"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { prepareCloudAudio } = require("../src/main/cloud-input");
test("Cloud preparation produces mono MP3 and measured duration; explicit cleanup removes every byte", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "scribble-input-test-"),
  );
  try {
    const frames = 16000 * 2;
    const wav = Buffer.alloc(44 + frames * 2);
    wav.write("RIFF");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24);
    wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(frames * 2, 40);
    for (let i = 0; i < frames; i++)
      wav.writeInt16LE(
        Math.round(4000 * Math.sin((i * 2 * Math.PI * 440) / 16000)),
        44 + i * 2,
      );
    const input = path.join(directory, "fixture.wav");
    await fs.writeFile(input, wav);
    const output = await prepareCloudAudio(input);
    try {
      assert.ok(
        output.duration >= 1.9 && output.duration <= 2.2,
        String(output.duration),
      );
      assert.ok((await fs.stat(output.filePath)).size > 1000);
      assert.deepEqual(await fs.readFile(input), wav);
    } finally {
      await output.cleanup();
    }
    await assert.rejects(fs.stat(output.filePath), { code: "ENOENT" });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
