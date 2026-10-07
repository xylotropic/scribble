#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, access, readdir, readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const require = createRequire(import.meta.url);
const { SpeechEngine, defaultDataDir, run } = require("../src/main/speech.js");
const version = "v1.8.7";
const expectedCommit = "48f628a84833905ee4a0658ee6d4a5c915ce1997";
const requestedArch = process.env.SCRIBBLE_TARGET_ARCH || process.arch;
const architecture = requestedArch === "x86_64" ? "x64" : requestedArch;
if (!["arm64", "x64"].includes(architecture)) throw Error(`Unsupported speech architecture: ${requestedArch}`);
if (architecture !== process.arch && !process.env.SCRIBBLE_SPEECH_DATA_DIR) throw Error("Cross-target speech builds require SCRIBBLE_SPEECH_DATA_DIR for isolation");
const dataDir = path.resolve(process.env.SCRIBBLE_SPEECH_DATA_DIR || defaultDataDir());
if (architecture !== process.arch && dataDir === path.resolve(defaultDataDir())) throw Error("Cross-target speech builds cannot reuse the installed data directory");
try {
  if (architecture !== process.arch && await realpath(dataDir) === await realpath(defaultDataDir())) throw Error("Cross-target speech directory resolves to installed data");
} catch (error) { if (error.code !== "ENOENT") throw error; }
const source = path.join(dataDir, "runtime", "whisper.cpp");
const build = path.join(source, "build");
await mkdir(path.dirname(source), { recursive: true });
const marker = path.join(path.dirname(source), "speech-build-arch.json");
try { if (JSON.parse(await readFile(marker, "utf8")).arch !== architecture) throw Error("Speech build directory belongs to another architecture; choose a fresh data directory"); } catch (error) { if (error.code !== "ENOENT") throw error; }
try {
  const cache = await readFile(path.join(source, "build", "CMakeCache.txt"), "utf8");
  const prior = cache.match(/^CMAKE_OSX_ARCHITECTURES:[^=]*=(.+)$/m)?.[1];
  if (prior && prior !== (architecture === "x64" ? "x86_64" : "arm64")) throw Error("Existing Whisper CMake cache belongs to another architecture");
} catch (error) { if (error.code !== "ENOENT") throw error; }
await writeFile(marker, JSON.stringify({ arch: architecture }));
try {
  await access(path.join(source, ".git"));
  await run("git", [
    "-C",
    source,
    "fetch",
    "--depth",
    "1",
    "origin",
    `refs/tags/${version}`,
  ]);
  await run("git", ["-C", source, "checkout", "--detach", "FETCH_HEAD"]);
} catch (error) {
  try {
    await access(source);
    throw error;
  } catch (check) {
    if (check.code !== "ENOENT") throw check;
  }
  await run("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    version,
    "https://github.com/ggml-org/whisper.cpp.git",
    source,
  ]);
}
const commit = (await run("git", ["-C", source, "rev-parse", "HEAD"])).trim();
if (commit !== expectedCommit)
  throw new Error(`Unexpected whisper.cpp source commit ${commit}`);
let cmake = "cmake";
try {
  await run(cmake, ["--version"]);
} catch {
  const envDir = path.join(dataDir, "runtime", "build-tools");
  await run("python3", ["-m", "venv", envDir]);
  const python = path.join(
    envDir,
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  await run(python, ["-m", "pip", "install", "cmake==3.31.6"]);
  cmake = path.join(
    envDir,
    process.platform === "win32" ? "Scripts/cmake.exe" : "bin/cmake",
  );
}
console.log(
  `Building whisper.cpp ${version} for ${process.platform}/${architecture}. A C++ compiler is required (macOS: xcode-select --install).`,
);
const configureArgs = [
  "-S",
  source,
  "-B",
  build,
  "-DCMAKE_BUILD_TYPE=Release",
  "-DBUILD_SHARED_LIBS=OFF",
  "-DGGML_NATIVE=OFF",
  ...(process.platform === "darwin" ? ["-DCMAKE_OSX_DEPLOYMENT_TARGET=14.0", `-DCMAKE_OSX_ARCHITECTURES=${architecture === "x64" ? "x86_64" : "arm64"}`, ...(process.env.SCRIBBLE_MACOS_SDK ? [`-DCMAKE_OSX_SYSROOT=${process.env.SCRIBBLE_MACOS_SDK}`] : [])] : []),
  "-DWHISPER_BUILD_TESTS=OFF",
  "-DWHISPER_BUILD_EXAMPLES=ON",
  "-DGGML_METAL_EMBED_LIBRARY=ON",
];
try {
  await run(cmake, configureArgs, { onData: (s) => process.stdout.write(s) });
} catch (error) {
  if (
    process.platform !== "darwin" ||
    !error.message.includes("unknown architecture")
  )
    throw error;
  const sdkRoot = "/Library/Developer/CommandLineTools/SDKs";
  const sdks = (await readdir(sdkRoot))
    .filter((s) => /^MacOSX\d+\.\d+\.sdk$/.test(s))
    .sort((a, b) => parseFloat(b.slice(6)) - parseFloat(a.slice(6)));
  let built = false;
  for (const sdk of sdks) {
    try {
      console.log(`Retrying with installed compatible SDK ${sdk}`);
      await run(
        cmake,
        [
          ...configureArgs,
          `-DCMAKE_OSX_SYSROOT=${path.join(sdkRoot, sdk)}`,
          "-DCMAKE_OSX_DEPLOYMENT_TARGET=14.0",
        ],
        { onData: (s) => process.stdout.write(s) },
      );
      built = true;
      break;
    } catch {}
  }
  if (!built) throw error;
}
await run(
  cmake,
  [
    "--build",
    build,
    "--config",
    "Release",
    "--target",
    "whisper-cli",
    "-j",
    String(Math.min(8, os.availableParallelism())),
  ],
  { onData: (s) => process.stdout.write(s) },
);
const binary = path.join(build, "bin", "whisper-cli");
if (process.platform === "darwin") {
  const actual = (await run("/usr/bin/lipo", ["-archs", binary])).trim();
  if (actual !== (architecture === "x64" ? "x86_64" : "arm64")) throw Error(`Speech architecture mismatch: ${actual}`);
}
const engine = new SpeechEngine({ dataDir });
console.log("Runtime:", engine.runtimePath());
if (!process.argv.includes("--no-model")) {
  const arg = process.argv.find((s) => s.startsWith("--model="));
  const id = arg?.slice(8) || "base.en";
  if (!engine.listModels().find((m) => m.id === id)?.installed) {
    let last = -1;
    engine.on("download-progress", (p) => {
      const percent = Math.floor(p.progress * 100);
      if (percent !== last) {
        last = percent;
        process.stdout.write(`\rDownloading ${id}: ${percent}%`);
      }
    });
    await engine.downloadModel(id);
    console.log();
  }
}
console.log(
  "Local speech is ready. Audio stays on your computer during transcription.",
);
