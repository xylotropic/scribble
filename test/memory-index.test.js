const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  MemoryIndex,
  SUPPORTED_EXTENSIONS,
} = require("../src/main/memory-index");
test("notes report indexing and retrieve relevant enabled context within budget", async () => {
  const updates = [];
  const index = new MemoryIndex({ onUpdate: (x) => updates.push(x.status) });
  await index.index({
    id: "a",
    name: "Project",
    content: "Falcon project uses blue packaging.",
  });
  await index.index({ id: "b", content: "Unrelated garden tools." });
  assert.deepEqual(updates, ["indexing", "indexed", "indexing", "indexed"]);
  assert.equal(index.search("Falcon")[0].id, "a");
  const context = index.context("Falcon", {
    maxChars: 45,
    currentContext: "Current selection.",
  });
  assert.ok(context.text.length <= 45);
  assert.equal(context.sources[0].id, "a");
  index.setEnabled("a", false);
  assert.deepEqual(index.search("Falcon"), []);
});
test("files reindex actual changed bytes; errors never expose stale indexed content", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-"));
  try {
    const file = path.join(dir, "note.md");
    await fs.writeFile(file, "Original reference");
    const index = new MemoryIndex();
    assert.equal(
      (await index.index({ id: "file", filePath: file })).status,
      "indexed",
    );
    await fs.writeFile(file, "Updated reference");
    assert.equal((await index.reindex("file")).content, "Updated reference");
    await fs.unlink(file);
    assert.equal((await index.reindex("file")).status, "error");
    assert.equal(index.search("reference").length, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("binary, symlink and unsupported formats fail truthfully", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-"));
  try {
    const index = new MemoryIndex();
    for (const [name, data] of [
      ["bad.txt", Buffer.from([255])],
      ["binary.md", "a\0b"],
      ["document.pdf", "%PDF"],
    ]) {
      const file = path.join(dir, name);
      await fs.writeFile(file, data);
      assert.equal(
        (await index.index({ id: name, filePath: file })).status,
        "error",
      );
    }
    await fs.symlink(path.join(dir, "bad.txt"), path.join(dir, "link.txt"));
    assert.equal(
      (await index.index({ id: "link", filePath: path.join(dir, "link.txt") }))
        .status,
      "error",
    );
    assert.ok(SUPPORTED_EXTENSIONS.includes(".pdf"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("removal supersedes in-flight read and prevents resurrection", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-"));
  try {
    const file = path.join(dir, "a.txt");
    await fs.writeFile(file, "Searchable");
    const index = new MemoryIndex();
    const pending = index.index({ id: "a", filePath: file });
    index.remove("a");
    assert.equal((await pending).status, "superseded");
    assert.deepEqual(index.list(), []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("PDF parser extracts real page text and rejects scanned/empty documents", async () => {
  const { PDFDocument } = require("pdf-lib");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-pdf-"));
  try {
    const index = new MemoryIndex();
    const document = await PDFDocument.create();
    document.addPage().drawText("Falcon PDF reference");
    const file = path.join(dir, "reference.pdf");
    await fs.writeFile(file, await document.save());
    const result = await index.index({ id: "pdf", filePath: file });
    assert.equal(result.status, "indexed");
    assert.match(result.content, /Falcon PDF reference/);
    assert.equal(index.search("Falcon")[0].id, "pdf");
    const empty = await PDFDocument.create();
    empty.addPage();
    await fs.writeFile(file, await empty.save());
    const failed = await index.reindex("pdf");
    assert.equal(failed.status, "error");
    assert.match(failed.error, /OCR/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("CJK substrings retrieve memory without whitespace word boundaries", async () => {
  const index = new MemoryIndex();
  await index.index({ id: "zh", content: "我们测试本地语音识别项目。" });
  assert.equal(index.search("语音识别")[0].id, "zh");
});
test('XML and HTML reference formats retain original text without executing or fetching markup',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scribble-memory-markup-'));
 try{for(const extension of ['xml','html','htm']){const file=path.join(directory,'reference.'+extension),content='<reference><script>untrusted()</script><fact>Cedar ID ABC-123</fact></reference>';await fs.writeFile(file,content);const indexed=await new MemoryIndex().index({id:extension,filePath:file});assert.equal(indexed.status,'indexed');assert.equal(indexed.content,content);}}finally{await fs.rm(directory,{recursive:true,force:true});}
});
