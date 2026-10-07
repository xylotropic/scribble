import Cocoa
import UniformTypeIdentifiers

/// Finder-selected media is handed to the containing app's existing open-file queue.
@objc(ShareViewController)
final class ShareViewController: NSViewController {
    private let status = NSTextField(wrappingLabelWithString: "Preparing selected audio and video…")
    private let submit = NSButton(title: "Add to Scribble", target: nil, action: nil)
    private var urls: [URL] = []
    private var scoped: [URL] = []
    private var loading = false
    private let mediaExtensions: Set<String> = ["mp3", "wav", "m4a", "aac", "ogg", "flac", "wma", "opus", "mp4", "mov", "avi", "mkv", "flv", "wmv", "webm", "mpeg", "mpg"]

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 380, height: 160))
        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancelShare))
        submit.target = self; submit.action = #selector(sendFiles); submit.isEnabled = false
        let buttons = NSStackView(views: [cancel, submit]); buttons.orientation = .horizontal
        let stack = NSStackView(views: [status, buttons]); stack.orientation = .vertical; stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24), stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24), stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
    }
    override func viewDidAppear() { super.viewDidAppear(); if !loading { loading = true; loadSelection() } }
    private func loadSelection() {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        let group = DispatchGroup()
        var rejected = 0
        for provider in providers {
            group.enter()
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    let url: URL?
                    if let value = item as? URL { url = value }
                    else if let data = item as? Data { url = URL(dataRepresentation: data, relativeTo: nil) }
                    else { url = nil }
                    DispatchQueue.main.async { if !self.accept(url) { rejected += 1 }; group.leave() }
                }
            } else if let type = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .audio) == true || UTType($0)?.conforms(to: .movie) == true }) {
                provider.loadInPlaceFileRepresentation(forTypeIdentifier: type) { url, inPlace, _ in
                    DispatchQueue.main.async { if !inPlace || !self.accept(url) { rejected += 1 }; group.leave() }
                }
            } else { rejected += 1; group.leave() }
        }
        group.notify(queue: .main) {
            self.submit.isEnabled = !self.urls.isEmpty
            self.status.stringValue = self.urls.isEmpty ? "No accessible audio or video files were provided. Share saved files from Finder." : "Add \(self.urls.count) file(s) to Scribble's transcription queue?" + (rejected > 0 ? " \(rejected) unsupported or temporary item(s) were skipped." : "")
        }
    }
    private func accept(_ candidate: URL?) -> Bool {
        guard let url = candidate, url.isFileURL, mediaExtensions.contains(url.pathExtension.lowercased()) else { return false }
        let acquired = url.startAccessingSecurityScopedResource()
        guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey]), values.isRegularFile == true else { if acquired { url.stopAccessingSecurityScopedResource() }; return false }
        if urls.contains(url) { if acquired { url.stopAccessingSecurityScopedResource() }; return true }
        urls.append(url); if acquired { scoped.append(url) }; return true
    }
    private func releaseScopes() { for url in scoped { url.stopAccessingSecurityScopedResource() }; scoped.removeAll() }
    @objc private func sendFiles() {
        guard !urls.isEmpty else { return }
        let host = Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        guard host.pathExtension == "app" else { status.stringValue = "Install this extension inside Scribble.app before using it."; return }
        submit.isEnabled = false
        let config = NSWorkspace.OpenConfiguration(); config.activates = true
        NSWorkspace.shared.open(urls, withApplicationAt: host, configuration: config) { _, error in
            DispatchQueue.main.async {
                if let error = error { self.status.stringValue = "Scribble could not open the files: \(error.localizedDescription)"; self.submit.isEnabled = true }
                else { self.releaseScopes(); self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil) }
            }
        }
    }
    @objc private func cancelShare() { releaseScopes(); extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)) }
    deinit { releaseScopes() }
}
