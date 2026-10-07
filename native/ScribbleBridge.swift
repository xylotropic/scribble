import Cocoa
import ApplicationServices
import ScreenCaptureKit
import AVFoundation

func emit(_ object: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: object), let text = String(data: data, encoding: .utf8) else { return }
    print(text); fflush(stdout)
}
final class Bridge: NSObject, SCStreamOutput, SCStreamDelegate {
    var tap: CFMachPort?
    struct Binding {
        var key: Int64
        var flags: CGEventFlags
        var mode: String
        var toggle: Bool
        var held = false
    }
    var bindings = [Binding(key: 49, flags: .maskAlternate, mode: "dictation", toggle: false)]
    let relevantFlags: CGEventFlags = [.maskAlternate, .maskCommand, .maskControl, .maskShift, .maskSecondaryFn]
    var expansions: [[String: String]] = []
    var typed = ""
    var injecting = false
    var monitor: Timer?
    var stream: SCStream?
    var captureStarting = false
    var systemPaused = false
    var audioFile: AVAudioFile?
    var recordingPath: String?
    let audioQueue = DispatchQueue(label: "scribble.audio")
    var pasteboardCount = NSPasteboard.general.changeCount
    func status() -> [String: Any] { ["accessibility": AXIsProcessTrusted(), "screenRecording": CGPreflightScreenCaptureAccess(), "microphone": AVCaptureDevice.authorizationStatus(for: .audio).rawValue, "hotkeys": tap != nil, "systemRecording": stream != nil, "systemPaused": systemPaused] }
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
    func paste(_ text: String, restore: Bool, enter: Bool) -> Bool {
        if let element = focused(), secure(element) { return false }
        if let element = focused(), !secure(element), AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, text as CFString) == .success {
            if enter { keystroke(36, []) }; return true
        }
        guard AXIsProcessTrusted() else { return false }
        let pb = NSPasteboard.general
        let saved = pb.pasteboardItems?.compactMap { item -> NSPasteboardItem? in
            let copy = NSPasteboardItem(); for type in item.types { if let data = item.data(forType: type) { copy.setData(data, forType: type) } }; return copy
        } ?? []
        pb.clearContents(); pb.setString(text, forType: .string)
        let insertedCount = pb.changeCount
        keystroke(9, .maskCommand)
        if enter { DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self.keystroke(36, []) } }
        if restore { DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { if pb.changeCount == insertedCount { pb.clearContents(); pb.writeObjects(saved) } } }
        return true
    }
    func keystroke(_ key: CGKeyCode, _ modifiers: CGEventFlags) {
        injecting = true
        for down in [true, false] { let event = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: down); event?.flags = modifiers; event?.setIntegerValueField(.eventSourceUserData, value: 0x534352); event?.post(tap: .cghidEventTap) }
        injecting = false
    }
    func startTap() {
        guard tap == nil, AXIsProcessTrusted() else { return }
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
                    emit(["event":"hotkey", "phase":bindings[i].held ? "start":"stop", "mode":binding.mode])
                    if binding.mode == "paste-last" { bindings[i].held = false }
                } else if !binding.held { bindings[i].held = true; emit(["event":"hotkey", "phase":"start", "mode":binding.mode]) }
                return binding.key < 0 ? Unmanaged.passUnretained(event) : nil
            }
            if !binding.toggle, binding.held, (type == .keyUp && code == binding.key || type == .flagsChanged && !currentFlags.isSuperset(of: binding.flags)) {
                bindings[i].held = false; emit(["event":"hotkey", "phase":"stop", "mode":binding.mode])
                if code == binding.key { return nil }
            }
        }
        if type == .keyDown, !event.flags.contains(.maskCommand), !event.flags.contains(.maskControl) {
            guard let field = focused(), !secure(field) else { typed = ""; return Unmanaged.passUnretained(event) }
            if code == 51 { if !typed.isEmpty { typed.removeLast() } } else {
                var chars = [UniChar](repeating: 0, count: 64); var count = 0
                event.keyboardGetUnicodeString(maxStringLength: 64, actualStringLength: &count, unicodeString: &chars)
                typed += String(utf16CodeUnits: chars, count: count); typed = String(typed.suffix(256))
                for item in expansions { if let trigger = item["trigger"], !trigger.isEmpty, typed.hasSuffix(trigger), let replacement = item["replacement"] {
                    typed = ""
                    let normalized = replacement.replacingOccurrences(of: "{{DATE}}", with: "{date}").replacingOccurrences(of: "{{TIME}}", with: "{time}").replacingOccurrences(of: "{{CLIPBOARD}}", with: "{clipboard}").replacingOccurrences(of: "{{date}}", with: "{date}").replacingOccurrences(of: "{{time}}", with: "{time}").replacingOccurrences(of: "{{clipboard}}", with: "{clipboard}")
                    DispatchQueue.main.async { for _ in trigger { self.keystroke(51, []) }; let formatter = DateFormatter(); formatter.dateStyle = .medium; var value = normalized.replacingOccurrences(of: "{date}", with: formatter.string(from: Date())); formatter.dateStyle = .none; formatter.timeStyle = .short; value = value.replacingOccurrences(of: "{time}", with: formatter.string(from: Date())).replacingOccurrences(of: "{clipboard}", with: NSPasteboard.general.string(forType: .string) ?? ""); _ = self.paste(value, restore: true, enter: false) }; break
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
            case "paste": result = ["inserted":paste(request["text"] as? String ?? "", restore: request["restoreClipboard"] as? Bool ?? true, enter: request["autoEnter"] as? Bool ?? false)]
            case "selection": var value: CFTypeRef?; if let field = focused(), !secure(field) { AXUIElementCopyAttributeValue(field, kAXSelectedTextAttribute as CFString, &value) }; result = ["text": value as? String ?? ""]
            case "frontmost": let app = NSWorkspace.shared.frontmostApplication; result = ["name": app?.localizedName ?? "", "bundleId": app?.bundleIdentifier ?? "", "pid": app?.processIdentifier ?? 0]
            case "setHotkeys":
                let configured = request["hotkeys"] as? [[String: Any]] ?? [request]
                bindings = configured.map { item in
                    var flags: CGEventFlags = []
                    for modifier in item["modifiers"] as? [String] ?? ["option"] {
                        switch modifier { case "option", "alt": flags.insert(.maskAlternate); case "command", "meta", "cmd": flags.insert(.maskCommand); case "control", "ctrl": flags.insert(.maskControl); case "shift": flags.insert(.maskShift); case "fn": flags.insert(.maskSecondaryFn); default: break }
                    }
                    return Binding(key: (item["keyCode"] as? NSNumber)?.int64Value ?? 49, flags: flags, mode: item["mode"] as? String ?? "dictation", toggle: item["toggle"] as? Bool ?? false)
                }
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
let bridge = Bridge()
if CommandLine.arguments.contains("--status") { emit(bridge.status()); exit(0) }
bridge.startTap()
DispatchQueue.global().async { while let line = readLine() { guard let data = line.data(using:.utf8), let object = try? JSONSerialization.jsonObject(with:data) as? [String:Any] else { emit(["ok":false,"error":"Invalid JSON"]); continue }; DispatchQueue.main.async { Task { await bridge.command(object) } } }; DispatchQueue.main.async { Task { if let stream = bridge.stream, !bridge.systemPaused { try? await stream.stopCapture() }; bridge.audioQueue.sync { bridge.audioFile = nil }; exit(0) } } }
RunLoop.main.run()
