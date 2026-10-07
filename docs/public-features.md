# Vowen public feature evidence for Scribble

Observed 2026-10-07 (America/New_York). This is an original factual inventory, not copied source code, assets, or a claim of completed implementation. Public documentation describes capabilities; runtime parity must be tested independently.

## Version and scope

`plutil -extract CFBundleShortVersionString raw /Applications/Vowen.app/Contents/Info.plist` returned **0.5.9**. The [official homepage](https://vowen.ai/) advertised **0.5.10, September 30**. Do not silently treat documentation for the current website as proof of the installed build. Mac and Windows are advertised; initial Scribble delivery targets Mac.

## No-payment entitlement matrix

The detailed [plans documentation](https://docs.vowen.ai/pricing) distinguishes the following. Free app entitlement does not make third-party API use free.

| Capability | Free entitlement |
|---|---|
| Dictation; local and BYOK cloud speech; supported languages | Unlimited |
| Voice log; vocabulary | Included |
| File transcription | 10 lifetime |
| Meetings | 10 saved notes |
| Basic meeting summary | Included |
| Single-file subtitle export | SRT/VTT |
| AI cleanup; dictation instructions | BYOK |
| Command Mode | 5/day |
| Tone; expansion | 1 custom each |
| Memory | 3 items |
| Custom voice shortcuts | 3 |
| Utility | 1 preconfigured |
| CLI/MCP | Included |

That page labels live preview, diarization, English translation, parallel file queues, watch folders, deletion, document exports, meeting pause/resume, automatic detection, custom summaries, citations, meeting chat/import/sharing, integrations and cloud sync as Pro. Enterprise features are commercial requests, not proven app switches.

The [plan limits reference](https://docs.vowen.ai/reference/plan-limits) additionally states dictionary words and threads are unlimited; built-in expansions/default tone do not consume custom allowance. It labels multiple bindings, auto-stop meetings, auto-learned corrections, Cursor/Windsurf file tagging and custom workflow webhooks/scripts Pro. Free history cannot be deleted to recycle note/file slots. There is no meeting-duration cap in that reference.

## Detailed behavior inventory

| Area | Publicly documented behavior | Evidence |
|---|---|---|
| Dictation | System-wide cursor insertion; push-to-talk, hands-free, mouse triggers; optional AI cleanup; local processing or direct BYOK provider requests | [Introduction](https://docs.vowen.ai/introduction) |
| Default Mac hotkeys | Fn dictation; Option+Shift commands; Fn+Control hands-free; Escape cancel; optional Cmd+Shift+N notes and Cmd+Shift+L paste-last; meeting panel Cmd+backslash | [Shortcuts](https://docs.vowen.ai/features/shortcuts) |
| Binding editor | Hold/tap modes; conflict rejection; immediate rebinding; free one binding per action | [Shortcuts](https://docs.vowen.ai/features/shortcuts) |
| Overlay | Pill or native notch; top/bottom/hidden; follows active display; starting/recording/paused/processing/resuming states; waveform; app/tone/enhancement badges | [Indicator](https://docs.vowen.ai/features/recording-indicator) |
| Overlay interaction | Toggle-session pause/stop; hold-stop cancellation; optional idle strip with dictate, command, note and tone picker | [Indicator](https://docs.vowen.ai/features/recording-indicator) |
| File input | One free file per run; per-file engine/language/timestamp choices; drag or browse; video audio extraction; edit/copy/regenerate result; completion notification | [Manual transcription](https://docs.vowen.ai/transcription/manual-transcription) |
| File formats | Audio MP3/WAV/M4A/AAC/OGG/FLAC/WMA/OPUS; video MP4/MOV/AVI/MKV/FLV/WMV/WEBM/MPEG/MPG | [Manual transcription](https://docs.vowen.ai/transcription/manual-transcription) |
| File timings | Clickable segment times where supported; Mandarin Parakeet and Nemotron have no file timings/subtitle export | [Manual transcription](https://docs.vowen.ai/transcription/manual-transcription) |
| History | Last 100 dictations/commands; day grouping; search final/original/errors/command revisions; filter; copy; retry retained audio with current model; original/AI toggle | [Voice log](https://docs.vowen.ai/transcription/voice-log) |
| Command history | Latest result in one row with revision pager; up to 30 turns; failed/silent recordings appear with messages | [Voice log](https://docs.vowen.ai/transcription/voice-log) |
| Threads | Trigger→replacement after speech engine; plain/rich editor; unique triggers; search; all occurrences; longest-first; case-insensitive Unicode-aware boundaries | [Threads](https://docs.vowen.ai/features/threads) |
| Rich threads | Rich/plain clipboard alternatives; rich formatting collapses when AI rewrites or direct character insertion is used | [Threads](https://docs.vowen.ai/features/threads) |
| Tones | Automatically select by app/site/hotkey; switch style, speech engine, dictation language and enhancer; engine-only profiles need no AI key | [Tones](https://docs.vowen.ai/ai-features/tones) |
| Memory | Named notes/files; index through configured provider; inject indexed summaries into commands/utilities, not ordinary cleanup/meeting summaries; delete/re-index; no edit UI | [Memory](https://docs.vowen.ai/features/memory) |
| Voice shortcuts | Free built-ins: Google, YouTube, DuckDuckGo, ChatGPT, Claude, Perplexity, navigate website, open common folder; custom actions open apps/folders/sites | [Voice shortcuts](https://docs.vowen.ai/features/workflows) |
| Shortcut routing | Prefix/alias/fuzzy matching; longest trigger first; custom wins tie; invalid address/folder can fall through to dictation; query substitution; browser/profile choice | [Voice shortcuts](https://docs.vowen.ai/features/workflows) |
| Utilities | Selected-text/clipboard prompts; preset cleanup/formal/polish/summary/bullets/email; result review with Tab paste, Escape dismiss, Copy | [Voice shortcuts](https://docs.vowen.ai/features/workflows) |
| Commands | Selected text/files, clipboard, screen/region and memory context; rewrite/summarize/translate/format/reply; review/refine text result; hold/toggle/mouse starts | [Command Mode](https://docs.vowen.ai/ai-features/command-mode) |
| Command actions | Image/config/audio/video conversion; PDF merge; image compression; ZIP/unzip; text→Markdown; Markdown→PDF; open app/site/editor/settings; timer; color palette | [Command Mode](https://docs.vowen.ai/ai-features/command-mode) |

## Model catalog evidence

The [official model page](https://vowen.ai/models/) lists local Whisper Tiny through Medium, Large v3/Turbo (99 languages), Parakeet v2 (English), v3 (25 languages), Japanese/Mandarin, and Apple-Silicon Nemotron. Model switching can vary by tone/task. Listed cloud services include Mistral, Groq, Deepgram, ElevenLabs, AssemblyAI, Soniox, OpenAI, Cartesia, Gemini, Speechmatics, Sarvam, xAI, OpenRouter and OpenAI-compatible servers. BYOK support is an app capability, not a promise of zero provider charges. Local engines and their redistribution licences require independent verification before bundling in Scribble.

## UI and settings coverage

The [settings documentation](https://docs.vowen.ai/get-started/settings) describes sidebar destinations Home, Transcribe, Speech models, Dictionary, Voice Shortcuts, Configure AI, Notes, Tones, optional Connectors, Settings and Help. The settings modal has Account, General, Audio, Language, Recording, Shortcuts, Sync, Developer, Experimental and Permissions; search is provided.

Configuration includes launch-at-login, hide Dock icon, auto-paste/direct insertion, auto-enter, clipboard restoration/history behavior, sounds, transcription history, filler removal, model resource mode, ranked microphones, UI/dictation/summary languages, UK/US spelling, recording location/indicator, shortcut editor, CLI management and IPv4 preference. Theme has a separate toolbar control. Some rows are gated by Pro or model/platform availability. This list is a coverage checklist, not runtime confirmation.

## Public inconsistencies and additional evidence

| Conflict | Consequence |
|---|---|
| [Marketing pricing](https://vowen.ai/pricing/) advertises 5 meeting hours; [reference](https://docs.vowen.ai/reference/plan-limits) says no duration cap | Test free installed runtime; do not invent a 5-hour quota |
| Marketing says 7 built-in voice shortcuts; [workflow docs](https://docs.vowen.ai/features/workflows) enumerate 8 | Inspect actual built-ins |
| Marketing implies words appear live; detailed plan reference calls preview Pro | Free speech output may be batch-only |
| Pricing marketing includes 1 API integration; plan reference labels custom providers Pro while pricing docs describe a built-in slot | Verify actual free slot capabilities |
| [Changelog](https://vowen.featurebase.app/changelog) describes Google Calendar in 0.5.7; pricing docs says OAuth verification still blocks calendar | Do not call reachable without runtime evidence |
| Changelog listing retrieved began at 0.5.7, but homepage links 0.5.10 | Changelog feed retrieval is incomplete for newest releases |
| Voice log docs show Delete on every entry; plans prohibit deleting transcriptions/notes | Dictation-log versus file/meeting history distinction needs runtime verification |

The retrieved changelog documents recording-folder choice, retained audio after stream failure, Hyper hotkeys, cue-volume control, voice reminders/timer banners, file drops via Share/Open With/Dock, mid-meeting independent mic/system mutes, audio playback, terminal screenshot insertion and model reconnect/recovery. These are public behavior candidates; availability and plan classification must be established before claiming free parity.

## Completion evidence still required

Public descriptions alone cannot prove every reachable feature or fidelity. Record installed free-plan UI navigation and permissions, execute dictation/paste/cancel/retry/file/note/voice-action workflows, verify local engines without provider charges, enumerate model/UI languages, inspect CLI/MCP command surface, and test settings persistence. Record each observed behavior against a Scribble acceptance test. Paid integrations and backend services can be documented as out of free-runtime scope; they must not be bypassed or silently represented as implemented.
