"use strict";
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const MODEL_REVISION = "5359861c739e955e79d9a303bcbc70fb988958b1";
const MODELS = [
  [
    "tiny.en",
    77704715,
    "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f",
  ],
  [
    "tiny",
    77691713,
    "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
  ],
  [
    "base.en",
    147964211,
    "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002",
  ],
  [
    "base",
    147951465,
    "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
  ],
  [
    "small",
    487601967,
    "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
  ],
  [
    "medium",
    1533763059,
    "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208",
  ],
  [
    "large-v3",
    3095033483,
    "64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2",
  ],
  [
    "large-v3-turbo",
    1624555275,
    "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69",
  ],
].map(([id, bytes, sha256]) => ({
  id,
  bytes,
  sha256,
  name: id,
  englishOnly: id.endsWith(".en"),
}));
function defaultDataDir() {
  return (
    process.env.SCRIBBLE_DATA_DIR ||
    path.join(
      os.homedir(),
      process.platform === "darwin"
        ? "Library/Application Support/Scribble"
        : ".local/share/scribble",
    )
  );
}
function resolveExecutablePath(binary) {
  const unpacked = binary.replace(
    /([/\\])app\.asar([/\\])/,
    "$1app.asar.unpacked$2",
  );
  return unpacked !== binary && fs.existsSync(unpacked) ? unpacked : binary;
}
function model(id) {
  const m = MODELS.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown speech model: ${id}`);
  return m;
}
function run(binary, args, { onData, signal, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      signal,
      env: env ? { ...process.env, ...env } : process.env,
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (b) => {
        output = (output + b.toString()).slice(-100000);
        onData?.(b.toString());
      });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(
            new Error(
              `${path.basename(binary)} exited ${code}: ${output.slice(-4000)}`,
            ),
          ),
    );
  });
}
function parseWhisperJSON(data) {
  const segments = (data.transcription || []).map((s) => ({
    start: (s.offsets?.from || 0) / 1000,
    end: (s.offsets?.to || 0) / 1000,
    text: String(s.text || "").trim(),
  }));
  return {
    text: segments
      .map((s) => s.text)
      .join(" ")
      .trim(),
    segments,
    language: data.result?.language || data.params?.language || "unknown",
    duration: segments.at(-1)?.end || 0,
  };
}
class SpeechEngine extends EventEmitter {
  constructor({ dataDir = defaultDataDir() } = {}) {
    super();
    this.dataDir = dataDir;
    this.modelDir = path.join(dataDir, "models");
    this.downloads = new Map();
    this.active = null;
    const { ParakeetEngine } = require("./parakeet");
    this.parakeet = new ParakeetEngine({ dataDir });
    const { CatalogEngine, CATALOG_MODELS } = require("./catalog-engine");
    this.catalog = new CatalogEngine({ dataDir });
    this.catalogIds = new Set(CATALOG_MODELS.map((m) => m.id));
    for (const event of ["download-progress", "models-changed", "progress"])
      for (const engine of [this.parakeet, this.catalog])
        engine.on(event, (data) =>
          this.emit(
            event,
            event === "models-changed" ? this.listModels() : data,
          ),
        );
  }
  runtimePath() {
    return (
      process.env.SCRIBBLE_WHISPER_BIN ||
      (process.resourcesPath &&
      fs.existsSync(
        path.join(process.resourcesPath, "native/speech/whisper-cli"),
      )
        ? path.join(process.resourcesPath, "native/speech/whisper-cli")
        : null) ||
      path.join(
        this.dataDir,
        "runtime",
        "whisper.cpp",
        "build",
        "bin",
        process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli",
      )
    );
  }
  status() {
    return {
      ready: fs.existsSync(this.runtimePath()),
      runtime: this.runtimePath(),
      busy:
        !!this.active ||
        this.parakeet.status().busy ||
        this.catalog.status().busy,
      downloads: [
        ...this.downloads.keys(),
        ...this.parakeet.status().downloads,
        ...this.catalog.status().downloads,
      ],
      defaultModel: "base.en",
      parakeet: this.parakeet.status(),
      catalog: this.catalog.status(),
    };
  }
  listModels() {
    return MODELS.map((m) => ({
      ...m,
      installed: fs.existsSync(path.join(this.modelDir, `ggml-${m.id}.bin`)),
      downloading: this.downloads.has(m.id),
    })).concat(this.parakeet.listModels(), this.catalog.listModels());
  }
  async downloadModel(id) {
    if (this.catalogIds.has(id)) return this.catalog.downloadModel(id);
    if (id?.startsWith("parakeet-")) return this.parakeet.downloadModel(id);
    const m = model(id);
    if (this.downloads.has(id))
      throw new Error("This model is already downloading");
    await fsp.mkdir(this.modelDir, { recursive: true });
    const controller = new AbortController();
    this.downloads.set(id, controller);
    const target = path.join(this.modelDir, `ggml-${id}.bin`),
      tmp = `${target}.${crypto.randomUUID()}.part`;
    let handle;
    try {
      const response = await fetch(
        `https://huggingface.co/ggerganov/whisper.cpp/resolve/${MODEL_REVISION}/ggml-${id}.bin`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error(`Model download failed: HTTP ${response.status}`);
      handle = await fsp.open(tmp, "wx");
      const hash = crypto.createHash("sha256");
      let downloaded = 0;
      for await (const chunk of response.body) {
        controller.signal.throwIfAborted();
        await handle.write(chunk);
        hash.update(chunk);
        downloaded += chunk.length;
        this.emit("download-progress", {
          id,
          downloaded,
          total: m.bytes,
          progress: downloaded / m.bytes,
        });
      }
      await handle.close();
      handle = null;
      if (downloaded !== m.bytes || hash.digest("hex") !== m.sha256)
        throw new Error("Model failed SHA-256 verification");
      await fsp.rename(tmp, target);
      this.downloads.delete(id);
      this.emit("models-changed", this.listModels());
      return this.listModels().find((m) => m.id === id);
    } finally {
      await handle?.close();
      await fsp.rm(tmp, { force: true });
      this.downloads.delete(id);
    }
  }
  cancelDownload(id) {
    if (this.catalogIds.has(id)) return this.catalog.cancelDownload(id);
    if (id?.startsWith("parakeet-")) return this.parakeet.cancelDownload(id);
    model(id);
    this.downloads.get(id)?.abort();
  }
  async deleteModel(id) {
    if (this.catalogIds.has(id)) return this.catalog.deleteModel(id);
    if (id?.startsWith("parakeet-")) return this.parakeet.deleteModel(id);
    model(id);
    if (this.downloads.has(id))
      throw new Error("Cancel the download before removing the model");
    if (this.active?.modelId === id) throw new Error("This model is in use");
    await fsp.rm(path.join(this.modelDir, `ggml-${id}.bin`), { force: true });
    this.emit("models-changed", this.listModels());
  }
  cancelTranscription() {
    this.active?.controller.abort();
    this.parakeet.cancelTranscription();
    this.catalog.cancelTranscription();
  }
  async transcribe(
    filePath,
    {
      modelId = "base.en",
      language = "auto",
      translate = false,
      prompt = "",
      threads = Math.min(8, os.availableParallelism()),
    } = {},
  ) {
    if (
      this.active ||
      this.parakeet.status().busy ||
      this.catalog.status().busy
    )
      throw new Error("A transcription is already running");
    if (this.catalogIds.has(modelId))
      return this.catalog.transcribe(filePath, {
        modelId,
        language,
        translate,
        prompt,
        threads,
      });
    if (modelId?.startsWith("parakeet-"))
      return this.parakeet.transcribe(filePath, {
        modelId,
        language,
        translate,
        prompt,
        threads,
      });
    const m = model(modelId);
    if (this.active || this.parakeet.status().busy)
      throw new Error("A transcription is already running");
    if (!this.status().ready)
      throw new Error("Speech runtime is missing. Run npm run setup:speech.");
    const modelPath = path.join(this.modelDir, `ggml-${modelId}.bin`);
    await fsp.access(modelPath);
    if (typeof filePath !== "string" || !path.isAbsolute(filePath))
      throw new Error("Audio path must be absolute");
    await fsp.access(filePath);
    if (typeof language !== "string" || !/^(auto|[a-z]{2,3})$/.test(language))
      throw new Error("Invalid language");
    if (!Number.isInteger(threads) || threads < 1 || threads > 128)
      throw new Error("Threads must be between 1 and 128");
    if (typeof prompt !== "string" || prompt.length > 10000)
      throw new Error("Invalid transcription prompt");
    const controller = new AbortController();
    this.active = { controller, modelId };
    let temp;
    try {
      temp = await fsp.mkdtemp(path.join(os.tmpdir(), "scribble-speech-"));
      const wav = path.join(temp, "audio.wav"),
        out = path.join(temp, "result");
      const ffmpeg = require("./ffmpeg").ffmpegExecutable({resourcesPath: this.resourcesPath});
      this.emit("progress", { stage: "decoding", progress: 0 });
      await run(
        resolveExecutablePath(ffmpeg),
        [
          "-nostdin",
          "-y",
          "-i",
          filePath,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "pcm_s16le",
          wav,
        ],
        { signal: controller.signal },
      );
      const args = [
        "-m",
        modelPath,
        "-f",
        wav,
        "-oj",
        "-of",
        out,
        "-l",
        m.englishOnly ? "en" : language,
        "-t",
        String(threads),
        "-pp",
      ];
      if (translate) args.push("-tr");
      if (prompt) args.push("--prompt", prompt);
      this.emit("progress", { stage: "transcribing", progress: 0 });
      await run(this.runtimePath(), args, {
        signal: controller.signal,
        onData: (text) => {
          for (const match of text.matchAll(/progress\s*=\s*(\d+)%/g))
            this.emit("progress", {
              stage: "transcribing",
              progress: Number(match[1]) / 100,
            });
        },
      });
      const result = parseWhisperJSON(
        JSON.parse(await fsp.readFile(`${out}.json`, "utf8")),
      );
      this.emit("progress", { stage: "complete", progress: 1 });
      return result;
    } finally {
      this.active = null;
      if (temp) await fsp.rm(temp, { recursive: true, force: true });
    }
  }
}
module.exports = {
  SpeechEngine,
  MODELS,
  MODEL_REVISION,
  defaultDataDir,
  parseWhisperJSON,
  resolveExecutablePath,
  run,
};
