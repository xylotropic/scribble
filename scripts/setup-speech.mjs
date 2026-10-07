#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, access, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const require = createRequire(import.meta.url);
const { SpeechEngine, defaultDataDir, run } = require("../src/main/speech.js");
const version = "v1.8.7";
const expectedCommit = "48f628a84833905ee4a0658ee6d4a5c915ce1997";
const dataDir = defaultDataDir();
const source = path.join(dataDir, "runtime", "whisper.cpp");
const build = path.join(source, "build");
await mkdir(path.dirname(source), { recursive: true });
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
  `Building whisper.cpp ${version} for ${process.platform}/${process.arch}. A C++ compiler is required (macOS: xcode-select --install).`,
);
const configureArgs = [
  "-S",
  source,
  "-B",
  build,
  "-DCMAKE_BUILD_TYPE=Release",
  "-DBUILD_SHARED_LIBS=OFF",
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
