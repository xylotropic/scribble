import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin') { console.log('macOS Share extension build skipped.'); process.exit(0); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arch = process.env.SCRIBBLE_NATIVE_ARCH || process.arch;
if (!['arm64', 'x64', 'x86_64'].includes(arch)) throw new Error(`Unsupported architecture: ${arch}; select arm64 or x64.`);
const targetArch = arch === 'arm64' ? 'arm64' : 'x86_64';
const compatible = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const selected = spawnSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { encoding: 'utf8' }).stdout?.trim();
const sdk = process.env.SCRIBBLE_MACOS_SDK || (existsSync(compatible) ? compatible : selected);
if (!sdk || !existsSync(sdk)) throw new Error(`macOS SDK missing: ${sdk}`);
const bundle = resolve(process.env.SCRIBBLE_SHARE_OUTPUT || resolve(root, 'release/native/ScribbleShare.appex'));
if (!bundle.endsWith('.appex')) throw new Error('Share extension output must end in .appex');
const args = ['swiftc', '-O', '-application-extension', '-parse-as-library', '-emit-executable', '-sdk', sdk, '-target', `${targetArch}-apple-macos14.0`, '-module-name', 'ScribbleShare', '-Xlinker', '-e', '-Xlinker', '_NSExtensionMain', resolve(root, 'native/ShareExtension/ShareViewController.swift'), '-o', `${bundle}/Contents/MacOS/ScribbleShare`, '-framework', 'Cocoa', '-framework', 'UniformTypeIdentifiers'];
if (process.env.SCRIBBLE_BUILD_DRY_RUN === '1') { console.log(JSON.stringify({ arch: targetArch, sdk, output: bundle, command: 'xcrun', args })); process.exit(0); }
for (const plist of ['Info.plist', 'entitlements.plist']) {
  const lint = spawnSync('plutil', ['-lint', resolve(root, 'native/ShareExtension', plist)], { stdio: 'inherit' });
  if (lint.status !== 0) process.exit(lint.status ?? 1);
}
mkdirSync(`${bundle}/Contents/MacOS`, { recursive: true });
copyFileSync(resolve(root, 'native/ShareExtension/Info.plist'), `${bundle}/Contents/Info.plist`);
const result = spawnSync('xcrun', args, { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const inspection = spawnSync('/usr/bin/lipo', ['-archs', `${bundle}/Contents/MacOS/ScribbleShare`], { encoding: 'utf8' });
if (inspection.status !== 0 || inspection.stdout.trim() !== targetArch) throw new Error(`Built Share extension architecture mismatch: expected ${targetArch}, received ${inspection.stdout?.trim() || 'unreadable Mach-O'}`);
const sign = spawnSync('codesign', ['--force', '--sign', '-', '--entitlements', resolve(root, 'native/ShareExtension/entitlements.plist'), bundle], { stdio: 'inherit' });
process.exit(sign.status ?? 1);
