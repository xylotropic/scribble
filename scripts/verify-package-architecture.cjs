'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { Arch } = require('builder-util');
function requiredArchitectures(arch) {
  if (arch === Arch.arm64) return ['arm64'];
  if (arch === Arch.x64) return ['x86_64'];
  if (arch === Arch.universal) return ['arm64', 'x86_64'];
  throw Error(`Unsupported macOS package architecture: ${arch}`);
}
function verifyMacPackage(appPath, arch, inspect = file => {
  const result = spawnSync('/usr/bin/lipo', ['-archs', file], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(`Cannot inspect packaged executable: ${file}`);
  return result.stdout.trim().split(/\s+/);
}) {
  const required = requiredArchitectures(arch);
  const contents = path.join(appPath, 'Contents');
  const name = path.basename(appPath, '.app');
  const files = [
    `MacOS/${name}`,
    'Resources/native/scribble-bridge',
    'Resources/native/scribble-image-codec',
    'Resources/native/speech/whisper-cli',
    'Resources/native/ffmpeg',
    'Resources/runtime/ollama/ollama',
    'PlugIns/ScribbleShare.appex/Contents/MacOS/ScribbleShare',
  ];
  for (const relative of files) {
    const actual = inspect(path.join(contents, relative));
    if (!required.every(value => actual.includes(value)))
      throw Error(`Package architecture mismatch for ${relative}: needs ${required.join('+')}, contains ${actual.join('+')}. Prepare matching native and speech/media runtimes before packaging.`);
  }
  for (const name of ['ScribbleParakeet', 'ScribbleCatalog']) {
    const file = path.join(contents, 'Resources/native/parakeet', name);
    if (!fs.existsSync(file)) continue;
    const actual = inspect(file);
    if (!actual.includes('arm64') || !required.includes('arm64'))
      throw Error(`Apple Silicon speech helper ${name} cannot be included in this package architecture.`);
  }
  return { architectures: required, checkedExecutables: files.length };
}
async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const name = context.packager.appInfo.productFilename;
  const result = verifyMacPackage(path.join(context.appOutDir, `${name}.app`), context.arch);
  console.log(`Verified ${result.checkedExecutables} packaged executables for ${result.architectures.join('+')}.`);
}
module.exports = afterPack;
module.exports.verifyMacPackage = verifyMacPackage;
module.exports.requiredArchitectures = requiredArchitectures;
