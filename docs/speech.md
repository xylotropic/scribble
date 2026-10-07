# Local speech engine

Scribble uses the MIT-licensed [whisper.cpp](https://github.com/ggml-org/whisper.cpp) v1.8.7 and public [Whisper model conversions](https://huggingface.co/ggerganov/whisper.cpp). It downloads its own models; no proprietary app files are required. Transcription requires no account, subscription, API key, or network after setup.

Install Node 22+, npm, Git and a C++ compiler. On macOS run `xcode-select --install` if Command Line Tools are missing. Then run:

```
npm install
npm run setup:speech
npm start
```

Setup compiles for the current machine (Apple Silicon and Intel Macs) and installs base.en (~148 MB). If CMake is absent it creates a Python 3 virtual environment and installs CMake 3.31.6 from PyPI. No Homebrew or administrator privileges are needed after compiler installation. To install another model use `node scripts/setup-speech.mjs --model=tiny`; `--no-model` builds only the runtime. The same source build works on supported Linux hosts. Windows builds require a compatible compiler and are not yet verified.

Data lives at `~/Library/Application Support/Scribble` on macOS. Set `SCRIBBLE_DATA_DIR` for a portable custom directory. `SCRIBBLE_WHISPER_BIN` and `SCRIBBLE_FFMPEG_BIN` can select existing executables. The default FFmpeg runtime is compiled from pinned official source by `npm run setup:ffmpeg`. The packaged app includes the exact corresponding source archives, codec licenses, and rebuild recipe. See [FFmpeg build and notices](licenses/ffmpeg.md).

The model registry includes tiny.en, tiny, base.en, base, small, medium and large-v3-turbo. All downloads are pinned to Hugging Face revision `5359861c739e955e79d9a303bcbc70fb988958b1` and verified against the registry's SHA-256 and size before becoming available. English-only models ignore language selection. Multilingual models support automatic language detection and optional translation to English. Larger models require more disk space, memory and processing time.

Audio/video imports decode with FFmpeg to temporary 16 kHz mono WAV, then whisper.cpp produces text and timestamped segments. Temporary audio is removed on success, error and cancellation. Recordings and transcripts are managed by the app independently. The EventEmitter engine emits `download-progress`, `models-changed`, and `progress`; cancellation uses `cancelDownload(id)` and `cancelTranscription()`.

Tests: `node --test test/speech.test.js`. Actual speech recognition must also be verified with a spoken fixture after runtime/model setup; unit tests alone do not prove transcription quality.

Verified on this Mac (Apple M4, arm64): source commit `48f628a84833905ee4a0658ee6d4a5c915ce1997`, CMake 3.31.6, Apple Command Line Tools, compatible MacOSX26.5 SDK, bundled FFmpeg and SHA-256-verified tiny.en. The upstream 11-second JFK fixture produced the expected “ask not what your country can do for you” text and timestamped segments. Run the opt-in integration check with `SCRIBBLE_TEST_AUDIO=/absolute/path/to/spoken.wav SCRIBBLE_TEST_EXPECT=country node --test test/speech.test.js`. First Metal initialization can take longer than later runs.

If the newest installed macOS SDK fails with `unknown architecture`, setup tries older installed SDKs locally for this build. It does not alter the system SDK or developer-tool selection. Runtime/model binaries are excluded from the source repository. Source builds compile runtimes locally; packaged apps bundle the compiled runtimes and download selected model weights separately.
