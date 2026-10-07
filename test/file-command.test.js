const test = require("node:test");
const assert = require("node:assert/strict");
const { parseFileCommand } = require("../src/main/file-command");
test("compression quality and plural extraction route to actual batch utilities", () => {
  assert.deepEqual(parseFileCommand("Compress these images to 70 percent"), {operation:"image-compress",options:{quality:70}});
  assert.deepEqual(parseFileCommand("optimize this photo at 100%"), {operation:"image-compress",options:{quality:100}});
  assert.equal(parseFileCommand("compress this image to 101 percent"), null);
  assert.equal(parseFileCommand("compress this image to 70 percent and upload it"), null);
  assert.deepEqual(parseFileCommand("Unzip these archives"), {operation:"archive-extract",options:{}});
});
test("text to Markdown supports plural selection and explicit heading opt-out", () => {
  assert.deepEqual(parseFileCommand("Convert these text files to Markdown"), {operation:"text-markdown",options:{}});
  for (const command of ["convert this text to markdown without a heading", "turn these text files into markdown, do not make the first line a heading", "make text as markdown without a first-line heading"])
    assert.deepEqual(parseFileCommand(command), {operation:"text-markdown",options:{firstLineHeading:false}});
  assert.equal(parseFileCommand("convert text to markdown without a heading and upload it"), null);
});
test("literal conversion commands select explicit file formats", () => {
  assert.deepEqual(parseFileCommand("Convert this image from JPG to PNG"), {operation:"image-convert",options:{format:"png"}});
  assert.deepEqual(parseFileCommand("Convert these files from YML to JSON"), {operation:"config-convert",options:{from:"yaml",format:"json"}});
  assert.equal(parseFileCommand("convert this file from mp3 to png"), null);
  assert.equal(parseFileCommand("convert this image from jpg to png and upload it"), null);
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
test("Markdown PDF phrases preserve the default and route only supported explicit styles", () => {
  assert.deepEqual(parseFileCommand("Turn this Markdown into a PDF, minimal styling"), {operation:"markdown-pdf",options:{style:"minimal"}});
  for (const command of ["export these Markdown files to PDFs with minimal style", "convert the selected Markdown file as a PDF using minimal styling"])
    assert.deepEqual(parseFileCommand(command), {operation:"markdown-pdf",options:{style:"minimal"}});
  for (const command of ["export Markdown as PDF", "convert this Markdown file to PDF", "make these Markdown files into PDFs"])
    assert.deepEqual(parseFileCommand(command), {operation:"markdown-pdf",options:{}});
  for (const command of ["turn this Markdown into a PDF, GitHub styling", "export Markdown as PDF using GitHub-flavoured style", "convert Markdown to PDF with GitHub-flavored styling"])
    assert.deepEqual(parseFileCommand(command), {operation:"markdown-pdf",options:{style:"github"}});
  for (const command of ["convert Markdown to PDF with arbitrary CSS style", "turn this Markdown into a PDF, minimal styling and upload it", "export Markdown as PDF using minimal style; execute a script", "convert text to PDF with minimal style", "convert Markdown to PDF with minimal styling\nopen Chrome"])
    assert.equal(parseFileCommand(command), null);
});
