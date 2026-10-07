"use strict";
function parseFileCommand(text) {
  if (typeof text !== "string" || text.length > 300 || /[\r\n;]/.test(text))
    return null;
  const command = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]$/, "")
    .replace(/\s+/g, " ");
  const literal = text.trim().replace(/[.!?]$/, "").replace(/\s+/g, " ");
  const combined = literal.match(/^(merge|combine) (?:these |the selected )?(?:pdfs|pdf files)(?:,? (?:as|into|named|called) (.+))?$/i) || literal.match(/^(zip|archive) (?:this |these |the selected )?(?:file|files|folder|folders)(?:,? (?:as|into|named|called) (.+))?$/i);
  if (combined) {
    const operation = /^(merge|combine)$/i.test(combined[1]) ? "pdf-merge" : "archive-create";
    try { return {operation,options:combined[2] ? {outputName:require("./file-combined").outputName(operation,combined[2])} : {}}; }
    catch { return null; }
  }
  const formats = {
    jpg: "image-convert",
    jpeg: "image-convert",
    png: "image-convert",
    webp: "image-convert",
    avif: "image-convert", gif: "image-convert", tiff: "image-convert", heic: "image-convert", heif: "image-convert", jfif: "image-convert",
    wav: "audio-convert",
    mp3: "audio-convert",
    m4a: "audio-convert",
    opus: "audio-convert", aac: "audio-convert", flac: "audio-convert", ogg: "audio-convert", wma: "audio-convert",
    mp4: "video-convert",
    webm: "video-convert", avi: "video-convert", mov: "video-convert", mkv: "video-convert", flv: "video-convert", wmv: "video-convert",
    json: "config-convert",
    yaml: "config-convert",
    yml: "config-convert",
    toml: "config-convert", xml: "config-convert",
  };
  const conversion =
    command.match(
      /^(?:convert|make|change|turn) (?:this|these|the selected) ?(?:image|images|audio|video|file|files|config|configuration)?(?: into| to| as)? (?:a |an )?(jpg|jpeg|png|webp|avif|gif|tiff|heic|heif|jfif|wav|mp3|m4a|opus|aac|flac|ogg|wma|mp4|webm|avi|mov|mkv|flv|wmv|json|yaml|yml|toml|xml)(?: file| files| image)?$/,
    ) ||
    command.match(
      /^convert (?:image|audio|video|config|configuration|file|files) to (jpg|jpeg|png|webp|avif|gif|tiff|heic|heif|jfif|wav|mp3|m4a|opus|aac|flac|ogg|wma|mp4|webm|avi|mov|mkv|flv|wmv|json|yaml|yml|toml|xml)$/,
    );
  const explicitConversion = command.match(/^(?:convert|change|turn) (?:this |these |the selected )?(?:image|images|audio|video|file|files|config|configuration) from (jpg|jpeg|png|webp|avif|gif|tiff|heic|heif|jfif|wav|mp3|m4a|opus|aac|flac|ogg|wma|mp4|webm|avi|mov|mkv|flv|wmv|json|yaml|yml|toml|xml) (?:to|into) (jpg|jpeg|png|webp|avif|gif|tiff|heic|heif|jfif|wav|mp3|m4a|opus|aac|flac|ogg|wma|mp4|webm|avi|mov|mkv|flv|wmv|json|yaml|yml|toml|xml)$/);
  if (explicitConversion) {
    const [,from,to] = explicitConversion;
    if (formats[from] !== formats[to]) return null;
    const normalize = value => value.replace("jpeg", "jpg").replace("yml", "yaml");
    return {operation:formats[to],options:{format:normalize(to),...(formats[to] === "config-convert" ? {from:normalize(from)} : {})}};
  }
  if (conversion) {
    const format = conversion[1].replace("jpeg", "jpg").replace("yml", "yaml");
    return { operation: formats[conversion[1]], options: { format } };
  }
  const textMarkdown = command.match(/^(?:convert|make|turn) (?:this |these |the selected )?(?:text|text file|text files)(?: to| into| as) markdown(?:,? (without (?:a |the )?(?:first[- ]line )?heading|(?:don't|do not) (?:make|turn) (?:the )?first line (?:into )?(?:a )?heading))?$/);
  if (textMarkdown) return { operation: "text-markdown", options: textMarkdown[1] ? { firstLineHeading: false } : {} };
  const compression = command.match(/^(?:compress|optimize) (?:this |these |the selected )?(?:image|images|photo|photos)(?: to| at) (\d{1,3})(?: percent|%| quality)$/);
  if (compression) return Number(compression[1]) >= 1 && Number(compression[1]) <= 100 ? {operation:"image-compress",options:{quality:Number(compression[1])}} : null;
  const markdownPDF = command.match(/^(?:convert|export|turn|make) (?:this |these |the selected )?markdown(?: files?)? (?:to|into|as) (?:a )?pdfs?(?:,? (?:with |using )?(minimal|github|github-flavou?red) (?:style|styling))?$/);
  if (markdownPDF) return { operation: "markdown-pdf", options: markdownPDF[1] ? {style:markdownPDF[1] === "minimal" ? "minimal" : "github"} : {} };
  const commands = [
    [
      /^(?:compress|optimize) (?:this |these |the selected )?(?:image|images|photo|photos)$/,
      "image-compress",
    ],
    [
      /^(?:merge|combine) (?:these |the selected )?(?:pdfs|pdf files)$/,
      "pdf-merge",
    ],
    [
      /^(?:zip|archive) (?:this |these |the selected )?(?:file|files|folder|folders)$/,
      "archive-create",
    ],
    [
      /^(?:unzip|extract) (?:this |these |the selected )?(?:zip|zips|archive|archives|zip file|zip files)$/,
      "archive-extract",
    ],
    [
      /^(?:convert|make|turn) (?:this |the selected )?(?:text|text file)(?: to| into| as) markdown$/,
      "text-markdown",
    ],
    [
      /^(?:extract|generate|create|make) (?:a |the )?(?:color |colour )?palette(?: from)? (?:this |the selected )?(?:image|photo)$/,
      "image-palette",
    ],
  ];
  for (const [pattern, operation] of commands)
    if (pattern.test(command)) return { operation, options: {} };
  return null;
}
module.exports = { parseFileCommand };
