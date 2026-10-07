# Scribble completion and acceptance gates

Scope: original, open-source Mac product covering every publicly reachable Vowen feature available without paying, with a substantial polished UI and microphone identity. Objective preserved as requested. This document records required evidence, not completion. Updated 2026-10-07.

## Objective gates

| Requirement | Evidence needed before completion | Current evidence |
|---|---|---|
| Accessible open-source repository | Public repository URL; clone from clean directory; licence and contributor/build documentation; no private/proprietary asset/code inclusion | Source published at https://github.com/xylotropic/scribble ; remote/local tree SHA 5be920b6919c8fafa5fbb90fec82f645dffee754 matches. README/MIT/notices present. Initial public revision clean-clone dependency install, native build and tests passed; latest source update/clean-clone verification pending. |
| Runs on Mac initially | Clean dependency install/build; packaged Mac app; launch, permissions, recording and insertion on supported Intel/Apple-Silicon targets, or accurately scoped architecture limits | Not verified |
| Complete feature coverage, not cheap copy | Every free feature in public-features.md matched to observed source runtime and working Scribble acceptance case; no fake backend controls | Not verified |
| Significant UI coverage | Rendered sidebar pages, onboarding, settings, editor dialogs, file/note/history detail, overlay; light/dark; keyboard paths; empty/error/loading/success states | Not verified |
| Scribble brand, microphone icon | Original assets, app title/menu/tray/package identity, coherent typography/layout, no Vowen branding artifacts | Not verified |
| Exhaust no-payment public surface | Version inventory; navigated installed free UI; provider/model options and CLI/MCP tested; quota/gates documented; contradictions resolved by runtime evidence | Incomplete: public inventory exists; runtime audit outstanding |
| Functionality on every machine eventually | Document portability architecture and platform interfaces; initial Mac delivery fully verified; never claim Windows/Linux tested without actual machines | Mac-first authorized; other platforms unverified |

## Feature acceptance ledger

Every row is **unverified end to end** until an evidence path records the actual test result. Pure domain tests prove only listed algorithm properties.

| Surface | Required acceptance evidence |
|---|---|
| Onboarding/permissions | Fresh-profile first launch; microphone/accessibility/screen capture prompts with grant/denial/recovery; usable first shortcut; no charge/account requirement |
| Dictation | Record actual microphone utterance through free local engine; correct output in TextEdit, Chrome text input and terminal; hold/toggle/hands-free, release/stop/cancel, punctuation, silence and error recovery |
| Audio | Device listing/selection/ranking; disconnect fallback; levels; sound cues and volume; retained audio/storage location; playback/retry |
| Insertion | Clipboard restoration; plain/rich pastes; direct insertion; auto-enter; focused target/caret behavior; no accidental paste into settings |
| Shortcuts | Rebind, duplicate rejection, custom modifier/mouse input where supported, free one binding/action, Escape cancellation, paste-last |
| Overlay | Pill/notch/top/bottom/hidden; multi-monitor reposition; actual waveform; processing/error; idle controls and tone picker; focus preservation |
| Local engines/models | Download progress/cancel/checksum/error/delete/switch; Whisper sizes/languages; Parakeet and Nemotron parity or explicitly unresolved model gap; genuine offline inference |
| Cloud providers | Public free BYOK service configuration/catalog, key secure storage, provider request routing and errors; prove no paid request occurred without authorization; fixture request tests alone cannot establish live accuracy |
| AI enhancement | Connected local/free provider; instructions, cleanup, dictionary preservation, disable bypass, unavailable-provider fallback; real result rather than placeholder |
| Vocabulary | Add/edit/delete/search, aliases, accents, Unicode and ambiguous boundaries; no substring corruption |
| Threads | Plain/rich replacement, long-before-short, multiple occurrences, duplicate validation, non-Latin scripts, rich/plain fallback and enhancement interaction |
| Text expansion | Built-in and custom templates, clipboard/date/selection substitutions, editor/trigger/persistence, safe no-evaluation semantics |
| Voice actions | All advertised built-ins plus custom website/app/folder actions; aliases/polite prefixes/fallback to ordinary dictation; query encoding; Chrome/profile launch per user preference |
| Tones | CRUD, default/one custom free reference allowance, per-app/site/hotkey activation, model/language override, manual pin/automatic reset |
| Memory | Named notes/files, provider indexing/status/errors/re-index/delete, supported formats, context injection only in intended flows |
| Command Mode | Actual voice command context capture; selected text/clipboard/screen/files; review/copy/Tab paste/Escape dismiss/refine; text-only path; model fallback; free-reference daily limit documented |
| Deterministic actions | Timers/reminders across sleep/relaunch; app/site/folder/clipboard/edit actions; file conversions, PDF/ZIP/media/Markdown/color extraction explicitly tracked; no success toast without side effect |
| File transcription | Drag/browse/Share/Open With/Dock paths; real supported audio/video decode; per-file model/language/timestamps; edit/copy/regenerate; subtitle timing; failures retained |
| Meetings | Actual microphone plus system audio capture without bot; start/stop; 10-reference note cap/no-hour-limit conflict audited; basic real transcript+summary; recording playback; metadata and detail tabs |
| History/stats | Persistent records; search raw/final/error/revisions; filters/copy/retry; rolling limit; correct daily/week words/streak/time saved; no fabricated metrics |
| Navigation/settings | Every mapped page/tab/search/palette/keyboard route; meaningful settings take effect and persist; startup/Dock/theme/language/resource mode; no inert switches |
| CLI/MCP | Enumerate official public commands; original Scribble interface drives running app safely; structured results/errors, help, permissions, lifecycle; actual command invocations |
| Export/import | Exact free reference SRT/VTT supported, timestamp requirements, editing persistence; CSV quoted commas/newlines/escaped quotes and duplicate rejection; original unrestricted exports acceptable but not proof of source parity |
| Security/privacy | No copied keys/profiles/credentials; API keys outside renderer and exports; path validation; no shell injection through spoken text; local-first network behavior documented and observed |

