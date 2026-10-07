# Scribble completion and acceptance gates

Scope: original, open-source Mac product covering every publicly reachable Vowen feature available without paying, with a substantial polished UI and microphone identity. Objective preserved as requested. This document records required evidence, not completion. Updated 2026-10-07.

## Objective gates

| Requirement | Evidence needed before completion | Current evidence |
|---|---|---|
| Accessible open-source repository | Public repository URL; clone from clean directory; licence and contributor/build documentation; no private/proprietary asset/code inclusion | Public source 87e3946 at https://github.com/xylotropic/scribble matches tree686821cf5b5fa603d63bf63bf20008d6be577aba. MIT, build instructions and notices are present. Current clean-checkout ARM package proof is in lifecycle-package-verification.json; private analysis is excluded. New audited fixes remain in development until separately published. |
| Runs on Mac initially | Clean dependency install/build; packaged Mac app; launch, permissions, recording and insertion on supported Intel/Apple-Silicon targets, or accurately scoped architecture limits | ARM and Intel packages pass architecture and deep strict signature checks. ARM packages have launched and run local fixture workflows. Physical recording/insertion, Intel execution, older-macOS inference and clean-user-profile startup remain unverified; see both package-verification JSON files and dependent-compatibility-verification.json. |
| Complete feature coverage, not cheap copy | Every free feature in public-features.md matched to observed source runtime and working Scribble acceptance case; no fake backend controls | Incomplete. Public surface inventory and original implementations exist; Settings search, independent clipboard retention and recording ownership fixes are being verified. Full microphone ranking and separate meeting overrides have source tests; packaged hardware acceptance remains pending. Physical runtime gates remain open. |
| Significant UI coverage | Rendered sidebar pages, onboarding, settings, editor dialogs, file/note/history detail, overlay; light/dark; keyboard paths; empty/error/loading/success states | Partial runtime evidence includes first-run flow, local model setup, file/note detail, ordered browser/voice-action editors, localized utility editor and Settings. Current search/ranking/capture changes need fresh packaged desktop checks. Full light/dark and keyboard acceptance remains incomplete. |
| Scribble brand, microphone icon | Original assets, app title/menu/tray/package identity, coherent typography/layout, no Vowen branding artifacts | Original assets/icon.svg, app/menu/tray identity and package branding are present. Shipped source/assets byte matching is verified; complete rendered visual audit remains pending. |
| Exhaust no-payment public surface | Version inventory; navigated installed free UI; provider/model options and CLI/MCP tested; quota/gates documented; contradictions resolved by runtime evidence | Incomplete. Public0.5.10 artifact delta, model/provider/catalog and entitlement boundaries are documented. Full free-runtime navigation and behavior remain unverified; version-audit.md bounds the static comparison. |
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


## Packaged browser acceptance — October 7, 2026

Public revision 8e8f4b6 passed 311 clean-checkout tests (306 passed,five explicit skips). `/tmp/scribble-browser-package-20261007/mac-arm64/Scribble.app` passed deep strict signature verification and all 42 tracked source/assets files matched app.asar.

The real shortcut editor discovered Google Chrome and Safari, and Chrome profile labels Your Chrome and Work. A new website action selected Your Chrome and saved URLs for the Scribble public repository and official workflow documentation. Running `scribble browser fixture` opened one new Chrome window with both pages as tabs, observed in Chrome’s native accessibility tree; the repository displayed the published 8e8f4b6 commit. The browser acceptance fixture was disabled afterward. This proves discovery, selection, persistence, dispatch and grouped tabs for this installed Chrome/profile fixture. Other browser families, runtime removal/failure fallback and all locale strings remain separate gates. No credentials, profile databases or browser profile files were copied. The app remains ad-hoc signed and unnotarized.


## Preset AI utilities — October 7, 2026

Keyboard-triggered AI utilities now have validated definitions, six fixed presets, selected-text/clipboard sources and conflict-checked captureable bindings. Native utility keys fire once without starting recording, suppress repeats/owned releases, and do not intercept when disabled. Results support Copy, Dismiss and explicit target-checked insertion. Main cancellation suppresses late output; empty selection never falls back to clipboard. Single-use native AX target tokens check app identity/field before clipboard writes and refuse unsafe or stale targets. Failed insertion leaves copy-only review text.

