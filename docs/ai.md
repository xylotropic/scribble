# Free local AI setup

Scribble can use a local Ollama language model for cleanup, commands and meeting summaries. The optional setup script installs the official CLI in a dedicated user directory, verifies a pinned SHA-256 archive, starts a loopback-only server with cloud features disabled, downloads the selected local model and performs a real generation test. It does not register a startup service, replace an existing Ollama application, create an account or use credentials.

```sh
node scripts/setup-ai.mjs --model qwen3:0.6b
# Larger model, optional additional download:
node scripts/setup-ai.mjs --model qwen3:4b
# Instruction model with measured useful latency on this 16 GiB Mac:
node scripts/setup-ai.mjs --model qwen2.5:7b
```

In Scribble's AI configuration choose **Ollama**, endpoint `http://127.0.0.1:11434`, and the downloaded model name. The 0.6B model is a small functional smoke-test model; it does not establish high-quality summarization or instruction fidelity. Both 0.6B and 4B weights have been downloaded, but the 4B quality tests below failed; installed does not mean ready.

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

## 4B quality findings

The Mac has 16 GiB RAM and sufficient disk. Local `qwen3:4b` downloaded on 2026-10-07 at 02:58 America/New_York: 2,497,293,931 bytes, digest `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`.

Two synthetic fixtures tested dictation cleanup preserving Priya/Kubernetes/Supabase/Friday/uncertainty, and meeting summaries preserving launch dates, named owners/deadlines, undecided pricing and tentative migration blockage. With `think:false`, the runtime exposed self-analysis as content and reached the 700-token ceiling without a usable final response. Adding `/no_think` did not repair those fixtures. The model's installed template unconditionally opens a thinking prefix.

A separate local alias `scribble-qwen3:4b` tested a custom template with a closed thinking prefix, reusing existing weights. It still generated reasoning; at a 4,096-token allowance both fixtures reached that ceiling without completed final text, taking roughly 2.5–3 minutes each. Evidence remains in the local `quality-fixtures-*.json` files. This alias is experimental and is not an approved default model. These failures mean 4B cleanup/summary fidelity is **not proven** and should not be advertised as complete.

The setup smoke test now demands an exact `ready`/`ready.` answer and uses the model's native thinking mode, rather than accepting arbitrary nonempty content. No hidden reasoning is inserted into user text by a successful smoke test.

Scribble's actual adapter with the official `qwen3:4b` native default eventually corrected “hello priya please send the plan by friday” to “Hello Priya, please send the plan by Friday.” This took **161.8 seconds** on this Mac. That proves one minimal correction, while demonstrating unsuitable interactive latency for this tested configuration; it does not clear the broader summary/cleanup quality gate.

## Tested instruction-model alternative

[Qwen2.5 7B](https://ollama.com/library/qwen2.5:7b) is listed under Apache 2.0. Its 3B variant instead has a Qwen research licence; the 3B download was cancelled and is not recommended as Scribble's default. The app repository does not redistribute model weights.

The official 7B Q4_K_M model was downloaded and run through the actual `src/main/ai.js` adapter on this 16 GiB Apple M4. Stored size: **4,683,087,332 bytes**; digest `845dbda0ea48ed749caafd9e6037047aa19acfcfd82e704d7ca97d631a0b697e`. Ollama `/api/ps` reported **4,740,716,952 bytes** loaded in Metal/VRAM and a **4,096-token** runtime context. This memory figure is model allocation, not total app/process memory. Concurrent ASR and long-meeting context remain untested.

Cleanup returned: “Hi Priya, can you send the Kubernetes migration plan by Friday? I think the staging deployment is blocked on the Supabase key, but please confirm.” Initial latency **5.24 seconds**, repeat warm latency **1.90–1.92 seconds**. Names, deadline and uncertainty were preserved in this fixture.

Initial generic summary prompts generated an ungrounded “upcoming week” and falsely assigned a pricing action to its reporting speaker. A stricter prompt requiring quotation evidence and explicit commitments produced six fact-preserving bullets in **6.53 seconds**, including the exact launch dates, Priya/Sam commitments, tentative migration issue, undecided price and unassigned owner. It ignored requested section headings, so formatting still needs a deterministic repair or further verified prompt. This is useful local functionality, not proof that every future summary is faithful. Retain transcripts and inspect generated notes.

`tests/local-ai-live.test.js` provides explicit opt-in factual regression checks against the loopback model. Run `SCRIBBLE_LIVE_AI=1 node --test tests/local-ai-live.test.js` only with the locally downloaded model and server running. Normal tests skip these live checks; they must not be mistaken for passing runtime evidence. Fixtures and measured outputs are retained locally in `quality-adapter-qwen2.5-7b*.json`.

Scribble now includes provider-specific text adapters; see [cloud AI](cloud-ai.md) for authentication, endpoint configuration and fixture evidence. Local Ollama remains the default. Cloud keys are stored independently per provider using Electron safeStorage encryption, so switching providers cannot send another provider's saved key. Existing legacy `provider.key` files are not reused automatically; re-enter the chosen provider's key if migrating from an earlier build.

English spelling in Language Settings now applies to AI dictation cleanup. The instruction preserves names, exact quotations, URLs, code and dictionary terms, and avoids translating other languages. This is model-guided: a live local qwen2.5:7b fixture changed color/center to colour/centre for British English and reversed those two words for American English, but retained grey. No universal dialect accuracy is claimed; raw speech without AI cleanup retains the recognizer’s output.
