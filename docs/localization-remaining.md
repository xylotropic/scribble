# Remaining interface localization

Read-only source inventory, October 7, 2026. Renderer SHA-256: `268a3e30e1de9a190fec6f297ae2dbfb37dfd3b6f1431ca641a09d66a6000b64`. Line numbers describe this snapshot and will shift after edits. No proprietary translation files were read.

The shared core has 61 keys and the form/prose catalogue has 207 exact English keys across 18 locales. Current `interfaceLabel` and `interfaceProse` handle those entries. Catalogue presence alone does not localize text inserted directly into HTML, attributes, options or toasts. This inventory identifies those call sites, not linguistic review or runtime proof of complete coverage.

## Next migration order

1. **Summary-provider controls and fallback/status:** app.js:555,712,1663. Option labels `Configured language model`, `Claude subscription CLI` and button `Check Claude CLI` remain English. The note view prints `Local extractive notes used because the selected summary provider failed:`, `Provider unavailable`, `Summary provider:` and raw provider IDs. The check prints `Claude CLI {version}: subscription sign-in detected; inference has not been tested.` or backend `status.reason`. Translate wrappers and map configured-ai/claude-cli/local-extractive to display labels while preserving stored IDs, provider names, versions and diagnostic detail. The four settings labels/descriptions are already in the catalogue.
2. **Select option labels:** app.js:269 uses `esc(l)` without localization; setting helper options similarly need review. Translate display labels only, keeping values stable. Speech-language options at app.js:133 and237 mostly prefer English langList names before Intl.DisplayNames; decide translated names or native names consistently.
3. **Attributes and empty states:** translate placeholders, accessibility labels, icon-only button titles, and empty-state titles/descriptions. app.js:277 bypasses translation. Preserve caller user content and external text.
4. **Raw page HTML and generated messages:** migrate the finite candidates below into explicit message keys with parameters/plurals. Do not globally replace DOM text or run user transcripts through translation lookup.
5. **Native surface:** finish notifications, picker labels, Electron-role menu labels and overlay wrappers listed below.

## Finite renderer inventories

AST inspection collects literal button/empty/toast calls and direct option labels. HTML inspection collects text and attributes from literal strings/templates. `__DYNAMIC__` marks interpolation boundaries: these entries require a whole-message key, not fragment substitution. SVG/code/script/style text is excluded. Nested templates may yield overlapping candidates. Generated note-tab labels, array-driven utility cards, backend messages and arbitrary runtime strings require the explicit follow-up locations below; this is not a claim that static extraction finds all visible text.

### Uncatalogued literal button labels: 57 unique candidates

- app.js:438 — Choose files
- app.js:449 — Start dictating
- app.js:449 — Set up shortcuts
- app.js:466,784 — Check permissions
- app.js:466 — All history
- app.js:466 — Recent
- app.js:482 — Load older entries
- app.js:529 — Show final
- app.js:529 — Show original
- app.js:529 — Earlier
- app.js:529 — Later
- app.js:529 — Retry
- app.js:542 — Browse files
- app.js:542,735 — Remove
- app.js:542 — Back to files
- app.js:542 — Copy text
- app.js:542 — Edit captions
- app.js:555,601 — Import
- app.js:555 — Take notes
- app.js:555 — Regenerate
- app.js:555 — My notes
- app.js:558 — Add shortcut
- app.js:558 — Run
- app.js:561 — Choose context files
- app.js:561 — Capture screen context
- app.js:561 — Clear files
- app.js:561 — Run command
- app.js:561 — Speak a command
- app.js:561 — Insert
- app.js:561 — Refine
- app.js:601 — Add
- app.js:611 — Selected
- app.js:611 — Use model
- app.js:611 — Download
- app.js:636 — Test connection
- app.js:636 — Get Ollama
- app.js:636 — Download selected model
- app.js:639 — Automatic
- app.js:639 — Create tone
- app.js:639 — Pinned
- app.js:639 — Use tone
- app.js:642 — Import file
- app.js:642 — Add memory
- app.js:642 — Re-index
- app.js:695 — Refresh microphones
- app.js:695 — Clear preferred order
- app.js:712 — Check Claude CLI
- app.js:733 — Choose folder
- app.js:735 — Add binding
- app.js:735 — Restore defaults
- app.js:735 — Save exclusions
- app.js:752 — Request
- app.js:752 — Open settings
- app.js:754 — Refresh status
- app.js:756 — Restore
- app.js:1026 — Capture binding
- app.js:1879 — Prefer selected input

