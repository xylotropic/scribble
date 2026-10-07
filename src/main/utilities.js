"use strict";
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { run, resolveExecutablePath } = require("./speech");
const LIMITS = {
  archiveBytes: 512 * 1024 * 1024,
  expandedBytes: 512 * 1024 * 1024,
  entries: 10000,
  compressionRatio: 1000,
  configBytes: 16 * 1024 * 1024,
  imagePixels: 64 * 1024 * 1024,
};
function integer(value, fallback, min, max, label) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  return value;
}
async function inputPaths(files) {
  if (!Array.isArray(files) || !files.length)
    throw new Error("Choose at least one input file");
  const paths = [];
  for (const file of files) {
    if (typeof file !== "string" || !path.isAbsolute(file))
      throw new Error("Input paths must be absolute");
    const stat = await fsp.lstat(file);
    if (stat.isSymbolicLink())
      throw new Error("Symbolic link inputs are not supported");
    paths.push({ file: path.resolve(file), stat });
  }
  return paths;
}
async function validateOutput(output, inputs, { overwrite = false } = {}) {
  if (typeof output !== "string" || !path.isAbsolute(output))
    throw new Error("Output path must be absolute");
  const resolved = path.resolve(output);
  for (const input of inputs) {
    if (
      resolved === input.file ||
      (input.stat.isDirectory() && resolved.startsWith(input.file + path.sep))
    )
      throw new Error("Output must not replace or be inside an input");
  }
  await fsp.mkdir(path.dirname(resolved), { recursive: true });
  const canonicalDestination = path.join(
    await fsp.realpath(path.dirname(resolved)),
    path.basename(resolved),
  );
  for (const input of inputs) {
    const actual = await fsp.realpath(input.file);
    if (
      canonicalDestination === actual ||
      (input.stat.isDirectory() &&
        canonicalDestination.startsWith(actual + path.sep))
    )
      throw new Error(
        "Output must not replace or be inside an input through a linked directory",
      );
  }
  let existing;
  try {
    existing = await fsp.lstat(resolved);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing?.isSymbolicLink())
    throw new Error("Output cannot be a symbolic link");
  if (existing && !overwrite)
    throw new Error(
      "Output already exists; choose another path or explicitly enable overwrite",
    );
  if (existing?.isDirectory())
    throw new Error(
      "Choose a new output path; existing directories are never merged or replaced",
    );
  if (existing) {
    const actual = await fsp.realpath(resolved);
    for (const input of inputs) {
      if (actual === (await fsp.realpath(input.file)))
        throw new Error("Output must not replace an input");
      const outStat = await fsp.stat(resolved);
      if (outStat.ino === input.stat.ino && outStat.dev === input.stat.dev)
        throw new Error("Output must not replace an input hard link");
    }
  }
  return resolved;
}
async function commitFile(temp, output, overwrite) {
  if (overwrite) await fsp.rename(temp, output);
  else {
    await fsp.link(temp, output);
    await fsp.unlink(temp);
  }
}
function ffmpeg() {
  return resolveExecutablePath(require("./ffmpeg").ffmpegExecutable());
}
function bitrate(value, fallback) {
  if (value === undefined) return fallback;
  if (
    typeof value !== "string" ||
    !/^\d{2,4}k$/.test(value) ||
    parseInt(value) < 16 ||
    parseInt(value) > 1536
  )
    throw new Error("Audio bitrate must be between 16k and 1536k");
  return value;
}
function trimArgs(options) {
  const args = [];
  for (const [option, flag] of [
    ["start", "-ss"],
    ["duration", "-t"],
  ])
    if (options[option] !== undefined) {
      const value = options[option];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 86400 ||
        (option === "duration" && value === 0)
      )
        throw new Error(`Invalid ${option} in seconds`);
      args.push(flag, String(value));
    }
  return args;
}
async function convertImage(input, temp, options, output) {
  const sharp = require("sharp");
  const format = (options.format || path.extname(output).slice(1))
    .toLowerCase()
    .replace("jpeg", "jpg");
  if (!["jpg", "png", "webp"].includes(format))
    throw new Error("Image format must be jpg, png, or webp");
  const width = integer(options.width, undefined, 1, 10000, "Width"),
    height = integer(options.height, undefined, 1, 10000, "Height"),
    quality = integer(options.quality, 85, 1, 100, "Quality");
  let image = sharp(input, { limitInputPixels: LIMITS.imagePixels }).rotate();
  if (width || height)
    image = image.resize({
      width,
      height,
      fit: "inside",
      withoutEnlargement: !options.enlarge,
    });
  if (format === "jpg")
    image = image
      .flatten({ background: options.background || "#ffffff" })
      .jpeg({ quality, mozjpeg: true });
  if (format === "png")
    image = image.png({
      compressionLevel: 9,
      palette: !!options.palette,
      quality,
    });
  if (format === "webp")
    image = image.webp({ quality, lossless: !!options.lossless });
  const result = await image.toFile(temp);
  return {
    format,
    width: result.width,
    height: result.height,
    bytes: result.size,
  };
}
async function imagePalette(input, temp, options) {
  const count = integer(options.colors, 6, 1, 16, "Palette colors");
  const { data, info } = await require("sharp")(input, {
    limitInputPixels: LIMITS.imagePixels,
  })
    .rotate()
    .resize({
      width: 128,
      height: 128,
      fit: "inside",
      withoutEnlargement: true,
      kernel: "nearest",
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Map();
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    pixels++;
    const key =
      (data[i] >> 5) * 64 + (data[i + 1] >> 5) * 8 + (data[i + 2] >> 5);
    const bin = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bin.n++;
    bin.r += data[i];
    bin.g += data[i + 1];
    bin.b += data[i + 2];
    bins.set(key, bin);
  }
  if (!pixels)
    throw new Error("Image contains no visible pixels for a palette");
  const colors = [...bins.values()]
    .sort((a, b) => b.n - a.n || a.r - b.r)
    .slice(0, count)
    .map((bin) => {
      const rgb = [bin.r, bin.g, bin.b].map((x) => Math.round(x / bin.n));
      return {
        hex: "#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join(""),
        rgb,
        proportion: bin.n / pixels,
      };
    });
  const details = {
    format: "json",
    colors,
    sampledPixels: pixels,
    sampleWidth: info.width,
    sampleHeight: info.height,
    method: "RGB bins of width 32; average color per dominant bin",
  };
  await fsp.writeFile(temp, JSON.stringify(details, null, 2) + "\n");
  return details;
}
async function convertMedia(input, temp, options, output, video) {
  const format = (
    options.format || path.extname(output).slice(1)
  ).toLowerCase();
  const args = ["-nostdin", "-y", ...trimArgs(options), "-i", input];
  if (video) {
    if (!["mp4", "webm"].includes(format))
      throw new Error("Video format must be mp4 or webm");
    const crf = integer(
      options.crf,
      format === "mp4" ? 23 : 32,
      0,
      51,
      "Video quality CRF",
    );
    args.push(
      "-c:v",
      format === "mp4" ? "libx264" : "libvpx-vp9",
      "-crf",
      String(crf),
    );
    if (format === "webm") args.push("-b:v", "0");
    if (options.width !== undefined) {
      const width = integer(options.width, undefined, 2, 10000, "Video width");
      args.push("-vf", `scale=${width - (width % 2)}:-2`);
    }
    if (options.removeAudio) args.push("-an");
    else
      args.push(
        "-c:a",
        format === "mp4" ? "aac" : "libopus",
        "-b:a",
        bitrate(options.bitrate, "128k"),
      );
    if (format === "mp4")
      args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart");
    args.push("-f", format === "mp4" ? "mp4" : "webm");
  } else {
    if (!["wav", "mp3", "m4a", "opus"].includes(format))
      throw new Error("Audio format must be wav, mp3, m4a, or opus");
    args.push(
      "-vn",
      "-c:a",
      { wav: "pcm_s16le", mp3: "libmp3lame", m4a: "aac", opus: "libopus" }[
        format
      ],
    );
    if (format !== "wav") args.push("-b:a", bitrate(options.bitrate, "192k"));
    if (options.sampleRate !== undefined)
      args.push(
        "-ar",
        String(
          integer(options.sampleRate, undefined, 8000, 192000, "Sample rate"),
        ),
      );
    if (options.mono) args.push("-ac", "1");
    if (options.normalize) args.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11");
    args.push(
      "-f",
      { wav: "wav", mp3: "mp3", m4a: "ipod", opus: "opus" }[format],
    );
  }
  args.push(temp);
  await run(ffmpeg(), args);
  return { format, bytes: (await fsp.stat(temp)).size };
}
async function mergePDF(inputs, temp) {
  const { PDFDocument } = require("pdf-lib");
  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const doc = await PDFDocument.load(await fsp.readFile(input.file));
    for (const page of await merged.copyPages(doc, doc.getPageIndices()))
      merged.addPage(page);
  }
  await fsp.writeFile(temp, await merged.save());
  return { pages: merged.getPageCount() };
}
function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
function safeEntryName(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.includes("\0") ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[a-z]:/i.test(name)
  )
    throw new Error("Archive contains an unsafe path");
  const segments = name.replace(/\/$/, "").split("/");
  if (segments.some((s) => s === ".." || s === "." || !s))
    throw new Error("Archive contains path traversal");
  return segments.join("/");
}
async function extractArchive(input, temp) {
  const AdmZip = require("adm-zip");
  if ((await fsp.stat(input)).size > LIMITS.archiveBytes)
    throw new Error("Archive exceeds 512 MB input limit");
  const zip = new AdmZip(input);
  const entries = zip.getEntries();
  if (entries.length > LIMITS.entries)
    throw new Error("Archive has too many entries");
  let expanded = 0;
  const names = new Set();
  const checked = entries.map((entry) => {
    const name = safeEntryName(entry.entryName),
      mode = (entry.attr >>> 16) & 0xffff,
      type = mode & 0xf000;
    if (type === 0xa000 || (type && type !== 0x8000 && type !== 0x4000))
      throw new Error("Archive contains a symbolic link or special file");
    if (names.has(name)) throw new Error("Archive has duplicate paths");
    names.add(name);
    const size = entry.header.size,
      compressed = entry.header.compressedSize;
    if (!Number.isSafeInteger(size) || size < 0)
      throw new Error("Invalid archive entry size");
    expanded += size;
    if (
      expanded > LIMITS.expandedBytes ||
      (size > 1024 * 1024 &&
        size / Math.max(1, compressed) > LIMITS.compressionRatio)
    )
      throw new Error("Archive exceeds extraction resource limits");
    if (![0, 8].includes(entry.header.method))
      throw new Error("Unsupported ZIP compression method");
    if (entry.header.flags & 1)
      throw new Error("Encrypted ZIP archives are not supported");
    return { entry, name, size };
  });
  await fsp.mkdir(temp);
  for (const { entry, name, size } of checked) {
    const dest = path.join(temp, ...name.split("/"));
    if (entry.isDirectory) {
      await fsp.mkdir(dest, { recursive: true });
      continue;
    }
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    const compressed = entry.getCompressedData();
    const data =
      entry.header.method === 0
        ? compressed
        : zlib.inflateRawSync(compressed, {
            maxOutputLength: Math.min(size + 1, LIMITS.expandedBytes + 1),
          });
    if (data.length !== size || crc32(data) !== entry.header.crc >>> 0)
      throw new Error(
        "Archive entry failed size or CRC integrity verification",
      );
    await fsp.writeFile(dest, data, { flag: "wx" });
  }
  return { entries: entries.length, expandedBytes: expanded };
}
async function createArchive(inputs, temp) {
  const AdmZip = require("adm-zip");
  const zip = new AdmZip();
  let entries = 0,
    bytes = 0;
  const names = new Set();
  async function add(file, name) {
    safeEntryName(name);
    const stat = await fsp.lstat(file);
    if (stat.isSymbolicLink())
      throw new Error("Archive creation refuses symbolic links");
    if (++entries > LIMITS.entries) throw new Error("Too many archive entries");
    if (names.has(name)) throw new Error("Inputs have duplicate archive names");
    names.add(name);
    if (stat.isDirectory()) {
      zip.addFile(name + "/", Buffer.alloc(0));
      for (const child of await fsp.readdir(file))
        await add(path.join(file, child), name + "/" + child);
    } else if (stat.isFile()) {
      bytes += stat.size;
      if (bytes > LIMITS.expandedBytes)
        throw new Error("Archive inputs exceed 512 MB resource limit");
      zip.addFile(name, await fsp.readFile(file));
    } else throw new Error("Special files cannot be archived");
  }
  for (const input of inputs) await add(input.file, path.basename(input.file));
  await fsp.writeFile(temp, zip.toBuffer());
  return { entries, inputBytes: bytes };
}
function configFormat(file, override) {
  const ext = (override || path.extname(file).slice(1)).toLowerCase();
  if (!["json", "yaml", "yml", "toml"].includes(ext))
    throw new Error("Configuration format must be JSON, YAML, or TOML");
  return ext === "yml" ? "yaml" : ext;
}
async function convertConfig(input, temp, options, output) {
  const YAML = require("yaml"),
    TOML = require("@iarna/toml");
  if ((await fsp.stat(input)).size > LIMITS.configBytes)
    throw new Error("Configuration file exceeds 16 MB");
  const from = configFormat(input, options.from),
    to = configFormat(output, options.format);
  const text = await readUTF8(input);
  const value =
    from === "json"
      ? JSON.parse(text)
      : from === "yaml"
        ? YAML.parse(text, { maxAliasCount: 100 })
        : TOML.parse(text);
  let result =
    to === "json"
      ? JSON.stringify(value, null, 2) + "\n"
      : to === "yaml"
        ? YAML.stringify(value)
        : TOML.stringify(value);
  if (typeof result !== "string")
    throw new Error(
      "Configuration cannot be represented in destination format",
    );
  await fsp.writeFile(temp, result);
  return { from, format: to };
}
function markdownLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading)
        return {
          text: heading[2],
          size: Math.max(13, 24 - heading[1].length * 2),
        };
      return {
        text: line
          .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
          .replace(/(?:\*\*|__|`)/g, ""),
        size: 11,
      };
    });
}
async function markdownPDF(input, temp, options) {
  const { PDFDocument, StandardFonts } = require("pdf-lib");
  if ((await fsp.stat(input)).size > LIMITS.configBytes)
    throw new Error("Markdown document exceeds 16 MB");
  const text = await readUTF8(input);
  const doc = await PDFDocument.create();
  let fontPath = options.fontPath;
  if (fontPath) {
    if (!path.isAbsolute(fontPath))
      throw new Error("Font path must be absolute");
    await fsp.access(fontPath);
  } else if (/[^\x00-\xff]/.test(text)) {
    for (const candidate of [
      "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
      "/Library/Fonts/Arial Unicode.ttf",
    ])
      if (fs.existsSync(candidate)) {
        fontPath = candidate;
        break;
      }
  }
  let font;
  if (fontPath) {
    doc.registerFontkit(require("@pdf-lib/fontkit"));
    font = await doc.embedFont(await fsp.readFile(fontPath), { subset: true });
  } else font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([612, 792]),
    y = 742;
  const margin = 50,
    maxWidth = 512;
  function draw(line, size) {
    if (y < margin + size) {
      page = doc.addPage([612, 792]);
      y = 742;
    }
    try {
      page.drawText(line, { x: margin, y, size, font });
    } catch (error) {
      throw new Error(
        `The PDF font cannot encode this text. Choose options.fontPath with a font covering its characters. ${error.message}`,
      );
    }
    y -= size * 1.4;
  }
  for (const item of markdownLines(text)) {
    if (!item.text) {
      y -= 8;
      continue;
    }
    let current = "";
    for (const word of item.text.split(/\s+/)) {
      const proposed = current ? current + " " + word : word;
      let width;
      try {
        width = font.widthOfTextAtSize(proposed, item.size);
      } catch (error) {
        throw new Error(
          "The default PDF font cannot encode this text. Choose options.fontPath with a Unicode font.",
        );
      }
      if (width > maxWidth && current) {
        draw(current, item.size);
        current = word;
      } else current = proposed;
      if (font.widthOfTextAtSize(current, item.size) > maxWidth) {
        let chunk = "";
        for (const character of Array.from(current)) {
          if (
            chunk &&
            font.widthOfTextAtSize(chunk + character, item.size) > maxWidth
          ) {
            draw(chunk, item.size);
            chunk = "";
          }
          chunk += character;
        }
        current = chunk;
      }
    }
    if (current) draw(current, item.size);
  }
  await fsp.writeFile(temp, await doc.save());
  return {
    pages: doc.getPageCount(),
    font: fontPath ? path.basename(fontPath) : "Helvetica",
    format: "pdf",
  };
}
async function readUTF8(file) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await fsp.readFile(file),
    );
  } catch (error) {
    if (error.code === "ERR_ENCODING_INVALID_ENCODED_DATA")
      throw new Error("Text conversion requires a valid UTF-8 input file");
    throw error;
  }
}
async function performUtility({ operation, files, output, options = {} } = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new Error("Options must be an object");
  if (options.overwrite !== undefined && typeof options.overwrite !== "boolean")
    throw new Error("Overwrite must be explicitly true or false");
  const aliases = {
    zip: "archive-create",
    unzip: "archive-extract",
    "pdf.merge": "pdf-merge",
    "image.convert": "image-convert",
    "audio.convert": "audio-convert",
    "video.convert": "video-convert",
    "config.convert": "config-convert",
    "markdown.pdf": "markdown-pdf",
  };
  operation = aliases[operation] || operation;
  const supported = [
    "image-convert",
    "image-compress",
    "image-palette",
    "audio-convert",
    "video-convert",
    "pdf-merge",
    "archive-create",
    "archive-extract",
    "config-convert",
    "markdown-pdf",
    "text-markdown",
  ];
  if (!supported.includes(operation))
    throw new Error(`Unknown file utility: ${operation}`);
  const inputs = await inputPaths(files);
  if (
    !["archive-create", "pdf-merge"].includes(operation) &&
    inputs.length !== 1
  )
    throw new Error("This operation requires exactly one input");
  if (operation !== "archive-create" && inputs.some((i) => !i.stat.isFile()))
    throw new Error("This operation requires regular files");
  const destination = await validateOutput(output, inputs, options);
  const temp = path.join(
    path.dirname(destination),
    `.scribble-${crypto.randomUUID()}${path.extname(destination)}`,
  );
  let details;
  try {
    switch (operation) {
      case "image-convert":
        details = await convertImage(
          inputs[0].file,
          temp,
          options,
          destination,
        );
        break;
      case "image-palette":
        details = await imagePalette(inputs[0].file, temp, options);
        break;
      case "image-compress":
        details = await convertImage(
          inputs[0].file,
          temp,
          { quality: 75, ...options },
          destination,
        );
        details = {
          ...details,
          inputBytes: inputs[0].stat.size,
          reduced: details.bytes < inputs[0].stat.size,
          savedBytes: Math.max(0, inputs[0].stat.size - details.bytes),
        };
        if (!details.reduced)
          details.notice = "Re-encoded image is not smaller than the input";
        break;
      case "audio-convert":
      case "video-convert":
        details = await convertMedia(
          inputs[0].file,
          temp,
          options,
          destination,
          operation === "video-convert",
        );
        break;
      case "pdf-merge":
        details = await mergePDF(inputs, temp);
        break;
      case "archive-create":
        details = await createArchive(inputs, temp);
        break;
      case "archive-extract":
        details = await extractArchive(inputs[0].file, temp);
        break;
      case "config-convert":
        details = await convertConfig(
          inputs[0].file,
          temp,
          options,
          destination,
        );
        break;
      case "markdown-pdf":
        details = await markdownPDF(inputs[0].file, temp, options);
        break;
      case "text-markdown":
        if (inputs[0].stat.size > LIMITS.configBytes)
          throw new Error("Text input exceeds 16 MB");
        await fsp.writeFile(temp, await readUTF8(inputs[0].file));
        details = { format: "md" };
        break;
    }
    if (operation === "archive-extract") {
      try {
        await fsp.access(destination);
        throw new Error("Extraction destination already exists");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await fsp.rename(temp, destination);
    } else await commitFile(temp, destination, !!options.overwrite);
    return { output: destination, details: { operation, ...details } };
  } finally {
    await fsp.rm(temp, { recursive: true, force: true });
  }
}
module.exports = { performUtility, markdownPDF, LIMITS, safeEntryName, crc32 };
