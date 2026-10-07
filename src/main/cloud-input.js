"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os");
const { run, resolveExecutablePath } = require("./speech");
async function prepareCloudAudio(file, { signal } = {}) {
  const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "scribble-cloud-audio-"),
    ),
    output = path.join(directory, "audio.mp3");
  const cleanup = () => fs.rm(directory, { recursive: true, force: true });
  try {
    const binary = resolveExecutablePath(
      require("./ffmpeg").ffmpegExecutable(),
    );
    const progress = await run(
      binary,
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-nostats",
        "-i",
        file,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "64k",
        output,
      ],
      { signal },
    );
    const match = [...progress.matchAll(/out_time_(?:us|ms)=(\d+)/g)].at(-1);
    const duration = match ? Number(match[1]) / 1e6 : null;
    return { filePath: output, duration, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
module.exports = { prepareCloudAudio };