## Domain-level evidence

`tests/domain.test.js` covers isolated-state defaults, Unicode replacement boundaries, literal dollar replacement, long-trigger ordering, filler/punctuation handling, template substitution, voice trigger matching, deterministic command parsing, duplicate-day streak behavior, subtitle formatting/invalid timings, CSV quoting and import duplicate/required-field validation. These tests do **not** verify UI, microphone, engines, integrations, command side effects, packaging or permissions.

## Model catalog evidence

Public Vowen engine coverage exceeds a Whisper-only implementation. NVIDIA's [Parakeet v3 model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) identifies CC BY 4.0 licensing. [FluidAudio](https://github.com/FluidInference/FluidAudio) is an independent Swift/CoreML path with local Parakeet inference and vocabulary support; investigate its pinned SDK licence and exact converted-model licences separately before bundling. No dependency copied from Vowen is needed. Model download size, minimum OS/architecture, accuracy, timing and resource performance must be measured. The catalog now includes independently implemented Nemotron English/multilingual, Japanese and Mandarin paths. Actual fixtures and pinned model provenance are recorded in `catalog.md` and `catalog-verification.json`; cross-machine performance remains unverified.

## Final audit procedure

1. Inspect current source, packaged bytes, clean-clone output, runtime evidence and repository access.
2. Mark each row proven/incomplete/contradicted with an evidence path and tested version. Missing evidence is incomplete.
3. Compare current official free surface and installed runtime inventory again; account for public-version drift.
4. Resolve every explicit objective gate; do not call a subset or test-only implementation full parity.
5. Report remaining limitations precisely and keep goal active until all required evidence exists.

## Observed development evidence — 2026-10-07

- Standard test run: 63 tests, 61 passing, 2 opt-in speech integration tests skipped. Actual Whisper and Parakeet fixtures were exercised separately; standard suite totals do not include those executions.
- Installed Apple Silicon application launches at `~/Applications/Scribble.app`, ad-hoc signed locally. No paid signing/notarization was used.
- Actual packaged Whisper transcription of the upstream JFK fixture produced the expected sentence with a segment from 0 to 11 seconds. This verifies real packaged media decoding and inference, not microphone capture.
- macOS Microphone pane displays Scribble enabled; application permission display remains unverified. Accessibility toggle reaches a macOS password prompt; awaiting the user’s authenticated settings change. No live insertion/global-shortcut success is claimed.
- Native system pause/resume protocol and renderer pause timing tests pass; real system-audio capture remains untested.
- Real local file-conversion fixtures pass; File tools UI integration added after the installed build and still needs packaged verification.
- Actual qwen2.5:7b cleanup and evidence-grounded summary fixtures passed; arbitrary recording accuracy remains unverified.

### Additional verification on October 7, 2026

- Original adapters support 13 cloud speech services and 10 text AI providers. Local HTTP fixture tests verify native request schemas, errors, aborts, response normalization and supported remote-resource cleanup. No account-backed cloud recognition or generation was requested; those remain unverified. Cloud keys are encrypted in separate provider-specific files and never returned in snapshots.
- Selecting a local speech model explicitly restores Local routing. History records the selected speech provider/model, and processing labels identify cloud use. Cloud media preparation was verified against a generated two-second WAV: MP3 output, measured duration, unchanged input and complete temporary-file cleanup.
- Actual qwen2.5:7b local cleanup and the final evidence-grounded summary formatter pass a transcript fixture containing explicit owners, dates, tentative blockers and an unassigned decision. The formatter discards model prose and nonmatching quotations. This is a fixture result, not proof of accuracy on arbitrary recordings or languages.
- Portable CPU flags were applied to Whisper and the rebuilt tiny.en engine successfully transcribed the public JFK fixture. Actual Intel and other Apple Silicon machines remain untested.
- Current packaged app targets macOS 14+, reflecting the bundled CoreML engine requirement. Packaging and final installed-app permission tests are still in progress; the existing installed build is older than current source.
- User explicitly authorized microphone and Accessibility testing. The macOS Accessibility settings password prompt still requires user authentication. No real microphone, global-hotkey, rich insertion or clipboard restoration end-to-end success is claimed.