The full source suite passed 330 tests:325 passed,five explicit integration skips. Native compilation and 22 protocol/synthetic tests passed. Actual local qwen2.5:7b grammar inference completed in 6.452 seconds and corrected the toy fixture while preserving “might”; docs/ai-utility-verification.json records exact input, prompt and output. This does not prove every preset’s accuracy. Packaged utility UI, physical shortcut/selection and insertion acceptance remain pending, as does translation of the new editor text.


## Utility public build verification — October 7, 2026

Public utility revision 28ea38d was pulled into the clean checkout, its native bridge rebuilt, and all330 tests rerun:325 passed,five explicit integration skips. The package at `/tmp/scribble-ai-utility-package-20261007/mac-arm64/Scribble.app` passed deep strict signature verification and all43 tracked source/assets files matched app.asar. The bundled bridge’s synthetic utility-key self-test passed single firing, repeat/owned-release suppression, Escape chord and never-held checks. This verifies the new native bridge is included, not just renderer source.

Before switching the running browser build to the utility package, desktop control reported the Mac locked and automatic unlock failed. The quit attempt is not proof the old app exited. Actual packaged utility UI, physical global keys, selection acquisition and insertion remain pending; the last observed System Settings authentication sheet also required the user’s password. No actual microphone/screen recording or paid provider request occurred in this verification.


## Indicator controls and display tracking — October 7, 2026

Public revision 26536e0 adds localized idle dictation, command and note buttons plus visible-only 250 ms cursor/display tracking for the existing Electron window. Position changes are applied only when geometry changes; display-added/removed/metrics events update immediately, and timers/listeners stop on hide, destruction and quit. Eleven focused geometry/lifecycle/DOM tests and all 26 main-action tests passed. Tests use synthetic display geometry and do not prove actual multi-monitor placement or recording. The notch option remains CSS styling, not a native notch panel. The Mac is still locked; packaged UI, microphone, physical shortcuts and insertion acceptance remain pending under the user's recorded microphone/Accessibility authorization.


## Utility packaged UI and architecture checks — October 7, 2026

The running browser package was quit through the desktop UI; process inspection confirmed its Electron process and bridge exited while the external Ollama server stayed running. The previously signed utility package (source 28ea38d) was then opened. Its real Language models page showed local Ollama/qwen2.5:7b. Add utility saved a grammar/selected-text definition without a keyboard binding. Run displayed “Select some text before running this utility”; the fixture was disabled afterward and Run became disabled. This proves packaged editing/persistence and the empty-input refusal surface, not physical hotkeys, actual selection acquisition, model output review or insertion. System Settings still displays its password sheet; user microphone/Accessibility authorization remains recorded but effective grants are unverified.

New source adds 81 original localization entries across 18 locales (288 catalogue entries total), including shortcut/browser and utility editor/review/capture controls. Sixty-four renderer/catalogue tests passed. Coverage remains partial: generic utility hotkey Settings rows, older provider-card prose and backend diagnostics remain separate. Native helpers compiled for both ARM and Intel into temporary outputs and Share signatures verified. The architecture hook accepted the existing ARM package and rejects a mismatched target; full Intel speech/media staging and desktop acceptance remain unverified.

The combined indicator/architecture/localization source suite passed 340 tests:335 passed,five explicit environment-dependent integration skips. This includes mocked package mismatches and does not establish complete Intel runtime or desktop permission acceptance.


## Public workflow package acceptance — October 7, 2026

Public source 1b9535e passed the clean-checkout 340-test suite (335 passed,five explicit skips). `/tmp/scribble-workflow-package-20261007/mac-arm64/Scribble.app` ran the new six-executable architecture hook during packaging, passed deep strict signature verification and matched all44 tracked source/assets files in app.asar. The older utility build quit through the desktop UI and its process/bridge were confirmed absent before the new package opened; external Ollama stayed running.

Actual Japanese UI verification showed translated AI utility list/disclosure, disabled Run, transformation/source labels, optional keyboard binding, capture button, modifier instructions and cancel/save. The saved fixture name, disabled state, option/command values and keycode5 survived the language switch. The editor was canceled without saving, and English was restored. Older provider-card prose remained visibly English, consistent with partial coverage. Desktop permissions, physical hotkeys, insertion and multi-monitor tracking remain separate gates.


## Native indicator, command review and Intel staging — October 7, 2026

