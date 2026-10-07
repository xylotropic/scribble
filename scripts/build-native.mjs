import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin') { console.log('Native macOS bridge build skipped on this platform.'); process.exit(0); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arch = process.env.SCRIBBLE_NATIVE_ARCH || process.arch;
if (!['arm64', 'x64', 'x86_64'].includes(arch)) throw new Error(`Unsupported architecture: ${arch}; select arm64 or x64.`);
const targetArch = arch === 'arm64' ? 'arm64' : 'x86_64';
const selected = spawnSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { encoding: 'utf8' }).stdout?.trim();
const compatible = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const sdk = process.env.SCRIBBLE_MACOS_SDK || (existsSync(compatible) ? compatible : selected);
if (!sdk || !existsSync(sdk)) throw new Error(`macOS SDK missing: ${sdk}. Set SCRIBBLE_MACOS_SDK to an installed SDK.`);
const output = resolve(process.env.SCRIBBLE_NATIVE_OUTPUT || resolve(root, 'release/native/scribble-bridge'));
const args = ['swiftc', '-O', '-sdk', sdk, '-target', `${targetArch}-apple-macos13.0`, resolve(root, 'native/ScribbleBridge.swift'), '-o', output, '-framework', 'Cocoa', '-framework', 'ApplicationServices', '-framework', 'ScreenCaptureKit', '-framework', 'AVFoundation'];
if (process.env.SCRIBBLE_BUILD_DRY_RUN === '1') { console.log(JSON.stringify({ arch: targetArch, sdk, output, command: 'xcrun', args })); process.exit(0); }
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync('xcrun', args, { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const inspection = spawnSync('/usr/bin/lipo', ['-archs', output], { encoding: 'utf8' });
if (inspection.status !== 0 || inspection.stdout.trim() !== targetArch) throw new Error(`Built bridge architecture mismatch: expected ${targetArch}, received ${inspection.stdout?.trim() || 'unreadable Mach-O'}`);