### Build, release and interaction changes

- The formerly supplied FFmpeg installer binary reported `--enable-nonfree` and has been removed entirely from production dependencies and package resources. The replacement source-built FFmpeg 8.0.3 passes eight real media fixtures. All six corresponding source archives are included in the signed package and their hashes match the pinned manifest. See `licenses/ffmpeg.md` and `licenses/ffmpeg-verification.json`.
- The packaged application passes strict deep ad-hoc signature verification; bundled upstream Ollama bytes still pass its pinned per-file manifest. No notarization or paid signing claim is made.
- Runtime Memory parsing/indexing, provider summary orchestration, cancellation/removal, tone resolution, real-level overlay rendering and expanded CLI/MCP have tests. No live cloud request was made. Searchable PDF extraction is verified; scanned PDF OCR is explicitly unsupported.
- OS Open With/Dock file events are implemented and routed to the queue; per-file local model/language overrides preserve global settings. Actual Finder event delivery remains unverified. Share extension remains incomplete.
- Transcript-only edits now invalidate caption export until the user corrects timed segments, avoiding stale subtitle text. Segment editing preserves each segment's original timing. Root action tests verify this behavior.
- Public 0.5.10 was downloaded and inspected privately without installing or launching; the confirmed speaker-model selector remains Pro. No new free ASR family/provider was established by the bounded delta audit. See `version-audit.md`.

### Latest integration verification

- File-command parsing now routes explicit conversion, compression, palette, PDF and archive requests into real file dialogs and utility execution. Cancellation returns a cancelled result; saved results include the output path and any compression size notice. A root integration test proves routing without AI simulation.
- Current full suite: 184 tests, 179 passed, five optional live tests skipped. Production dependency audit reports zero vulnerabilities. These checks do not establish the remaining desktop acceptance gates.
- The rebuilt Apple Silicon application passes strict deep ad-hoc signature verification. The subsequent CLI local-model routing correction is tested in source and requires the next package refresh.

### Public clone and screen context

- Public commit `7ccd035df3016920b759743fd9407fbcc4e96ba3` was cloned into a new directory. `npm ci`, native bridge compilation and documented FFmpeg source setup succeeded. The resulting clone passed 179 tests with five optional live tests skipped.
- Command Mode now previews available screen images and attaches only the user-selected preview. A renderer interaction test verifies draft preservation, no premature command dispatch, and the selected image in the eventual command request. Actual screen permission, region cropping and live vision inference remain unverified or incomplete.

### Current packaged UI observation

- The rebuilt app launched from `release/mac-arm64/Scribble.app`; its renderer URL proves it was the new package rather than the older installed copy. Command Mode visibly exposes file context and screen-context controls. Dictionary → Expansions → Add expansion visibly exposes typed shortcut, rich replacement, formatting controls and template variables. This observes UI availability, not system-wide insertion success.
- Full suite after rich expansion changes: 186 tests, 181 passed, five optional live tests skipped. The rebuilt app passes strict deep signature verification. Accessibility authentication remains at the macOS password sheet.

### Packaged command and history runtime check

- In the running packaged app, Command Mode transformed the disposable fixture `Scribble command fixture October seven.` to uppercase. Refining with lowercase updated the displayed result. The running app’s Unix-socket CLI returned the same history ID with both revisions, exact source context and final output. This establishes local typed command execution, refinement and persisted revision inspection; it does not establish microphone commands or insertion into another app.

- Actual packaged local AI command: qwen2.5:7b rewrote the disposable Cedar fixture to `Maya will finish the Cedar demo by October 14 and needs the review by October 12.` The app displayed the output and the socket CLI returned the identical persisted context/result. Owner and both dates were preserved in this case. This fixture is not a claim of general model accuracy.

### Packaged Memory runtime check

- Added a disposable named Cedar reference in the packaged Memory UI. Actual local qwen2.5:7b indexing reached `indexed`, with a summary preserving coordinator Maya Chen, review October 12, 2026, delivery October 14, 2026 and copper color. Command Mode retrieved the coordinator, review date and color correctly; the UI and socket history agreed. The disposable reference was then disabled, with the UI checkbox visibly off. This proves the tested note-indexing/retrieval path, not arbitrary reference accuracy or PDF import.

- A generated searchable PDF was imported through the packaged native file picker. PDF.js extracted all four fixture lines, local AI indexing reached indexed, and the app displayed the correct coordinator Jordan Lee, November 5, 2026 date and AURORA-57 identifier. The socket CLI confirmed identical extracted source and summary. The reference was disabled afterward. Scanned PDF OCR remains unsupported; this test covers a searchable single-page fixture.

### Embedded Share extension

- Original Swift Share extension is compiled with application-extension restrictions and embedded at Contents/PlugIns/ScribbleShare.appex by package/dist. The embedded extension and complete host pass strict signature verification. The nested extension retains app-sandbox and user-selected read-only entitlements. A read-only pluginkit inventory currently reports no registered match; actual Finder discovery/handoff is still unverified.
