const test = require("node:test");
const assert = require("node:assert/strict");
const { parseFileCommand } = require("../src/main/file-command");
test("literal conversion commands select explicit file formats", () => {
  assert.deepEqual(parseFileCommand("Make this a PNG"), {
    operation: "image-convert",
    options: { format: "png" },
  });
  assert.deepEqual(parseFileCommand("convert audio to mp3"), {
    operation: "audio-convert",
    options: { format: "mp3" },
  });
  assert.equal(
    parseFileCommand("convert configuration to toml").operation,
    "config-convert",
  );
  assert.equal(
    parseFileCommand("convert video to webm").operation,
    "video-convert",
  );
});
test("deterministic utilities cover only supported literal intents", () => {
  for (const [command, operation] of [
    ["compress this image", "image-compress"],
    ["merge these PDFs", "pdf-merge"],
    ["zip these files", "archive-create"],
    ["unzip this archive", "archive-extract"],
    ["convert text to markdown", "text-markdown"],
    ["export markdown as PDF", "markdown-pdf"],
    ["extract a color palette from this image", "image-palette"],
  ])
    assert.equal(parseFileCommand(command)?.operation, operation);
  for (const command of [
    "delete all files",
    "convert this to exe",
    "zip files; rm -rf /",
    "please do something with the image",
    "make this png and upload it",
  ])
    assert.equal(parseFileCommand(command), null);
});
