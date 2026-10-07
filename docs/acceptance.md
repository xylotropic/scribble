# Scribble completion and acceptance gates

Scope: original, open-source Mac product covering every publicly reachable Vowen feature available without paying, with a substantial polished UI and microphone identity. Objective preserved as requested. This document records required evidence, not completion. Updated 2026-10-07.

## Objective gates

| Requirement | Evidence needed before completion | Current evidence |
|---|---|---|
| Accessible open-source repository | Public repository URL; clone from clean directory; licence and contributor/build documentation; no private/proprietary asset/code inclusion | Source published at https://github.com/xylotropic/scribble ; README/MIT/notices present. Successive public revisions were clean-clone tested; localization surface revision5d42f95 passed211 tests after the native helper rebuild. Public revision1096317 tree2f615fafa0a64fbaa861734047b4c9ca6746e517 was packaged and35 tracked src/assets files matched archived bytes. Public revision061a11c (tree8277ce01626277e2aec3144b92c1420a4e0f2858) passed235 tests in the existing clean checkout:230 passed,5 explicit integration skips. Expanded language controls/translations are published; a fresh package build is in progress. |
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

### Share discovery and Finder gate

- Relaunching the updated host automatically registered org.scribble.voice.share; pluginkit listed the embedded appex at the current package path. No manual registry mutation was used.
- Finder selected the isolated public JFK WAV fixture and enabled Share. Its actual Share popover displayed `Unlock Mac to continue with Siri request` instead of destinations, corroborated by AX and screenshot. No Share handoff success is claimed; session unlock is needed to continue this desktop check.

- Added searchable workspace navigation through the header and Cmd+K/Ctrl+K. A renderer interaction test filters to File tools and uses Enter to navigate, closing the palette. Other physical keyboard paths remain under desktop verification.

## Current packaged language verification

Public revision1096317 (tree2f615fafa0a64fbaa861734047b4c9ca6746e517) was packaged after terminating the stale test host through Activity Monitor. Deep strict code-signature verification passed;35 tracked source/asset files matched the app archive exactly. The fresh app socket reported nativeAvailable:true and Whisper/Parakeet/catalog runtimes ready.

The actual Settings selector switched from English to Japanese. AX showed Japanese navigation, common buttons and tabs, and the native application Settings menu changed to 設定. The interface was restored to English visibly. Language settings then showed the base.en selector disabled with English selected and the correct model explanation. This verifies these bounded packaged behaviors, not complete localization, native recording or insertion. Microphone remained Not yet requested; Accessibility remained Not yet allowed.

## Physical shortcut capture implementation

The native capture protocol accepts keyboard, side-specific modifier, modifier-only and auxiliary mouse bindings. Capture suspends normal hotkey/expansion handling, ignores repeat events, consumes owned releases, allows primary clicks, cancels on Escape and expires after30 seconds. Renderer tests verify capture fills/persists a right-option+M4 binding and closing the editor stops capture. Main actions reject capture without actual tap availability and stop the pending mode. Native synthetic events and compilation passed; physical desktop capture remains unverified.

## Packaged shutdown regression

The older tested host reproducibly stopped its native bridge/socket on Quit but remained alive, confirmed by read-only process inventory after the menu action. Shutdown now performs the existing cleanup and uses Electron app.exit(0) after the owned AI runtime cleanup completes. A main-process test verifies ordering. The rebuilt capture/form package was launched and quit through its actual application menu; subsequent process inventory found no Scribble host or bridge, while the pre-existing external Ollama PID23381 remained running. Strict deep signature verification passed. This proves the bounded idle shutdown regression, not shutdown during recording or provider activity.


## File-tools packaged palette verification

In the packaged capture/form build, File tools → Extract image colors accepted an independently generated 200×100 PNG through the native Open dialog, then a new JSON path through Save. The actual UI displayed the saved path. Read-back of the output reported #0000ff and #ff0000, each at proportion0.5, with8192 sampled pixels. This verifies one complete palette workflow in the packaged app; other utility workflows and spoken file-command invocation still need their own desktop acceptance evidence.

## Model-aware languages and expanded localization

