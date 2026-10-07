"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  fsSync = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const {
  analyzeCloudSilence,
  createEnergyAnalyzer,
} = require("../src/main/cloud-silence");
function pcm(seconds, amplitudeAt = () => 0) {
  const result = Buffer.alloc(Math.round(seconds * 16000) * 4);
  for (let i = 0; i < result.length / 4; i++)
    result.writeFloatLE(
      amplitudeAt(i / 16000) * Math.sin((i * 2 * Math.PI * 200) / 16000),
      i * 4,
    );
  return result;
}
function analyze(bytes, sensitivity = 2) {
  const a = createEnergyAnalyzer({ sensitivity });
  for (let p = 0; p < bytes.length; p += 997)
    a.push(bytes.subarray(p, p + 997));
  return a.finish();
}
test("Measured stationary fan baseline and silence skip while quiet bursts respond to sensitivity", () => {
  const silence = analyze(pcm(2));
  assert.equal(silence.decision, "skip");
  assert.equal(silence.measurements.measuredBaselineRms, 0);
  assert.equal(silence.measurements.baselineRms, 0.0001);
  const fan = analyze(pcm(2, () => 0.014142));
  assert.equal(fan.decision, "skip");
  assert.ok(Math.abs(fan.measurements.measuredBaselineRms - 0.01) < 0.0001);
  assert.ok(Math.abs(fan.measurements.thresholdRms - 0.02) < 0.0002);
  const burst = pcm(2, (t) => (t > 0.8 && t < 1.2 ? 0.025 : 0.014142));
  assert.equal(analyze(burst, 1.2).decision, "upload");
  assert.equal(analyze(burst, 2).decision, "skip");
  const speechEnergy = pcm(2, (t) => (t > 0.8 && t < 1.2 ? 0.1 : 0.014142));
  assert.equal(analyze(speechEnergy).decision, "upload");
});
test("Numerical validation rejects malformed sensitivity/PCM and short audio stays conservative", async () => {
  for (const sensitivity of [NaN, Infinity, 0, 5.1, "2"])
    assert.throws(() => createEnergyAnalyzer({ sensitivity }), /finite number/);
  assert.equal(analyze(pcm(0.1)).decision, "upload");
  assert.equal(analyze(pcm(0.1)).complete, false);
  const invalid = Buffer.alloc(4);
  invalid.writeFloatLE(NaN);
  assert.throws(() => analyze(invalid), /Invalid normalized/);
  assert.throws(() => analyze(Buffer.alloc(3)), /Incomplete/);
  assert.equal(analyze(pcm(1, () => 2)).reason, "clipped-energy");
  await assert.rejects(
    analyzeCloudSilence("ignored", { enabled: false, sensitivity: NaN }),
    /finite number/,
  );
  let calls = 0;
  assert.equal(
    (
      await analyzeCloudSilence("ignored", {
        spawnProcess: () => {
          calls++;
        },
      })
    ).reason,
    "disabled",
  );
  assert.equal(calls, 0);
});
test("Long streaming analysis keeps fixed memory and handles irregular byte boundaries", () => {
  const analyzer = createEnergyAnalyzer(),
    chunk = pcm(1, () => 0.01),
    memory = analyzer.memoryBytes;
  for (let i = 0; i < 300; i++) {
    analyzer.push(chunk.subarray(0, 3));
    analyzer.push(chunk.subarray(3));
    assert.equal(analyzer.memoryBytes, memory);
  }
  const result = analyzer.finish();
  assert.equal(result.measurements.durationMs, 300000);
  assert.equal(result.decision, "skip");
  assert.ok(memory < 13000);
});
async function fixture(t) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "scribble-silence-test-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
function wav(bytes) {
  const frames = bytes.length / 4,
    buffer = Buffer.alloc(44 + frames * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24);
  buffer.writeUInt32LE(32000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++)
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, bytes.readFloatLE(i * 4))) * 32767),
      44 + i * 2,
    );
  return buffer;
}
let ffmpeg;
try {
  ffmpeg = require("../src/main/ffmpeg").ffmpegExecutable();
} catch {}
test(
  "Actual FFmpeg decodes synthetic silence/fan/burst without changing input files",
  { skip: !ffmpeg },
  async (t) => {
    const directory = await fixture(t);
    for (const [name, data, decision] of [
      ["silence", pcm(2), "skip"],
      ["fan", pcm(2, () => 0.014142), "skip"],
      ["burst", pcm(2, (t) => (t > 0.8 && t < 1.2 ? 0.1 : 0.014142)), "upload"],
    ]) {
      const file = path.join(directory, name + ".wav"),
        original = wav(data);
      await fs.writeFile(file, original);
      const value = await analyzeCloudSilence(file, {
        enabled: true,
        ffmpegPath: ffmpeg,
      });
      assert.equal(value.decision, decision, name);
      assert.equal(value.complete, true);
      assert.ok(value.measurements.durationMs >= 1999);
      assert.deepEqual(await fs.readFile(file), original);
    }
    const failed = await analyzeCloudSilence(path.join(directory, "missing"), {
      enabled: true,
      ffmpegPath: ffmpeg,
    });
    assert.equal(failed.decision, "upload");
    assert.equal(failed.complete, false);
    assert.equal(failed.reason, "decoder-failed");
  },
);
const jfk =
  process.env.SCRIBBLE_TEST_SILENCE_AUDIO ||
  "/tmp/scribble-intel-audit/speech/runtime/whisper.cpp/samples/jfk.wav";
