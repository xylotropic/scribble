# Scribble completion and acceptance gates

Scope: original, open-source Mac product covering every publicly reachable Vowen feature available without paying, with a substantial polished UI and microphone identity. Objective preserved as requested. This document records required evidence, not completion. Updated 2026-10-07.

## Objective gates

| Requirement | Evidence needed before completion | Current evidence |
|---|---|---|
| Accessible open-source repository | Public repository URL; clone from clean directory; licence and contributor/build documentation; no private/proprietary asset/code inclusion | Not verified |
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

## Model parity gap and candidate

Public Vowen engine coverage exceeds a Whisper-only implementation. NVIDIA's [Parakeet v3 model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) identifies CC BY 4.0 licensing. [FluidAudio](https://github.com/FluidInference/FluidAudio) is an independent Swift/CoreML path with local Parakeet inference and vocabulary support; investigate its pinned SDK licence and exact converted-model licences separately before bundling. No dependency copied from Vowen is needed. Model download size, minimum OS/architecture, accuracy, timing and resource performance must be measured. Nemotron/Japanese/Mandarin remain separate catalog gaps until independently verified and integrated.

## Final audit procedure

1. Inspect current source, packaged bytes, clean-clone output, runtime evidence and repository access.
2. Mark each row proven/incomplete/contradicted with an evidence path and tested version. Missing evidence is incomplete.
3. Compare current official free surface and installed runtime inventory again; account for public-version drift.
4. Resolve every explicit objective gate; do not call a subset or test-only implementation full parity.
5. Report remaining limitations precisely and keep goal active until all required evidence exists.