### Empty-state titles and descriptions (translation bypass): 12 unique candidates

- app.js:512 — A clean slate.
- app.js:512 — Your dictations and commands will show up here. Start with one sentence.
- app.js:542 — Your first transcript starts here.
- app.js:542 — Audio or video, short memo or long conversation. There’s no artificial quota.
- app.js:555 — Nothing lost. Everything remembered.
- app.js:555 — Capture microphone and meeting audio, then get a local summary and editable notes.
- app.js:601 — Make it sound like you.
- app.js:601 — Add a name, a term, or a phrase you say often. Your dictionary is stored locally.
- app.js:639 — Every app has its own rhythm.
- app.js:639 — Set a concise tone for Slack, a polished one for email, or keep your words untouched.
- app.js:642 — Your useful context, on hand.
- app.js:642 — Names, project details, preferred writing style, or a reference document.

### Direct select/setting option display labels (translation bypass): 51 unique candidates

- app.js:468 — All entries
- app.js:468 — Dictations
- app.js:468 — Commands
- app.js:468 — Files
- app.js:468,1005 — Voice shortcuts
- app.js:468 — Errors
- app.js:537 — Use configured language
- app.js:542 — Use configured provider
- app.js:605 — Local · no usage fees
- app.js:619 — Ollama · local and free
- app.js:619 — OpenAI
- app.js:619 — Anthropic
- app.js:619 — Gemini
- app.js:619 — Groq
- app.js:619 — DeepSeek
- app.js:619 — OpenRouter
- app.js:619 — Cerebras
- app.js:619 — Azure OpenAI
- app.js:619 — AWS Bedrock · bearer API key
- app.js:619 — Custom OpenAI-compatible API
- app.js:675 — Light
- app.js:675 — Dark
- app.js:684 — Google Chrome
- app.js:684 — System browser
- app.js:697 — Automatic
- app.js:697 — CPU · reduced parallelism
- app.js:712 — Configured language model
- app.js:712 — Claude subscription CLI
- app.js:712 — American English
- app.js:712 — British English
- app.js:723 — Bottom
- app.js:723 — Top
- app.js:723 — Hidden
- app.js:892 — Open a website
- app.js:892 — Open an application
- app.js:892 — Open a folder
- app.js:918 — Default
- app.js:924 — Default language
- app.js:1005 — Dictation
- app.js:1005 — Command Mode
- app.js:1005 — Start a note
- app.js:1005 — Paste last dictation
- app.js:1017 — Hold
- app.js:1017 — Toggle
- app.js:1034 — Use keyboard code
- app.js:1047 — Automatic tone
- app.js:1075 — Meeting
- app.js:1075 — Brainstorm
- app.js:1075 — Interview
- app.js:1075 — Lecture
- app.js:1075 — Personal

### Raw visible/accessibility attributes: 14 unique candidates

- app.js:303 — placeholder: Search pages…
- app.js:303 — aria-label: Find a workspace
- app.js:468 — placeholder: Search words, commands, or recordings…
- app.js:542 — aria-label: Choose audio or video files
- app.js:555 — placeholder: Search notes…
- app.js:555 — placeholder: Your own notes, decisions, or follow-ups…
- app.js:558 — placeholder: google public hiking trails
- app.js:561 — placeholder: Make this more concise, set a timer for 5 minutes…
- app.js:561 — placeholder: Make it shorter, change the tone…
- app.js:601 — aria-label: Enable expansion
- app.js:642 — aria-label: Include memory
- app.js:659 — aria-label: Dictation language
- app.js:870 — aria-label: Replacement text
- app.js:1746 — alt: Screen context preview

### Literal toast messages/fragments (translation bypass): 24 unique candidates

