# Parakeet on Apple Silicon

Scribble's independent Swift command-line adapter uses [FluidAudio](https://github.com/FluidInference/FluidAudio) v0.17.5, commit `0b1f46289fe27d95b5e66ad8be46e64f5ee02ae7` (Apache-2.0). SwiftPM pins the exact source commit and disables optional NeMo text-processing traits. No Vowen binary or implementation is used.

The models are FluidInference's CoreML conversions of NVIDIA Parakeet TDT 0.6b [v2](https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v2-coreml) and [v3](https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml), licensed CC-BY-4.0. Attribution: NVIDIA (original Parakeet model) and FluidInference (CoreML conversion). Revisions and per-file SHA-256/Git blob hashes are recorded in `native/Parakeet/models.json`; downloads verify every artifact before installation. v2 is English-only (~464 MB), v3 is multilingual (~483 MB).

On macOS 14+ Apple Silicon with Swift 6.2+ and Command Line Tools:

```
npm run setup:parakeet
```

Setup builds the adapter and installs v3; use `--model=parakeet-v2` for v2 or `--no-model` for only the runtime. `SCRIBBLE_SWIFT_BIN` selects a custom Swift toolchain without changing the system toolchain. If macOS's SwiftPM reports missing framework symbols before it builds anything, install a consistent official Swift toolchain from [Swift.org](https://www.swift.org/install/macos/) and select its `usr/bin/swift`. The repository contains buildable Swift source; it does not redistribute Apple toolchain files.

Parakeet uses local CoreML inference and word timestamps, which Scribble groups into caption segments. It transcribes the original language; translation to English uses Whisper instead. v3 supports a language hint, but does not expose automatic language detection, so the adapter reports `unknown` when no language is supplied. This is not a fabricated detected language. Intel Macs and other platforms retain the Whisper engine.

Models and the adapter live in Scribble's local data directory. Removing a model deletes only Scribble's own downloaded copy. Temporary converted audio is removed after every transcription, including failures or cancellation. No network access is needed during inference.

Unit tests: `node --test test/parakeet.test.js`. Optional actual spoken-fixture integration: `SCRIBBLE_TEST_PARAKEET_AUDIO=/absolute/path/to/jfk.wav node --test test/parakeet.test.js`.

Verified on Apple M4 arm64: both v2 and v3 recognized the upstream 11-second JFK recording as “And so, my fellow Americans, ask not what your country can do for you, ask what you can do for your country.” Both returned word-derived caption segments and 11-second duration through Scribble's complete FFmpeg + SpeechEngine dispatch path. v3 took ~843 ms after initial CoreML compilation. First use took ~33 seconds for v3 and ~27 seconds for v2; macOS caches compiled CoreML models for later runs. The initial optimized FluidAudio source build took ~341 seconds with official Swift 6.3.3 and MacOSX26.5 SDK.

The npm FFmpeg binary is resolved from `app.asar.unpacked` in packaged Electron apps; the engine never tries to spawn a path inside an archive. A regression test creates an archive-shaped file tree and actually executes the unpacked binary.
