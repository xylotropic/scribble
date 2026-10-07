import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
if (process.platform !== 'darwin') { console.log('Native macOS bridge build skipped on this platform.'); process.exit(0); }
const selected=spawnSync('xcrun',['--sdk','macosx','--show-sdk-path'],{encoding:'utf8'}).stdout?.trim();
const compatible='/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const sdk = process.env.SCRIBBLE_MACOS_SDK || (existsSync(compatible)?compatible:selected);
if (!sdk || !existsSync(sdk)) throw new Error(`macOS SDK missing: ${sdk}. Set SCRIBBLE_MACOS_SDK to an installed SDK.`);
mkdirSync('release/native', { recursive: true });
const arch = process.env.SCRIBBLE_NATIVE_ARCH || process.arch;
const targetArch = arch === 'arm64' ? 'arm64' : 'x86_64';
const result = spawnSync('xcrun', ['swiftc', '-O', '-sdk', sdk, '-target', `${targetArch}-apple-macos13.0`, resolve('native/ScribbleBridge.swift'), '-o', resolve('release/native/scribble-bridge'), '-framework', 'Cocoa', '-framework', 'ApplicationServices', '-framework', 'ScreenCaptureKit', '-framework', 'AVFoundation'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