New source provides a real nonactivating NSPanel indicator, using hardware notch geometry at the top and a visible-area pill for bottom/nonnotched displays. Buttons retain identity through meter updates; main serializes updates and cleans up late show replies on shutdown. Recording settings now expose style and 294 catalogue entries are authored across18 locales. Four native tests compile an isolated current helper and verify synthetic geometry, stable control signatures, atomic protocol validation and private pasteboard types without displaying a panel or posting keys. Hardware appearance and clicks remain unverified.

Command review carries an opaque cached result ID. The exact cached text is inserted only through its original captured target, which survives refinement; superseded results cannot be replayed. Own-app/absent/expired/refused targets produce copy-only review. Renderer Insert/Tab gating, dismissal, failure retention and newer-result races are covered. Main passes the clipboard-history policy on dictation, command review, AI utilities and expansions; native private writes mark the same pasteboard transaction transient. External clipboard managers and physical insertion still require desktop acceptance.

Intel Whisper and FFmpeg were actually compiled and staged with source/licence/recipe provenance in an isolated directory; Ollama universal-file provenance was verified before copying. Matching-target cache/build/stage guards are implemented. mac-architecture-verification.json records exact binaries/recipe hashes. Rosetta is absent, so no Intel executable was run and no complete Intel app is yet claimed. The combined source suite passed355 tests:350 passed,five explicit integration skips. A clean package with the newly rebuilt bridge and desktop native-panel acceptance remain pending.


## Public native package verification — October 7, 2026

Public revision 4ab6f1e was pulled into the clean checkout and its bridge rebuilt before the355-test suite:350 passed,five explicit skips. The package `/tmp/scribble-native-indicator-package-20261007/mac-arm64/Scribble.app` passed deep strict signature verification and the six-entry-point ARM architecture hook; all45 tracked source/assets files matched app.asar. Its bundled notch geometry self-test passed without creating a window. Signing changed the helper's bytes: after stripping signatures from temporary copies, all bytes matched the rebuilt helper except the signing-related __LINKEDIT virtual allocation (147456 vs163840). No literal signed-byte equality is claimed.

The Mac locked before switching packages. The quit attempt is not proof of exit; desktop native-panel appearance/actions and physical insertion remain pending. The last effective permission observation still required the System Settings password sheet. The source is published; a built package and synthetic tests do not establish hardware or permission acceptance.

## Cloud silence, timers and Intel package verification — October 7, 2026

Public revision a0360ed matches local tree 2adfe6aae2fd4dec17ab6e2a41203c612c9a54a2. The full source suite passed 366 of 371 tests, with five explicit environment-dependent skips. Experimental cloud silence settings are opt-in, persist numeric sensitivity, and bypass local transcription. Complete below-threshold cloud jobs save an explicit failure before provider preparation/upload; incomplete analysis continues normal processing. Actual FFmpeg fixtures include silence, stationary noise, quiet bursts and public JFK audio. This energy gate is not speech recognition and can skip quiet speech; no paid cloud request was used.

The fresh ARM package `/tmp/scribble-cloud-silence-package-20261007/mac-arm64/Scribble.app` rebuilt bridge and Share, passed six executable architecture checks, ARM Sharp/libvips inspections and deep strict signature verification. All49 shipped ASAR source/assets/CLI/model files matched public source. Existing runtime files/links and the external Ollama service stayed unchanged; detailed proof is in cloud-silence-package-verification.json. This package has not yet been launched.

Intel packaging now also passes deep strict signing and architecture checks; intel-package-verification.json records exact baseline equivalence and20 pinned relative Ollama symlink checks. The isolated staging copy initially rewrote relative links to absolute source paths; preserving verbatim symlinks fixes the source, and the verified temporary stage was repaired from pinned provenance. Intel execution still requires Rosetta or an Intel host.

Timer countdowns update existing text nodes without replacing forms; completion banners persist until dismissed within the runtime session. Focused renderer tests verify lifecycle cleanup and escaped, bounded notices. Physical timer/banner acceptance remains pending. Microphone and Accessibility testing are authorized, but System Settings still requires the user to complete its password prompt before effective grants can be verified. No screen/system-audio permission is inferred.

## Settings, microphone ranking and recording lifecycle source verification — October 7, 2026

The rebuilt ARM bridge and full source suite passed422 tests:417 passed,five existing optional live integrations skipped. The native system-capture self-test was explicitly enabled against the freshly built helper and did not request screen permission. ARM and Intel source builds are warning-free; Intel execution remains unverified.

