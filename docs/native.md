# macOS bridge

Scribble's original Swift helper supplies global dictation hotkeys, selected-text access, insertion, text expansions, clipboard monitoring, and system audio capture. It requires macOS 13 or newer. Microphone capture remains in the renderer; meeting audio can be captured separately as WAV and transcribed by the application. Native system capture does not mix microphone audio.

Build with `node scripts/build-native.mjs`. The default SDK is MacOSX26.5 from Command Line Tools; override `SCRIBBLE_MACOS_SDK` if needed. `SCRIBBLE_NATIVE_ARCH=arm64` or `x64` controls the target; package each architecture with its matching executable at `release/native/scribble-bridge`.

The application launches the helper once. Send one JSON object per line on stdin. Replies include the request `id`, `ok`, and `result` or `error`. Events have no request ID. `--status` reports permission state without prompting or installing a global event tap.

Commands:

- `status`: accessibility, screenRecording, microphone authorization raw value, hotkeys, systemRecording.
- `permissions`: optional `accessibility: true` and `screenRecording: true` request the corresponding system prompt. Permission is always controlled by the user in macOS Settings.
- `setHotkeys`: `keyCode` (default 49/Space), `modifiers` (default `["option"]`), `toggle` (default false), `mode` (dictation/command/shortcut/meeting). Emits `hotkey` with `phase` start or stop and mode. Hold stops on key release or modifier release; autorepeat is ignored.
- `paste`: `text`, `restoreClipboard` (default true), `autoEnter` (default false). Attempts Accessibility insertion then clipboard and Command-V. Clipboard restoration occurs only if no subsequent clipboard owner changed it.
- `selection`: returns `{text}` for the focused field, excluding secure text fields.
- `frontmost`: returns name, bundleId, pid.
- `setExpansions`: `expansions: [{trigger,replacement}]`; supports `{date}`, `{time}`, `{clipboard}` and literal newlines. Secure fields are excluded; synthetic events are tagged to prevent recursion.
- `clipboardMonitoring`: `enabled`; emits clipboard text only when enabled and changed. Clipboard monitoring is opt-in and may expose sensitive copied text to the local app.
- `open`: `url` supports HTTP(S), mailto, and macOS Settings links.
- `recordSystemStart`: absolute `path` to WAV destination. Captures output from the primary display via ScreenCaptureKit, excluding Scribble's own audio. Capture permission denial returns an error.
- `recordSystemStop`: flushes/closes output and returns path.

EOF closes the active capture and exits. Unexpected stream failure emits `recordingError`. Capture uses a dedicated serial queue. The helper does not grant permissions itself. Global typing features depend on Accessibility permission and apps exposing Accessibility fields; insertion fallback also depends on focus being in a writable field. A packaged app should sign its helper consistently to preserve macOS permission identity across updates.

Multiple bindings are configured with `setHotkeys({hotkeys:[{keyCode,modifiers,mode,toggle}, ...]})`. `keyCode:-1` enables modifier-only bindings (including `fn`). Escape emits `hotkey` with phase `cancel`. `paste-last` bindings emit one start event per press. Different bindings can use distinct hold/toggle behavior simultaneously.

`recordSystemPause` stops audio delivery without closing the WAV writer; `recordSystemResume` starts the same stream and appends samples. Both reply `{paused:boolean}` and fail when no system capture is active. Paused intervals are omitted from output, matching renderer MediaRecorder pauses. Status includes `systemPaused`. Stop closes the writer even when paused.

Editing command API: `edit` with `action: "undo" | "redo" | "selectAll" | "find"`; these four action names also work directly as commands. Accessibility permission is required. Optional `expectedPid` rejects a changed foreground application before posting events. Secure password fields are rejected. Replies report `dispatched:true, verified:false`, plus action and target identity: a posted keyboard shortcut does not prove the receiving application performed it. `find` optionally accepts `text`; insertion occurs only if the original app remains foreground and Accessibility observes a different, nonsecure focused field. Otherwise `queryInserted:false` explains the skipped query.

`dryRun:true` validates/maps an editing action without requesting permission or posting events. `--no-event-tap` disables global keyboard observation for protocol tests. Status includes `hotkeyBindings` with keyCode, mode, toggle, and active state; invalid or duplicate binding replacements are rejected atomically. Replacing bindings cancels any active binding.

Permission identity matters: status describes the native helper's AVCaptureDevice/TCC identity, which can differ from Electron's renderer microphone identity during development. `permissionIdentity` reports helper pid, executable, bundle identifier, and microphoneSource. The Electron main process should use `systemPreferences.getMediaAccessStatus('microphone')` as the authoritative microphone display for renderer capture, while retaining helper Accessibility and ScreenCaptureKit status. A checked permission row in Settings is not evidence of another executable's authorization. Stable packaged signing and process identity help preserve grants between app launches. Tests never request or change permissions.

`paste` optionally accepts caller-sanitized `html` alongside its plain `text` fallback. Nonempty HTML chooses clipboard-rich insertion, carrying both `public.html` and `public.utf8-plain-text`; the receiving app chooses a supported representation. Plain insertion attempts Accessibility first and otherwise uses a plain clipboard item. The helper does not render or sanitize HTML; the product must sanitize it before this call.

Paste replies identify `method` (`accessibility`, `clipboard-rich`, `clipboard-plain`, or `none`). Accessibility setter success returns `inserted:true, verified:true`. Posted Command-V returns `inserted:false, dispatched:true, verified:false`; it cannot prove the receiving application inserted content. The caller should treat `inserted || dispatched` as an accepted insertion request. Permission denial, secure fields, and changed optional `expectedPid` return no insertion or dispatch and a reason. Auto Enter remains in the same foreground process. Clipboard restoration preserves every item and available data type; another application's new clipboard write cancels restoration.

`paste` with `dryRun:true` reports planned format types without clipboard writes or keyboard events. `--clipboard-self-test` exercises actual snapshot/restoration using a unique private pasteboard, including HTML, arbitrary binary data, multiple items, and changed ownership. It never accesses or modifies the user's general clipboard.

Typed expansion items can also include sanitized `html` alongside `replacement`. Placeholders support `{date}`, `{time}`, `{clipboard}`, `{selection}` and `{selected_text}`, single or double braces, case-insensitively. The helper captures selected text before the first trigger keystroke replaces it. Templates are expanded once; placeholder text inside clipboard/selection data remains literal. Dynamic data is HTML-escaped when used in rich templates. The helper verifies the same nonsecure Accessibility field remains focused before deleting the trigger or inserting the replacement. These behaviors depend on apps exposing reliable selected text and field identity through Accessibility.

`frontmost` optionally reports URL context for Google Chrome only. It reads the focused window's AXDocument, the focused element's document, an identified focused omnibox value, or AXURL on at most eight focused ancestors. It never traverses browser children, inventories tabs, launches AppleScript, or changes browser focus. HTTP(S) URLs omit query strings/fragments and reject embedded credentials; non-web documents are unavailable. `urlAvailable` and `urlSource` distinguish observed evidence from permission absence, unsupported apps, or inaccessible browser fields. An inaccessible URL remains an empty string and must not be inferred from a page title. Bounded AX reads do not prove all Chrome versions expose the same attributes.

Hotkey bindings optionally carry `toneId`, which accompanies their start/stop/cancel events. Native only forwards this identifier; main must resolve it to an existing product tone. The protocol's self-test emits fixture events to stdout without posting desktop keystrokes.
