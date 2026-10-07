const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  ParakeetEngine,
  PARAKEET_MODELS,
  getManifest,
} = require("../src/main/parakeet");
test("Parakeet download manifests pin upstream revision and verify every blob", () => {
  assert.equal(PARAKEET_MODELS.length, 2);
  for (const m of PARAKEET_MODELS) {
    const manifest = getManifest(m.id);
    assert.match(manifest.revision, /^[0-9a-f]{40}$/);
    assert.ok(manifest.files.length >= 20);
    assert.ok(
      manifest.files.every(
        (f) => !f.path.includes("..") && f.bytes > 0 && (f.sha256 || f.gitBlob),
      ),
    );
    assert.equal(m.license, "CC-BY-4.0");
  }
  assert.throws(() => getManifest("../model"), /Unknown/);
});
test("missing Parakeet runtime is separate from model install status", async () => {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "scribble-parakeet-test-"),
  );
  try {
    const e = new ParakeetEngine({ dataDir });
    assert.equal(e.status().ready, false);
    assert.ok(e.listModels().every((m) => !m.installed));
    await assert.rejects(e.transcribe("/missing.wav"), /runtime is missing/);
    await assert.rejects(
      e.transcribe("/missing.wav", { translate: true }),
      /Choose Whisper/,
    );
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
test(
  "real Parakeet transcription (opt-in)",
  { skip: !process.env.SCRIBBLE_TEST_PARAKEET_AUDIO },
  async () => {
    const { defaultDataDir } = require("../src/main/speech");
    const e = new ParakeetEngine({ dataDir: defaultDataDir() });
    const result = await e.transcribe(
      path.resolve(process.env.SCRIBBLE_TEST_PARAKEET_AUDIO),
      {
        modelId: process.env.SCRIBBLE_TEST_PARAKEET_MODEL || "parakeet-v3",
        language: "en",
      },
    );
    assert.match(result.text, /country/i);
    assert.ok(result.duration > 10);
    assert.ok(result.segments.every((s) => s.end >= s.start));
  },
);
test("cancelled Parakeet download removes partial CoreML artifacts", async () => {
  if (process.platform !== "darwin" || process.arch !== "arm64") return;
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "scribble-parakeet-test-"),
  );
  const original = global.fetch;
  let e;
  global.fetch = async () => ({
    ok: true,
    body: (async function* () {
      yield Buffer.from("partial");
      e.cancelDownload("parakeet-v3");
      yield Buffer.from("more");
    })(),
  });
  try {
    e = new ParakeetEngine({ dataDir });
    await assert.rejects(e.downloadModel("parakeet-v3"), /abort/i);
    assert.equal(e.status().downloads.length, 0);
    assert.equal(
      e.listModels().find((m) => m.id === "parakeet-v3").installed,
      false,
    );
    assert.deepEqual(await fs.readdir(path.join(dataDir, "models")), []);
  } finally {
    global.fetch = original;
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
test("same-size corrupt CoreML artifact fails integrity verification", async () => {
  if (process.platform !== "darwin" || process.arch !== "arm64") return;
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "scribble-parakeet-test-"),
  );
  const original = global.fetch;
  const first = getManifest("parakeet-v3").files[0];
  global.fetch = async () => ({
    ok: true,
    body: (async function* () {
      yield Buffer.alloc(first.bytes);
    })(),
  });
  try {
    const e = new ParakeetEngine({ dataDir });
    await assert.rejects(
      e.downloadModel("parakeet-v3"),
      /integrity verification failed/,
    );
    assert.equal(
      e.listModels().find((m) => m.id === "parakeet-v3").installed,
      false,
    );
    assert.deepEqual(await fs.readdir(path.join(dataDir, "models")), []);
  } finally {
    global.fetch = original;
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