Settings search renders existing editable rows, matches English labels/synonyms across every query word, includes entire named sections, excludes Permissions, and preserves input focus. Dictation retention in external clipboard managers is now independent of Scribble's opt-in local clipboard log. Existing local-history preferences do not enable the new retention permission. Audio ranking offers a connected picker, RMS preview, draft arrows/drag, disconnected-only removal, cancellation, and exact meeting inheritance/copy/system-default distinctions. The original form catalogue now has325 entries across18 locales; older provider prose and other legacy UI text remain partially untranslated. See microphones.md for the ranking bounds and pending hardware checks.

Per-session renderer ownership protects newer microphone streams from late replies. Recorder errors cannot save/upload failed partial audio. Main system-audio startup requires the matching live note token; late cancelled starts are stopped, and failures retain retryable ownership. Swift drops obsolete-stream audio, invalidates pending starts/resumes before cancellation awaits, coalesces stops and retains handles after failed stops. Pure native tests exercise cancellation, failed-stop retention, replacement refusal and confirmed retry without ScreenCaptureKit capture.

Shutdown immediately releases renderer recording/preview streams and awaits native helper exit plus owned AI termination. Unconfirmed shutdown refuses quit with a visible error and supports retry; partial audio is retained until ownership is settled. Healthy external Ollama services remain untouched. Managed Apple Silicon AI below macOS26.2 uses the compatible Metal3 backend; compatibility selection and lifecycle tests are not older-host inference proof. These changes still require a new published package and desktop acceptance. The macOS password handoff remains outstanding.


## Public lifecycle package verification — October 7, 2026

Public revision87e3946 was packaged from the clean checkout at tree686821cf5b5fa603d63bf63bf20008d6be577aba. The bridge and Share extension were rebuilt. All50 shipped source/assets/CLI/model files match public source; six executable entry points and three unpacked native modules match ARM, and deep strict ad-hoc hardened signing passes. Reused runtime83 files/links remain unchanged and10 packaged Ollama relative links match pinned provenance. Detailed proof is in lifecycle-package-verification.json. No GUI, actual microphone capture, insertion or model inference was performed against this package. The latest desktop observation reports the Mac locked, and the previously observed permission password handoff is not confirmed complete.

## Memory context correction in development — October 7, 2026

Provider summarization already exists. Command Mode incorrectly appended raw keyword hits from MemoryIndex, including parsed items whose provider indexing was still pending; this path is now removed. Every enabled successfully indexed summary is included, independent of query terms. Failed, pending and disabled entries never contribute. The same summary context is included for utilities except the polish enhancer. Oversized combined summaries refuse the request visibly rather than silently omitting later items. Fifty-four focused tests pass, including a held indexing request proving raw unfinished content never reaches a concurrent command. The existing local Ollama/qwen2.5:7b service also completed a fictional reference indexing and command-answer fixture, preserving owner Ana and identifier CED-731 while excluding raw reference content; memory-local-provider-verification.json records the output. This verifies the source summary/context path with that local model, not packaged desktop Memory or live cloud/document behavior.


## Durable microphone labels and provider localization in development — October 7, 2026

Saved microphone rankings now retain friendly display labels across renderer relaunches. Only ranked IDs are persisted; labels are bounded plain text, escaped on display and never treated as evidence that a device is connected. Empty/redacted enumerations preserve names. Rank changes atomically merge observed labels and prune only unreferenced devices. Eighty-five backend and101 UI/shared tests pass, including disk migration, relaunch, disconnected rows, invalid atomic writes, rename and empty scans. Actual hardware ranking remains unverified.

Fifteen provider-card messages have original translations across18 locales, bringing the form catalogue to340 entries. Japanese/German DOM assertions verify privacy/disclosure text and preserve provider IDs, model names, endpoints and user instructions. Ninety-three focused renderer/catalogue tests passed before the microphone integration. Other legacy UI prose and backend diagnostics remain untranslated; this is not a complete localization claim.


## Combined Memory and microphone source verification — October 7, 2026

The full suite passes458 tests:453 passed,five existing optional live integrations skipped. The native system-capture ownership self-test was explicitly enabled against the current rebuilt helper. Memory now owns imported copies, safely removes replacements/deletions, preserves persisted summaries/error states on relaunch, captures provider metadata from the request settings, and completes indexing despite enabled-state changes. Native PDF indexing supports scanned files through validated Gemini/Anthropic document parts; tests verify the exact payload and rejected encryption/size/page limits without cloud inference. Local DOCX extraction includes body, headers, footers, footnotes and endnotes with bounded ZIP/XML parsing. Its layout and image fidelity are not established; native Gemini DOCX acceptance remains unverified. docs/memory.md records behavior and differences.