test(
  "Public whisper.cpp JFK speech fixture retains above-baseline energy at default sensitivity",
  { skip: !ffmpeg || !fsSync.existsSync(jfk) },
  async () => {
    const value = await analyzeCloudSilence(jfk, {
      enabled: true,
      ffmpegPath: ffmpeg,
    });
    assert.equal(value.decision, "upload");
    assert.equal(value.complete, true);
    assert.ok(value.measurements.measuredBaselineRms > 0);
    assert.ok(value.measurements.aboveThresholdMs > 60);
  },
);
function processFixture(code, onChild) {
  return () => {
    const child = spawn(process.execPath, ["-e", code], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    onChild?.(child);
    return child;
  };
}
test("Cancellation waits for decoder cleanup and never returns a silence decision", async () => {
  const controller = new AbortController();
  let child;
  const promise = analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: process.execPath,
    signal: controller.signal,
    spawnProcess: processFixture("setInterval(()=>{},1000)", (c) => {
      child = c;
    }),
  });
  controller.abort();
  await assert.rejects(promise, { name: "AbortError" });
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  await assert.rejects(
    analyzeCloudSilence("ignored", { signal: controller.signal }),
    { name: "AbortError" },
  );
});
test("Timeout, incomplete output and decoder errors fail open instead of suppressing upload", async () => {
  let child;
  const timeout = await analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: process.execPath,
    timeoutMs: 25,
    spawnProcess: processFixture("setInterval(()=>{},1000)", (c) => {
      child = c;
    }),
  });
  assert.equal(timeout.reason, "analysis-timeout");
  assert.equal(timeout.decision, "upload");
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  const reported = await analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: process.execPath,
    spawnProcess: processFixture(
      'process.stderr.write("Decode error despite success exit");process.stdout.write(Buffer.alloc(16000*4))',
    ),
  });
  assert.equal(reported.reason, "decoder-reported-error");
  assert.equal(reported.decision, "upload");
  const incomplete = await analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: process.execPath,
    spawnProcess: processFixture("process.stdout.write(Buffer.alloc(3))"),
  });
  assert.equal(incomplete.reason, "incomplete-audio");
  assert.equal(incomplete.complete, false);
  const invalid = await analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: process.execPath,
    spawnProcess: processFixture(
      "const b=Buffer.alloc(4);b.writeFloatLE(NaN);process.stdout.write(b);setInterval(()=>{},1000)",
    ),
  });
  assert.equal(invalid.reason, "invalid-pcm");
  assert.equal(invalid.decision, "upload");
  const missing = await analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: "/nonexistent/scribble-ffmpeg",
  });
  assert.equal(missing.reason, "decoder-failed");
  assert.equal(missing.decision, "upload");
  const limited = await analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: process.execPath,
    maxDurationMs: 100,
    spawnProcess: processFixture(
      "process.stdout.write(Buffer.alloc(16000*4));setInterval(()=>{},1000)",
    ),
  });
  assert.equal(limited.reason, "analysis-duration-limit");
  assert.equal(limited.decision, "upload");
});
test("Cancellation escalates when decoder ignores TERM and removes the active child before rejection", async () => {
  const controller = new AbortController();
  let child, readyResolve;
  const ready = new Promise((resolve) => {
    readyResolve = resolve;
  });
  const pending = analyzeCloudSilence("fixture", {
    enabled: true,
    ffmpegPath: process.execPath,
    signal: controller.signal,
    spawnProcess: processFixture(
      "process.on('SIGTERM',()=>{});process.stderr.write('ready');setInterval(()=>{},1000)",
      (c) => {
        child = c;
        c.stderr.once("data", readyResolve);
      },
    ),
  });
  await ready;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(child.signalCode, "SIGKILL");
});
