"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const MarkdownIt = require("markdown-it");
const {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFName,
  PDFString,
} = require("pdf-lib");
const LIMITS = Object.freeze({
  bytes: 16 * 1024 ** 2,
  characters: 500000,
  lineCharacters: 16384,
  tokens: 50000,
  depth: 32,
  pages: 300,
});
// Parser: markdown-it15.0.2 (MIT), https://markdown-it.github.io/markdown-it/
const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  maxNesting: LIMITS.depth * 2 + 1,
});
function safeLink(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      value.length <= 4096
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
function inlineRuns(tokens = []) {
  const runs = [];
  let bold = 0,
    italic = 0,
    strike = 0,
    link = null;
  for (const token of tokens) {
    if (token.type === "strong_open") bold++;
    else if (token.type === "strong_close") bold--;
    else if (token.type === "em_open") italic++;
    else if (token.type === "em_close") italic--;
    else if (token.type === "s_open") strike++;
    else if (token.type === "s_close") strike--;
    else if (token.type === "link_open") link = safeLink(token.attrGet("href"));
    else if (token.type === "link_close") link = null;
    else if (
      ["text", "code_inline", "softbreak", "hardbreak", "image"].includes(
        token.type,
      )
    ) {
      const text =
        token.type === "softbreak"
          ? " "
          : token.type === "hardbreak"
            ? "\n"
            : token.type === "image"
              ? `[Image: ${token.content || "image"}]`
              : token.content;
      runs.push({
        text,
        bold: bold > 0,
        italic: italic > 0,
        strike: strike > 0,
        code: token.type === "code_inline",
        link,
      });
    }
  }
  return runs;
}
function markdownBlocks(text) {
  if (
    typeof text !== "string" ||
    Buffer.byteLength(text) > LIMITS.bytes ||
    text.length > LIMITS.characters
  )
    throw Error("Markdown input exceeds size or character limit");
  if (text.split("\n").some((line) => line.length > LIMITS.lineCharacters))
    throw Error("Markdown line exceeds character limit");
  const tokens = md.parse(text, {});
  let count = 0;
  for (const token of tokens) {
    count += 1 + (token.children?.length || 0);
    if (count > LIMITS.tokens) throw Error("Markdown token limit exceeded");
    if (
      token.level > LIMITS.depth ||
      token.children?.some((child) => child.level > LIMITS.depth)
    )
      throw Error("Markdown nesting limit exceeded");
  }
  const blocks = [],
    lists = [];
  let heading = 0,
    quote = 0,
    prefix = "",
    table = null,
    row = null,
    header = false;
  for (const token of tokens) {
    if (token.type === "heading_open") heading = Number(token.tag.slice(1));
    else if (token.type === "heading_close") heading = 0;
    else if (token.type === "blockquote_open") quote++;
    else if (token.type === "blockquote_close") quote--;
    else if (token.type === "bullet_list_open")
      lists.push({ ordered: false, index: 0 });
    else if (token.type === "ordered_list_open")
      lists.push({
        ordered: true,
        index: Number(token.attrGet("start") || 1) - 1,
      });
    else if (token.type.endsWith("_list_close")) lists.pop();
    else if (token.type === "list_item_open") {
      const list = lists.at(-1);
      prefix = list.ordered ? `${++list.index}. ` : "- ";
    } else if (token.type === "table_open")
      table = { kind: "table", rows: [], headerRows: 0 };
    else if (token.type === "thead_open") header = true;
    else if (token.type === "thead_close") header = false;
    else if (token.type === "tr_open") row = [];
    else if (token.type === "tr_close") {
      table.rows.push(row);
      if (header) table.headerRows++;
      row = null;
    } else if (token.type === "table_close") {
      blocks.push(table);
      table = null;
    } else if (token.type === "inline") {
      const runs = inlineRuns(token.children);
      if (table) {
        row.push(runs);
      } else {
        blocks.push({
          kind: heading ? "heading" : "paragraph",
          level: heading,
          indent: Math.max(0, lists.length - 1),
          quote,
          prefix,
          runs,
        });
        prefix = "";
      }
    } else if (token.type === "fence" || token.type === "code_block")
      blocks.push({
        kind: "code",
        text: token.content.replace(/\t/g, "    "),
        language: token.info.trim().split(/\s/)[0],
      });
    else if (token.type === "hr") blocks.push({ kind: "rule" });
  }
  return blocks;
}
async function renderMarkdownPDF(text, options = {}) {
  const style = options.style ?? "github";
  if (!["github", "minimal"].includes(style))
    throw Error("Markdown PDF style must be github or minimal");
  const blocks = markdownBlocks(text),
    doc = await PDFDocument.create();
  let fontPath = options.fontPath;
  if (fontPath && !path.isAbsolute(fontPath))
    throw Error("Font path must be absolute");
  if (!fontPath && /[^\x00-\xff]/.test(text))
    for (const candidate of [
      "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
      "/Library/Fonts/Arial Unicode.ttf",
    ]) {
      try {
        await fs.access(candidate);
        fontPath = candidate;
        break;
      } catch {}
    }
  const fonts = {};
  if (fontPath) {
    const stat = await fs.stat(fontPath);
    if (!stat.isFile() || stat.size > 64 * 1024 ** 2)
      throw Error("PDF font must be a regular file of at most64MiB");
    doc.registerFontkit(require("@pdf-lib/fontkit"));
    const font = await doc.embedFont(await fs.readFile(fontPath), {
      subset: true,
    });
    for (const key of ["normal", "bold", "italic", "boldItalic", "code"])
      fonts[key] = font;
  } else {
    const names =
      style === "github"
        ? {
            normal: StandardFonts.Helvetica,
            bold: StandardFonts.HelveticaBold,
            italic: StandardFonts.HelveticaOblique,
            boldItalic: StandardFonts.HelveticaBoldOblique,
            code: StandardFonts.Courier,
          }
        : {
            normal: StandardFonts.TimesRoman,
            bold: StandardFonts.TimesRomanBold,
            italic: StandardFonts.TimesRomanItalic,
            boldItalic: StandardFonts.TimesRomanBoldItalic,
            code: StandardFonts.Courier,
          };
    for (const [key, name] of Object.entries(names))
      fonts[key] = await doc.embedFont(name);
  }
  const minimal = style === "minimal",
    margin = minimal ? 60 : 50,
    width = 612 - margin * 2,
    normalSize = minimal ? 12 : 11,
    lineFactor = minimal ? 1.3 : 1.5,
    ink = rgb(0.12, 0.14, 0.17),
    muted = rgb(0.4, 0.43, 0.47),
    blue = rgb(0.03, 0.32, 0.67),
    gray = rgb(0.95, 0.96, 0.97);
  let page, y;
  let links = 0;
  function newPage() {
    if (doc.getPageCount() >= LIMITS.pages)
      throw Error("Markdown PDF page limit exceeded");
    page = doc.addPage([612, 792]);
    y = 792 - margin;
  }
  function space(height) {
    if (y - height < margin) newPage();
  }
  function face(run) {
    return fonts[
      run.code
        ? "code"
        : run.bold && run.italic
          ? "boldItalic"
          : run.bold
            ? "bold"
            : run.italic
              ? "italic"
              : "normal"
    ];
  }
  function measure(run, size) {
    try {
      return face(run).widthOfTextAtSize(run.text, size);
    } catch {
      throw Error(
        "The PDF font cannot encode this text. Choose options.fontPath with a Unicode font.",
      );
    }
  }
  function lines(runs, size, maxWidth) {
    const result = [];
    let line = [],
      used = 0;
    for (const run of runs) {
      for (const part of run.text.split(/(\n|\s+)/).filter(Boolean)) {
        if (part === "\n") {
          result.push(line);
          line = [];
          used = 0;
          continue;
        }
        let chunk = "";
        for (const character of part) {
          const proposed = { ...run, text: chunk + character };
          if (measure(proposed, size) > maxWidth) {
            if (chunk) {
              push({ ...run, text: chunk });
              chunk = "";
            }
            if (measure({ ...run, text: character }, size) > maxWidth)
              throw Error("PDF layout cannot fit this character");
          }
          chunk += character;
        }
        if (chunk) push({ ...run, text: chunk });
      }
    }
    if (line.length || !result.length) result.push(line);
    return result;
    function push(run) {
      const length = measure(run, size);
      if (used + length > maxWidth && line.length) {
        result.push(line);
        line = [];
        used = 0;
        if (/^\s+$/.test(run.text)) return;
      }
      line.push(run);
      used += length;
    }
  }
  function annotation(url, x, baseline, length, size) {
    const object = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, baseline - 2, x + length, baseline + size],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    });
    const ref = doc.context.register(object);
    let existing = page.node.lookupMaybe(
      PDFName.of("Annots"),
      require("pdf-lib").PDFArray,
    );
    if (!existing) {
      existing = doc.context.obj([]);
      page.node.set(PDFName.of("Annots"), existing);
    }
    existing.push(ref);
    links++;
  }
  function drawLine(runs, x, baseline, size) {
    for (const run of runs) {
      const length = measure(run, size);
      page.drawText(run.text, {
        x,
        y: baseline,
        size,
        font: face(run),
        color: run.link && !minimal ? blue : ink,
      });
      if (run.link && length) {
        annotation(run.link, x, baseline, length, size);
        page.drawLine({
          start: { x, y: baseline - 1 },
          end: { x: x + length, y: baseline - 1 },
          thickness: 0.4,
          color: minimal ? ink : blue,
        });
      }
      if (run.strike)
        page.drawLine({
          start: { x, y: baseline + size * 0.3 },
          end: { x: x + length, y: baseline + size * 0.3 },
          thickness: 0.5,
          color: ink,
        });
      x += length;
    }
  }
  newPage();
  for (const block of blocks) {
    if (block.kind === "table") {
      const columns = Math.max(...block.rows.map((row) => row.length));
      if (columns > 32) throw Error("Markdown table exceeds32columns");
      const cellWidth = width / columns,
        padding = 6,
        size = normalSize - 1;
      for (let index = 0; index < block.rows.length; index++) {
        const row = block.rows[index],
          header = index < block.headerRows;
        const cells = row.map((runs) =>
            lines(
              runs.map((run) => ({ ...run, bold: header || run.bold })),
              size,
              cellWidth - padding * 2,
            ),
          ),
          height =
            Math.max(...cells.map((cell) => cell.length)) * size * lineFactor +
            padding * 2;
        if (height > 792 - margin * 2)
          throw Error("Markdown table row exceeds one page");
        space(height + 8);
        const top = y;
        for (let col = 0; col < columns; col++) {
          const x = margin + col * cellWidth;
          page.drawRectangle({
            x,
            y: top - height,
            width: cellWidth,
            height,
            borderWidth: minimal ? 0.3 : 0.6,
            borderColor: muted,
            ...(!minimal && header ? { color: gray } : {}),
          });
          (cells[col] || []).forEach((line, n) =>
            drawLine(
              line,
              x + padding,
              top - padding - size - n * size * lineFactor,
              size,
            ),
          );
        }
        y -= height;
      }
      y -= 12;
      continue;
    }
    if (block.kind === "rule") {
      space(18);
      page.drawLine({
        start: { x: margin, y: y - 6 },
        end: { x: margin + width, y: y - 6 },
        thickness: minimal ? 0.4 : 1,
        color: muted,
      });
      y -= 18;
      continue;
    }
    if (block.kind === "code") {
      const size = normalSize - 1,
        padding = minimal ? 0 : 8;
      const codeLines = block.text
        .replace(/\n$/, "")
        .split("\n")
        .flatMap((text) =>
          lines([{ text, code: true }], size, width - padding * 2),
        );
      for (const line of codeLines) {
        space(size * lineFactor);
        if (!minimal)
          page.drawRectangle({
            x: margin,
            y: y - size * lineFactor,
            width,
            height: size * lineFactor,
            color: gray,
          });
        drawLine(line, margin + padding, y - size, size);
        y -= size * lineFactor;
      }
      y -= 12;
      continue;
    }
    const size =
        block.kind === "heading"
          ? (minimal ? [20, 18, 16, 14, 13, 12] : [26, 22, 18, 16, 14, 12])[
              block.level - 1
            ]
          : normalSize,
      offset = block.indent * 20 + (block.quote ? 12 : 0),
      x = margin + offset,
      runs = block.runs.map((run) => ({
        ...run,
        bold: block.kind === "heading" || run.bold,
      }));
    if (block.prefix) runs.unshift({ text: block.prefix });
    const wrapped = lines(runs, size, width - offset);
    y -= block.kind === "heading" ? 10 : 0;
    for (const line of wrapped) {
      space(size * lineFactor);
      if (block.quote && !minimal)
        page.drawLine({
          start: { x: margin + offset - 7, y: y - size * lineFactor },
          end: { x: margin + offset - 7, y },
          thickness: 2,
          color: muted,
        });
      drawLine(line, x, y - size, size);
      y -= size * lineFactor;
    }
    if (block.kind === "heading" && !minimal && block.level <= 2) {
      space(5);
      page.drawLine({
        start: { x: margin, y },
        end: { x: margin + width, y },
        thickness: 0.6,
        color: gray,
      });
    }
    y -= block.kind === "heading" ? 10 : 8;
  }
  return {
    bytes: await doc.save(),
    details: {
      pages: doc.getPageCount(),
      font: fontPath
        ? path.basename(fontPath)
        : minimal
          ? "Times-Roman"
          : "Helvetica",
      style,
      links,
      blocks: blocks.length,
      format: "pdf",
    },
  };
}
module.exports = { LIMITS, markdownBlocks, renderMarkdownPDF, safeLink };