- app.js:988 — Saved locally.
- app.js:1151 — Preferred microphone unavailable. Using the next available input.
- app.js:1205 — Transcribing on this Mac…
- app.js:1205 — Transcribing with
- app.js:1205 — …
- app.js:1232 — Recording failed:
- app.js:1241 — Microphone disconnected. Finishing the captured audio.
- app.js:1384 — Saved:
- app.js:1465 — Microphone on.
- app.js:1465 — Microphone muted.
- app.js:1481 — Moment flagged.
- app.js:1523 — Item deleted.
- app.js:1545,1820 — Copied.
- app.js:1678 — Speech model selected.
- app.js:1686 — Model verified and installed.
- app.js:1825 — Insertion requested.
- app.js:1832 — Language model is connected.
- app.js:1838 — Language model downloaded.
- app.js:1893 — Selected input moved to the top of microphone priorities.
- app.js:1907 — Backup exported.
- app.js:1977 — Exclusions saved.
- app.js:2128 — Speech configuration saved.
- app.js:2143 — Language model preferences saved.
- app.js:2217 — Transcript ready.

### Raw HTML text/message candidates (translation bypass): 132 unique candidates

- app.js:260,347,438,449,529,542,561,608,619,642,735,737,752,762 — __DYNAMIC____DYNAMIC__
- app.js:303 — Go to a workspace
- app.js:322 — No matching workspace.
- app.js:351 — Scribble
- app.js:351 — VOICE WORKSPACE
- app.js:351 — Make it yours
- app.js:351 — Local by default.
- app.js:351 — Your voice stays yours.
- app.js:353 — Workspace
- app.js:353,555,639,642,756 — __DYNAMIC____DYNAMIC____DYNAMIC__
- app.js:438 — Output format
- app.js:449 — Speak naturally. Stay in flow.
- app.js:449 — A thought worth saying.
- app.js:449 — Hold
- app.js:449 — ⌥ Space
- app.js:449 — in any app. Release to write.
- app.js:449 — Use
- app.js:449 — ⌥ ⇧ Space
- app.js:449 — for hands-free dictation.
- app.js:449 — Finding your rhythm
- app.js:449 — Last 7 days
- app.js:449 — Ready when you are
- app.js:449 — A private microphone, a local model, a shortcut. That’s all you need.
- app.js:449 — No account, subscription, or transcription limit.
- app.js:449 — Voice log
- app.js:449 — The local speech runtime needs setup. Run
- app.js:449 — from this repository.
- app.js:466 — Your daily activity appears after the first dictation.
- app.js:529 — __DYNAMIC__ words
- app.js:529,697 — __DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC__
- app.js:529 — __DYNAMIC__ / __DYNAMIC__
- app.js:542 — Selecting a local model transcribes these files on this Mac. Choices apply to files added next.
- app.js:542 — Drop a recording here
- app.js:542 — MP3 · WAV · M4A · MP4 · MOV · FLAC · OGG · and more
- app.js:542,555 — __DYNAMIC__ · __DYNAMIC__
- app.js:542 — Your transcriptions
- app.js:542 — __DYNAMIC__ files
- app.js:542 — Transcription queue
- app.js:542 — Transcript
- app.js:542 — __DYNAMIC__ · __DYNAMIC__ words · __DYNAMIC__
- app.js:555 — Edits save automatically on this Mac.
- app.js:555 — AI summary draft. Review its wording against the quoted transcript evidence.
- app.js:555 — Local extractive notes used because the selected summary provider failed: __DYNAMIC__
- app.js:555 — Summary provider: __DYNAMIC__
- app.js:558 — Say “google best coffee near me” while dictating. Scribble routes the phrase instead of typing it.
- app.js:558 — Try a shortcut
- app.js:558 — Running a shortcut opens the selected app, folder, or browser destination.
- app.js:558,601 — BUILT-IN
- app.js:561 — Hold ⌥ ⌃ Space for a voice command
- app.js:561 — What would you like to do?
- app.js:561 — __DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC__
- app.js:561 — Local utilities are ready. AI commands use your configured provider.
- app.js:561 — A few things to try
- app.js:561 — Focus the result and press Tab to insert, or Escape to dismiss.
- app.js:561 — Refine this result
- app.js:561 — Timers
- app.js:601,605,1295,1746 — __DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC__
- app.js:601 — Variables: {date}, {time}, {clipboard}. Start a trigger with a colon, such as :intro. Secure password fields are excluded.
- app.js:605 — Choose where speech is transcribed
- app.js:605 — Local models run on this Mac for free. Choosing a cloud service sends the audio you transcribe to that provider. Its API may charge for usage.
- app.js:605 — Save speech configuration
- app.js:605 — Local transcription does not upload audio. Switching back to Local restores that behavior. Cloud file-size and duration limits depend on the provider.
- app.js:608 — Model files stay outside the source repository. You can move them by changing SCRIBBLE_DATA_DIR.
- app.js:611 — __DYNAMIC__ · __DYNAMIC__ MB
- app.js:611 — SHA-256 verified downloads. __DYNAMIC__
- app.js:611 — ACTIVE
- app.js:611 — __DYNAMIC__%
- app.js:619 — Configure a language model
- app.js:619 — __DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC__
- app.js:619 — Save configuration
- app.js:619 — Local intelligence
- app.js:619 — Keep the whole loop private.
- app.js:619 — Ollama serves a local language model for cleanup, commands, summaries, and tones. No API key is needed.
- app.js:619 — Scribble starts its bundled Ollama runtime when needed. You can use a smaller model on a Mac with limited memory.
- app.js:619 — What gets sent?
- app.js:619 — Commands can include text, selected files and screen images you attach. Memory indexing sends reference text to the configured provider. Scribble does not send audio to a text model or use telemetry.
- app.js:659 — Dictation language
- app.js:659 — __DYNAMIC__ transcribes __DYNAMIC__. Choose a multilingual model to change languages.
- app.js:675 — A workspace that fits.
- app.js:675 — __DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC__
- app.js:695 — Your microphone.
- app.js:695 — Choose a connected input. Refreshing devices asks the browser for microphone access so labels are available.
- app.js:695 — The system default follows your Mac’s selected microphone. Unavailable preferred inputs fall through to the next choice and then the system default.
- app.js:695 — Preferred order
- app.js:697 — Every word, understood.
- app.js:697 — Whisper .en models transcribe English only. Select Base or a larger multilingual model for other languages.
- app.js:723 — Stay in the flow.
- app.js:723 — __DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC____DYNAMIC__
- app.js:723 — Recordings folder
- app.js:723 — Changing folders applies to new recordings. Existing audio keeps its original path so playback and retries still work.
- app.js:735 — A shortcut for every thought.
- app.js:735 — Bindings are global when Accessibility access is enabled. Use hold for push-to-talk, or toggle for hands-free recording.
- app.js:735 — Escape cancels an active recording. Cmd+Shift+L can be configured to paste the last dictation.
- app.js:735 — __DYNAMIC__ __DYNAMIC__
- app.js:735 — __DYNAMIC__ + __DYNAMIC__
- app.js:737 — Only what’s needed.
- app.js:737 — Scribble needs microphone access for recording and Accessibility access for shortcuts, insertion, and expansions. Screen recording is optional for meeting audio.
- app.js:756 — Your workspace belongs to you.
- app.js:756 — Export backup
- app.js:756 — Settings, vocabulary, transcripts, notes, and history. API keys are excluded.
- app.js:756 — Restore backup
- app.js:756 — Your current workspace is backed up before replacement.
- app.js:756 — Data folder
- app.js:758 — Recent clipboard
- app.js:768 — A voice workspace you can build on.
- app.js:768 — Use the CLI to search your history, transcribe a file, manage vocabulary, or expose an MCP server to your coding agent.
- app.js:768 — Speech runtime
- app.js:768 — Communication uses a local Unix socket with owner-only permissions. Scribble does not expose a public HTTP server.
- app.js:768 — Version __DYNAMIC__ · MIT licensed original source
- app.js:784 — Start with one sentence.
- app.js:784 — Download a speech model in Speech models.
- app.js:784 — Allow microphone and Accessibility access.
- app.js:784 — Hold Option+Space in the app where you want to write.
- app.js:784 — Release. Your words appear at the cursor.
- app.js:784 — Free, local components.
- app.js:784 — Speech recognition uses Whisper.cpp and optional Parakeet. Language-model features use Ollama or your explicitly configured provider.
- app.js:784 — Scribble’s source is original. Vowen’s public behavior informed the feature checklist. No Vowen application code or artwork ships with Scribble.
- app.js:784 — MICROPHONE ICON · SCRIBBLE
- app.js:784 — Useful shortcuts
- app.js:784 — Closing the window keeps Scribble in the menu bar. Use Quit Scribble to exit completely.
- app.js:870 — Replacement
- app.js:870 — Formatting is included when inserting through the clipboard. AI cleanup returns plain text. Variables: {date}, {time}, {clipboard}, {selection}.
- app.js:943 — Source file: __DYNAMIC__. Saving re-reads this file and rebuilds its summary using your configured AI provider.
- app.js:1026 — Press a key, modifier chord or auxiliary mouse button.
- app.js:1520 — This removes the item from Scribble’s workspace. Your source audio files are kept.
- app.js:1703 — You can download it again whenever you need it.
- app.js:1746 — Only the selected preview is attached. Running the command sends it to your configured AI provider. Use a vision-capable model.
- app.js:1746 — Screen
- app.js:1746 — Region within the preview, in percentages. Leave 0, 0, 100, 100 for the full screen.
- app.js:1871 — Input device
- app.js:1871 — System default
- app.js:1913 — This replaces the current workspace from a backup. Scribble saves a copy of the current data first.

