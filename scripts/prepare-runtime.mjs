import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { defaultDataDir } = require("../src/main/speech");
async function run(script) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "--no-model"], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`${script} exited with ${code}`)),
    );
  });
}
async function cachedFFmpeg() {
  try {
    const stage = path.resolve("release/runtime");
    const marker = JSON.parse(
      await fs.readFile(path.join(stage, "ffmpeg-build.json"), "utf8"),
    );
    const hash = async (file) =>
      crypto
        .createHash("sha256")
        .update(await fs.readFile(file))
        .digest("hex");
    if (
      marker.arch !== process.arch ||
      marker.platform !== process.platform ||
      marker.recipeSHA256 !== (await hash("scripts/setup-ffmpeg.mjs")) ||
      marker.binarySHA256 !== (await hash(path.join(stage, "ffmpeg")))
    )
      return false;
    const sources = JSON.parse(
      await fs.readFile("docs/licenses/ffmpeg-sources.json", "utf8"),
    );
    for (const source of sources) {
      if (
        !marker.sources.some(
          (item) =>
            item.filename === source.filename && item.sha256 === source.sha256,
        ) ||
        source.sha256 !==
          (await hash(
            path.join(stage, "licenses/ffmpeg/sources", source.filename),
          ))
      )
        return false;
    }
    if (
      marker.buildRecipeSHA256 !==
      (await hash(path.join(stage, "licenses/ffmpeg/build-recipe.json")))
    )
      return false;
    await fs.access(path.join(stage, "licenses/ffmpeg/ffmpeg-COPYING.GPLv2"));
    return true;
  } catch {
    return false;
  }
}
if (await cachedFFmpeg())
  console.log(
    "Reusing verified FFmpeg build and corresponding source archives.",
  );
else await run("scripts/setup-ffmpeg.mjs");
const destination = path.resolve("release/runtime");
await fs.mkdir(destination, { recursive: true });
await fs.mkdir(path.join(destination, "parakeet"), { recursive: true });
await run("scripts/setup-speech.mjs");
const runtime = path.join(defaultDataDir(), "runtime");
await fs.copyFile(
  path.join(runtime, "whisper.cpp/build/bin/whisper-cli"),
  path.join(destination, "whisper-cli"),
);
await fs.chmod(path.join(destination, "whisper-cli"), 0o755);
await fs.rm(path.join(destination, "WHISPER-LICENSE"), { force: true });
await fs.copyFile(
  path.join(runtime, "whisper.cpp/LICENSE"),
  path.join(destination, "WHISPER-LICENSE"),
);
if (process.platform === "darwin" && process.arch === "arm64") {
  await run("scripts/setup-parakeet.mjs");
  const from = path.join(runtime, "parakeet"),
    to = path.join(destination, "parakeet");
  await fs.mkdir(to, { recursive: true });
  for (const name of await fs.readdir(from))
    if (
      ["ScribbleParakeet", "ScribbleCatalog"].includes(name) ||
      name.endsWith(".bundle")
    )
      await fs.cp(path.join(from, name), path.join(to, name), {
        recursive: true,
      });
  const fluidLicense = path.resolve(
    "native/Parakeet/.build/checkouts/FluidAudio/LICENSE",
  );
  await fs.rm(path.join(to, "FLUIDAUDIO-LICENSE"), { force: true });
  await fs.copyFile(fluidLicense, path.join(to, "FLUIDAUDIO-LICENSE"));
}
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/bundle-ai.mjs"], {
    stdio: "inherit",
  });
  child.on("error", reject);
  child.on("exit", (code) =>
    code === 0 ? resolve() : reject(Error("Ollama runtime staging failed")),
  );
});
console.log(
  "Staged local speech runtimes. Model weights are downloaded separately through the app.",
);