A separate public Command Mode audit confirms selected filenames feed file actions; it does not establish a native PDF/DOCX reading requirement there. Scribble lacks a verified Finder selection snapshot. An Accessibility-based bounded capture and trusted file-tool routing remain implementation work, followed by physical desktop acceptance. No Finder contents were read during this audit.


## Public Memory packages — October 7, 2026

Public5419146 at treeb30998f147d921806498a26b9b73158bc332007a now has fresh ARM and Intel packages. Both match all53 shipped source/assets/CLI/model files and pass executable architecture plus deep strict ad-hoc hardened-signature checks. Bridge and Share were rebuilt for each target. ARM runtime83 files/links stayed unchanged; Intel reused pinned runtime/dependency bytes and verified relative Ollama links through original/stage/package. Detailed proofs are memory-package-verification.json and memory-intel-package-verification.json. Neither package was launched or used for physical recording/insertion; Intel execution remains unverified.

The latest desktop observation now shows the Mac unlocked, but System Settings still presents its Privacy & Security password sheet. The microphone/Accessibility test authorization persists; effective grants are not confirmed. No screen/system-audio permission is inferred.


## Finder command-context source verification — October 7, 2026

The fresh ARM helper and full source suite pass470 tests:465 passed,five existing optional live integrations skipped. ARM and Intel native builds compile separately. Voice and typed commands now capture selected text and Finder paths once, retain private context for refinements, and refuse mismatched insertion owners. Selected file actions validate captured file identity before and after the destination dialog, preserve AX enumeration order, and use the ordinary input picker when selection is unavailable. Native traversal resolves selected nodes and bounded decorative children without treating expanded unselected folder descendants as selected. Pure fixtures cover ownership changes, URL rejection, traversal limits, decorated rows and ordering; no real Finder view was queried. Files can still change during underlying utility reads; no atomic filesystem snapshot is claimed. docs/finder-context.md records the runtime gates.

Public Command Mode documentation also establishes opt-in automatic screen context and a recording-time region overlay. The existing manual screenshot/percentage-crop tool does not establish those behaviors. A master switch, permission-gated automatic screen option and multi-region recording overlay are the next implementation scope. Screen Recording remains unapproved for assistant testing; source and synthetic verification can proceed without captures.

## Automatic command screen context source verification — October 7, 2026

The fresh ARM helper and full source suite pass 494 tests: 489 passed, five existing optional live integrations skipped. ARM and Intel native screen-helper builds compile without warnings. Screen context is off by default and permission gated. Voice region mode replaces automatic display context with up to five selected regions; zero regions fails explicitly. Typed region mode requires manual attachments. Changes to capture policy cancel the current command. Failed cleanup retains ownership and the next command retries confirmation before replacement. Disabling Command Mode still removes its shortcuts when cleanup fails. Refinements reuse private original images, bounded by a ten-minute review cache; image pixels are excluded from history and public events. See docs/command-screen.md for bounds and behavior.

Pure tests cover coordinates, ownership, deadlines, stale callbacks, cancellation before start, shutdown fences, policy changes and cleanup retry. No actual screen capture or overlay was performed. Screen Recording testing remains unapproved. The current macOS observation shows an unlocked session with System Settings waiting for the user's password; microphone and Accessibility testing are authorized but effective grants, live recording, global shortcuts and insertion remain unverified. Running packages still predate this screen-context source change.

## Screen packages and automatic command context — October 7, 2026

Fresh ARM and Intel packages of public c53dacfb7d78a2451ac720dfb2c5fb07320940ce match its exact source tree. Both verify 54 shipped source/assets/script/catalog files, architecture guards, deep strict ad hoc hardened signatures and the updated Screen Recording notice. Bundled runtimes retain their previously verified bytes and relative Ollama links. See docs/screen-package-verification.json and docs/screen-intel-package-verification.json. Neither package was launched; Intel execution, actual screen context and live permission behavior remain unverified. These packages predate the following automatic-context change.

