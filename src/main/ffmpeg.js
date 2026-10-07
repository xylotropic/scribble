"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function ffmpegExecutable({
  resourcesPath = process.resourcesPath,
  override = process.env.SCRIBBLE_FFMPEG_BIN,
} = {}) {
  const candidates = [
    override,
    resourcesPath && path.join(resourcesPath, "native", "ffmpeg"),
    path.resolve(__dirname, "../../release/runtime/ffmpeg"),
    path.join(
      os.homedir(),
      "Library/Application Support/Scribble/runtime/ffmpeg",
    ),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  throw Error(
    "FFmpeg is missing. Run npm run setup:ffmpeg, or set SCRIBBLE_FFMPEG_BIN to your installed executable.",
  );
}
module.exports = { ffmpegExecutable };
