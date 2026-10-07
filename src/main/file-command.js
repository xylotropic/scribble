"use strict";
function parseFileCommand(text) {
  if (typeof text !== "string" || text.length > 300 || /[\r\n;]/.test(text))
    return null;
  const command = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]$/, "")
    .replace(/\s+/g, " ");
  const formats = {
    jpg: "image-convert",
    jpeg: "image-convert",
    png: "image-convert",
    webp: "image-convert",
    wav: "audio-convert",
    mp3: "audio-convert",
    m4a: "audio-convert",
    opus: "audio-convert",
    mp4: "video-convert",
    webm: "video-convert",
    json: "config-convert",
    yaml: "config-convert",
    yml: "config-convert",
    toml: "config-convert",
  };
  const conversion =
    command.match(
      /^(?:convert|make|change|turn) (?:this|these|the selected) ?(?:image|images|audio|video|file|files|config|configuration)?(?: into| to| as)? (?:a |an )?(jpg|jpeg|png|webp|wav|mp3|m4a|opus|mp4|webm|json|yaml|yml|toml)(?: file| files| image)?$/,
    ) ||
    command.match(
      /^convert (?:image|audio|video|config|configuration|file|files) to (jpg|jpeg|png|webp|wav|mp3|m4a|opus|mp4|webm|json|yaml|yml|toml)$/,
    );
  const explicitConversion = command.match(/^(?:convert|change|turn) (?:this |these |the selected )?(?:image|images|audio|video|file|files|config|configuration) from (jpg|jpeg|png|webp|wav|mp3|m4a|opus|mp4|webm|json|yaml|yml|toml) (?:to|into) (jpg|jpeg|png|webp|wav|mp3|m4a|opus|mp4|webm|json|yaml|yml|toml)$/);
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
  const commands = [
    [
      /^(?:compress|optimize) (?:this |the selected )?(?:image|photo)$/,
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
      /^(?:unzip|extract) (?:this |the selected )?(?:zip|archive|zip file)$/,
      "archive-extract",
    ],
    [
      /^(?:convert|make|turn) (?:this |the selected )?(?:text|text file)(?: to| into| as) markdown$/,
      "text-markdown",
    ],
    [
      /^(?:convert|export) (?:this |the selected )?(?:markdown|markdown file)(?: to| as) (?:a )?pdf$/,
      "markdown-pdf",
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