## Generated/array-driven messages to migrate explicitly

| Source | Finite migration task |
| --- | --- |
| src/renderer/app.js:377 | Utility cards are arrays with titles/descriptions, rendered directly: Extract image colors, Convert audio/video, Merge PDFs and their instructions. Translate display strings, preserve operation IDs and format names. |
| src/renderer/app.js:449 | Home personalized heading and count sentence: Your words, in motion{name}; {count} words spoken today. What’s on your mind? Use parameters, locale-aware numbers and plural forms. |
| src/renderer/app.js:450 | Dashboard stat arrays: Words captured, Your ideas, saved, related activity/count labels. Current total.toLocaleString() uses OS locale, rather than UI locale. |
| src/renderer/app.js:466 | Chart tooltip {date}: {words} words; date axis is already locale-aware. Add whole tooltip message and count formatting. |
| src/renderer/app.js:555 | Note tabs are generated from summary/transcript/personal via capitalization; replace with explicit localized display labels. Keep stored noteTab/data-field values. |
| src/renderer/app.js:951 | Add/Edit titles combine fragments with word/thread/expansion/shortcut/tone/memory. Use 12 full localized titles, not translated English fragments. |
| src/renderer/app.js:1026 | Capture binding button and initial instruction. |
| src/renderer/app.js:1404 | Hotkey capture listening status is a direct textContent message: Listening for a binding… Escape cancels. Capture expires after 30 seconds. |
| src/renderer/app.js:1303 | Queue display currently uses Waiting, Transcribing, Done and Failed: {error}. Keep internal queue state stable; localize at rendering. |
| src/renderer/app.js:2191 | Capture result uses Captured: {modifiers} + {key}; timeout/cancel messages at2196 are also directly assigned. |
| src/renderer/app.js:245 | toast accepts external errors, user/AI result text and app messages. Localize known app messages at their source; never translate arbitrary text by global replacement. Include Unable to save, Operation failed and direct throw Error messages exposed here. |
| src/renderer/app.js:133 | Speech/summary language names are an English catalogue; prefer Intl.DisplayNames for UI-language names, or intentionally native names. Auto-detect needs an ordinary translated label. Preserve locale IDs. |

