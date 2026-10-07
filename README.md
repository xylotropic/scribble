# Scribble

An original, open-source voice workspace for macOS. Speech transcription runs on your Mac by default. Optional cloud speech and text assistance runs through local Ollama or a provider you explicitly configure.

## Build and run

Requires macOS 14+, Node.js 24+, and Apple Command Line Tools (`xcode-select --install`). Apple Silicon supports Parakeet; Whisper also supports Intel Macs.

```sh
npm ci
npm run setup
npm start
```

The speech setup downloads pinned whisper.cpp source and a verified speech model into your application support directory. Optional engines:

```sh
npm run setup:parakeet
npm run setup:ai
```

See [Parakeet setup](docs/parakeet.md) and [local AI setup](docs/ai.md). Model downloads consume disk space and bandwidth; local inference has no usage fees. Cloud providers may charge separately.

```sh
npm test
npm run package
```

Packaging builds the speech runtimes, a redistributable FFmpeg from pinned official sources, and bundles Ollama without model weights. Its first build can take several minutes and requires network downloads; later builds reuse compiled dependencies. Corresponding FFmpeg sources and notices are included in the app.

The macOS app appears in `release/mac-arm64/Scribble.app` on Apple Silicon. Locally ad-hoc signed builds require macOS permission setup and are not notarized releases. Grant microphone access for recording and Accessibility for global shortcuts, text insertion, and expansions. Screen/system-audio permission is optional for meeting audio.

## Workspace

Dictation, meeting notes, audio/video transcription, editable history, timestamped subtitles, dictionary corrections, reusable text expansions, voice shortcuts, text commands, application tones, reference memory, and local file conversion tools share one workspace. No account or artificial transcription quota is required.

Hold Option+Space for dictation; Option+Shift+Space toggles recording. Shortcuts are configurable. Use the CLI with the running app:

```sh
node scripts/scribble.cjs status --json
node scripts/scribble.cjs transcribe /absolute/path/recording.wav --json
```

See [CLI and MCP](docs/cli.md), [native bridge](docs/native.md), [file utilities](docs/utilities.md), and [feature verification ledger](docs/acceptance.md). Some workflows remain under active end-to-end verification; the ledger distinguishes implementation from observed proof.

## Data and privacy

Settings, retained recordings, models, and history live in `~/Library/Application Support/Scribble`. Configure recording/history retention in Settings. API keys use Electron secure storage. Clipboard monitoring is opt-in. No telemetry is implemented. Local AI uses a loopback service; remote AI receives text only when explicitly configured and used. Adding or re-indexing Memory uses the configured language model; choose Ollama to keep those reference files local. Cloud speech receives the audio explicitly submitted while a cloud speech provider is selected.

## Provenance

Scribble is independently implemented from public behavior and documentation. Proprietary application bundles, extracted source, private analysis, downloaded models, and local runtime tools are excluded from this repository. The project includes original microphone artwork. See [third-party notices](THIRD_PARTY_NOTICES.md).
