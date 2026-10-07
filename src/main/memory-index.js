"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
];
SUPPORTED_EXTENSIONS.push(".pdf");
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CHARS = 500000;
async function pdfText(buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void task.destroy().catch(() => {});
  }, 30000);
  try {
    const document = await task.promise;
    if (document.numPages > 300) throw new Error("PDF exceeds 300 pages");
    let text = "";
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const stream = page.streamTextContent({ disableNormalization: false });
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const item of value.items) {
            if (typeof item.str === "string")
              text += item.str + (item.hasEOL ? "\n" : " ");
            if (text.length > MAX_CHARS)
              throw new Error("PDF exceeds 500,000 extracted characters");
          }
        }
      } finally {
        await reader.cancel();
        page.cleanup();
      }
      text += "\n";
    }
    if (!text.trim())
      throw new Error(
        "PDF has no searchable text; scanned pages require OCR, which is not implemented",
      );
    return text;
  } catch (error) {
    if (timedOut) throw new Error("PDF indexing exceeded 30 seconds");
    throw error;
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}
function chunks(text) {
  const result = [];
  for (let start = 0; start < text.length; start += 1800)
    result.push({
      start,
      end: Math.min(start + 2200, text.length),
      text: text.slice(start, start + 2200),
    });
  return result;
}
function normalizeText(text) {
  if (typeof text !== "string") throw new Error("Memory content must be text");
  if (text.length > MAX_CHARS)
    throw new Error("Memory exceeds 500,000 characters");
  if (text.includes("\0")) throw new Error("Binary content is not supported");
  return text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
}
function terms(text) {
  const normalized = text.normalize("NFKC").toLowerCase();
  const words = normalized.match(/[\p{L}\p{N}]{2,}/gu) || [];
  for (const sequence of normalized.match(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu,
  ) || []) {
    const chars = [...sequence];
    for (let i = 0; i < chars.length - 1; i++)
      words.push(chars[i] + chars[i + 1]);
  }
  return words.slice(0, 5000);
}
class MemoryIndex {
  constructor({ onUpdate } = {}) {
    this.items = new Map();
    this.revisions = new Map();
    this.onUpdate = onUpdate;
  }
  publish(item) {
    this.items.set(item.id, item);
    this.onUpdate?.(this.describe(item));
    return this.describe(item);
  }
  describe(item) {
    const { chunks: _, ...view } = item;
    return { ...view, chunkCount: item.chunks?.length || 0 };
  }
  list() {
    return [...this.items.values()].map((item) => this.describe(item));
  }
  remove(id) {
    this.revisions.set(id, (this.revisions.get(id) || 0) + 1);
    return this.items.delete(id);
  }
  async index(input) {
    if (
      !input ||
      typeof input.id !== "string" ||
      !input.id ||
      input.id.length > 200
    )
      throw new Error("Memory ID is required");
    const id = input.id,
      revision = (this.revisions.get(id) || 0) + 1;
    this.revisions.set(id, revision);
    const item = {
      id,
      name: String(input.name || "Untitled memory").slice(0, 300),
      enabled: input.enabled !== false,
      source: input.filePath ? "file" : "note",
      filePath: input.filePath || null,
      status: "indexing",
      error: null,
      content: "",
      chunks: [],
      indexedAt: null,
    };
    this.publish(item);
    try {
      let content;
      if (input.filePath) {
        if (
          typeof input.filePath !== "string" ||
          !path.isAbsolute(input.filePath)
        )
          throw new Error("Memory file path must be absolute");
        if (
          !SUPPORTED_EXTENSIONS.includes(
            path.extname(input.filePath).toLowerCase(),
          )
        )
          throw new Error("Unsupported memory format");
        const stat = await fs.lstat(input.filePath);
        if (!stat.isFile() || stat.isSymbolicLink())
          throw new Error("Memory must be a regular file");
        if (stat.size > MAX_BYTES) throw new Error("Memory file exceeds 8 MiB");
        const handle = await fs.open(
          input.filePath,
          require("node:fs").constants.O_RDONLY |
            require("node:fs").constants.O_NOFOLLOW,
        );
        try {
          const actual = await handle.stat();
          if (!actual.isFile() || actual.size > MAX_BYTES)
            throw new Error("Memory file is invalid or too large");
          const buffer = Buffer.alloc(MAX_BYTES + 1);
          let offset = 0;
          while (offset < buffer.length) {
            const { bytesRead } = await handle.read(
              buffer,
              offset,
              buffer.length - offset,
              null,
            );
            if (!bytesRead) break;
            offset += bytesRead;
          }
          if (offset > MAX_BYTES) throw new Error("Memory file exceeds 8 MiB");
          content =
            path.extname(input.filePath).toLowerCase() === ".pdf"
              ? await pdfText(buffer.subarray(0, offset))
              : new TextDecoder("utf-8", { fatal: true }).decode(
                  buffer.subarray(0, offset),
                );
        } finally {
          await handle.close();
        }
      } else content = input.content;
      content = normalizeText(content);
      if (!content.trim())
        throw new Error("Memory contains no searchable text");
      const indexed = {
        ...item,
        content,
        chunks: chunks(content),
        status: "indexed",
        sha256: crypto.createHash("sha256").update(content).digest("hex"),
        indexedAt: new Date().toISOString(),
      };
      if (this.revisions.get(id) !== revision)
        return { id, status: "superseded" };
      return this.publish({
        ...indexed,
        enabled: this.items.get(id)?.enabled ?? indexed.enabled,
      });
    } catch (error) {
      if (this.revisions.get(id) !== revision)
        return { id, status: "superseded" };
      return this.publish({ ...item, status: "error", error: error.message });
    }
  }
  reindex(id) {
    const item = this.items.get(id);
    if (!item) throw new Error("Unknown memory item");
    return this.index(item);
  }
  setEnabled(id, enabled) {
    const item = this.items.get(id);
    if (!item) throw new Error("Unknown memory item");
    return this.publish({ ...item, enabled: !!enabled });
  }
  search(query, { limit = 8 } = {}) {
    if (typeof query !== "string" || query.length > 10000)
      throw new Error("Invalid memory query");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("Invalid result limit");
    const wanted = [...new Set(terms(query))];
    if (!wanted.length) return [];
    const results = [];
    for (const item of this.items.values()) {
      if (!item.enabled || item.status !== "indexed") continue;
      for (const chunk of item.chunks) {
        const counts = new Map();
        for (const term of terms(chunk.text))
          counts.set(term, (counts.get(term) || 0) + 1);
        let score = 0;
        for (const term of wanted) score += Math.min(3, counts.get(term) || 0);
        if (score)
          results.push({
            id: item.id,
            name: item.name,
            source: item.source,
            start: chunk.start,
            end: chunk.end,
            text: chunk.text,
            score,
          });
      }
    }
    return results
      .sort(
        (a, b) =>
          b.score - a.score || a.id.localeCompare(b.id) || a.start - b.start,
      )
      .slice(0, limit);
  }
  context(query, { maxChars = 12000, currentContext = "" } = {}) {
    if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > 50000)
      throw new Error("Invalid memory context budget");
    if (typeof currentContext !== "string")
      throw new Error("Current context must be text");
    const parts = [],
      sources = [];
    let remaining = maxChars;
    if (currentContext) {
      const text = currentContext.slice(0, remaining);
      parts.push(text);
      remaining -= text.length;
    }
    for (const hit of this.search(query)) {
      const text = `\n\n[Memory: ${hit.name}]\n${hit.text}`.slice(0, remaining);
      if (!text) break;
      parts.push(text);
      sources.push({
        id: hit.id,
        name: hit.name,
        start: hit.start,
        end: hit.end,
      });
      remaining -= text.length;
    }
    return { text: parts.join(""), sources };
  }
}
module.exports = {
  MemoryIndex,
  SUPPORTED_EXTENSIONS,
  MAX_BYTES,
  MAX_CHARS,
  normalizeText,
};