The full source suite now passes 504 tests: 499 passed, five optional live integrations skipped. AI commands capture dictionary addition recency, known app, matched Tone and transcription language once and retain them for refinements. Existing file-attachment source and tests remain unchanged. Actual UTF-8 fixtures verify text-to-Markdown first-line headings, line-ending preservation and explicit opt-out; the parser also recognizes supported same-family “from X to Y” conversions. docs/command-automatic-context.md records bounds and semantics. Source tests do not prove live app selection, recording, shortcuts, insertion or vision inference; remaining file batches, output placement, formats and spoken system tools still require implementation and acceptance.

## Batch files, media formats and XML verification — October 7, 2026

The fresh ARM helper build and full source suite pass 534 tests: 529 passed, five optional live integrations skipped. The latest bridge and original ImageIO codec also compile separately for Intel without warnings. The new codec is a required packaged resource and the architecture guard now checks seven executable entrypoints.

Selected transformations and manual multi-file choices write adjacent per-input outputs after bounded identity, size, parent and collision preflight; ZIP extraction uses individual folders. PDF merge and ZIP creation retain combined dialogs. Actual fixtures cover multiple text/image/archive inputs, collisions before first output, source changes, partial failures and cancellation with completed output reporting. Format-preserving image compression defaults to quality 80. Generated image fixtures verify PNG/JPEG/WebP/AVIF/GIF/TIFF/genuine HEIC/HEIF/JFIF, animated GIF preservation and mislabeled HEIC refusal. Generated two-second media fixtures verify all seven documented audio and video formats plus existing Opus, with strict FFmpeg decode checks. Ordinary mixed-content XML round-trips through JSON, YAML and TOML; typed XML preserves supported configuration values and keys. docs/file-tools.md records representations, bounds and limitations.

No user media, screen capture, provider request or desktop operation was used for these checks. Existing c53 packages predate these changes. Fresh packages, live Finder selection, microphone/global shortcut/insertion acceptance and actual Intel execution remain required. Spoken editor/settings tools, screen palettes, output naming and Markdown PDF style choices also remain implementation work; passing this suite is not proof of full public-feature parity.

## File-tool package verification — October 7, 2026

Fresh ARM and Intel packages now use exact public 4d7d673a23b95447e5e780fe193d02abe4b11292, tree 6e5fe208a01cc08467be3310feba5df0b5d41ae9. Both verify 57 shipped source/assets/script/catalog files, seven executable entrypoints including the ImageIO codec, architecture-specific native modules, actual Info.plist and deep strict ad hoc hardened signatures. Native bridge, image codec and Share extension were rebuilt; cached Electron/dependencies and pinned speech/media/AI runtimes were reused and verified. See docs/file-tools-package-verification.json and docs/file-tools-intel-package-verification.json.

Neither package was launched. The running app remains an older package. The current System Settings observation still shows the password prompt awaiting user entry; microphone and Accessibility test authorization persists. Screen Recording testing has not been authorized. Fresh package parity does not establish desktop behavior, Intel runtime execution, notarization or full public-feature fidelity.

## Command tools, PDF styles and result previews — October 7, 2026

The source suite passes 567 tests with five optional integration skips (572 total). Eight editor targets and 17 Settings routes now use bounded command parsing, selected-file identity checks and the existing shortcut precedence rules. These tests exercise synthetic launch boundaries; they do not establish that a real editor or Settings pane opened.

Markdown PDFs default to GitHub styling and support minimal styling through the utility controls and spoken grammar. PDF structure, pagination, safe annotations, code whitespace and Unicode fixtures pass; both styles were rendered and visually inspected. The pinned markdown-it dependency and its six new dependency license notices are recorded and included in packaged source resources. Existing 387 lockfile package records are unchanged.

Command and AI utility previews render sanitized Markdown headings, lists, tables and code. Images become alt text without fetching resources; links use the existing external URL handler. Copy and insertion retain original text, and preview HTML is excluded from saved history. The screen palette action uses a token-owned capture and local sampling without a provider request. Capture denial, cancellation and late results are covered using synthetic frames; actual Screen Recording access and capture remain untested and unauthorized.

The utility interface now presents all verified formats, compression quality, PDF style and text-heading controls, plus persistent per-file batch outcomes. The form catalogue contains 373 entries across 18 locales. Live microphone, Accessibility insertion, Finder selection, shortcuts, new-package desktop acceptance and Intel execution remain open. Combined-output default naming remains outstanding. These source results do not prove complete public-feature parity.

## Command-preview ARM and Intel package verification — October 7, 2026

