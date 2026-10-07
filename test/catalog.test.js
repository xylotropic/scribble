const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  CatalogEngine,
  CATALOG_MODELS,
  getCatalogManifest,
} = require("../src/main/catalog-engine");
test("catalog pins four distinct upstream engine families with exact licenses and per-file hashes", () => {
  assert.deepEqual(
    CATALOG_MODELS.map((m) => m.id),
    ["parakeet-ja", "parakeet-zh", "nemotron-en", "nemotron-multilingual"],
  );
  for (const model of CATALOG_MODELS) {
    const manifest = getCatalogManifest(model.id);
    assert.match(manifest.revision, /^[a-f0-9]{40}$/);
    assert.ok(manifest.files.length > 10);
    assert.ok(
      manifest.files.every(
        (f) => f.bytes > 0 && !f.path.includes("..") && (f.sha256 || f.gitBlob),
      ),
    );
    assert.ok(model.licenseURL.startsWith("https://"));
  }
  assert.equal(
    getCatalogManifest("nemotron-en").license,
    "NVIDIA-Open-Model-License",
  );
  assert.equal(
    getCatalogManifest("nemotron-multilingual").license,
    "OpenMDW-1.1",
  );
  assert.throws(() => getCatalogManifest("../model"), /Unknown/);
});
test("catalog registry distinguishes installed models from native runtime readiness", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "scribble-catalog-test-"),
  );
  try {
    const e = new CatalogEngine({ dataDir: dir });
    assert.equal(e.status().ready, false);
    assert.ok(e.listModels().every((m) => !m.installed));
    await assert.rejects(
      e.transcribe("/missing.wav", { modelId: "nemotron-en" }),
      /runtime is missing/,
    );
    await assert.rejects(
      e.transcribe("/missing.wav", { modelId: "parakeet-ja", translate: true }),
      /Whisper/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("catalog refuses same-size corrupted source artifact and removes partial data", async () => {
  if (process.platform !== "darwin" || process.arch !== "arm64") return;
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "scribble-catalog-test-"),
  );
  const original = global.fetch;
  global.fetch = async () => ({
    ok: true,
    body: (async function* () {
      yield Buffer.alloc(getCatalogManifest("parakeet-ja").files[0].bytes);
    })(),
  });
  try {
    const e = new CatalogEngine({ dataDir: dir });
    await assert.rejects(e.downloadModel("parakeet-ja"), /integrity/);
    assert.equal(e.status().downloads.length, 0);
    assert.deepEqual(await fs.readdir(path.join(dir, "models")), []);
  } finally {
    global.fetch = original;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test(
  "actual catalog model fixture (opt-in)",
  { skip: !process.env.SCRIBBLE_TEST_CATALOG_AUDIO },
  async () => {
    const { defaultDataDir, SpeechEngine } = require("../src/main/speech");
    const e = new SpeechEngine({ dataDir: defaultDataDir() });
    const result = await e.transcribe(
      path.resolve(process.env.SCRIBBLE_TEST_CATALOG_AUDIO),
      {
        modelId: process.env.SCRIBBLE_TEST_CATALOG_MODEL || "nemotron-en",
        language: process.env.SCRIBBLE_TEST_CATALOG_LANGUAGE || "auto",
      },
    );
    assert.ok(result.text.length > 0);
    assert.ok(result.segments.length > 0);
    assert.ok(result.duration > 0);
    assert.ok(
      result.segments.every(
        (s) =>
          s.start >= 0 && s.end >= s.start && s.end <= result.duration + 0.001,
      ),
    );
    if (process.env.SCRIBBLE_TEST_CATALOG_EXACT) {
      const normalize = (s) => s.replace(/[\p{P}\s]/gu, "").toLowerCase();
      assert.equal(
        normalize(result.text),
        normalize(process.env.SCRIBBLE_TEST_CATALOG_EXACT),
      );
    }
    if (process.env.SCRIBBLE_TEST_CATALOG_EXPECT)
      assert.ok(
        result.text
          .replace(/\s/g, "")
          .toLowerCase()
          .includes(
            process.env.SCRIBBLE_TEST_CATALOG_EXPECT.replace(
              /\s/g,
              "",
            ).toLowerCase(),
          ),
      );
  },
);

test("SpeechEngine routes catalog IDs and resolves actual packaged runtimes", async () => {
  const { SpeechEngine } = require("../src/main/speech");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scribble-packaged-"));
  const previous = Object.getOwnPropertyDescriptor(process, "resourcesPath");
  const envNames = [
    "SCRIBBLE_WHISPER_BIN",
    "SCRIBBLE_PARAKEET_BIN",
    "SCRIBBLE_CATALOG_BIN",
  ];
  const saved = envNames.map((name) => process.env[name]);
  try {
    for (const name of envNames) delete process.env[name];
    for (const relative of [
      "native/speech/whisper-cli",
      "native/parakeet/ScribbleParakeet",
      "native/parakeet/ScribbleCatalog",
    ]) {
      await fs.mkdir(path.dirname(path.join(dir, relative)), {
        recursive: true,
      });
      await fs.writeFile(path.join(dir, relative), "fixture");
    }
    Object.defineProperty(process, "resourcesPath", {
      configurable: true,
      value: dir,
    });
    const engine = new SpeechEngine({ dataDir: dir });
    assert.equal(
      engine.runtimePath(),
      path.join(dir, "native/speech/whisper-cli"),
    );
    assert.equal(
      engine.parakeet.runtimePath(),
      path.join(dir, "native/parakeet/ScribbleParakeet"),
    );
    assert.equal(
      engine.catalog.runtimePath(),
      path.join(dir, "native/parakeet/ScribbleCatalog"),
    );
    for (const method of ["downloadModel", "cancelDownload", "deleteModel"]) {
      engine.catalog[method] = (id) => `catalog:${id}`;
      assert.equal(await engine[method]("parakeet-ja"), "catalog:parakeet-ja");
    }
    engine.catalog.transcribe = (_, options) => options.modelId;
    assert.equal(
      await engine.transcribe("/fixture", { modelId: "nemotron-en" }),
      "nemotron-en",
    );
    engine.parakeet.transcribe = (_, options) => options.modelId;
    assert.equal(
      await engine.transcribe("/fixture", { modelId: "parakeet-v3" }),
      "parakeet-v3",
    );
  } finally {
    if (previous) Object.defineProperty(process, "resourcesPath", previous);
    else delete process.resourcesPath;
    envNames.forEach((name, i) => {
      if (saved[i] === undefined) delete process.env[name];
      else process.env[name] = saved[i];
    });
    await fs.rm(dir, { recursive: true, force: true });
  }
});
