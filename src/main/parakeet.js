"use strict";
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const manifests = require("../../native/Parakeet/models.json");
const PARAKEET_MODELS = Object.entries(manifests).map(([version, m]) => ({
  id: `parakeet-${version}`,
  name: `Parakeet ${version}`,
  engine: "parakeet",
  englishOnly: version === "v2",
  supportedLanguages: version === "v2" ? ["en"] : "bg hr cs da nl en et fi fr de el hu it lv lt mt pl pt ro sk sl es sv ru uk".split(" "),
  bytes: m.files.reduce((n, f) => n + f.bytes, 0),
  license: "CC-BY-4.0",
  supported: process.platform === "darwin" && process.arch === "arm64",
}));
function getManifest(id) {
  const version = id?.replace("parakeet-", "");
  if (!manifests[version]) throw new Error(`Unknown Parakeet model: ${id}`);
  return manifests[version];
}
class ParakeetEngine extends EventEmitter {
  constructor({ dataDir }) {
    super();
    this.dataDir = dataDir;
    this.downloads = new Map();
    this.active = null;
  }
  runtimePath() {
    return (
      process.env.SCRIBBLE_PARAKEET_BIN ||
      (process.resourcesPath &&
      fs.existsSync(
        path.join(process.resourcesPath, "native/parakeet/ScribbleParakeet"),
      )
        ? path.join(process.resourcesPath, "native/parakeet/ScribbleParakeet")
        : null) ||
      path.join(this.dataDir, "runtime/parakeet/ScribbleParakeet")
    );
  }
  modelPath(id) {
    getManifest(id);
    return path.join(this.dataDir, "models", id);
  }
  status() {
    return {
      ready:
        process.platform === "darwin" &&
        process.arch === "arm64" &&
        fs.existsSync(this.runtimePath()),
      runtime: this.runtimePath(),
      busy: !!this.active,
      downloads: [...this.downloads.keys()],
    };
  }
  listModels() {
    return PARAKEET_MODELS.map((m) => ({
      ...m,
      installed: fs.existsSync(
        path.join(this.modelPath(m.id), "scribble-verified.json"),
      ),
      downloading: this.downloads.has(m.id),
      runtimeReady: this.status().ready,
    }));
  }
  async downloadModel(id) {
    const manifest = getManifest(id);
    if (this.active?.modelId === id) throw new Error("This model is in use");
    if (process.platform !== "darwin" || process.arch !== "arm64")
      throw new Error(
        "Parakeet requires Apple Silicon macOS; use Whisper on this machine",
      );
    if (this.downloads.has(id))
      throw new Error("This model is already downloading");
    const controller = new AbortController();
    this.downloads.set(id, controller);
    const target = this.modelPath(id),
      temp = `${target}.${crypto.randomUUID()}.part`;
    let downloaded = 0;
    const total = manifest.files.reduce((n, f) => n + f.bytes, 0);
    try {
      await fsp.mkdir(temp, { recursive: true });
      for (const file of manifest.files) {
        controller.signal.throwIfAborted();
        const response = await fetch(
          `https://huggingface.co/${manifest.repo}/resolve/${manifest.revision}/${file.path}`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error(`Parakeet download failed: HTTP ${response.status}`);
        const dest = path.join(temp, file.path);
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        const handle = await fsp.open(dest, "wx");
        const hash = crypto.createHash(file.sha256 ? "sha256" : "sha1");
        if (!file.sha256) hash.update(`blob ${file.bytes}\0`);
        let size = 0;
        try {
          for await (const chunk of response.body) {
            controller.signal.throwIfAborted();
            await handle.write(chunk);
            hash.update(chunk);
            size += chunk.length;
            downloaded += chunk.length;
            this.emit("download-progress", {
              id,
              downloaded,
              total,
              progress: downloaded / total,
            });
          }
        } finally {
          await handle.close();
        }
        if (
          size !== file.bytes ||
          hash.digest("hex") !== (file.sha256 || file.gitBlob)
        )
          throw new Error(
            `Parakeet integrity verification failed: ${file.path}`,
          );
      }
      await fsp.writeFile(
        path.join(temp, "scribble-verified.json"),
        JSON.stringify({
          repo: manifest.repo,
          revision: manifest.revision,
          verifiedAt: new Date().toISOString(),
        }),
      );
      await fsp.rm(target, { recursive: true, force: true });
      await fsp.rename(temp, target);
      this.downloads.delete(id);
      this.emit("models-changed", this.listModels());
      return this.listModels().find((m) => m.id === id);
    } finally {
      this.downloads.delete(id);
      await fsp.rm(temp, { recursive: true, force: true });
    }
  }
  cancelDownload(id) {
    getManifest(id);
    this.downloads.get(id)?.abort();
  }
  async deleteModel(id) {
    getManifest(id);
    if (this.active?.modelId === id || this.downloads.has(id))
      throw new Error("This model is in use");
    await fsp.rm(this.modelPath(id), { recursive: true, force: true });
    this.emit("models-changed", this.listModels());
  }
  cancelTranscription() {
    this.active?.controller.abort();
  }
  async transcribe(
    filePath,
    { modelId = "parakeet-v3", language = "auto", translate = false } = {},
  ) {
    getManifest(modelId);
    if (translate)
      throw new Error(
        "Parakeet transcribes speech in its original language. Choose Whisper for translation.",
      );
    if (!this.status().ready)
      throw new Error(
        "Parakeet runtime is missing. Run npm run setup:parakeet on Apple Silicon macOS.",
      );
    if (this.active) throw new Error("A transcription is already running");
    if (typeof filePath !== "string" || !path.isAbsolute(filePath))
      throw new Error("Audio path must be absolute");
    if (!/^(auto|[a-z]{2,3})$/.test(language))
      throw new Error("Invalid language");
    await fsp.access(
      path.join(this.modelPath(modelId), "scribble-verified.json"),
    );
    const controller = new AbortController();
    this.active = { modelId, controller };
    let temp;
    try {
      temp = await fsp.mkdtemp(path.join(os.tmpdir(), "scribble-parakeet-"));
      const wav = path.join(temp, "audio.wav"),
        out = path.join(temp, "result.json");
      const { run, resolveExecutablePath } = require("./speech");
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
      this.emit("progress", { stage: "transcribing", progress: 0 });
      await run(
        this.runtimePath(),
        [
          this.modelPath(modelId),
          modelId.replace("parakeet-", ""),
          wav,
          out,
          language,
        ],
        { signal: controller.signal },
      );
      const result = JSON.parse(await fsp.readFile(out, "utf8"));
      this.emit("progress", { stage: "complete", progress: 1 });
      return result;
    } finally {
      this.active = null;
      if (temp) await fsp.rm(temp, { recursive: true, force: true });
    }
  }
}
module.exports = { ParakeetEngine, PARAKEET_MODELS, getManifest };