The option list above includes proper names (OpenAI, Anthropic, Gemini, Google Chrome, etc.). Those remain brand names; translate attached descriptions such as local and free, bearer API key, reduced parallelism, and provider defaults. File-format acronyms and keyboard tokens remain unchanged. A row in the static inventory does not imply a brand or technical token needs translation.

## Main, overlay and native surfaces

| Source | Remaining task |
| --- | --- |
| src/main/index.js:72 | notify passes title/body literally to Notification and notice IPC. Translate app-owned titles and wrappers, preserve transcript previews, reminder titles and external diagnostic detail. |
| src/main/index.js:376 | Busy notice title/body: Scribble is busy; Finish the current recording or transcription first. |
| src/main/index.js:584 | Reminder notification title. |
| src/main/index.js:571 | Timer-result scheduled for {date} wrapper; toLocaleString currently uses OS locale rather than selected UI locale. |
| src/main/index.js:608 | Command file-result Saved {path} wrapper and optional notice. |
| src/main/index.js:926 | Your notes are ready / Transcription ready; No speech detected fallback. Body transcript excerpts remain user content. |
| src/main/index.js:1093 | Recording could not start title; structured reason localization can precede preserved native error detail. |
| src/main/index.js:789; src/renderer/overlay.js:13 | Cloud processing sends Transcribing with {provider}…; overlay's known-message map handles the local phrase but does not recognize this dynamic cloud phrase. Send a message key plus provider parameter rather than raw English. |
| src/main/index.js:1184 | File picker filter Audio and video. Other filters at 1313 (Import), 1351 (Scribble backup), 1481 (Command context). OS-owned dialog controls follow macOS locale. |
| src/main/index.js:901 | Generated default Untitled meeting; distinguish future default labels from stored user-editable titles. |
| src/main/index.js:110 | Electron role-based About/Hide/Hide Others/Show All/Quit/Edit/View/Window menu labels are not explicitly tied to Scribble UI locale. Verify actual role behavior, then supply translated labels while retaining roles/accelerators if required. Tray action labels and settings/automatic-tone labels are already translated. |
| src/main/index.js:1733 | Startup sets an English tooltip before refreshInterfaceMenus replaces it. Avoid English flash; use localized tooltip directly. |
| src/main/index.js:1784 | Startup error box title Scribble could not start. Preserve diagnostic stack as diagnostic text. |
| src/main/summary-cli.js:143 | Summary CLI status.reason branches are English backend messages: policy rejection, unsupported isolation/auth metadata, sign-in unavailable, CLI not installed. Return stable reason codes/parameters for localized wrappers; keep technical detail. Never imply inference was verified by metadata checks. |
| src/renderer/overlay.js:10 | Selected custom tone tooltip prefixes Tone: in English. Use a parameterized message; custom tone name stays untouched. |
| src/renderer/overlay.js:11 | Action failed generic fallback; external error.message remains diagnostic detail. |
| src/renderer/overlay.html:1 | Document title Scribble recording indicator and section aria-label Scribble voice controls are static. Controls/meter/status are replaced by localizedControls; these two are not. |
| native/ShareExtension/ShareViewController.swift:7 | Preparing selected audio and video…, Add to Scribble, Cancel, empty/error messages, queue count and skipped count at46, installation message at60 and host-open failure wrapper at65. Requires native resource strings/plurals and a deliberate locale handoff; the extension does not read the main app's UI-language setting. |
| native/ShareExtension/Info.plist:6 | CFBundleDisplayName Add to Scribble needs localized InfoPlist.strings if the Share-menu name is to follow a supported system locale. Runtime UI locale and system Share-menu locale may differ; document that choice. |
| native/ScribbleBridge.swift | Native protocol errors are English diagnostics. Localize stable product-facing wrappers/codes at the host boundary; retain OS error details instead of modifying native messages by text matching. |

## Verification for each bounded migration

- Validate every new key and parameter across all 18 catalogues; do not count English fallback as translation coverage.
- Exercise translated option labels while proving stored values/action IDs unchanged.
- Check placeholders, accessibility labels, notifications, dialogs and overlay separately from visual headings.
- Test fallback/status paths with mocked failures. In particular retain the Claude disclosure that inference has not been tested, and distinguish local-extractive fallback from the requested provider.
- Keep user text, custom tone/profile names, paths, URLs, model names, transcripts, AI output, versions and diagnostic detail unchanged.
- Verify live locale changes preserve unsaved input, selection, recording state and queued jobs. Regenerate this inventory against the resulting source baseline.


Subsequent bounded coverage: the 18 first-run setup labels and the 23 File tools card titles, descriptions and Output format label are now translated in all 18 locales. Technical format identifiers remain unchanged. This does not resolve the remaining raw options, dynamic status text or notifications.
