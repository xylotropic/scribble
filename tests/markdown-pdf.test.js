"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  markdownBlocks,
  renderMarkdownPDF,
  LIMITS,
} = require("../src/main/markdown-pdf");
async function inspect(bytes) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      pages.push({
        text: await page.getTextContent(),
        annotations: await page.getAnnotations(),
        operators: await page.getOperatorList(),
      });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
const source =
  "# Migration plan\n\nA **bold** and *emphasized* paragraph with [the docs](https://example.test/docs?q=1).\n\n1. First item\n2. Second item\n   - Nested detail\n\n> Evidence only\n\n```js\nconst answer = 42;\n  keepIndent();\n```\n\n| Owner | Deadline |\n| --- | --- |\n| Priya | Friday |\n| Sam | Monday |\n\n![Chart alt](https://example.test/private.png)";
test("CommonMark parsing produces genuine heading, ordered/nested lists, fenced code, links and table structure", () => {
  const blocks = markdownBlocks(source);
  assert.equal(blocks[0].kind, "heading");
  assert.equal(blocks[0].level, 1);
  assert.ok(blocks.some((b) => b.prefix === "1. "));
  assert.ok(blocks.some((b) => b.prefix === "2. "));
  assert.ok(blocks.some((b) => b.prefix === "- " && b.indent === 1));
  assert.ok(
    blocks.some((b) => b.kind === "code" && b.text.includes("  keepIndent();")),
  );
  const table = blocks.find((b) => b.kind === "table");
  assert.equal(table.rows.length, 3);
  assert.equal(table.headerRows, 1);
  assert.equal(table.rows[1][0][0].text, "Priya");
  assert.ok(
    blocks.some((b) => b.runs?.some((r) => r.bold && r.text === "bold")),
  );
});
test("generated GitHub and minimal PDFs have distinct typography and actual semantic content/link annotations", async () => {
  const github = await renderMarkdownPDF(source),
    minimal = await renderMarkdownPDF(source, { style: "minimal" });
  assert.equal(github.details.style, "github");
  assert.equal(minimal.details.style, "minimal");
  assert.equal(github.details.font, "Helvetica");
  assert.equal(minimal.details.font, "Times-Roman");
  assert.notDeepEqual(github.bytes, minimal.bytes);
  const [g, m] = await Promise.all([
    inspect(github.bytes),
    inspect(minimal.bytes),
  ]);
  for (const pages of [g, m]) {
    const text = pages
      .flatMap((p) => p.text.items.map((x) => x.str))
      .join(" ")
      .replace(/\s+/g, " ");
    for (const fact of [
      "Migration plan",
      "First item",
      "Second item",
      "Nested detail",
      "const answer = 42;",
      "keepIndent();",
      "Owner",
      "Deadline",
      "Priya",
      "Friday",
      "Sam",
      "Monday",
      "[Image: Chart alt]",
    ])
      assert.ok(text.includes(fact), fact);
    const links = pages
      .flatMap((p) => p.annotations)
      .filter((x) => x.subtype === "Link");
    assert.ok(links.length);
    assert.ok(links.every((x) => x.url === "https://example.test/docs?q=1"));
  }
  assert.ok(
    g[0].text.items.find((x) => x.str === "keepIndent();").transform[4] >
      g[0].text.items.find((x) => x.str === "const answer = 42;").transform[4],
  );
  assert.equal(
    g[0].text.items.find((x) => x.str === "Migration plan").transform[0],
    26,
  );
  assert.equal(
    m[0].text.items.find((x) => x.str === "Migration plan").transform[0],
    20,
  );
  assert.ok(g[0].operators.fnArray.length > m[0].operators.fnArray.length);
});
test("untrusted HTML, dangerous links and remote images never execute or fetch resources", async (t) => {
  const saved = global.fetch;
  global.fetch = () => {
    assert.fail("external request");
  };
  t.after(() => (global.fetch = saved));
  const pdf = await renderMarkdownPDF(
    "<script>alert(1)</script>\n\n[bad](javascript:alert%281%29) [local](file:///private/data) [mail](mailto:test@example.test)\n\n![Visible image alt](https://example.test/image.png)",
  );
  const pages = await inspect(pdf.bytes);
  assert.equal(pages.flatMap((x) => x.annotations).length, 0);
  const text = pages.flatMap((x) => x.text.items.map((i) => i.str)).join(" ");
  assert.match(text, /<script>alert\(1\)<\/script>/);
  assert.match(text, /Visible image alt/);
});
test("layout paginates code and long documents while all code lines remain extractable", async () => {
  const text =
    "```\n" +
    Array.from({ length: 160 }, (_, i) => `line_${i}:    exact`).join("\n") +
    "\n```";
  const result = await renderMarkdownPDF(text);
  assert.ok(result.details.pages > 1);
  const pages = await inspect(result.bytes);
  const content = pages
    .flatMap((x) => x.text.items.map((i) => i.str))
    .join(" ");
  for (const i of [0, 80, 159]) assert.ok(content.includes(`line_${i}:`));
});
test("explicit bounds reject excessive source, lines, nesting/output pages and unknown styles", async () => {
  assert.throws(
    () => markdownBlocks("x".repeat(LIMITS.characters + 1)),
    /limit/,
  );
  assert.throws(
    () => markdownBlocks("x".repeat(LIMITS.lineCharacters + 1)),
    /line/,
  );
  assert.throws(() => markdownBlocks("> ".repeat(40) + "deep"), /nesting/);
  await assert.rejects(renderMarkdownPDF("text", { style: "other" }), /style/);
  await assert.rejects(
    renderMarkdownPDF("```\n" + "x\n".repeat(22000) + "```"),
    /page limit/,
  );
});
