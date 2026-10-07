# Additional free local speech models

Scribble implements four additional speech engines independently using public CoreML weights and the pinned Apache-2.0 [FluidAudio SDK](https://github.com/FluidInference/FluidAudio/tree/0b1f46289fe27d95b5e66ad8be46e64f5ee02ae7). No Vowen binaries, code, or model files are used.

| Model ID | Public weights | Model license |
| --- | --- | --- |
| `parakeet-ja` | [Japanese Parakeet TDT](https://huggingface.co/FluidInference/parakeet-0.6b-ja-coreml) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) |
| `parakeet-zh` | [Mandarin Parakeet CTC](https://huggingface.co/FluidInference/parakeet-ctc-0.6b-zh-cn-coreml) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) |
| `nemotron-en` | [English Nemotron Streaming](https://huggingface.co/FluidInference/nemotron-speech-streaming-en-0.6b-coreml) | [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/) |
| `nemotron-multilingual` | [Multilingual Nemotron 3.5](https://huggingface.co/FluidInference/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b-CoreML) | [OpenMDW-1.1](https://openmdw.ai/license/1-1/) |

All four pinned versions were downloaded publicly without authentication or payment. Model licenses remain separate from Scribble's code license. Keep upstream attribution and applicable license notices when redistributing weights. Exact revisions, per-file SHA-256 or Git blob SHA-1 hashes, sizes, and license links are stored in `native/Parakeet/catalog-models.json`. Downloads verify every file before publishing the installed marker; cancellation and integrity failures remove partial artifacts.

Run `npm run setup:parakeet -- --no-model` to build both `ScribbleParakeet` and `ScribbleCatalog`, or `node scripts/setup-catalog.mjs --model=nemotron-en` for the catalog executable and a chosen model. The app uses bundled executables when available, then its data-directory runtime; explicit `SCRIBBLE_CATALOG_BIN`, `SCRIBBLE_PARAKEET_BIN`, and `SCRIBBLE_WHISPER_BIN` overrides take priority. Swift resource bundles must accompany executables. Models are installed through the normal SpeechEngine model API and UI.

The native engines require Apple Silicon and macOS 14 or later. Intel uses the independently implemented Whisper backend. Japanese uses FluidAudio's TDT pipeline. Nemotron uses its public streaming RNNT pipelines internally; the current file transcription API returns the completed transcript and timestamps. This does not implement incremental microphone transcript events. Multilingual hints accept `en`, `ja`, `zh`, `es`, `fr`, `de`, `it`, and `pt`, mapped to the SDK's regional codes; detected language is returned when available. Translation remains a Whisper operation.

Mandarin uses an original CoreML CTC pipeline because the pinned SDK does not include this family. It runs the public preprocessor, quantized encoder, and decoder, respects tensor strides, and collapses CTC repeats and blank tokens. Fifteen-second windows overlap by two seconds; central frame ranges retain each boundary once. Segment timestamps are clamped to actual audio duration.

Actual fixture results, output text, duration, elapsed time, and fixture hashes are recorded in `docs/catalog-verification.json`. Verified cases include English JFK audio on both Nemotron engines, Japanese on both Japanese Parakeet and multilingual Nemotron, Mandarin on both Mandarin Parakeet and multilingual Nemotron, and a 19.73-second Mandarin fixture crossing the CTC window boundary. The boundary test matches all five spoken phrases after punctuation normalization. These checks establish those specific cases, not a complete multilingual accuracy benchmark. Apple system speech generated temporary Japanese/Mandarin fixtures; those audio files are not distributed.

Unit tests are in `test/catalog.test.js`. Set `SCRIBBLE_TEST_CATALOG_AUDIO` to an absolute fixture path, `SCRIBBLE_TEST_CATALOG_MODEL` to an installed model ID, and optionally `SCRIBBLE_TEST_CATALOG_LANGUAGE`, `SCRIBBLE_TEST_CATALOG_EXPECT`, or `SCRIBBLE_TEST_CATALOG_EXACT` to run genuine inference through SpeechEngine. Exact matching ignores punctuation and whitespace. Ordinary tests also exercise pinned manifests, separate runtime/model readiness, and integrity-failure cleanup.