Fresh isolated packages built from public commit 629901b2fc43e7ee76e5a4140c533cbe1f36f7ef, tree 08c5e967474b2ecb68aefc4bd627f456da27a32a. Both retain 62 tracked source/assets/catalogue/CLI/notice files byte-for-byte, including THIRD_PARTY_NOTICES.md. ARM and Intel architecture guards, SDK 26.5 native/share compilation and deep strict ad hoc hardened signing pass. Runtime resources remain unchanged from prior verified packages. No runtime downloads, provider calls, service changes or GUI launches were performed.

All 387 prior dependency lock records remain unchanged. The six new pure JavaScript package directories were copied exactly; shipped runtime code and licenses match their sources. Builder metadata sanitization and argparse dependency hoisting are recorded explicitly rather than claimed byte-identical. Detailed evidence is in command-preview-package-verification.json, command-preview-package-dependencies-verification.json and command-preview-intel-package-verification.json. Neither static proof establishes microphone, insertion, screen capture, Finder interactions or Intel execution. The packages are not notarized and predate subsequent timer/combined-output/swatches edits.

## Selected combined outputs, timer grammar and palette swatches — October 7, 2026

The current source suite passes 586 tests with five optional integration skips (591 total). Selected PDF merging writes merged.pdf beside the first selection in enumeration order; selected archive creation writes archive.zip beside the first source. Explicit spoken basenames preserve case, add the matching extension when absent and reject paths/traversal/type mismatches. Preflight rejects aliases, duplicate archive names, case-equivalent existing outputs, changed source fingerprints and replaced output parents. Real generated PDF/ZIP fixtures verify merged page order and file/folder archive contents. A confirmed regular saved output remains reported when command cancellation arrives during the write. Existing path-based readers retain a source TOCTOU boundary; ZIP descendants are validated during execution rather than frozen by this preflight.

Timer commands recognize the public duration-before-timer example and enforce one second through 24 hours; longer reminders remain supported. Palette results display validated swatches, hex values and percentages while Copy retains complete text. The new command-tool-plan module validates and maps an executor-neutral schema for the 17 documented tools. Its multilingual examples are synthetic structured responses, not actual language inference, and the module is not yet connected to the model or live executor. The independent native timer pill is also still under implementation. See remaining-command-fidelity.md for the open requirements.

## Native timer pill and multilingual tool selection — October 7, 2026

The full suite passes 602 tests with five optional integration skips (607 total). Timer scheduling/cancellation, startup, resume, locale updates and shutdown now synchronize a dedicated native nonactivating countdown pill. It shows the nearest deadline, active count and a Cancel control, uses wall-clock deadlines and exposes standard accessible text children. Pure probes validate ordering, ceil-second countdowns, atomic refusal, geometry, and accessible summary data without creating a window; ARM and Intel compilation are warning-free. The main controller serializes snapshots, drops cancelled late updates, limits legacy display snapshots to the nearest 32 timers and closes through a final empty snapshot. Existing stored reminders remain intact. Timer labels add three original strings across 18 locales (376 catalogue entries); all 373 prior entries are unchanged. Desktop focus, physical positioning, clicks and VoiceOver behavior remain unverified.

Unresolved human instructions can now select one of the 17 bounded tool plans. Selection receives only the human instruction, capabilities and literal trusted target labels; selected text, Memory, Tone and images are structurally excluded from this action-authority turn. Writing generation retains its original captured context separately. Valid plans dispatch existing guarded file/timer/settings/target/palette operations, with cancellation and enabled-state checks. Malformed structured responses error visibly; plain prose never executes. Clear writing intents use one model call; ambiguous referenced text and explicit translation plans may need a separate generation call. Synthetic integration verifies selected-file execution and original context reuse.

Five held-out action-selection requests passed on the existing local qwen2.5:7b endpoint without service changes or format forcing: Portuguese image conversion, Italian PDF merge, Korean ZIP, Arabic timer and French Bluetooth settings. See multilingual-plan-isolated-fixtures.json. No tools were executed in that live model check. Earlier prompt variants failed other samples, so this is bounded evidence rather than an all-language reliability claim. Alias/literal-URL target preparation remains incomplete for arbitrary spoken app/site operands. The floating result review banner, voice follow-ups, version paging and provider retry behavior remain separate open requirements documented in result-banner-fidelity.md. Fresh packages and physical desktop acceptance remain required for this source revision.
