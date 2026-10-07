# Free local AI setup

Scribble can use a local Ollama language model for cleanup, commands and meeting summaries. The optional setup script installs the official CLI in a dedicated user directory, verifies a pinned SHA-256 archive, starts a loopback-only server with cloud features disabled, downloads the selected local model and performs a real generation test. It does not register a startup service, replace an existing Ollama application, create an account or use credentials.

```sh
node scripts/setup-ai.mjs --model qwen3:0.6b
# Larger model, optional additional download:
node scripts/setup-ai.mjs --model qwen3:4b
```

In Scribble's AI configuration choose **Ollama**, endpoint `http://127.0.0.1:11434`, and the downloaded model name. The 0.6B model is a small functional smoke-test model; it does not establish high-quality summarization or instruction fidelity. The 4B model needs more disk/RAM and has not been downloaded by this task.

The script accepts `--endpoint http://127.0.0.1:PORT`, `--root DIRECTORY` and `--binary PATH`. Mac automatic installation uses Ollama 0.40.0; other operating systems require an independently installed official binary. If an endpoint already exists, the script reuses it without changing its configuration. Only a newly started Scribble-owned process is known to have `OLLAMA_NO_CLOUD=1` and its isolated model directory.

Logs, PID, downloaded archive, model files and evidence live in `~/.local/share/scribble-tools/ollama`. `provenance.json` records the archive URL/version/hash and binary path; `verification.json` records the real generated response and model digest. A detached process continues until stopped or the machine restarts; rerun the script to start it again. Inspect `server.pid` and the actual process before stopping it.

## Source provenance

- [Official Ollama release 0.40.0](https://github.com/ollama/ollama/releases/tag/v0.40.0), CLI archive `ollama-darwin.tgz`.
- GitHub release API supplied SHA-256 `b490b4925a95c5f3dfcd889e566cf3dcd727848d59057fb00b03f1d6630326dc`; setup checks the archive before extraction.
- [Official Qwen3 0.6B model catalog](https://ollama.com/library/qwen3:0.6b).
- [Ollama FAQ](https://docs.ollama.com/faq) documents loopback binding, model-storage configuration and cloud-disable environment variable.
- [OpenAI-compatible API documentation](https://docs.ollama.com/api/openai-compatibility) describes the alternative `/v1` interface. Scribble's Ollama provider uses native `/api/chat`.

Model downloads require an internet connection. After downloading, local inference uses your hardware and has no provider usage charge. Cloud providers remain separate and can charge when configured. Cloud-disabled server logging proves its configuration; this task has not performed a full network/telemetry audit of the upstream runtime.

## Verification status

Bootstrap fixture tests cover model/endpoint validation, official archive pinning and API failure propagation: 3 tests passed.

On 2026-10-07 at 02:54 America/New_York, the newly started local Ollama 0.40.0 process generated **`ready.`** from the request “Reply with only the word ready.” using qwen3:0.6b with thinking disabled. The response had `done: true`, 3 evaluated tokens and approximately 4.18 seconds total duration. This proves real local generation on this Apple M4 Mac, not broader AI-quality parity or performance on other machines.

Downloaded model size: 522,653,767 bytes; catalog digest: `7df6b6e09427a769808717c0a93cadc4ae99ed4eb8bf5ca557c90846becea435`. Runtime logs reported `Ollama cloud disabled: true` and `Listening on 127.0.0.1:11434`. Local provenance and verification files retain the exact request/response and installation paths.

An independent invocation of Scribble's actual `src/main/ai.js` `chat()` function against the same local provider/model returned **`ready`** for “Reply with only the word ready. /no_think”. Thus the application's provider adapter, beyond the setup script's API call, has produced a real generated response. Renderer activation, complete dictation enhancement and meeting summary workflows remain separate acceptance tests.
