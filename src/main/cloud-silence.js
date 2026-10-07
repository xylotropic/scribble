"use strict";
const { spawn } = require("node:child_process");
const SAMPLE_RATE = 16000,
  WINDOW_SAMPLES = 320,
  WINDOW_MS = 20,
  BINS = 512;
const RMS_FLOOR = 0.0001,
  MIN_DURATION_MS = 250,
  MIN_ACTIVITY_MS = 60;
function abortError() {
  return Object.assign(new Error("Cloud audio analysis cancelled"), {
    name: "AbortError",
  });
}
function validateSensitivity(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 1 ||
    value > 5
  )
    throw new RangeError(
      "Cloud silence sensitivity must be a finite number from 1 to 5",
    );
  return value;
}
// A fixed-size, time-weighted log histogram estimates the lower-energy baseline.
// The gate measures energy variation, not the presence or intelligibility of speech.
function createEnergyAnalyzer({ sensitivity = 2 } = {}) {
  validateSensitivity(sensitivity);
  const weights = new Float64Array(BINS),
    rmsSums = new Float64Array(BINS),
    maxima = new Float64Array(BINS);
  let samples = 0,
    windowCount = 0,
    count = 0,
    squares = 0,
    peakSample = 0,
    peakRms = 0,
    tail = Buffer.alloc(0),
    finished = false;
  function window() {
    if (!count) return;
    const rms = Math.sqrt(squares / count),
      db = rms > 0 ? 20 * Math.log10(rms) : -100,
      bin = Math.max(
        0,
        Math.min(BINS - 1, Math.floor(((db + 100) / 100) * BINS)),
      );
    weights[bin] += count;
    rmsSums[bin] += rms * count;
    maxima[bin] = Math.max(maxima[bin], rms);
    peakRms = Math.max(peakRms, rms);
    windowCount++;
    count = 0;
    squares = 0;
  }
  function push(chunk) {
    if (finished) throw Error("Audio analyzer has already finished");
    if (!Buffer.isBuffer(chunk)) throw TypeError("PCM input must be a Buffer");
    let offset = 0;
    function sample(value) {
      if (!Number.isFinite(value) || Math.abs(value) > 8)
        throw Error("Invalid normalized PCM sample");
      squares += value * value;
      peakSample = Math.max(peakSample, Math.abs(value));
      count++;
      samples++;
      if (count === WINDOW_SAMPLES) window();
    }
    if (tail.length) {
      const needed = 4 - tail.length;
      if (chunk.length < needed) {
        tail = Buffer.concat([tail, chunk]);
        return;
      }
      sample(Buffer.concat([tail, chunk.subarray(0, needed)]).readFloatLE(0));
      offset = needed;
      tail = Buffer.alloc(0);
    }
    const end = chunk.length - ((chunk.length - offset) % 4);
    for (; offset < end; offset += 4) sample(chunk.readFloatLE(offset));
    if (offset < chunk.length) tail = Buffer.from(chunk.subarray(offset));
  }
  function finish() {
    if (finished) throw Error("Audio analyzer has already finished");
    finished = true;
    if (tail.length) throw Error("Incomplete PCM sample at end of audio");
    window();
    const durationMs = (samples / SAMPLE_RATE) * 1000;
    let cumulative = 0,
      baselineBin = 0;
    for (; baselineBin < BINS - 1; baselineBin++) {
      cumulative += weights[baselineBin];
      if (cumulative >= samples * 0.2) break;
    }
    const measuredBaselineRms = weights[baselineBin]
      ? rmsSums[baselineBin] / weights[baselineBin]
      : 0;
    const baselineRms = Math.max(RMS_FLOOR, measuredBaselineRms),
      thresholdRms = baselineRms * sensitivity;
    // Counting a whole bin if its maximum clears the threshold errs toward upload.
    let activitySamples = 0;
    for (let bin = 0; bin < BINS; bin++)
      if (maxima[bin] > thresholdRms) activitySamples += weights[bin];
    const aboveThresholdMs = (activitySamples / SAMPLE_RATE) * 1000;
    const measurements = {
      durationMs,
      windowMs: WINDOW_MS,
      windowCount,
      measuredBaselineRms,
      baselineRms,
      baselineDb: 20 * Math.log10(baselineRms),
      thresholdRms,
      sensitivity,
      aboveThresholdMs,
      minimumActivityMs: MIN_ACTIVITY_MS,
      peakRms,
      peakSample,
      histogramBins: BINS,
    };
    if (durationMs < MIN_DURATION_MS)
      return {
        decision: "upload",
        complete: false,
        reason: "insufficient-audio",
        measurements,
      };
    if (peakSample > 1)
      return {
        decision: "upload",
        complete: true,
        reason: "clipped-energy",
        measurements,
      };
    return {
      decision: aboveThresholdMs >= MIN_ACTIVITY_MS ? "upload" : "skip",
      complete: true,
      reason:
        aboveThresholdMs >= MIN_ACTIVITY_MS
          ? "above-threshold-energy"
          : "below-threshold-energy",
      measurements,
    };
  }
  return {
    push,
    finish,
    get durationMs() {
      return (samples / SAMPLE_RATE) * 1000;
    },
    get memoryBytes() {
      return (
        weights.byteLength +
        rmsSums.byteLength +
        maxima.byteLength +
        tail.length
      );
    },
  };
}
async function analyzeCloudSilence(
  file,
  {
    enabled = false,
    sensitivity = 2,
    signal,
    ffmpegPath,
    timeoutMs = 120000,
    maxDurationMs = 21600000,
    spawnProcess = spawn,
  } = {},
) {
  validateSensitivity(sensitivity);
  if (typeof enabled !== "boolean")
    throw TypeError("Cloud silence enabled must be a boolean");
  if (signal?.aborted) throw abortError();
  if (!enabled)
    return {
      decision: "upload",
      complete: false,
      reason: "disabled",
      measurements: null,
    };
  if (typeof file !== "string" || !file)
    throw TypeError("An audio file path is required");
  for (const [key, value] of Object.entries({ timeoutMs, maxDurationMs }))
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
      throw new RangeError(`${key} must be a positive finite number`);
  let binary;
  try {
    binary = ffmpegPath || require("./ffmpeg").ffmpegExecutable();
  } catch (error) {
    return {
      decision: "upload",
      complete: false,
      reason: "decoder-unavailable",
      measurements: null,
      diagnostic: error.message,
    };
  }
  const analyzer = createEnergyAnalyzer({ sensitivity });
  return new Promise((resolve, reject) => {
    let child,
      reason = null,
      diagnostic = "",
      closed = false,
      escalation,
      timer;
    const failOpen = (why) => ({
      decision: "upload",
      complete: false,
      reason: why,
      measurements: { durationMs: analyzer.durationMs },
      ...(diagnostic ? { diagnostic: diagnostic.slice(-2000) } : {}),
    });
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(escalation);
      signal?.removeEventListener("abort", cancel);
    };
    const stop = (why) => {
      if (closed || reason) return;
      reason = why;
      child?.kill("SIGTERM");
      escalation = setTimeout(() => {
        if (!closed) child?.kill("SIGKILL");
      }, 500);
      escalation.unref?.();
    };
    const cancel = () => stop("cancelled");
    try {
      child = spawnProcess(
        binary,
        [
          "-nostdin",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          file,
          "-map",
          "0:a:0",
          "-vn",
          "-ac",
          "1",
          "-ar",
          String(SAMPLE_RATE),
          "-codec:a",
          "pcm_f32le",
          "-f",
          "f32le",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      diagnostic = error.message;
      resolve(failOpen("decoder-failed"));
      return;
    }
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    timer = setTimeout(() => stop("analysis-timeout"), timeoutMs);
    timer.unref?.();
    child.stdout.on("data", (chunk) => {
      if (reason) return;
      try {
        analyzer.push(chunk);
        if (analyzer.durationMs > maxDurationMs)
          stop("analysis-duration-limit");
      } catch (error) {
        diagnostic = error.message;
        stop("invalid-pcm");
      }
    });
    child.stderr.on("data", (chunk) => {
      diagnostic = (diagnostic + chunk.toString()).slice(-2000);
    });
    for (const stream of [child.stdout, child.stderr])
      stream.once("error", (error) => {
        diagnostic = error.message;
        stop("decoder-stream-error");
      });
    child.once("error", (error) => {
      diagnostic = error.message;
      if (!reason) reason = "decoder-failed";
    });
    child.once("close", (code) => {
      closed = true;
      cleanup();
      if (reason === "cancelled" || signal?.aborted) {
        reject(abortError());
        return;
      }
      if (reason) {
        resolve(failOpen(reason));
        return;
      }
      if (code !== 0) {
        resolve(failOpen("decoder-failed"));
        return;
      }
      if (diagnostic.trim()) {
        resolve(failOpen("decoder-reported-error"));
        return;
      }
      try {
        resolve(analyzer.finish());
      } catch (error) {
        diagnostic = error.message;
        resolve(failOpen("incomplete-audio"));
      }
    });
  });
}
module.exports = { analyzeCloudSilence, createEnergyAnalyzer };
