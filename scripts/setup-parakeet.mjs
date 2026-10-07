#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import os from "node:os";
import { mkdir, cp, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { defaultDataDir, run } = require("../src/main/speech.js");
if (process.platform !== "darwin" || process.arch !== "arm64")
  throw new Error(
    "Parakeet CoreML requires an Apple Silicon Mac. Use Whisper on Intel or other platforms.",
  );
const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../native/Parakeet",
);
const privateSwift = path.join(
  os.homedir(),
  ".local/share/scribble-tools/swift-6.3.3-expanded/swift-6.3.3-RELEASE-osx-package.pkg/Payload/usr/bin/swift",
);
const swift =
  process.env.SCRIBBLE_SWIFT_BIN ||
  (existsSync(privateSwift) ? privateSwift : "swift");
let selectedSDK = process.env.SDKROOT;
const buildArgs = [
  "build",
  "-c",
  "release",
  "--package-path",
  project,
  "--product",
  "ScribbleParakeet",
];
try {
  await run(swift, buildArgs, { onData: (s) => process.stdout.write(s) });
} catch (error) {
  if (!/unknown architecture|malformed file/.test(error.message)) throw error;
  const root = "/Library/Developer/CommandLineTools/SDKs";
  const sdks = (await readdir(root))
    .filter((s) => /^MacOSX\d+\.\d+\.sdk$/.test(s))
    .sort((a, b) => parseFloat(b.slice(6)) - parseFloat(a.slice(6)));
  let success = false;
  for (const sdk of sdks) {
    try {
      await run(swift, [...buildArgs, "--sdk", path.join(root, sdk)], {
        onData: (s) => process.stdout.write(s),
        env: { SDKROOT: path.join(root, sdk) },
      });
      selectedSDK = path.join(root, sdk);
      success = true;
      break;
    } catch {}
  }
  if (!success) throw error;
}
const output = (
  await run(
    swift,
    ["build", "-c", "release", "--package-path", project, "--show-bin-path"],
    { env: selectedSDK ? { SDKROOT: selectedSDK } : undefined },
  )
).trim();
const runtime = path.join(defaultDataDir(), "runtime", "parakeet");
await mkdir(runtime, { recursive: true });
await cp(
  path.join(output, "ScribbleParakeet"),
  path.join(runtime, "ScribbleParakeet"),
);
for (const name of await readdir(output))
  if (name.endsWith(".bundle"))
    await cp(path.join(output, name), path.join(runtime, name), {
      recursive: true,
    });
console.log(
  "Installed Parakeet runtime:",
  path.join(runtime, "ScribbleParakeet"),
);
if (!process.argv.includes("--no-model")) {
  const { ParakeetEngine } = require("../src/main/parakeet.js");
  const engine = new ParakeetEngine({ dataDir: defaultDataDir() });
  const id =
    process.argv.find((s) => s.startsWith("--model="))?.slice(8) ||
    "parakeet-v3";
  if (!engine.listModels().find((m) => m.id === id)?.installed) {
    let last = -1;
    engine.on("download-progress", (p) => {
      const percent = Math.floor(p.progress * 100);
      if (percent >= last + 5) {
        last = percent;
        console.log(`Downloading ${id}: ${percent}%`);
      }
    });
    await engine.downloadModel(id);
  }
}
console.log("Parakeet is ready for local transcription.");
