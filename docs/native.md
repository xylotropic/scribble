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
