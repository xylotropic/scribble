const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {
  SpeechEngine,
  parseWhisperJSON,
  MODELS,
} = require("../src/main/speech");
test("whisper output preserves exact millisecond timing and detected language", () => {
  assert.deepEqual(
    parseWhisperJSON({
      result: { language: "es" },
      transcription: [
        { offsets: { from: 120, to: 2540 }, text: " Hola " },
        { offsets: { from: 3000, to: 5000 }, text: "mundo" },
      ],
    }),
    {
      text: "Hola mundo",
      segments: [
        { start: 0.12, end: 2.54, text: "Hola" },
        { start: 3, end: 5, text: "mundo" },
      ],
      language: "es",
      duration: 5,
    },
  );
});
test("model identifiers cannot escape data directory", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "scribble-test-"));
  try {
    const engine = new SpeechEngine({ dataDir });
    await assert.rejects(engine.downloadModel("../bad"), /Unknown/);
    await assert.rejects(engine.deleteModel("../bad"), /Unknown/);
    assert.equal(engine.status().ready, false);
    assert.equal(engine.listModels().length, 9);
    assert.ok(MODELS.every((m) => /^[0-9a-f]{64}$/.test(m.sha256)));
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
test("cancelled download cleans temporary file", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "scribble-test-"));
  const original = global.fetch;
  let engine;
  global.fetch = async () => ({
    ok: true,
    body: (async function* () {
      yield Buffer.from("partial");
      engine.cancelDownload("tiny");
      yield Buffer.from("more");
    })(),
  });
  try {
    engine = new SpeechEngine({ dataDir });
    await assert.rejects(engine.downloadModel("tiny"), /abort/i);
    assert.equal(engine.status().downloads.length, 0);
    assert.equal(
      engine.listModels().find((m) => m.id === "tiny").installed,
      false,
    );
    const { readdir } = require("node:fs/promises");
    assert.deepEqual(await readdir(engine.modelDir), []);
  } finally {
    global.fetch = original;
    await rm(dataDir, { recursive: true, force: true });
  }
});
test(
  "real speech fixture integration (opt-in)",
  { skip: !process.env.SCRIBBLE_TEST_AUDIO },
  async () => {
    const engine = new SpeechEngine();
    const result = await engine.transcribe(
      path.resolve(process.env.SCRIBBLE_TEST_AUDIO),
      { modelId: process.env.SCRIBBLE_TEST_MODEL || "tiny.en" },
    );
    assert.ok(result.text.length > 10);
    assert.ok(result.segments.length > 0);
    assert.ok(result.segments.every((s) => s.end >= s.start));
    if (process.env.SCRIBBLE_TEST_EXPECT)
      assert.ok(
        result.text
          .toLowerCase()
          .includes(process.env.SCRIBBLE_TEST_EXPECT.toLowerCase()),
      );
  },
);
test("packaged FFmpeg resolves to a real executable outside the asar archive", async () => {
  if (process.platform === "win32") return;
  const { writeFile, mkdir, chmod } = require("node:fs/promises");
  const { resolveExecutablePath, run } = require("../src/main/speech");
  const dir = await mkdtemp(path.join(os.tmpdir(), "scribble-asar-test-"));
  try {
    await writeFile(path.join(dir, "app.asar"), "synthetic archive");
    const executable = path.join(
      dir,
      "app.asar.unpacked",
      "node_modules",
      "ffmpeg",
      "ffmpeg",
    );
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(
      executable,
      '#!/bin/sh\nprintf "unpacked ffmpeg executable"\n',
    );
    await chmod(executable, 0o755);
    const virtual = path.join(
      dir,
      "app.asar",
      "node_modules",
      "ffmpeg",
      "ffmpeg",
    );
    assert.equal(resolveExecutablePath(virtual), executable);
    assert.equal(
      await run(resolveExecutablePath(virtual), []),
      "unpacked ffmpeg executable",
    );
    const missing = path.join(dir, "app.asar", "missing");
    assert.equal(resolveExecutablePath(missing), missing);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