Local model metadata now records verified supported languages from primary model/runtime sources in model-languages.md. Global, per-file and tone editors use that coverage, preserving exact supported locale codes such as vi-VN and excluding adaptation-only Nemotron languages. Saved incompatible global selections reset to Auto. Renderer tests exercise locale-code options and tone model switching. The independently authored form catalogue now includes162 exact labels/descriptions/hints/subtitles across18 locales; helper rendering escapes translated prose and preserves dynamic HTML. Thirty-seven focused renderer/localization/model-preference tests passed. These source changes still require fresh packaged verification.


## Desktop workspace navigation and optional summary provider

The capture/form package accepted Cmd+K through desktop input, filtered the workspace palette to Tones, and Enter opened that page while closing the dialog. This proves that bounded keyboard path.

The optional Claude subscription CLI route is independent of the global AI provider and applies only to new and regenerated note summaries. Read-only status checks require installed isolation flags and successful claude.ai auth-method metadata; current local status reports that Claude is not installed. No actual login, install, inference or cloud request occurred. Provider failures retain local extractive notes with explicit error/provider metadata visible in note detail. Scoped main/store tests cover routing, cancellation, fallback, settings and normalization; renderer/adapter tests cover selection, disclosure, unavailable status and visible fallback. CLI inference remains unverified on an actual subscription account.


## Expanded translations: clean package and desktop evidence

Public revision061a11c was packaged in the existing clean checkout. Strict deep signature verification passed and36 tracked src/assets files matched that revision's archived bytes. The actual General pane switched English → Japanese; setting labels and descriptions (including greeting, appearance, launch behavior, clipboard, punctuation and sounds) were visibly Japanese. English was restored visibly. The package reported the three speech runtimes ready through actual CLI status. Microphone request was invoked after user approval, but the UI still reported Not yet requested; no grant or recording success is claimed. Accessibility still depends on the outstanding macOS password step.

Public summary-provider revisionb8a84ad passed250 tests in the clean checkout:245 passed,5 explicit integration skips. No actual Claude executable/account inference was tested.

## Useful localized summary drafts

The original structured JSON summary prompt now requests the configured output language and meaningful preset sections. Valid generated prose and headings remain visible beside exact transcript evidence instead of being replaced wholesale by English quotations. Source excerpts are checked, repeated excerpts require occurrence indices, and invalid owner/deadline metadata falls back to exact excerpts. Main passes summaryLanguage to the formatter and labels AI-produced notes as drafts in note detail. These checks cannot prove arbitrary paraphrase entailment; review remains necessary.

A real local qwen2.5:7b Spanish schema fixture produced localized headings/prose in40.9 seconds after the prompt was corrected to use full language names. The first attempt produced Italian and was rejected as quality evidence. The successful run still translated deadline metadata and had an awkward unresolved paraphrase; the formatter recovered unsupported metadata as source excerpts. This is bounded evidence, not a guarantee of factual or translation accuracy. Conservative fallback headings currently cover English, Spanish, French and German; other malformed-output language fallbacks remain English. The source suite passed257 tests:252 passed,5 explicit integration skips. The subsequent clean-public and packaged results are recorded below.


## Final summary package: bounded desktop acceptance

Public revision0ac39a2 (tree68425a2fae54407603441fbc703c4625536a5d02) passed257 tests in the clean checkout:252 passed,5 explicit integration skips. Packaging succeeded, deep strict signing verification passed, and37 tracked src/assets files matched that exact revision in app.asar.

The real Settings → Languages pane selected Claude subscription CLI, displayed its transcript/subscription disclosure and optional model field, and its live read-only check displayed “Claude CLI is not installed”. Importing the public upstream JFK audio through the actual Notes/Open dialog completed local Whisper transcription and saved note4bc17d2b-05fc-4337-9fc0-5dcda3e94602, with11-second audio and the expected transcript. Note detail visibly reported the CLI failure and displayed a local extractive summary. Actual CLI read-back confirmed summaryProvider:local-extractive, summaryRequestedProvider:claude-cli, summaryFallback:true, summaryDraft:false and the explicit error. No Claude inference/login/cloud request occurred. The configured language-model summary provider was restored visibly afterward. This verifies import, local inference, note persistence and provider-failure presentation for this fixture; live meeting/microphone/system-audio recording is not proven.


## Guided first-run setup implementation

