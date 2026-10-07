import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
if (process.platform !== 'darwin') { console.log('macOS Share extension build skipped.'); process.exit(0); }
const compatible = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const sdk = process.env.SCRIBBLE_MACOS_SDK || (existsSync(compatible) ? compatible : spawnSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { encoding: 'utf8' }).stdout.trim());
if (!existsSync(sdk)) throw new Error(`macOS SDK missing: ${sdk}`);
const arch = process.env.SCRIBBLE_NATIVE_ARCH || process.arch;
if (!['arm64', 'x64', 'x86_64'].includes(arch)) throw new Error(`Unsupported architecture: ${arch}`);
const bundle = resolve('release/native/ScribbleShare.appex');
for (const plist of ['native/ShareExtension/Info.plist', 'native/ShareExtension/entitlements.plist']) {
  const lint = spawnSync('plutil', ['-lint', plist], { stdio: 'inherit' });
  if (lint.status !== 0) process.exit(lint.status ?? 1);
}
mkdirSync(`${bundle}/Contents/MacOS`, { recursive: true });
copyFileSync('native/ShareExtension/Info.plist', `${bundle}/Contents/Info.plist`);
const result = spawnSync('xcrun', ['swiftc', '-O', '-application-extension', '-parse-as-library', '-emit-executable', '-sdk', sdk, '-target', `${arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos14.0`, '-module-name', 'ScribbleShare', '-Xlinker', '-e', '-Xlinker', '_NSExtensionMain', resolve('native/ShareExtension/ShareViewController.swift'), '-o', `${bundle}/Contents/MacOS/ScribbleShare`, '-framework', 'Cocoa', '-framework', 'UniformTypeIdentifiers'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const sign = spawnSync('codesign', ['--force', '--sign', '-', '--entitlements', resolve('native/ShareExtension/entitlements.plist'), bundle], { stdio: 'inherit' });
process.exit(sign.status ?? 1);
