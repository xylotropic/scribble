import Cocoa
import ApplicationServices
import ScreenCaptureKit
import AVFoundation

func emit(_ object: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: object), let text = String(data: data, encoding: .utf8) else { return }
    print(text); fflush(stdout)
}
func clipboardSnapshot(_ board: NSPasteboard) -> [NSPasteboardItem] {
    board.pasteboardItems?.map { item in
        let copy = NSPasteboardItem()
        for type in item.types { if let data = item.data(forType:type) { copy.setData(data, forType:type) } }
        return copy
    } ?? []
}
@discardableResult func restoreClipboardIfUnchanged(_ board: NSPasteboard, saved: [NSPasteboardItem], expectedCount: Int) -> Bool {
    guard board.changeCount == expectedCount else { return false }
    board.clearContents()
    return saved.isEmpty || board.writeObjects(saved)
}
func clipboardSelfTest() -> Bool {
    let board = NSPasteboard.withUniqueName()
    defer { board.releaseGlobally() }
    let custom = NSPasteboard.PasteboardType("org.scribble.fixture.binary")
    let first = NSPasteboardItem(); first.setString("Original plain text", forType:.string); first.setString("<b>Original rich text</b>", forType:.html); first.setData(Data([0,1,2,255]), forType:custom)
    let second = NSPasteboardItem(); second.setString("file:///tmp/scribble-test.txt", forType:.fileURL)
    board.clearContents(); guard board.writeObjects([first,second]) else { return false }
    let saved = clipboardSnapshot(board)
    board.clearContents(); board.setString("Dictation", forType:.string)
    let count = board.changeCount
    guard restoreClipboardIfUnchanged(board,saved:saved,expectedCount:count), let restored = board.pasteboardItems, restored.count == 2, restored[0].string(forType:.string) == "Original plain text", restored[0].string(forType:.html) == "<b>Original rich text</b>", restored[0].data(forType:custom) == Data([0,1,2,255]), restored[1].string(forType:.fileURL) == "file:///tmp/scribble-test.txt" else { return false }
    let stale = board.changeCount
    board.clearContents(); board.setString("New copy from another owner", forType:.string)
    return !restoreClipboardIfUnchanged(board,saved:saved,expectedCount:stale) && board.string(forType:.string) == "New copy from another owner"
}
func templateValues(_ template: String, values: [String:String], html: Bool = false) -> String {
    let pattern = "\\{\\{(date|time|clipboard|selection|selected_text)\\}\\}|\\{(date|time|clipboard|selection|selected_text)\\}"
    guard let regex = try? NSRegularExpression(pattern:pattern,options:.caseInsensitive) else { return template }
    let source = template as NSString, result = NSMutableString(string:template)
    for match in regex.matches(in:template,range:NSRange(location:0,length:source.length)).reversed() {
        let range = match.range(at:1).location != NSNotFound ? match.range(at:1) : match.range(at:2)
        let key = source.substring(with:range).lowercased()
        guard let raw = values[key] else { continue }
        let value = html ? raw.replacingOccurrences(of:"&",with:"&amp;").replacingOccurrences(of:"<",with:"&lt;").replacingOccurrences(of:">",with:"&gt;").replacingOccurrences(of:"\"",with:"&quot;").replacingOccurrences(of:"'",with:"&#39;") : raw
        result.replaceCharacters(in:match.range,with:value)
    }
    return result as String
}
func contextURL(_ value: String) -> String? {
    guard var components = URLComponents(string:value), ["http","https"].contains(components.scheme?.lowercased() ?? ""), let host = components.host, !host.isEmpty, components.user == nil, components.password == nil else { return nil }
    components.query = nil; components.fragment = nil
    return components.string
}
final class Bridge: NSObject, SCStreamOutput, SCStreamDelegate {
    var tap: CFMachPort?
    let eventTapAllowed = !CommandLine.arguments.contains("--no-event-tap")
    struct Binding {
        var key: Int64
        var flags: CGEventFlags
        var mode: String
        var toggle: Bool
        var held = false
        var toneId: String? = nil
    }
    var bindings = [Binding(key: 49, flags: .maskAlternate, mode: "dictation", toggle: false)]
    let relevantFlags: CGEventFlags = [.maskAlternate, .maskCommand, .maskControl, .maskShift, .maskSecondaryFn]
    var expansions: [[String: String]] = []
    var typed = ""
    var typingElement: AXUIElement?
    var expansionSelection = ""
    var injecting = false
    var monitor: Timer?
    var stream: SCStream?
    var captureStarting = false
    var systemPaused = false
    var audioFile: AVAudioFile?
    var recordingPath: String?
    let audioQueue = DispatchQueue(label: "scribble.audio")
    var pasteboardCount = NSPasteboard.general.changeCount
    func status() -> [String: Any] { ["accessibility": AXIsProcessTrusted(), "screenRecording": CGPreflightScreenCaptureAccess(), "microphone": AVCaptureDevice.authorizationStatus(for: .audio).rawValue, "hotkeys": tap != nil, "hotkeyBindings": bindings.map { ["keyCode":$0.key, "mode":$0.mode, "toggle":$0.toggle, "active":$0.held, "toneId":$0.toneId ?? ""] as [String:Any] }, "systemRecording": stream != nil, "systemPaused": systemPaused, "permissionIdentity": ["pid": ProcessInfo.processInfo.processIdentifier, "executable": CommandLine.arguments.first ?? "", "bundleId": Bundle.main.bundleIdentifier ?? "", "microphoneSource": "native-helper-AVCaptureDevice"]] }
    func focused() -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(AXUIElementCreateSystemWide(), kAXFocusedUIElementAttribute as CFString, &value) == .success else { return nil }
        return value as! AXUIElement?
    }
    func secure(_ element: AXUIElement) -> Bool {
        var value: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXSubroleAttribute as CFString, &value)
        return (value as? String) == kAXSecureTextFieldSubrole
    }
    func attribute(_ element: AXUIElement, _ key: CFString) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element,key,&value) == .success else { return nil }
        return value
    }
    func frontmostContext() -> [String: Any] {
        let app = NSWorkspace.shared.frontmostApplication
        var result: [String: Any] = ["name":app?.localizedName ?? "", "bundleId":app?.bundleIdentifier ?? "", "pid":app?.processIdentifier ?? 0, "url":"", "urlAvailable":false]
        guard let app, ["com.google.Chrome","com.google.Chrome.canary","com.google.Chrome.beta","com.google.Chrome.dev"].contains(app.bundleIdentifier ?? "") else { result["urlSource"] = "unsupported-application"; return result }
        guard AXIsProcessTrusted() else { result["urlSource"] = "accessibility-unavailable"; return result }
        let application = AXUIElementCreateApplication(app.processIdentifier)
        func valueURL(_ element: AXUIElement, _ key: CFString) -> String? {
            guard let value = attribute(element,key) else { return nil }
            return contextURL((value as? URL)?.absoluteString ?? (value as? String ?? ""))
        }
        func found(_ url: String, _ source: String) -> [String: Any] { result["url"] = url; result["urlAvailable"] = true; result["urlSource"] = source; return result }
        if let raw = attribute(application,kAXFocusedWindowAttribute as CFString), CFGetTypeID(raw) == AXUIElementGetTypeID() {
            let window = raw as! AXUIElement
            if let url = valueURL(window,kAXDocumentAttribute as CFString) { return found(url,"focused-window-document") }
        }
        if let field = focused() {
            var owner: pid_t = 0
            guard AXUIElementGetPid(field,&owner) == .success, owner == app.processIdentifier else { result["urlSource"] = "frontmost-changed"; return result }
            if let url = valueURL(field,kAXDocumentAttribute as CFString) { return found(url,"focused-element-document") }
            let identifier = (attribute(field,"AXIdentifier" as CFString) as? String ?? "").lowercased()
            let description = (attribute(field,kAXDescriptionAttribute as CFString) as? String ?? "").lowercased()
            if !secure(field), identifier == "omnibox" || identifier == "addressbar" || description == "address and search bar", let value = attribute(field,kAXValueAttribute as CFString) as? String, let url = contextURL(value) { return found(url,"focused-omnibox") }
            var element = field
            for _ in 0..<8 {
                if (attribute(element,kAXRoleAttribute as CFString) as? String) == "AXWebArea", let url = valueURL(element,"AXURL" as CFString) { return found(url,"focused-web-area") }
                guard let parent = attribute(element,kAXParentAttribute as CFString), CFGetTypeID(parent) == AXUIElementGetTypeID() else { break }
                element = parent as! AXUIElement
            }
        }
        result["urlSource"] = "not-exposed-by-accessibility"
        return result
    }
    func emitHotkey(_ phase: String, _ binding: Binding) {
        var event: [String: Any] = ["event":"hotkey","phase":phase,"mode":binding.mode]
        if let tone = binding.toneId, !tone.isEmpty { event["toneId"] = tone }
        emit(event)
    }
    func paste(_ text: String, html: String? = nil, restore: Bool, enter: Bool, expectedPid: Int32? = nil, dryRun: Bool = false) -> [String: Any] {
        let rich = html.map { !$0.isEmpty } ?? false
        let method = rich ? "clipboard-rich" : "accessibility-or-clipboard-plain"
        if dryRun { return ["inserted":false, "dispatched":false, "verified":false, "dryRun":true, "method":method, "clipboardTypes":rich ? [NSPasteboard.PasteboardType.string.rawValue, NSPasteboard.PasteboardType.html.rawValue] : [NSPasteboard.PasteboardType.string.rawValue], "restoreClipboard":restore, "autoEnter":enter, "requiresAccessibility":true] }
        guard AXIsProcessTrusted() else { return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Accessibility permission is required"] }
        if let expectedPid, NSWorkspace.shared.frontmostApplication?.processIdentifier != expectedPid { return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"The active application changed"] }
        if let element = focused(), secure(element) { return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Secure password field"] }
        if !rich, let element = focused(), AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, text as CFString) == .success {
            let entered = enter ? keystroke(36, []) : false
            return ["inserted":true, "dispatched":entered, "verified":true, "method":"accessibility", "richText":false, "autoEnterDispatched":entered]
        }
        let pb = NSPasteboard.general
        let saved = clipboardSnapshot(pb)
        let item = NSPasteboardItem(); item.setString(text, forType:.string)
        if rich, let html { item.setString(html, forType:.html) }
        pb.clearContents()
        guard pb.writeObjects([item]) else { pb.clearContents(); pb.writeObjects(saved); return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Clipboard write failed"] }
        let insertedCount = pb.changeCount
        guard keystroke(9, .maskCommand) else { restoreClipboardIfUnchanged(pb,saved:saved,expectedCount:insertedCount); return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Keyboard event could not be posted"] }
        let targetPid = NSWorkspace.shared.frontmostApplication?.processIdentifier
        if enter { DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { if NSWorkspace.shared.frontmostApplication?.processIdentifier == targetPid { self.keystroke(36, []) } } }
        if restore { DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { restoreClipboardIfUnchanged(pb,saved:saved,expectedCount:insertedCount) } }
        return ["inserted":false, "dispatched":true, "verified":false, "method":rich ? "clipboard-rich":"clipboard-plain", "richText":rich, "clipboardRestoreScheduled":restore, "autoEnterScheduled":enter]
    }
    @discardableResult func keystroke(_ key: CGKeyCode, _ modifiers: CGEventFlags) -> Bool {
        guard AXIsProcessTrusted(), let down = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: true), let up = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: false) else { return false }
        injecting = true
        for event in [down,up] { event.flags = modifiers; event.setIntegerValueField(.eventSourceUserData, value: 0x534352); event.post(tap: .cghidEventTap) }
        injecting = false
        return true
    }
    @MainActor func edit(_ request: [String: Any], action: String) async throws -> [String: Any] {
        let key: CGKeyCode
        let modifiers: CGEventFlags
        switch action {
        case "undo": key = 6; modifiers = .maskCommand
        case "redo": key = 6; modifiers = [.maskCommand, .maskShift]
        case "selectAll": key = 0; modifiers = .maskCommand
        case "find": key = 3; modifiers = .maskCommand
        default: throw NSError(domain:"Scribble", code:6, userInfo:[NSLocalizedDescriptionKey:"Unsupported edit action"])
        }
        if request["dryRun"] as? Bool == true { return ["action":action, "dispatched":false, "verified":false, "dryRun":true, "keyCode":key, "requiresAccessibility":true] }
        guard AXIsProcessTrusted() else { throw NSError(domain:"Scribble", code:7, userInfo:[NSLocalizedDescriptionKey:"Accessibility permission is required for editing commands"]) }
        guard let app = NSWorkspace.shared.frontmostApplication else { throw NSError(domain:"Scribble", code:8, userInfo:[NSLocalizedDescriptionKey:"No frontmost application is available"]) }
        if let pid = request["expectedPid"] as? NSNumber, pid.int32Value != app.processIdentifier { throw NSError(domain:"Scribble", code:9, userInfo:[NSLocalizedDescriptionKey:"The active application changed; editing was canceled"]) }
        if let field = focused(), secure(field) { throw NSError(domain:"Scribble", code:10, userInfo:[NSLocalizedDescriptionKey:"Editing commands are unavailable in secure password fields"]) }
        let priorFocus = focused()
        guard let down = CGEvent(keyboardEventSource:nil, virtualKey:key, keyDown:true), let up = CGEvent(keyboardEventSource:nil, virtualKey:key, keyDown:false) else { throw NSError(domain:"Scribble", code:11, userInfo:[NSLocalizedDescriptionKey:"Could not create keyboard events"]) }
        for event in [down,up] { event.flags = modifiers; event.setIntegerValueField(.eventSourceUserData, value:0x534352); event.post(tap:.cghidEventTap) }
        var result: [String: Any] = ["action":action, "dispatched":true, "verified":false, "bundleId":app.bundleIdentifier ?? "", "pid":app.processIdentifier]
        if action == "find", let text = request["text"] as? String, !text.isEmpty {
            try await Task.sleep(nanoseconds: 150_000_000)
            guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { result["queryInserted"] = false; result["warning"] = "The active application changed before search text insertion"; return result }
            guard let field = focused(), !secure(field), priorFocus == nil || !CFEqual(priorFocus!,field) else { result["queryInserted"] = false; result["warning"] = "A new search field was not observed; query insertion was skipped"; return result }
            result["queryInserted"] = AXUIElementSetAttributeValue(field, kAXSelectedTextAttribute as CFString, text as CFString) == .success
        }
        return result
    }
    func startTap() {
        guard eventTapAllowed, tap == nil, AXIsProcessTrusted() else { return }
        let mask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)
        tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap, eventsOfInterest: CGEventMask(mask), callback: { _, type, event, ref in
            let bridge = Unmanaged<Bridge>.fromOpaque(ref!).takeUnretainedValue()
            return bridge.handle(type, event)
        }, userInfo: Unmanaged.passUnretained(self).toOpaque())
        if let tap { CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0), .commonModes); CGEvent.tapEnable(tap: tap, enable: true) }
    }
    func handle(_ type: CGEventType, _ event: CGEvent) -> Unmanaged<CGEvent>? {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput { if let tap { CGEvent.tapEnable(tap: tap, enable: true) }; return Unmanaged.passUnretained(event) }
        if event.getIntegerValueField(.eventSourceUserData) == 0x534352 { return Unmanaged.passUnretained(event) }
        let code = event.getIntegerValueField(.keyboardEventKeycode)
        if type == .keyDown, code == 53 {
            for i in bindings.indices { bindings[i].held = false }
            emit(["event":"hotkey", "phase":"cancel", "mode":"dictation"])
            return Unmanaged.passUnretained(event)
        }
        let currentFlags = event.flags.intersection(relevantFlags)
        for i in bindings.indices {
            let binding = bindings[i]
            let pressed = binding.key < 0 ? (type == .flagsChanged && currentFlags == binding.flags) : (type == .keyDown && code == binding.key && currentFlags == binding.flags)
            if pressed && event.getIntegerValueField(.keyboardEventAutorepeat) == 0 {
                if binding.toggle || binding.mode == "paste-last" {
                    bindings[i].held.toggle()
                    emitHotkey(bindings[i].held ? "start":"stop",binding)
                    if binding.mode == "paste-last" { bindings[i].held = false }
                } else if !binding.held { bindings[i].held = true; emitHotkey("start",binding) }
                return binding.key < 0 ? Unmanaged.passUnretained(event) : nil
            }
            if !binding.toggle, binding.held, (type == .keyUp && code == binding.key || type == .flagsChanged && !currentFlags.isSuperset(of: binding.flags)) {
                bindings[i].held = false; emitHotkey("stop",binding)
                if code == binding.key { return nil }
            }
        }
        if type == .keyDown, event.flags.contains(.maskCommand) || event.flags.contains(.maskControl) { typed = ""; expansionSelection = "" }
        if type == .keyDown, !event.flags.contains(.maskCommand), !event.flags.contains(.maskControl) {
            guard let field = focused(), !secure(field) else { typed = ""; return Unmanaged.passUnretained(event) }
            var selectedValue: CFTypeRef?
            AXUIElementCopyAttributeValue(field,kAXSelectedTextAttribute as CFString,&selectedValue)
            let selected = selectedValue as? String ?? ""
            if typingElement == nil || !CFEqual(typingElement!,field) || !selected.isEmpty { typed = "" }
            if typed.isEmpty { expansionSelection = selected }
            typingElement = field
            if code == 51 { if !typed.isEmpty { typed.removeLast() } } else {
                var chars = [UniChar](repeating: 0, count: 64); var count = 0
                event.keyboardGetUnicodeString(maxStringLength: 64, actualStringLength: &count, unicodeString: &chars)
                typed += String(utf16CodeUnits: chars, count: count); typed = String(typed.suffix(256))
                for item in expansions { if let trigger = item["trigger"], !trigger.isEmpty, typed.hasSuffix(trigger), let replacement = item["replacement"] {
                    typed = ""
                    let selection = expansionSelection
                    expansionSelection = ""
                    DispatchQueue.main.async {
                        guard let current = self.focused(), CFEqual(current,field), !self.secure(current), AXIsProcessTrusted() else { return }
                        let formatter = DateFormatter(); formatter.dateStyle = .medium
                        let date = formatter.string(from:Date()); formatter.dateStyle = .none; formatter.timeStyle = .short
                        let values = ["date":date,"time":formatter.string(from:Date()),"clipboard":NSPasteboard.general.string(forType:.string) ?? "","selection":selection,"selected_text":selection]
                        let value = templateValues(replacement,values:values)
                        let html = item["html"].map { templateValues($0,values:values,html:true) }
                        for _ in trigger { self.keystroke(51, []) }
                        _ = self.paste(value,html:html,restore:true,enter:false)
                    }; break
                } }
            }
        }
        return Unmanaged.passUnretained(event)
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, sampleBuffer.isValid, let format = sampleBuffer.formatDescription, let desc = CMAudioFormatDescriptionGetStreamBasicDescription(format), let audioFormat = AVAudioFormat(streamDescription: desc) else { return }
        let count = CMSampleBufferGetNumSamples(sampleBuffer)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: AVAudioFrameCount(count)) else { return }
        buffer.frameLength = AVAudioFrameCount(count)
        let result = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer, at: 0, frameCount: Int32(count), into: buffer.mutableAudioBufferList)
        guard result == noErr else { return }
        do { if audioFile == nil, let recordingPath { audioFile = try AVAudioFile(forWriting: URL(fileURLWithPath: recordingPath), settings: audioFormat.settings) }; try audioFile?.write(from: buffer) } catch { emit(["event":"recordingError", "error":error.localizedDescription]) }
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        audioQueue.async { self.audioFile = nil }
        DispatchQueue.main.async { self.stream = nil; self.systemPaused = false; emit(["event":"recordingError", "error":error.localizedDescription]) }
    }
    @objc func pollClipboard() {
        let pb = NSPasteboard.general
        guard pb.changeCount != pasteboardCount else { return }
        pasteboardCount = pb.changeCount
        if let text = pb.string(forType: .string) { emit(["event":"clipboard", "text":text]) }
    }
    @MainActor func command(_ request: [String: Any]) async {
        let id = request["id"] ?? NSNull()
        do {
            var result: Any = NSNull()
            switch request["command"] as? String ?? "" {
            case "status": startTap(); result = status()
            case "permissions":
                if request["accessibility"] as? Bool == true { _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary) }
                if request["screenRecording"] as? Bool == true { _ = CGRequestScreenCaptureAccess() }
                startTap(); result = status()
            case "edit": result = try await edit(request, action: request["action"] as? String ?? "")
            case "undo", "redo", "selectAll", "find": result = try await edit(request, action: request["command"] as? String ?? "")
            case "paste": result = paste(request["text"] as? String ?? "", html: request["html"] as? String, restore: request["restoreClipboard"] as? Bool ?? true, enter: request["autoEnter"] as? Bool ?? false, expectedPid: (request["expectedPid"] as? NSNumber)?.int32Value, dryRun: request["dryRun"] as? Bool ?? false)
            case "selection": var value: CFTypeRef?; if let field = focused(), !secure(field) { AXUIElementCopyAttributeValue(field, kAXSelectedTextAttribute as CFString, &value) }; result = ["text": value as? String ?? ""]
            case "frontmost": result = frontmostContext()
            case "setHotkeys":
                let configured = request["hotkeys"] as? [[String: Any]] ?? [request]
                let allowedModifiers = ["option", "alt", "command", "meta", "cmd", "control", "ctrl", "shift", "fn"]
                let candidate: [Binding] = try configured.map { item in
                    let modifiers = item["modifiers"] as? [String] ?? ["option"]
                    let key = (item["keyCode"] as? NSNumber)?.int64Value ?? 49
                    let mode = item["mode"] as? String ?? "dictation"
                    guard key >= -1, key <= 127, modifiers.allSatisfy({allowedModifiers.contains($0)}), ["dictation", "command", "shortcut", "meeting", "note", "paste-last"].contains(mode), !(key == -1 && modifiers.isEmpty) else { throw NSError(domain:"Scribble", code:12, userInfo:[NSLocalizedDescriptionKey:"Invalid hotkey binding"]) }
                    var flags: CGEventFlags = []
                    for modifier in modifiers {
                        switch modifier { case "option", "alt": flags.insert(.maskAlternate); case "command", "meta", "cmd": flags.insert(.maskCommand); case "control", "ctrl": flags.insert(.maskControl); case "shift": flags.insert(.maskShift); case "fn": flags.insert(.maskSecondaryFn); default: break }
                    }
                    return Binding(key: key, flags: flags, mode: mode, toggle: item["toggle"] as? Bool ?? false, toneId:item["toneId"] as? String)
                }
                var signatures = Set<String>()
                for binding in candidate { guard signatures.insert("\(binding.key):\(binding.flags.rawValue)").inserted else { throw NSError(domain:"Scribble", code:13, userInfo:[NSLocalizedDescriptionKey:"Duplicate hotkey binding"]) } }
                for binding in bindings where binding.held { emitHotkey("cancel",binding) }
                bindings = candidate
                startTap(); result = status()
            case "setExpansions": expansions = request["expansions"] as? [[String: String]] ?? []; result = ["count":expansions.count]
            case "clipboardMonitoring":
                monitor?.invalidate(); monitor = nil
                if request["enabled"] as? Bool == true {
                    pasteboardCount = NSPasteboard.general.changeCount
                    let timer = Timer(timeInterval: 0.5, target: self, selector: #selector(pollClipboard), userInfo: nil, repeats: true)
                    RunLoop.main.add(timer, forMode: .common)
                    monitor = timer
                }
                result = true
            case "open": guard let url = URL(string: request["url"] as? String ?? ""), ["https", "http", "mailto", "x-apple.systempreferences"].contains(url.scheme ?? "") else { throw NSError(domain: "Scribble", code: 1, userInfo: [NSLocalizedDescriptionKey:"Unsupported URL"]) }; result = NSWorkspace.shared.open(url)
            case "recordSystemStart":
                guard stream == nil, !captureStarting, let path = request["path"] as? String, path.hasPrefix("/") else { throw NSError(domain:"Scribble", code:2, userInfo:[NSLocalizedDescriptionKey:"Already recording or missing absolute output path"]) }
                captureStarting = true
                defer { captureStarting = false }
                let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
                guard let display = content.displays.first else { throw NSError(domain:"Scribble", code:3, userInfo:[NSLocalizedDescriptionKey:"No display available"]) }
                let config = SCStreamConfiguration(); config.capturesAudio = true; config.excludesCurrentProcessAudio = true; config.width = 2; config.height = 2; config.minimumFrameInterval = CMTime(value: 1, timescale: 1); config.sampleRate = 48000; config.channelCount = 2
                let ownBundle = request["excludeBundleId"] as? String ?? "org.scribble.voice"
                let excluded = content.applications.filter { $0.bundleIdentifier == ownBundle }
                let capture = SCStream(filter: SCContentFilter(display: display, excludingApplications: excluded, exceptingWindows: []), configuration: config, delegate: self)
                recordingPath = path; audioFile = nil; try capture.addStreamOutput(self, type: .audio, sampleHandlerQueue: audioQueue); try await capture.startCapture(); stream = capture; systemPaused = false; result = ["path":path]
            case "recordSystemPause":
                guard let stream else { throw NSError(domain:"Scribble", code:5, userInfo:[NSLocalizedDescriptionKey:"No system recording is active"]) }
                if !systemPaused { try await stream.stopCapture(); systemPaused = true }
                result = ["paused":systemPaused]
            case "recordSystemResume":
                guard let stream else { throw NSError(domain:"Scribble", code:5, userInfo:[NSLocalizedDescriptionKey:"No system recording is active"]) }
                if systemPaused { try await stream.startCapture(); systemPaused = false }
                result = ["paused":systemPaused]
            case "recordSystemStop": if let stream, !systemPaused { try await stream.stopCapture() }; stream = nil; systemPaused = false; audioQueue.sync { audioFile = nil }; result = ["path":recordingPath ?? ""]; recordingPath = nil
            default: throw NSError(domain:"Scribble", code:4, userInfo:[NSLocalizedDescriptionKey:"Unknown command"])
            }
            emit(["id":id, "ok":true, "result":result])
        } catch { emit(["id":id, "ok":false, "error":error.localizedDescription]) }
    }
}
if CommandLine.arguments.contains("--context-url-self-test") { emit(["clean":contextURL("https://example.com/work?token=secret#fragment") ?? "", "credentialed":contextURL("https://user:secret@example.com") == nil, "nonWeb":contextURL("file:///private/notes") == nil]); exit(0) }
if CommandLine.arguments.contains("--template-self-test") {
    let values = ["date":"October 7, 2026","time":"9:30 AM","clipboard":"<b>Clipboard & text</b>","selection":"Selected <words>","selected_text":"Selected <words>"]
    let plain = templateValues("{date} {{TIME}} {selection} {{selected_text}} {clipboard}",values:values)
    let rich = templateValues("<strong>{clipboard}</strong><p>{{selection}}</p>",values:values,html:true)
    emit(["plain":plain,"html":rich,"literal":templateValues("{clipboard}",values:["clipboard":"{date}","date":"Should not expand"])]); exit(0)
}
if CommandLine.arguments.contains("--clipboard-self-test") { let passed = clipboardSelfTest(); emit(["ok":passed, "privatePasteboard":true]); exit(passed ? 0 : 1) }
let bridge = Bridge()
if CommandLine.arguments.contains("--status") { emit(bridge.status()); exit(0) }
if CommandLine.arguments.contains("--hotkey-tone-self-test") { let binding = Bridge.Binding(key:49,flags:.maskAlternate,mode:"dictation",toggle:false,toneId:"tone-fixture"); bridge.emitHotkey("start",binding); bridge.emitHotkey("stop",binding); exit(0) }
bridge.startTap()
DispatchQueue.global().async { while let line = readLine() { guard let data = line.data(using:.utf8), let object = try? JSONSerialization.jsonObject(with:data) as? [String:Any] else { emit(["ok":false,"error":"Invalid JSON"]); continue }; DispatchQueue.main.async { Task { await bridge.command(object) } } }; DispatchQueue.main.async { Task { if let stream = bridge.stream, !bridge.systemPaused { try? await stream.stopCapture() }; bridge.audioQueue.sync { bridge.audioFile = nil }; exit(0) } } }
RunLoop.main.run()