Fresh workspaces show a Home setup card for local model selection/download, microphone permission and Accessibility. It uses the existing verified download/progress/cancel APIs and explicit permission buttons; status checks alone do not grant access or start recording. Finish stays disabled until the selected local model/runtime, microphone permission, Accessibility trust and native shortcut service are available. A trusted-but-unavailable shortcut service displays a restart recovery. Users can defer setup or replay it from Help. Completion state persists; existing saved workspaces and old backups migrate without interrupting returning users.

Source tests cover fresh/persisted state, legacy migration/backup validation, explicit completion, deferral/replay, permission denial/recovery, model choice without hidden inference/downloads, download progress and unavailable shortcut-service recovery. The full suite passed267 tests:262 passed,5 explicit integration skips. The18 setup strings are independently translated in18 locales; full form catalogue184. Fresh packaged setup and grant-to-first-recording acceptance remain pending.


## Routing and File tools translation update — October 7, 2026

The full source suite passed 273 tests with five environment-dependent skips (278 total). New coverage checks ranked voice routing, validated targets, custom/built-in trigger coexistence, disabled command fallback, folder-opening errors and Japanese File tools labels with stable operation/format identifiers. The form catalogue now contains 207 exact strings in 18 locales; this remains partial UI localization.

The separate first-run setup package at `/tmp/scribble-setup-package-20261007/mac-arm64/Scribble.app` passed deep strict signature verification. This package predates the routing/translation update. Desktop control resumed inventory access but reports the Mac is locked and automatic unlock failed; live permission, microphone, global shortcut and insertion checks remain pending. User microphone and Accessibility testing authorization is recorded. No screen capture grant or test is implied.


## Ordered shortcut actions — October 7, 2026

Custom voice shortcuts now have a numbered editor with websites, applications and folders; add/reorder/remove controls preserve entered values. Website groups support multiple URLs and an optional existing Chrome profile directory, applications support an optional folder, and folder groups support multiple paths. Aliases are editable. Legacy simple shortcuts remain editable; the new action list takes precedence over preserved legacy fields.

Pure planning validates the whole list before execution. Store persistence and backup restoration reject invalid action lists atomically. Mocked main tests exercise a mixed website/application/folder sequence, grouped Chrome arguments, selected-profile existence, URL query punctuation preservation and failure propagation without launching apps. `mailto:` navigation is restored, with optional recipients and RFC 6068 encoded body line breaks; no email was composed or sent. The full source suite passed 298 tests: 293 passed, five explicit integration skips.

Desktop acceptance of the editor and ordered actions is pending because the Mac remains locked. Automatic browser/profile discovery, additional browser families and documented runtime fallback behavior remain gaps. New editor labels have not yet been added to the locale catalogue. The source tests do not prove microphone, physical shortcuts or text insertion.


## Browser/profile discovery and live ordered-action acceptance — October 7, 2026

The ordered-action package at `/tmp/scribble-multiaction-package-20261007/mac-arm64/Scribble.app`, source revision 5cf8dc5, passed deep strict signature verification and matched all 41 tracked source/assets files. In the actual editor, application Finder with optional `/tmp/scribble-shortcut-acceptance` plus folders `a` and `b` survived reorder and save. Running `please scribble test fixture` matched the saved alias/filler and opened all three corresponding Finder windows, verified through Finder’s Window menu. The fixture was disabled afterward. Help → Run setup again displayed the installed model and unavailable microphone/Accessibility, kept Finish disabled, and Do this later restored the prior state.

The Mac is now accessible, but System Settings still displays a password authentication sheet for Privacy & Security; the user was asked to finish it. Microphone Request produced no visible prompt and live recording/insertion remain unverified.

The new browser catalogue and website editor offer discovered browser/profile dropdowns. Read-only metadata extraction returns only display labels and selector IDs. Browser removal, profile removal and immediate launch errors fall back to the default browser. Async discovery preserves unsaved fields and unavailable selections. Synthetic/mocked tests cover Chromium, Gecko, Safari’s actual Apple Cryptex path, metadata bounds, symlink/path rejection, grouping, profile flags and fallback. The full source suite passed 311 tests:306 passed,five explicit integration skips. No browser was launched by those tests and vendor compatibility beyond the filesystem evidence remains unverified. New editor text is still awaiting catalogue translation.
