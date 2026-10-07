import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const require = createRequire(import.meta.url);
const { defaultDataDir } = require("../src/main/speech");
const requestedArch = process.env.SCRIBBLE_TARGET_ARCH || process.arch;
const architecture = requestedArch === "x86_64" ? "x64" : requestedArch;
if (!["arm64", "x64"].includes(architecture)) throw Error(`Unsupported runtime architecture: ${requestedArch}`);
const helperArch = process.env.SCRIBBLE_NATIVE_ARCH === "x86_64" ? "x64" : process.env.SCRIBBLE_NATIVE_ARCH;
if (helperArch && helperArch !== architecture) throw Error("Native helper and runtime architectures must match");
const destination = path.resolve(process.env.SCRIBBLE_RUNTIME_STAGE_DIR || "release/runtime");
const isolated = Boolean(process.env.SCRIBBLE_RUNTIME_STAGE_DIR);
if (architecture !== process.arch && destination === path.resolve("release/runtime")) throw Error("Cross-target staging cannot overwrite the shared release runtime");
try { if (architecture !== process.arch && await fs.realpath(destination) === await fs.realpath("release/runtime")) throw Error("Cross-target stage resolves to shared release runtime"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (architecture !== process.arch && (!isolated || !process.env.SCRIBBLE_SPEECH_DATA_DIR || !process.env.SCRIBBLE_FFMPEG_BUILD_DIR)) throw Error("Cross-target runtime staging requires isolated stage, speech data and FFmpeg build directories");
async function run(script) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "--no-model"], {
      stdio: "inherit",
      env: { ...process.env, SCRIBBLE_TARGET_ARCH: architecture, SCRIBBLE_FFMPEG_STAGE_DIR: destination },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`${script} exited with ${code}`)),
    );
  });
}
async function cachedFFmpeg() {
  try {
    const stage = destination;
    const marker = JSON.parse(
      await fs.readFile(path.join(stage, "ffmpeg-build.json"), "utf8"),
    );
    const hash = async (file) =>
      crypto
        .createHash("sha256")
        .update(await fs.readFile(file))
        .digest("hex");
    if (
      marker.arch !== architecture ||
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
await fs.mkdir(destination, { recursive: true });
await fs.mkdir(path.join(destination, "parakeet"), { recursive: true });
await run("scripts/setup-speech.mjs");
const runtime = path.join(process.env.SCRIBBLE_SPEECH_DATA_DIR || defaultDataDir(), "runtime");
const { spawnSync } = await import("node:child_process");
const whisperInspection = spawnSync("/usr/bin/lipo", ["-archs", path.join(runtime, "whisper.cpp/build/bin/whisper-cli")], { encoding: "utf8" });
if (whisperInspection.status !== 0 || whisperInspection.stdout.trim() !== (architecture === "x64" ? "x86_64" : "arm64")) throw Error("Whisper runtime does not match staging architecture");
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
if (process.platform === "darwin" && architecture === "arm64" && process.arch === "arm64") {
  if (!isolated) await run("scripts/setup-parakeet.mjs");
  const from = path.join(isolated ? path.join(defaultDataDir(), "runtime") : runtime, "parakeet"),
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
if (architecture === "x64") await fs.rm(path.join(destination, "parakeet"), { recursive: true, force: true });
if (isolated) {
  // The Ollama staging script currently has a fixed output. Reuse only a verified
  // universal binary in an isolated stage; never invoke it against shared state.
  const from = path.resolve("release/runtime/ollama");
  const { spawnSync } = await import("node:child_process");
  const inspection = spawnSync("/usr/bin/lipo", ["-archs", path.join(from, "ollama")], { encoding: "utf8" });
  if (inspection.status !== 0 || !inspection.stdout.trim().split(/\s+/).includes(architecture === "x64" ? "x86_64" : "arm64")) throw Error("Isolated staging requires an existing matching Ollama runtime");
  const provenance = JSON.parse(await fs.readFile(path.join(from, "scribble-runtime.json"), "utf8"));
  const { release } = await import("./setup-ai.mjs");
  if (provenance.archiveSHA256 !== release.sha256 || provenance.version !== release.version || !Array.isArray(provenance.files)) throw Error("Isolated Ollama runtime provenance mismatch");
  for (const item of provenance.files) {
    const file = path.resolve(from, item.path);
    if (!file.startsWith(from + path.sep)) throw Error("Ollama provenance path escapes runtime");
    if (item.link) { if (await fs.readlink(file) !== item.link) throw Error("Ollama runtime link mismatch"); }
    else if (crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex") !== item.sha256) throw Error("Ollama runtime file hash mismatch");
  }
  await fs.cp(from, path.join(destination, "ollama"), { recursive: true, verbatimSymlinks: true });
} else await new Promise((resolve, reject) => {
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
