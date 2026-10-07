# macOS Share extension

`native/ShareExtension` is an original macOS Share extension for saved audio/video files. It displays an explicit **Add to Scribble** button, validates regular-file URLs against the app's existing supported extension list, removes duplicate URLs, and opens accepted files with its containing Scribble.app. The app's existing `open-file` handler calls `acceptOpenFiles` and emits `open-files` to its transcription queue. Adding files does not start transcription automatically.

Finder's `public.file-url` attachments and genuinely in-place audio/movie representations are accepted. Temporary-only representations are rejected with a visible message; this implementation does not copy them into an app-group inbox. Security-scoped access acquired during validation is released after the host launch completes or the share is canceled. No microphone, screen capture, automation, cloud service or app-group permission is requested.

## Build and integrate

Run `node scripts/build-share-extension.mjs` on macOS. The default SDK is the installed MacOSX26.5 SDK; `SCRIBBLE_MACOS_SDK` overrides it. `SCRIBBLE_NATIVE_ARCH=arm64` or `x64` selects the architecture. The script produces an ad hoc signed `release/native/ScribbleShare.appex`. It deliberately does not install or register it.

The package and dist scripts now build and embed the bundle at **Scribble.app/Contents/PlugIns/ScribbleShare.appex**. Putting it under Resources/native will not register a Share extension. For electron-builder, add an `extraFiles` entry with `from: release/native/ScribbleShare.appex` and `to: PlugIns/ScribbleShare.appex`; macOS extraFiles destinations are relative to Contents. Run the extension build before packaging. Include both architectures in a universal build, or build one matching the host package.

Sign the nested extension before signing the containing app. Its own `native/ShareExtension/entitlements.plist` enables App Sandbox and read-only user-selected files. Do not replace these with Electron's unsandboxed app entitlements. Configure the packaging sign hook/options to preserve the extension-specific entitlements, or sign the extension explicitly with those entitlements before final host signing. Ad hoc local verification is supported; distribution requires a suitable Apple signing identity, host/extension identity consistency and the normal notarization workflow. No distribution or entitlement approval is implied by the local build.

No new main-process action, queue transport, custom URL scheme, renderer or app-group handler is required. The current app's supported media suffixes are duplicated in the extension validator; keep the two sets synchronized when adding formats. The activation rule permits up to 100 file/movie attachments, so Finder may also offer the extension for unrelated file selections; those are rejected by validation.

## Verified and remaining checks

The arm64 executable compiled against SDK26.5, both property lists passed `plutil -lint`, and `codesign --verify --strict` accepted the standalone extension. These are structural checks, not evidence of Share-menu registration or a working host handoff. No GUI interaction or permission change was performed.

After embedding and installing the app, verify that macOS offers **Add to Scribble**, saved audio/video selections reach the real file queue once, unsupported/temporary attachments show a clear message, cancel adds nothing, and selection still works when Scribble is initially closed. Validate sandbox access and host launch in the target macOS version. If system extension discovery declines an ad hoc build, inspect its signing/registration evidence before changing permissions or claiming it works. Do not manually execute the extension binary: macOS's extension host supplies its context.
