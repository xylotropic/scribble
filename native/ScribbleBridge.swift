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
func pasteboardInsertionItem(_ text:String, html:String?, allowClipboardHistory:Bool) -> NSPasteboardItem {
    let item=NSPasteboardItem();item.setString(text,forType:.string)
    if let html, !html.isEmpty {item.setString(html,forType:.html)}
    if !allowClipboardHistory {item.setData(Data(),forType:NSPasteboard.PasteboardType("org.nspasteboard.TransientType"))}
    return item
}
func requestedClipboardHistory(_ request:[String:Any], defaultValue:Bool=true) throws -> Bool {
    guard let raw=request["allowClipboardHistory"] else {return defaultValue}
    guard let value=raw as? NSNumber, CFGetTypeID(value)==CFBooleanGetTypeID() else {throw NSError(domain:"Scribble",code:12,userInfo:[NSLocalizedDescriptionKey:"allowClipboardHistory must be a boolean"])}
    return value.boolValue
}
func clipboardSelfTest() -> Bool {
    let board = NSPasteboard.withUniqueName()
    defer { board.releaseGlobally() }
    let custom = NSPasteboard.PasteboardType("org.scribble.fixture.binary")
    let first = NSPasteboardItem(); first.setString("Original plain text", forType:.string); first.setString("<b>Original rich text</b>", forType:.html); first.setData(Data([0,1,2,255]), forType:custom);first.setData(Data(),forType:NSPasteboard.PasteboardType("org.nspasteboard.TransientType"))
    let second = NSPasteboardItem(); second.setString("file:///tmp/scribble-test.txt", forType:.fileURL)
    board.clearContents(); guard board.writeObjects([first,second]) else { return false }
    let saved = clipboardSnapshot(board)
    board.clearContents(); board.setString("Dictation", forType:.string)
    let count = board.changeCount
    guard restoreClipboardIfUnchanged(board,saved:saved,expectedCount:count), let restored = board.pasteboardItems, restored.count == 2, restored[0].string(forType:.string) == "Original plain text", restored[0].string(forType:.html) == "<b>Original rich text</b>", restored[0].data(forType:custom) == Data([0,1,2,255]), restored[0].types.contains(NSPasteboard.PasteboardType("org.nspasteboard.TransientType")), restored[1].string(forType:.fileURL) == "file:///tmp/scribble-test.txt" else { return false }
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
// Original native indicator. Screen geometry and protocol validation are pure and testable.
struct IndicatorGeometry {
    let frame: NSRect
    let notch: Bool
    let hardwareNotch: Bool
    let safeTop: CGFloat
    let fallbackReason: String
    static func calculate(screen: NSRect, visible: NSRect? = nil, safeTop: CGFloat, left: NSRect?, right: NSRect?, style: String, position: String) -> IndicatorGeometry {
        let gap = (left != nil && right != nil) ? right!.minX - left!.maxX : 0
        let hardware = safeTop > 0 && gap > 0 && gap < screen.width / 2
        let notch = style == "notch" && hardware && position == "top"
        let intersection = (visible ?? screen).intersection(screen)
        let usable = intersection.isEmpty ? screen : intersection
        let margin = min(16, max(0, min(usable.width, usable.height) / 4))
        let width = notch ? min(screen.width, max(460, min(640, gap + 160))) : min(460, max(1, usable.width - 2 * margin))
        let height = notch ? safeTop + 72 : min(86, max(1, usable.height - 2 * margin))
        let center = notch ? (left!.maxX + right!.minX) / 2 : usable.midX
        let area = notch ? screen : usable
        let x = min(max(center - width / 2, area.minX), area.maxX - width)
        let y = notch ? screen.maxY - height : position == "top" ? usable.maxY - height - margin : usable.minY + margin
        let fallback = style != "notch" || notch ? "" : position == "bottom" ? "position-bottom" : "display-has-no-notch"
        return IndicatorGeometry(frame:NSRect(x:x,y:y,width:width,height:height),notch:notch,hardwareNotch:hardware,safeTop:notch ? safeTop : 0,fallbackReason:fallback)
    }
}
struct IndicatorState {
    var enabled = true, style = "notch", position = "top", state = "idle", mode = "dictation", text = "", tone = "", level = 0.0, canSelectTone = false
    var labels = ["dictate":"Dictate","command":"Command","note":"Note","stop":"Stop","cancel":"Cancel","open":"Open","tones":"Tone","status":"Ready","fallback":"This display has no notch. Using a pill indicator."]
    static func invalid(_ message: String) -> NSError { NSError(domain:"ScribbleIndicator",code:20,userInfo:[NSLocalizedDescriptionKey:message]) }
    mutating func apply(_ input: [String:Any]) throws {
        var next = self
        func string(_ key: String, limit: Int, allowed: [String]? = nil) throws -> String? {
            guard let raw = input[key] else { return nil }
            guard let value = raw as? String, value.count <= limit, !value.unicodeScalars.contains(where:{$0.value < 32 && $0.value != 10 && $0.value != 9}), allowed == nil || allowed!.contains(value) else { throw Self.invalid("Invalid indicator \(key)") }
            return value
        }
        func boolean(_ key: String) throws -> Bool? {
            guard let raw = input[key] else { return nil }
            guard let number = raw as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { throw Self.invalid("Invalid indicator \(key)") }
            return number.boolValue
        }
        if let value = try string("style",limit:10,allowed:["notch","pill"]) { next.style = value }
        if let value = try string("position",limit:10,allowed:["top","bottom"]) { next.position = value }
        if let value = try string("state",limit:20,allowed:["idle","starting","recording","processing","muted","paused","error","failed"]) { next.state = value }
        if let value = try string("mode",limit:20,allowed:["dictation","command","note","meeting","shortcut"]) { next.mode = value }
        if let value = try string("text",limit:500) { next.text = value }
        if let value = try string("tone",limit:120) { next.tone = value }
        if let value = try boolean("enabled") { next.enabled = value }
        if let value = try boolean("canSelectTone") { next.canSelectTone = value }
        if let raw = input["level"] {
            guard let value = raw as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(), value.doubleValue.isFinite, (0...1).contains(value.doubleValue) else { throw Self.invalid("Indicator level must be a finite number from 0 to 1") }
            next.level = value.doubleValue
        }
        if let raw = input["labels"] {
            guard let labels = raw as? [String:String], labels.count <= 9, labels.allSatisfy({next.labels[$0.key] != nil && $0.value.count <= 120 && !$0.value.unicodeScalars.contains(where:{$0.value < 32})}) else { throw Self.invalid("Invalid indicator labels") }
            next.labels.merge(labels) {_,new in new}
        }
        self = next
    }
}
struct IndicatorControlSignature: Equatable {
    struct Control: Equatable { let action: String; let title: String; let accessibilityLabel: String }
    let frame: NSRect
    let notchHeight: CGFloat
    let controls: [Control]
    static func make(state: IndicatorState, geometry: IndicatorGeometry) -> IndicatorControlSignature {
        let idle=["idle","error","failed"].contains(state.state)
        var actions=idle ? ["dictate","command","note"] : state.state == "processing" ? ["cancel"] : ["stop","cancel"]
        actions.append("open");if state.canSelectTone {actions.append("tones")}
        return IndicatorControlSignature(frame:geometry.frame,notchHeight:geometry.safeTop,controls:actions.map { action in
            let label=state.labels[action] ?? action
            return Control(action:action,title:action == "tones" && !state.tone.isEmpty ? state.tone : label,accessibilityLabel:label)
        })
    }
}
final class IndicatorPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}
final class IndicatorButton: NSButton { var actionName = "" }
final class IndicatorView: NSView {
    var snapshot = IndicatorState()
    var notchHeight: CGFloat = 0
    override func draw(_ dirtyRect: NSRect) {
        NSColor.clear.setFill();bounds.fill()
        NSColor(calibratedWhite:0.025,alpha:0.97).setFill()
        NSBezierPath(roundedRect:bounds,xRadius:22,yRadius:22).fill()
        if notchHeight > 0 { NSRect(x:0,y:bounds.height-22,width:bounds.width,height:22).fill() }
        let color = NSColor(calibratedRed:0.6,green:0.94,blue:0.43,alpha:1)
        color.setStroke()
        let mic = NSBezierPath(roundedRect:NSRect(x:18,y:45,width:8,height:15),xRadius:4,yRadius:4);mic.lineWidth=2;mic.stroke()
        let stem=NSBezierPath();stem.move(to:NSPoint(x:14,y:50));stem.line(to:NSPoint(x:14,y:46));stem.curve(to:NSPoint(x:30,y:46),controlPoint1:NSPoint(x:14,y:36),controlPoint2:NSPoint(x:30,y:36));stem.line(to:NSPoint(x:30,y:50));stem.move(to:NSPoint(x:22,y:39));stem.line(to:NSPoint(x:22,y:35));stem.lineWidth=2;stem.stroke()
        let paragraph = NSMutableParagraphStyle();paragraph.lineBreakMode = .byTruncatingTail
        let message = snapshot.text.isEmpty ? snapshot.labels["status"] ?? snapshot.state : snapshot.text
        (message as NSString).draw(in:NSRect(x:40,y:46,width:bounds.width-58,height:20),withAttributes:[.font:NSFont.systemFont(ofSize:13,weight:.medium),.foregroundColor:NSColor.white,.paragraphStyle:paragraph])
        let meter=NSRect(x:40,y:38,width:bounds.width-58,height:3)
        NSColor(calibratedWhite:0.3,alpha:1).setFill();NSBezierPath(roundedRect:meter,xRadius:1.5,yRadius:1.5).fill()
        color.setFill();NSBezierPath(roundedRect:NSRect(x:meter.minX,y:meter.minY,width:meter.width*CGFloat(snapshot.level),height:meter.height),xRadius:1.5,yRadius:1.5).fill()
    }
}
final class NativeIndicator: NSObject {
    var snapshot = IndicatorState()
    private var panel: IndicatorPanel?, view: IndicatorView?, timer: Timer?, currentScreen: NSScreen?, geometry: IndicatorGeometry?
    private var currentVisibleFrame: NSRect?
    private var controlSignature: IndicatorControlSignature?
    private(set) var visible = false
    func metadata() -> [String:Any] {
        let notch = geometry?.notch ?? false
        let hasHardware = geometry?.hardwareNotch ?? false
        let fallback = geometry?.fallbackReason ?? ""
        let frame = geometry?.frame ?? .zero
        return ["visible":visible,"layout":notch ? "notch":"pill","hasHardwareNotch":hasHardware,"fallbackReason":fallback,"fallbackText":fallback == "display-has-no-notch" ? snapshot.labels["fallback"] ?? "":"","screenId":currentScreen?.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] ?? NSNull(),"frame":["x":frame.minX,"y":frame.minY,"width":frame.width,"height":frame.height],"state":snapshot.state,"mode":snapshot.mode]
    }
    func configure(_ input: [String:Any], show: Bool = false) throws -> [String:Any] {
        try snapshot.apply(input)
        if !snapshot.enabled { hide() }
        else if show { display() }
        else if visible { refresh() }
        return metadata()
    }
    private func selectedScreen() -> NSScreen? { let point=NSEvent.mouseLocation;return NSScreen.screens.first(where:{$0.frame.contains(point)}) ?? NSScreen.main ?? NSScreen.screens.first }
    private func display() {
        let wasVisible=visible
        if panel == nil {
            let window = IndicatorPanel(contentRect:.zero,styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
            window.isOpaque=false;window.backgroundColor = .clear;window.hasShadow=true;window.level=NSWindow.Level(rawValue:NSWindow.Level.statusBar.rawValue+1)
            window.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary,.stationary,.ignoresCycle];window.hidesOnDeactivate=false;window.isFloatingPanel=true;window.becomesKeyOnlyIfNeeded=true;window.isReleasedWhenClosed=false
            let content=IndicatorView(frame:.zero);window.contentView=content;panel=window;view=content
        }
        visible=true;refresh();if !wasVisible {panel?.orderFrontRegardless()}
        if timer == nil { timer=Timer.scheduledTimer(withTimeInterval:0.25,repeats:true) {[weak self] _ in guard let self, self.visible else {return}; let screen=self.selectedScreen(); if self.currentScreen !== screen || self.currentVisibleFrame != screen?.visibleFrame {self.refresh()} } }
    }
    private func refresh() {
        guard visible, let screen=selectedScreen(), let panel, let view else { return }
        currentScreen=screen;currentVisibleFrame=screen.visibleFrame
        let layout=IndicatorGeometry.calculate(screen:screen.frame,visible:screen.visibleFrame,safeTop:screen.safeAreaInsets.top,left:screen.auxiliaryTopLeftArea,right:screen.auxiliaryTopRightArea,style:snapshot.style,position:snapshot.position);geometry=layout
        if panel.frame != layout.frame {panel.setFrame(layout.frame,display:true);view.frame=NSRect(origin:.zero,size:layout.frame.size)}
        view.snapshot=snapshot;view.notchHeight=layout.safeTop
        let signature=IndicatorControlSignature.make(state:snapshot,geometry:layout)
        if controlSignature != signature {
            view.subviews.forEach{$0.removeFromSuperview()}
            let buttonWidth=(layout.frame.width-24)/CGFloat(signature.controls.count)
            for (index,control) in signature.controls.enumerated() {
                let button=IndicatorButton(frame:NSRect(x:12+CGFloat(index)*buttonWidth,y:7,width:buttonWidth-4,height:24));button.actionName=control.action
                button.title=control.title;button.target=self;button.action=#selector(clicked(_:));button.bezelStyle = .inline;button.isBordered=false;button.font=NSFont.systemFont(ofSize:11,weight:.medium);button.contentTintColor = .white;button.setAccessibilityLabel(control.accessibilityLabel);view.addSubview(button)
            }
            controlSignature=signature
        }
        let fallback = layout.fallbackReason == "display-has-no-notch" ? snapshot.labels["fallback"] : nil
        view.toolTip=fallback;view.setAccessibilityHelp(fallback)
        view.needsDisplay=true
    }
    @objc private func clicked(_ sender: IndicatorButton) { emit(["event":"indicator-action","action":sender.actionName]) }
    func hide() { visible=false;timer?.invalidate();timer=nil;panel?.orderOut(nil);panel?.close();panel=nil;view=nil;currentScreen=nil;currentVisibleFrame=nil;geometry=nil;controlSignature=nil }
}
func notchControlSelfTest() -> [String:Any] {
    let screen=NSRect(x:-1920,y:0,width:1920,height:1080)
    let geometry=IndicatorGeometry.calculate(screen:screen,safeTop:0,left:nil,right:nil,style:"notch",position:"top")
    var state=IndicatorState();state.state="recording";state.canSelectTone=true;state.tone="Original tone"
    let original=IndicatorControlSignature.make(state:state,geometry:geometry)
    var meterStable=true
    for step in 0..<100 {state.level=Double(step)/100;state.text="Meter sample \(step)";state.labels["status"]="Recording \(step)";meterStable = meterStable && IndicatorControlSignature.make(state:state,geometry:geometry)==original}
    state.state="muted";let mutedStable=IndicatorControlSignature.make(state:state,geometry:geometry)==original
    state.state="processing";let actionsChange=IndicatorControlSignature.make(state:state,geometry:geometry) != original;state.state="recording"
    state.labels["stop"]="停止";let labelsChange=IndicatorControlSignature.make(state:state,geometry:geometry) != original;state.labels["stop"]="Stop"
    state.tone="Different tone";let toneChange=IndicatorControlSignature.make(state:state,geometry:geometry) != original;state.tone="Original tone"
    state.canSelectTone=false;let availabilityChange=IndicatorControlSignature.make(state:state,geometry:geometry) != original;state.canSelectTone=true
    let moved=IndicatorGeometry.calculate(screen:NSRect(x:0,y:0,width:1512,height:982),safeTop:0,left:nil,right:nil,style:"notch",position:"top")
    return ["selfTest":"notch-controls","meterAndTextStable":meterStable,"mutedStable":mutedStable,"actionsChange":actionsChange,"labelsChange":labelsChange,"toneChange":toneChange,"availabilityChange":availabilityChange,"geometryChange":IndicatorControlSignature.make(state:state,geometry:moved) != original,"noWindowCreated":true]
}
func notchIndicatorSelfTest() -> [String:Any] {
    let laptop=NSRect(x:100,y:80,width:1512,height:982), left=NSRect(x:100,y:1024,width:655,height:38),right=NSRect(x:957,y:1024,width:655,height:38)
    let visible=NSRect(x:100,y:150,width:1512,height:874)
    let notch=IndicatorGeometry.calculate(screen:laptop,visible:visible,safeTop:38,left:left,right:right,style:"notch",position:"top")
    let externalScreen=NSRect(x:-1920,y:-100,width:1920,height:1080),externalVisible=NSRect(x:-1850,y:-100,width:1850,height:1056)
    let external=IndicatorGeometry.calculate(screen:externalScreen,visible:externalVisible,safeTop:0,left:nil,right:nil,style:"notch",position:"top")
    let bottom=IndicatorGeometry.calculate(screen:laptop,visible:visible,safeTop:38,left:left,right:right,style:"notch",position:"bottom")
    let externalBottom=IndicatorGeometry.calculate(screen:externalScreen,visible:externalVisible,safeTop:0,left:nil,right:nil,style:"pill",position:"bottom")
    var state=IndicatorState();var retained=false, atomic=false;var rejects=0
    do {try state.apply(["state":"recording","text":"<b>Plain</b>","tone":"Original tone","mode":"command","labels":["stop":"停止"]]);try state.apply(["level":0.8]);retained=state.text == "<b>Plain</b>" && state.labels["stop"] == "停止" && state.tone == "Original tone" && state.mode == "command"} catch {}
    for invalid: [String:Any] in [["state":"invented"],["level":Double.nan],["level":true],["level":1.1],["enabled":1],["text":String(repeating:"a",count:501)],["labels":["pause":"Pause"]],["tone":String(repeating:"a",count:121)]] { do { try state.apply(invalid) } catch { rejects += 1 } }
    do {try state.apply(["text":"Wrong replacement","level":-1]);} catch {atomic=state.text == "<b>Plain</b>"}
    return ["selfTest":"notch-indicator","notch":notch.notch,"topAnchored":notch.frame.maxY == laptop.maxY,"gapCentered":notch.frame.midX == (left.maxX+right.minX)/2,"externalFallback":!external.notch && external.frame.minX < 0,"bottomPill":!bottom.notch && bottom.frame.minY == visible.minY+16,"bottomHardwareMetadata":bottom.hardwareNotch && bottom.fallbackReason == "position-bottom","topFallbackReason":external.fallbackReason == "display-has-no-notch" && !external.hardwareNotch,"pillAvoidsMenuDock":external.frame.maxY == externalVisible.maxY-16 && externalVisible.contains(external.frame) && externalBottom.frame.minY == externalVisible.minY+16 && externalVisible.contains(externalBottom.frame),"levelRetainsContext":retained,"rejected":rejects,"atomicValidation":atomic,"noWindowCreated":true]
}

// Main-queue session ownership; pending starts retain their guard until completion.
final class SystemCaptureOwnership {
    private(set) var generation: UInt64 = 0
    private(set) var starting: UInt64?
    private(set) var owner: UInt64?
    func begin() -> UInt64? { guard starting == nil, owner == nil else { return nil }; generation += 1; starting = generation; owner = generation; return generation }
    func beginOperation(_ token: UInt64) -> Bool { guard owner == token, starting == nil else { return false }; starting = token; return true }
    func owns(_ token: UInt64) -> Bool { owner == token }
    func cancel() { generation += 1; owner = nil }
    func finish(_ token: UInt64) { if starting == token { starting = nil } }
}
@MainActor final class RetainedCaptureStop<Capture: AnyObject> {
    nonisolated init() {}
    private(set) var handle: Capture?
    private var task: Task<Void, Error>?
    private var taskCapture: Capture?
    var blocksNewStarts: Bool { handle != nil || task != nil }
    func retain(_ capture: Capture) -> Bool { guard (handle == nil || handle === capture), (task == nil || taskCapture === capture) else { return false }; handle = capture; return true }
    func confirm(_ capture: Capture) { if handle === capture { handle = nil } }
    func stop(_ capture: Capture, operation: @escaping () async throws -> Void) async throws {
        guard retain(capture) else { throw CancellationError() }
        if let task { try await task.value; return }
        let pending = Task { try await operation() }
        task = pending; taskCapture = capture
        do { try await pending.value; confirm(capture); task = nil; taskCapture = nil }
        catch { task = nil; taskCapture = nil; if handle === capture { throw error } }
    }
}
final class Bridge: NSObject, SCStreamOutput, SCStreamDelegate {
    let indicator = NativeIndicator()
    var expansionClipboardHistory = false
    var tap: CFMachPort?
    let eventTapAllowed = !CommandLine.arguments.contains("--no-event-tap")
    struct Binding {
        var key: Int64
        var flags: CGEventFlags
        var mode: String
        var toggle: Bool
        var held = false
        var toneId: String? = nil
        var sideFlags: UInt64 = 0
        var utilityId: String? = nil
    }
    var bindings = [Binding(key: 49, flags: .maskAlternate, mode: "dictation", toggle: false)]
    // Only auxiliary down events consumed by a binding own their corresponding up.
    var consumedUtilityKeys = Set<Int64>()
    var consumedMouseButtons = Set<Int64>()
    // Apple SDK IOKit/hidsystem/IOLLEvent.h NX_DEVICE* masks; Carbon Events.h physical modifier codes.
    let modifierSides: [(name:String,key:CGKeyCode,bit:UInt64,family:CGEventFlags)] = [
        ("left-control",59,0x1,.maskControl),("right-control",62,0x2000,.maskControl),
        ("left-shift",56,0x2,.maskShift),("right-shift",60,0x4,.maskShift),
        ("left-command",55,0x8,.maskCommand),("right-command",54,0x10,.maskCommand),
        ("left-option",58,0x20,.maskAlternate),("right-option",61,0x40,.maskAlternate)
    ]
    var currentSideFlags: UInt64 = 0
    var lastModifierFlags: CGEventFlags = []
    func snapshotModifierSides() { lastModifierFlags = CGEventSource.flagsState(.combinedSessionState).intersection(relevantFlags); currentSideFlags = modifierSides.reduce(0) { $0 | (CGEventSource.keyState(.combinedSessionState,key:$1.key) ? $1.bit : 0) } }
    func updateModifierSides(_ type:CGEventType,_ event:CGEvent) {
        let raw=event.flags.rawValue, code=event.getIntegerValueField(.keyboardEventKeycode)
        for family:CGEventFlags in [.maskControl,.maskShift,.maskCommand,.maskAlternate] {
            let sides=modifierSides.filter { $0.family == family }, mask=sides.reduce(UInt64(0)) { $0 | $1.bit }
            if !event.flags.contains(family) { currentSideFlags &= ~mask }
            else if raw & mask != 0 { currentSideFlags = (currentSideFlags & ~mask) | (raw & mask) }
            else if type == .flagsChanged, let side=sides.first(where:{Int64($0.key)==code}) { currentSideFlags ^= side.bit }
        }
    }
    func matchesSides(_ binding:Binding) -> Bool { (currentSideFlags & binding.sideFlags) == binding.sideFlags }

    var hotkeyCaptureActive = false
    var hotkeyCaptureTimer: Timer?
    var captureModifiers: [String] = []
    var captureOwnedKeys = Set<Int64>()
    var captureOwnedMouse = Set<Int64>()
    func captureModifierNames(_ flags:CGEventFlags) -> [String] {
        var names=modifierSides.filter{currentSideFlags & $0.bit != 0 && flags.contains($0.family)}.map{$0.name}
        for (name,family) in [("control",CGEventFlags.maskControl),("shift",.maskShift),("command",.maskCommand),("option",.maskAlternate)] { if flags.contains(family) && !modifierSides.contains(where:{$0.family==family && currentSideFlags & $0.bit != 0}) { names.append(name) } }
        if flags.contains(.maskSecondaryFn) { names.append("fn") };return names
    }
    func stopHotkeyCapture() { hotkeyCaptureActive=false;hotkeyCaptureTimer?.invalidate();hotkeyCaptureTimer=nil;captureModifiers=[];typed="";expansionSelection="" }
    func captureTimedOut() { guard hotkeyCaptureActive else{return};stopHotkeyCapture();emit(["event":"hotkey-capture-ended","reason":"timeout"]) }
    func startHotkeyCapture() {
        stopHotkeyCapture(); snapshotModifierSides(); hotkeyCaptureActive=true
        for i in bindings.indices { if bindings[i].held { emitHotkey("cancel",bindings[i]);bindings[i].held=false } }
        hotkeyCaptureTimer=Timer.scheduledTimer(withTimeInterval:30,repeats:false){[weak self] _ in self?.captureTimedOut()}
    }
    func captureLabel(_ code:Int64,_ event:CGEvent,_ mouse:Bool)->String {
        if mouse { return code == 130 ? "Middle mouse" : "Mouse \(code-127)" }
        let special:[Int64:String]=[49:"Space",36:"Return",48:"Tab",51:"Backspace",117:"Delete",123:"Left",124:"Right",125:"Down",126:"Up"]
        if let name=special[code]{return name};var chars=[UniChar](repeating:0,count:16);var count=0;event.keyboardGetUnicodeString(maxStringLength:16,actualStringLength:&count,unicodeString:&chars)
        let text=String(utf16CodeUnits:chars,count:count).trimmingCharacters(in:.whitespacesAndNewlines);return text.isEmpty ? "Key \(code)" : text.uppercased()
    }
    func captureEvent(_ type:CGEventType,_ event:CGEvent,_ code:Int64,_ mouse:Bool) -> Unmanaged<CGEvent>? {
        updateModifierSides(type,event);lastModifierFlags=event.flags.intersection(relevantFlags)
        if type == .keyDown && code == 53 { captureOwnedKeys.insert(code);stopHotkeyCapture();emit(["event":"hotkey-capture-cancelled","reason":"escape"]);return nil }
        if type == .flagsChanged {
            let names=captureModifierNames(lastModifierFlags)
            if !names.isEmpty { if names.count >= captureModifiers.count { captureModifiers=names } }
            else if !captureModifiers.isEmpty { let names=captureModifiers;stopHotkeyCapture();emit(["event":"hotkey-captured","keyCode":-1,"modifiers":names,"inputKind":"modifiers","label":names.joined(separator:" + ")]) }
            return Unmanaged.passUnretained(event)
        }
        if type == .keyDown || type == .otherMouseDown {
            if !mouse && event.getIntegerValueField(.keyboardEventAutorepeat) != 0 { return nil }
            if mouse { captureOwnedMouse.insert(code-128) } else { captureOwnedKeys.insert(code) }
            let modifiers=captureModifierNames(lastModifierFlags),label=captureLabel(code,event,mouse)
            stopHotkeyCapture();emit(["event":"hotkey-captured","keyCode":code,"modifiers":modifiers,"inputKind":mouse ? "mouse":"keyboard","label":label]);return nil
        }
        return Unmanaged.passUnretained(event)
    }

    let relevantFlags: CGEventFlags = [.maskAlternate, .maskCommand, .maskControl, .maskShift, .maskSecondaryFn]
    var expansions: [[String: String]] = []
    var typed = ""
    var typingElement: AXUIElement?
    var expansionSelection = ""
    var injecting = false
    var monitor: Timer?
    var stream: SCStream?
    let captureOwnership = SystemCaptureOwnership()
    let retainedCapture = RetainedCaptureStop<SCStream>()
    var pendingCapture: SCStream?
    var audioStream: SCStream?
    var systemPaused = false
    var audioFile: AVAudioFile?
    var recordingPath: String?
    var partialCapturePaths = Set<String>()
    let audioQueue = DispatchQueue(label: "scribble.audio")
    var pasteboardCount = NSPasteboard.general.changeCount
    func status() -> [String: Any] { ["accessibility": AXIsProcessTrusted(), "screenRecording": CGPreflightScreenCaptureAccess(), "microphone": AVCaptureDevice.authorizationStatus(for: .audio).rawValue, "hotkeys": tap != nil, "hotkeyCaptureActive":hotkeyCaptureActive, "hotkeyBindings": bindings.map { ["keyCode":$0.key, "inputKind":$0.key >= 130 ? "mouse" : ($0.key < 0 ? "modifiers" : "keyboard"), "modifierFlags":$0.flags.rawValue, "sideModifierFlags":$0.sideFlags, "mode":$0.mode, "toggle":$0.toggle, "active":$0.held, "toneId":$0.toneId ?? "", "utilityId":$0.utilityId ?? ""] as [String:Any] }, "systemRecording": stream != nil, "systemPaused": systemPaused, "permissionIdentity": ["pid": ProcessInfo.processInfo.processIdentifier, "executable": CommandLine.arguments.first ?? "", "bundleId": Bundle.main.bundleIdentifier ?? "", "microphoneSource": "native-helper-AVCaptureDevice"]] }
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
        if let utility = binding.utilityId, binding.mode == "utility" { event["utilityId"] = utility }
        if let tone = binding.toneId, !tone.isEmpty { event["toneId"] = tone }
        emit(event)
    }
    struct InsertionTarget { let pid:Int32;let element:AXUIElement;let issued:TimeInterval;let launchDate:Date?;let application:NSRunningApplication? }
    var insertionTargets:[String:InsertionTarget]=[:]
    func pruneInsertionTargets(_ now:TimeInterval=ProcessInfo.processInfo.systemUptime) {
        insertionTargets=insertionTargets.filter{now-$0.value.issued < 600 && now >= $0.value.issued}
        while insertionTargets.count >= 32, let oldest=insertionTargets.min(by:{$0.value.issued < $1.value.issued}) { insertionTargets.removeValue(forKey:oldest.key) }
    }
    func captureInsertionTarget() throws -> [String:Any] {
        guard AXIsProcessTrusted(), let app=NSWorkspace.shared.frontmostApplication, let element=focused(), !secure(element) else { throw NSError(domain:"Scribble",code:20,userInfo:[NSLocalizedDescriptionKey:"An accessible non-password field is required for insertion"]) }
        var pid:Int32=0;guard AXUIElementGetPid(element,&pid) == .success, pid == app.processIdentifier else { throw NSError(domain:"Scribble",code:20,userInfo:[NSLocalizedDescriptionKey:"The insertion field no longer belongs to the active application"]) }
        pruneInsertionTargets();let token=UUID().uuidString
        insertionTargets[token]=InsertionTarget(pid:pid,element:element,issued:ProcessInfo.processInfo.systemUptime,launchDate:app.launchDate,application:app)
        return ["token":token,"pid":pid,"bundleId":app.bundleIdentifier ?? "","expiresInMs":600000]
    }
    func insertionRefused(_ reason:String)->[String:Any] { ["inserted":false,"dispatched":false,"verified":false,"method":"none","reason":reason] }
    @MainActor func pasteAtTarget(_ request:[String:Any], token:String) async -> [String:Any] {
        // One attempt consumes the opaque token, including failed attempts, before any clipboard changes.
        guard let target=insertionTargets.removeValue(forKey:token) else { return insertionRefused("The insertion target is missing or already used") }
        let now=ProcessInfo.processInfo.systemUptime
        guard now >= target.issued, now-target.issued < 600 else { return insertionRefused("The insertion target expired") }
        if request["dryRun"] as? Bool == true { return insertionRefused("Target insertion dry runs never activate applications") }
        guard request["activateTarget"] as? Bool == true else { return insertionRefused("Explicit target activation is required") }
        guard AXIsProcessTrusted(), !secure(target.element), let originalApp=target.application, !originalApp.isTerminated, let app=NSRunningApplication(processIdentifier:target.pid), !app.isTerminated, app.launchDate == target.launchDate else { return insertionRefused("The original insertion application or field is unavailable") }
        guard app.activate(options:[]) else { return insertionRefused("The original application could not be activated") }
        for _ in 0..<10 {
            try? await Task.sleep(for:.milliseconds(100))
            if NSWorkspace.shared.frontmostApplication?.processIdentifier == target.pid, let element=focused(), CFEqual(element,target.element), !secure(element) {
                return paste(request["text"] as? String ?? "",html:request["html"] as? String,restore:request["restoreClipboard"] as? Bool ?? true,enter:request["autoEnter"] as? Bool ?? false,expectedPid:target.pid,allowClipboardHistory:(try? requestedClipboardHistory(request)) ?? true)
            }
        }
        return insertionRefused("The original field is no longer focused; insertion was canceled")
    }
    func paste(_ text: String, html: String? = nil, restore: Bool, enter: Bool, expectedPid: Int32? = nil, dryRun: Bool = false, allowClipboardHistory:Bool = true) -> [String: Any] {
        let rich = html.map { !$0.isEmpty } ?? false
        let method = rich ? "clipboard-rich" : "accessibility-or-clipboard-plain"
        if dryRun { return ["inserted":false, "dispatched":false, "verified":false, "dryRun":true, "method":method, "clipboardTypes":pasteboardInsertionItem(text,html:html,allowClipboardHistory:allowClipboardHistory).types.map{$0.rawValue}, "restoreClipboard":restore, "autoEnter":enter, "requiresAccessibility":true] }
        guard AXIsProcessTrusted() else { return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Accessibility permission is required"] }
        if let expectedPid, NSWorkspace.shared.frontmostApplication?.processIdentifier != expectedPid { return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"The active application changed"] }
        if let element = focused(), secure(element) { return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Secure password field"] }
        if !rich, let element = focused(), AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, text as CFString) == .success {
            let entered = enter ? keystroke(36, []) : false
            return ["inserted":true, "dispatched":entered, "verified":true, "method":"accessibility", "richText":false, "autoEnterDispatched":entered]
        }
        let pb = NSPasteboard.general
        let saved = clipboardSnapshot(pb)
        let item = pasteboardInsertionItem(text,html:html,allowClipboardHistory:allowClipboardHistory)
        pb.clearContents()
        guard pb.writeObjects([item]) else { pb.clearContents(); pb.writeObjects(saved); return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Clipboard write failed"] }
        let insertedCount = pb.changeCount
        guard keystroke(9, .maskCommand) else { restoreClipboardIfUnchanged(pb,saved:saved,expectedCount:insertedCount); return ["inserted":false, "dispatched":false, "verified":false, "method":"none", "reason":"Keyboard event could not be posted"] }
        let targetPid = NSWorkspace.shared.frontmostApplication?.processIdentifier
        if enter { DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { if NSWorkspace.shared.frontmostApplication?.processIdentifier == targetPid { self.keystroke(36, []) } } }
        if restore { DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { restoreClipboardIfUnchanged(pb,saved:saved,expectedCount:insertedCount) } }
        return ["inserted":false, "dispatched":true, "verified":false, "method":rich ? "clipboard-rich":"clipboard-plain", "richText":rich, "clipboardRestoreScheduled":restore, "autoEnterScheduled":enter,"allowClipboardHistory":allowClipboardHistory]
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
        snapshotModifierSides()
        let mask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue) | (1 << CGEventType.otherMouseDown.rawValue) | (1 << CGEventType.otherMouseUp.rawValue)
        tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap, eventsOfInterest: CGEventMask(mask), callback: { _, type, event, ref in
            let bridge = Unmanaged<Bridge>.fromOpaque(ref!).takeUnretainedValue()
            return bridge.handle(type, event)
        }, userInfo: Unmanaged.passUnretained(self).toOpaque())
        if let tap { CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0), .commonModes); CGEvent.tapEnable(tap: tap, enable: true) }
    }
    func handle(_ type: CGEventType, _ event: CGEvent) -> Unmanaged<CGEvent>? {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput { if let tap { CGEvent.tapEnable(tap: tap, enable: true) }; return Unmanaged.passUnretained(event) }
        if event.getIntegerValueField(.eventSourceUserData) == 0x534352 { return Unmanaged.passUnretained(event) }
        let mouse = type == .otherMouseDown || type == .otherMouseUp
        let button = event.getIntegerValueField(.mouseEventButtonNumber)
        if mouse && !(2...31).contains(button) { return Unmanaged.passUnretained(event) }
        let code = mouse ? 128 + button : event.getIntegerValueField(.keyboardEventKeycode)
        if mouse && captureOwnedMouse.contains(button) { if type == .otherMouseUp { captureOwnedMouse.remove(button) };return nil }
        if !mouse && captureOwnedKeys.contains(code) && (type == .keyDown || type == .keyUp) { if type == .keyUp { captureOwnedKeys.remove(code) };return nil }
        if !mouse && consumedUtilityKeys.contains(code) && (type == .keyDown || type == .keyUp) { if type == .keyUp { consumedUtilityKeys.remove(code) };return nil }
        if hotkeyCaptureActive {
            if type == .leftMouseDown || type == .leftMouseUp || type == .rightMouseDown || type == .rightMouseUp { return Unmanaged.passUnretained(event) }
            return captureEvent(type,event,code,mouse)
        }
        if type == .otherMouseDown, consumedMouseButtons.contains(button) { return nil }
        let previousSides = currentSideFlags, previousFlags = lastModifierFlags
        updateModifierSides(type,event)
        let currentFlags = event.flags.intersection(relevantFlags)
        lastModifierFlags = currentFlags
        if type == .keyDown, code == 53, !bindings.contains(where:{$0.mode == "utility" && $0.key == code && $0.flags == currentFlags && matchesSides($0)}) {
            for i in bindings.indices { bindings[i].held = false }
            emit(["event":"hotkey", "phase":"cancel", "mode":"dictation"])
            return Unmanaged.passUnretained(event)
        }
        for i in bindings.indices {
            let binding = bindings[i]
            let pressed = binding.key < 0 ? (type == .flagsChanged && currentFlags == binding.flags && matchesSides(binding) && !(previousFlags == binding.flags && (previousSides & binding.sideFlags) == binding.sideFlags)) : ((binding.key >= 130 ? type == .otherMouseDown : type == .keyDown) && code == binding.key && currentFlags == binding.flags && matchesSides(binding))
            if pressed && (mouse || event.getIntegerValueField(.keyboardEventAutorepeat) == 0) {
                if binding.mode == "utility" { consumedUtilityKeys.insert(code); typed="";expansionSelection="";emitHotkey("start",binding);return nil }
                if mouse { consumedMouseButtons.insert(button) }
                if binding.toggle || binding.mode == "paste-last" {
                    bindings[i].held.toggle()
                    emitHotkey(bindings[i].held ? "start":"stop",binding)
                    if binding.mode == "paste-last" { bindings[i].held = false }
                } else if !binding.held { bindings[i].held = true; emitHotkey("start",binding) }
                return binding.key < 0 ? Unmanaged.passUnretained(event) : nil
            }
            let released = (binding.key >= 130 ? type == .otherMouseUp : type == .keyUp) && code == binding.key
            if !binding.toggle, binding.held, (released || type == .flagsChanged && (!currentFlags.isSuperset(of: binding.flags) || !matchesSides(binding))) {
                bindings[i].held = false; emitHotkey("stop",binding)
                if released { if mouse { consumedMouseButtons.remove(button) }; return nil }
            }
        }
        if type == .otherMouseUp, consumedMouseButtons.remove(button) != nil { return nil }
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
                        _ = self.paste(value,html:html,restore:true,enter:false,allowClipboardHistory:self.expansionClipboardHistory)
                    }; break
                } }
            }
        }
        return Unmanaged.passUnretained(event)
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard audioStream === stream, type == .audio, sampleBuffer.isValid, let format = sampleBuffer.formatDescription, let desc = CMAudioFormatDescriptionGetStreamBasicDescription(format), let audioFormat = AVAudioFormat(streamDescription: desc) else { return }
        let count = CMSampleBufferGetNumSamples(sampleBuffer)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: AVAudioFrameCount(count)) else { return }
        buffer.frameLength = AVAudioFrameCount(count)
        let result = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer, at: 0, frameCount: Int32(count), into: buffer.mutableAudioBufferList)
        guard result == noErr else { return }
        do { if audioFile == nil, let recordingPath { guard !FileManager.default.fileExists(atPath:recordingPath) else { throw NSError(domain:"Scribble",code:2,userInfo:[NSLocalizedDescriptionKey:"System audio output already exists"]) }; audioFile = try AVAudioFile(forWriting: URL(fileURLWithPath: recordingPath), settings: audioFormat.settings); partialCapturePaths.insert(recordingPath) }; try audioFile?.write(from: buffer) } catch { emit(["event":"recordingError", "error":error.localizedDescription]) }
    }
    func stream(_ stoppedStream: SCStream, didStopWithError error: Error) {
        DispatchQueue.main.async {
            guard self.stream === stoppedStream || self.pendingCapture === stoppedStream else { return }
            self.retainedCapture.confirm(stoppedStream); self.captureOwnership.cancel(); self.stream = nil; self.pendingCapture = nil; self.systemPaused = false
            self.audioQueue.sync { if self.audioStream === stoppedStream { self.audioStream = nil; self.audioFile = nil; self.recordingPath = nil } }
            emit(["event":"recordingError", "error":error.localizedDescription])
        }
    }
    @MainActor func stopSystemCapture() async throws -> String {
        captureOwnership.cancel()
        let capture = retainedCapture.handle ?? stream ?? pendingCapture, paused = systemPaused
        let completed = stream != nil
        audioQueue.sync { audioStream = nil }
        if let capture {
            try await retainedCapture.stop(capture) { if !paused { try await capture.stopCapture() } }
            if stream === capture { stream = nil }; if pendingCapture === capture { pendingCapture = nil }
        }
        systemPaused = false
        var savedPath = ""
        audioQueue.sync {
            audioFile = nil
            if completed { savedPath = recordingPath ?? "" }
            else if let recordingPath, partialCapturePaths.remove(recordingPath) != nil { try? FileManager.default.removeItem(atPath:recordingPath) }
            audioFile = nil; recordingPath = nil
        }
        return savedPath
    }
    @objc func pollClipboard() {
        let pb = NSPasteboard.general
        guard pb.changeCount != pasteboardCount else { return }
        pasteboardCount = pb.changeCount
        if pb.types?.contains(NSPasteboard.PasteboardType("org.nspasteboard.TransientType")) == true { return }
        if let text = pb.string(forType: .string) { emit(["event":"clipboard", "text":text]) }
    }
    @MainActor func command(_ request: [String: Any]) async {
        let id = request["id"] ?? NSNull()
        do {
            var result: Any = NSNull()
            switch request["command"] as? String ?? "" {
            case "indicatorConfigure": result = try indicator.configure(request)
            case "indicatorShow": result = try indicator.configure(request,show:true)
            case "indicatorUpdate": result = try indicator.configure(request)
            case "indicatorHide": indicator.hide();result = indicator.metadata()
            case "status": startTap(); result = status()
            case "permissions":
                if request["accessibility"] as? Bool == true { _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary) }
                if request["screenRecording"] as? Bool == true { _ = CGRequestScreenCaptureAccess() }
                startTap(); result = status()
            case "edit": result = try await edit(request, action: request["action"] as? String ?? "")
            case "undo", "redo", "selectAll", "find": result = try await edit(request, action: request["command"] as? String ?? "")
            case "captureInsertionTarget": result = try captureInsertionTarget()
            case "paste":
                let allowClipboardHistory = try requestedClipboardHistory(request)
                if let token=request["targetToken"] as? String { result = await pasteAtTarget(request,token:token) }
                else if request["targetToken"] != nil { result=insertionRefused("Invalid insertion target token") }
                else { result = paste(request["text"] as? String ?? "", html: request["html"] as? String, restore: request["restoreClipboard"] as? Bool ?? true, enter: request["autoEnter"] as? Bool ?? false, expectedPid: (request["expectedPid"] as? NSNumber)?.int32Value, dryRun: request["dryRun"] as? Bool ?? false,allowClipboardHistory:allowClipboardHistory) }
            case "selection": var value: CFTypeRef?; if let field = focused(), !secure(field) { AXUIElementCopyAttributeValue(field, kAXSelectedTextAttribute as CFString, &value) }; result = ["text": value as? String ?? ""]
            case "hotkeyCaptureStart": startHotkeyCapture();startTap();result=["capturing":true,"available":tap != nil,"timeoutMs":30000]
            case "hotkeyCaptureStop": stopHotkeyCapture();result=["capturing":false]
            case "frontmost": result = frontmostContext()
            case "setHotkeys":
                let configured = request["hotkeys"] as? [[String: Any]] ?? [request]
                let allowedModifiers = ["option", "alt", "command", "meta", "cmd", "control", "ctrl", "shift", "fn"] + modifierSides.map { $0.name }
                let candidate: [Binding] = try configured.map { item in
                    let modifiers = item["modifiers"] as? [String] ?? ["option"]
                    if let supplied = item["keyCode"] {
                        guard let numeric = supplied as? NSNumber, CFGetTypeID(numeric) != CFBooleanGetTypeID(), numeric.doubleValue.isFinite, numeric.doubleValue == Double(numeric.int64Value) else { throw NSError(domain:"Scribble",code:12,userInfo:[NSLocalizedDescriptionKey:"Hotkey keyCode must be an integer"]) }
                    }
                    let key = (item["keyCode"] as? NSNumber)?.int64Value ?? 49
                    let mode = item["mode"] as? String ?? "dictation"
                    guard ((-1...127).contains(key) || (130...159).contains(key)), modifiers.allSatisfy({allowedModifiers.contains($0)}), ["dictation", "command", "shortcut", "meeting", "note", "paste-last", "utility"].contains(mode), !(key == -1 && modifiers.isEmpty) else { throw NSError(domain:"Scribble", code:12, userInfo:[NSLocalizedDescriptionKey:"Invalid hotkey binding"]) }
                    let utilityId = item["utilityId"] as? String
                    if mode == "utility" {
                        guard (0...127).contains(key), ![54,55,56,57,58,59,60,61,62,63].contains(key), !modifiers.isEmpty, let utilityId, !utilityId.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty, utilityId.count <= 100, utilityId.rangeOfCharacter(from:.controlCharacters) == nil else { throw NSError(domain:"Scribble",code:12,userInfo:[NSLocalizedDescriptionKey:"Utility hotkeys require a modifier, regular key and utility ID"]) }
                    }
                    var flags: CGEventFlags = []
                    var sideFlags: UInt64 = 0
                    for modifier in modifiers {
                        if let side=modifierSides.first(where:{$0.name==modifier}) { flags.insert(side.family); sideFlags |= side.bit; continue }
                        switch modifier { case "option", "alt": flags.insert(.maskAlternate); case "command", "meta", "cmd": flags.insert(.maskCommand); case "control", "ctrl": flags.insert(.maskControl); case "shift": flags.insert(.maskShift); case "fn": flags.insert(.maskSecondaryFn); default: break }
                    }
                    return Binding(key: key, flags: flags, mode: mode, toggle: item["toggle"] as? Bool ?? false, toneId:item["toneId"] as? String,sideFlags:sideFlags,utilityId: mode == "utility" ? utilityId:nil)
                }
                var signatures = Set<String>()
                for binding in candidate { guard signatures.insert("\(binding.key):\(binding.flags.rawValue):\(binding.sideFlags)").inserted else { throw NSError(domain:"Scribble", code:13, userInfo:[NSLocalizedDescriptionKey:"Duplicate hotkey binding"]) } }
                for binding in bindings where binding.held { emitHotkey("cancel",binding) }
                bindings = candidate
                startTap(); result = status()
            case "setExpansions":
                let allowClipboardHistory = try requestedClipboardHistory(request,defaultValue:false)
                expansionClipboardHistory = allowClipboardHistory; expansions = request["expansions"] as? [[String: String]] ?? []; result = ["count":expansions.count]
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
                guard !retainedCapture.blocksNewStarts, let path = request["path"] as? String, path.hasPrefix("/"), !FileManager.default.fileExists(atPath:path), let token = captureOwnership.begin() else { throw NSError(domain:"Scribble", code:2, userInfo:[NSLocalizedDescriptionKey:"Already recording or invalid/existing output path"]) }
                defer { captureOwnership.finish(token) }
                var capture: SCStream?
                do {
                    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly:true)
                    guard captureOwnership.owns(token) else { throw CancellationError() }
                    guard let display = content.displays.first else { throw NSError(domain:"Scribble", code:3, userInfo:[NSLocalizedDescriptionKey:"No display available"]) }
                    let config = SCStreamConfiguration(); config.capturesAudio = true; config.excludesCurrentProcessAudio = true; config.width = 2; config.height = 2; config.minimumFrameInterval = CMTime(value:1,timescale:1); config.sampleRate = 48000; config.channelCount = 2
                    let ownBundle = request["excludeBundleId"] as? String ?? "org.scribble.voice"
                    let excluded = content.applications.filter { $0.bundleIdentifier == ownBundle }
                    let candidate = SCStream(filter:SCContentFilter(display:display,excludingApplications:excluded,exceptingWindows:[]),configuration:config,delegate:self)
                    capture = candidate; pendingCapture = candidate; _ = retainedCapture.retain(candidate)
                    audioQueue.sync { audioStream = candidate; recordingPath = path; audioFile = nil }
                    try candidate.addStreamOutput(self,type:.audio,sampleHandlerQueue:audioQueue)
                    try await candidate.startCapture()
                    guard captureOwnership.owns(token), pendingCapture === candidate else { throw CancellationError() }
                    audioQueue.sync { _ = partialCapturePaths.remove(path) }
                    pendingCapture = nil; stream = candidate; systemPaused = false; result = ["path":path]
                } catch {
                    if captureOwnership.owns(token) { captureOwnership.cancel() }
                    audioQueue.sync { if audioStream === capture { audioStream = nil } }
                    if let capture {
                        // A failed cleanup keeps its retryable handle and blocks new starts.
                        do { try await retainedCapture.stop(capture) { try await capture.stopCapture() } }
                        catch { throw error }
                        if pendingCapture === capture { pendingCapture = nil }
                    }
                    audioQueue.sync {
                        audioFile = nil; recordingPath = nil
                        if partialCapturePaths.remove(path) != nil { try? FileManager.default.removeItem(atPath:path) }
                    }
                    throw error
                }
            case "recordSystemPause":
                guard let capture = stream, let token = captureOwnership.owner else { throw NSError(domain:"Scribble",code:5,userInfo:[NSLocalizedDescriptionKey:"No system recording is active"]) }
                guard captureOwnership.beginOperation(token) else { throw CancellationError() }; defer { captureOwnership.finish(token) }
                if !systemPaused { try await capture.stopCapture(); guard captureOwnership.owns(token), stream === capture else { throw CancellationError() }; systemPaused = true }
                result = ["paused":systemPaused]
            case "recordSystemResume":
                guard let capture = stream, let token = captureOwnership.owner else { throw NSError(domain:"Scribble",code:5,userInfo:[NSLocalizedDescriptionKey:"No system recording is active"]) }
                guard captureOwnership.beginOperation(token) else { throw CancellationError() }; defer { captureOwnership.finish(token) }
                if systemPaused {
                    try await capture.startCapture()
                    guard captureOwnership.owns(token), stream === capture else { try await retainedCapture.stop(capture) { try await capture.stopCapture() }; throw CancellationError() }
                    systemPaused = false
                }
                result = ["paused":systemPaused]
            case "recordSystemStop": result = ["path":try await stopSystemCapture()]
            default: throw NSError(domain:"Scribble", code:4, userInfo:[NSLocalizedDescriptionKey:"Unknown command"])
            }
            emit(["id":id, "ok":true, "result":result])
        } catch { emit(["id":id, "ok":false, "error":error.localizedDescription]) }
    }
}
if CommandLine.arguments.contains("--clipboard-history-self-test") {
    let transient=NSPasteboard.PasteboardType("org.nspasteboard.TransientType")
    let privateItem=pasteboardInsertionItem("Private",html:"<b>Private</b>",allowClipboardHistory:false), publicItem=pasteboardInsertionItem("Public",html:nil,allowClipboardHistory:true)
    var invalid=false;do{_ = try requestedClipboardHistory(["allowClipboardHistory":1])}catch{invalid=true}
    emit(["selfTest":"clipboard-history","privateTagged":privateItem.types.contains(transient),"publicUntagged":!publicItem.types.contains(transient),"plainRichPreserved":privateItem.string(forType:.string)=="Private" && privateItem.string(forType:.html)=="<b>Private</b>","invalidRejected":invalid,"legacyDefault":(try? requestedClipboardHistory([:])) ?? false,"originalTypesRestored":clipboardSelfTest()]);exit(0)
}
if CommandLine.arguments.contains("--notch-controls-self-test") { emit(notchControlSelfTest()); exit(0) }
if CommandLine.arguments.contains("--notch-indicator-self-test") { emit(notchIndicatorSelfTest()); exit(0) }
if CommandLine.arguments.contains("--context-url-self-test") { emit(["clean":contextURL("https://example.com/work?token=secret#fragment") ?? "", "credentialed":contextURL("https://user:secret@example.com") == nil, "nonWeb":contextURL("file:///private/notes") == nil]); exit(0) }
if CommandLine.arguments.contains("--template-self-test") {
    let values = ["date":"October 7, 2026","time":"9:30 AM","clipboard":"<b>Clipboard & text</b>","selection":"Selected <words>","selected_text":"Selected <words>"]
    let plain = templateValues("{date} {{TIME}} {selection} {{selected_text}} {clipboard}",values:values)
    let rich = templateValues("<strong>{clipboard}</strong><p>{{selection}}</p>",values:values,html:true)
    emit(["plain":plain,"html":rich,"literal":templateValues("{clipboard}",values:["clipboard":"{date}","date":"Should not expand"])]); exit(0)
}
if CommandLine.arguments.contains("--clipboard-self-test") { let passed = clipboardSelfTest(); emit(["ok":passed, "privatePasteboard":true]); exit(passed ? 0 : 1) }
if CommandLine.arguments.contains("--system-capture-self-test") {
    let state = SystemCaptureOwnership(), first = state.begin()!
    state.cancel(); let lateStartRejected = !state.owns(first), pendingStartGuarded = state.begin() == nil
    state.finish(first); let second = state.begin()!
    state.finish(first); let newOwnerPreserved = state.owns(second) && state.starting == second
    state.finish(second); let resumeToken = second; state.cancel()
    let lateResumeRejected = !state.owns(resumeToken), third = state.begin()!
    let staleStopCannotOwnNew = !state.owns(second) && state.owns(third)
    state.cancel(); state.finish(third)
    let passed = lateStartRejected && pendingStartGuarded && newOwnerPreserved && lateResumeRejected && staleStopCannotOwnNew && state.owner == nil && state.starting == nil
    Task { @MainActor in
        let retained = RetainedCaptureStop<NSObject>(), fixture = NSObject()
        _ = retained.retain(fixture)
        var rejected = false
        do { try await retained.stop(fixture) { throw NSError(domain:"fixture",code:1) } } catch { rejected = true }
        let failedStopRetains = rejected && retained.handle === fixture
        let replacementRefused = !retained.retain(NSObject())
        var calls = 0
        let firstStop = Task { @MainActor in try await retained.stop(fixture) { calls += 1; try await Task.sleep(nanoseconds:5_000_000) } }
        let secondStop = Task { @MainActor in try await retained.stop(fixture) { calls += 1 } }
        var retryConfirmed = false
        do { try await firstStop.value; try await secondStop.value; retryConfirmed = retained.handle == nil } catch {}
        let coalescedStops = calls == 1
        let allPassed = passed && failedStopRetains && replacementRefused && retryConfirmed && coalescedStops
        emit(["selfTest":"system-capture", "ok":allPassed,"lateStartRejected":lateStartRejected,"pendingStartGuarded":pendingStartGuarded,"newOwnerPreserved":newOwnerPreserved,"lateResumeRejected":lateResumeRejected,"staleStopCannotOwnNew":staleStopCannotOwnNew,"failedStopRetains":failedStopRetains,"replacementRefused":replacementRefused,"retryConfirmed":retryConfirmed,"coalescedStops":coalescedStops]); exit(allPassed ? 0 : 1)
    }
    RunLoop.main.run()

}
let bridge = Bridge()
if CommandLine.arguments.contains("--status") { emit(bridge.status()); exit(0) }
if CommandLine.arguments.contains("--hotkey-tone-self-test") { let binding = Bridge.Binding(key:49,flags:.maskAlternate,mode:"dictation",toggle:false,toneId:"tone-fixture"); bridge.emitHotkey("start",binding); bridge.emitHotkey("stop",binding); exit(0) }
if CommandLine.arguments.contains("--insertion-target-self-test") {
    let field=AXUIElementCreateApplication(-1),now=ProcessInfo.processInfo.systemUptime
    for index in 0..<40 { bridge.pruneInsertionTargets(now);bridge.insertionTargets["fixture-\(index)"]=Bridge.InsertionTarget(pid:-1,element:field,issued:now-Double(40-index)/1000,launchDate:nil,application:nil) }
    let bounded=bridge.insertionTargets.count == 32;bridge.pruneInsertionTargets(now+601)
    emit(["selfTest":"insertion-targets","bounded":bounded,"expiredCleared":bridge.insertionTargets.isEmpty]);exit(0)
}
if CommandLine.arguments.contains("--utility-hotkey-self-test") {
    func event(_ type:CGEventType,key:Int64=49,repeatKey:Bool=false)->CGEvent { let e=CGEvent(source:nil)!;e.type=type;e.flags=CGEventFlags(rawValue:CGEventFlags.maskAlternate.rawValue|0x40);e.setIntegerValueField(.keyboardEventKeycode,value:key);e.setIntegerValueField(.keyboardEventAutorepeat,value:repeatKey ? 1:0);return e }
    bridge.bindings=[Bridge.Binding(key:49,flags:.maskAlternate,mode:"utility",toggle:true,sideFlags:0x40,utilityId:"fixture-utility"),Bridge.Binding(key:53,flags:.maskAlternate,mode:"utility",toggle:false,sideFlags:0x40,utilityId:"escape-utility")]
    let fired=bridge.handle(.keyDown,event(.keyDown)) == nil
    let repeated=bridge.handle(.keyDown,event(.keyDown,repeatKey:true)) == nil
    let released=bridge.handle(.keyUp,event(.keyUp)) == nil
    let unheld = bridge.bindings.allSatisfy{!$0.held}
    let escapeFired=bridge.handle(.keyDown,event(.keyDown,key:53)) == nil;_=bridge.handle(.keyUp,event(.keyUp,key:53))
    emit(["selfTest":"utility-hotkeys","fired":fired,"repeatConsumed":repeated,"releaseConsumed":released,"neverHeld":unheld,"ownedCleared":bridge.consumedUtilityKeys.isEmpty,"escapeChord":escapeFired]);exit(0)
}
if CommandLine.arguments.contains("--hotkey-capture-self-test") {
    func event(_ type:CGEventType,key:Int64=49,button:Int64=2,flags:CGEventFlags=[],repeatKey:Bool=false)->CGEvent { let e=CGEvent(source:nil)!;e.type=type;e.flags=flags;e.setIntegerValueField(.keyboardEventKeycode,value:key);e.setIntegerValueField(.mouseEventButtonNumber,value:button);e.setIntegerValueField(.keyboardEventAutorepeat,value:repeatKey ? 1:0);return e }
    bridge.startHotkeyCapture();let repeatIgnored=bridge.handle(.keyDown,event(.keyDown,repeatKey:true))==nil && bridge.hotkeyCaptureActive
    let capturedKey=bridge.handle(.keyDown,event(.keyDown,flags:CGEventFlags(rawValue:CGEventFlags.maskAlternate.rawValue|0x40)))==nil && !bridge.hotkeyCaptureActive
    let releasedKey=bridge.handle(.keyUp,event(.keyUp))==nil
    bridge.startHotkeyCapture();let primaryPassed=bridge.handle(.leftMouseDown,event(.leftMouseDown,button:0)) != nil
    let capturedMouse=bridge.handle(.otherMouseDown,event(.otherMouseDown,button:5))==nil;let releasedMouse=bridge.handle(.otherMouseUp,event(.otherMouseUp,button:5))==nil
    bridge.startHotkeyCapture();_=bridge.handle(.flagsChanged,event(.flagsChanged,key:56,flags:CGEventFlags(rawValue:CGEventFlags.maskShift.rawValue|0x2)));_=bridge.handle(.flagsChanged,event(.flagsChanged,key:59,flags:CGEventFlags(rawValue:CGEventFlags.maskShift.rawValue|CGEventFlags.maskControl.rawValue|0x3)));_=bridge.handle(.flagsChanged,event(.flagsChanged,key:56,flags:CGEventFlags(rawValue:CGEventFlags.maskControl.rawValue|0x1)));_=bridge.handle(.flagsChanged,event(.flagsChanged,key:59));let capturedModifiers = !bridge.hotkeyCaptureActive
    bridge.startHotkeyCapture();let escaped=bridge.handle(.keyDown,event(.keyDown,key:53))==nil && !bridge.hotkeyCaptureActive;_=bridge.handle(.keyUp,event(.keyUp,key:53))
    bridge.startHotkeyCapture();bridge.captureTimedOut();let timedOut = !bridge.hotkeyCaptureActive;bridge.stopHotkeyCapture();bridge.stopHotkeyCapture()
    emit(["selfTest":"hotkey-capture","repeatIgnored":repeatIgnored,"capturedKey":capturedKey,"releasedKey":releasedKey,"primaryPassed":primaryPassed,"capturedMouse":capturedMouse,"releasedMouse":releasedMouse,"capturedModifiers":capturedModifiers,"escaped":escaped,"timedOut":timedOut,"ownedReleasesCleared":bridge.captureOwnedKeys.isEmpty && bridge.captureOwnedMouse.isEmpty]);exit(0)
}
if CommandLine.arguments.contains("--modifier-side-self-test") {
    func event(_ type:CGEventType,_ key:Int64,_ flags:CGEventFlags,_ sides:UInt64)->CGEvent { let value=CGEvent(source:nil)!;value.type=type;value.flags=CGEventFlags(rawValue:flags.rawValue|sides);value.setIntegerValueField(.keyboardEventKeycode,value:key);value.setIntegerValueField(.mouseEventButtonNumber,value:2);return value }
    bridge.bindings=[Bridge.Binding(key:49,flags:.maskAlternate,mode:"dictation",toggle:false,sideFlags:0x20),Bridge.Binding(key:49,flags:.maskAlternate,mode:"command",toggle:false,sideFlags:0x40)]
    _=bridge.handle(.keyDown,event(.keyDown,49,.maskAlternate,0x40));let rightOnly=bridge.bindings[1].held && !bridge.bindings[0].held
    _=bridge.handle(.flagsChanged,event(.flagsChanged,61,.maskAlternate,0x20));let sideRelease = !bridge.bindings[1].held
    _=bridge.handle(.keyDown,event(.keyDown,49,.maskAlternate,0x20));_=bridge.handle(.keyUp,event(.keyUp,49,.maskAlternate,0x20));let leftReleased = !bridge.bindings[0].held
    bridge.bindings=[Bridge.Binding(key:-1,flags:.maskControl,mode:"dictation",toggle:false,sideFlags:0x1)]
    _=bridge.handle(.flagsChanged,event(.flagsChanged,59,.maskControl,0x1));let modifierHeld=bridge.bindings[0].held
    _=bridge.handle(.flagsChanged,event(.flagsChanged,59,.maskControl,0x2000));let modifierReleased = !bridge.bindings[0].held
    bridge.bindings=[Bridge.Binding(key:130,flags:.maskShift,mode:"command",toggle:true,sideFlags:0x4)]
    for _ in 0..<2 { _=bridge.handle(.otherMouseDown,event(.otherMouseDown,0,.maskShift,0x4));_=bridge.handle(.otherMouseUp,event(.otherMouseUp,0,.maskShift,0x4)) }
    let mouseToggle = !bridge.bindings[0].held && bridge.consumedMouseButtons.isEmpty
    bridge.bindings=[Bridge.Binding(key:49,flags:.maskCommand,mode:"dictation",toggle:false)]
    _=bridge.handle(.keyDown,event(.keyDown,49,.maskCommand,0x10));let genericRight=bridge.bindings[0].held;_=bridge.handle(.keyUp,event(.keyUp,49,.maskCommand,0x10))
    bridge.bindings=[Bridge.Binding(key:-1,flags:.maskShift,mode:"command",toggle:true,sideFlags:0x2)]
    _=bridge.handle(.flagsChanged,event(.flagsChanged,56,.maskShift,0x2));_=bridge.handle(.flagsChanged,event(.flagsChanged,56,.maskShift,0x2));let modifierToggleRepeat=bridge.bindings[0].held
    _=bridge.handle(.flagsChanged,event(.flagsChanged,56,[],0));_=bridge.handle(.flagsChanged,event(.flagsChanged,56,.maskShift,0x2));let modifierToggleStopped = !bridge.bindings[0].held
    emit(["selfTest":"modifier-sides","rightOnly":rightOnly,"sideRelease":sideRelease,"leftReleased":leftReleased,"modifierHeld":modifierHeld,"modifierReleased":modifierReleased,"mouseToggle":mouseToggle,"genericRight":genericRight,"modifierToggleRepeat":modifierToggleRepeat,"modifierToggleStopped":modifierToggleStopped]);exit(0)
}
if CommandLine.arguments.contains("--mouse-hotkey-self-test") {
    func event(_ type: CGEventType, button: Int64 = 2, flags: CGEventFlags = []) -> CGEvent {
        let value = CGEvent(source:nil)!; value.type = type; value.flags = flags
        value.setIntegerValueField(.mouseEventButtonNumber,value:button)
        return value
    }
    bridge.bindings = [Bridge.Binding(key:130,flags:.maskAlternate,mode:"dictation",toggle:false),Bridge.Binding(key:131,flags:[],mode:"command",toggle:true),Bridge.Binding(key:159,flags:[],mode:"meeting",toggle:false)]
    let holdDown = bridge.handle(.otherMouseDown,event(.otherMouseDown,flags:.maskAlternate)) == nil
    let repeatedDown = bridge.handle(.otherMouseDown,event(.otherMouseDown,flags:.maskAlternate)) == nil
    let modifierReleasePassed = bridge.handle(.flagsChanged,event(.flagsChanged)) != nil
    let releasedHold = !bridge.bindings[0].held
    let holdUp = bridge.handle(.otherMouseUp,event(.otherMouseUp)) == nil
    var toggleConsumed = true
    for _ in 0..<2 {
        toggleConsumed = (bridge.handle(.otherMouseDown,event(.otherMouseDown,button:3)) == nil) && toggleConsumed
        toggleConsumed = (bridge.handle(.otherMouseUp,event(.otherMouseUp,button:3)) == nil) && toggleConsumed
    }
    let unboundPassed = bridge.handle(.otherMouseDown,event(.otherMouseDown,button:4)) != nil && bridge.handle(.otherMouseUp,event(.otherMouseUp,button:4)) != nil
    let primaryPassed = bridge.handle(.leftMouseDown,event(.leftMouseDown,button:0)) != nil && bridge.handle(.rightMouseDown,event(.rightMouseDown,button:1)) != nil
    let highestConsumed = bridge.handle(.otherMouseDown,event(.otherMouseDown,button:31)) == nil && bridge.handle(.otherMouseUp,event(.otherMouseUp,button:31)) == nil
    emit(["selfTest":"mouse-hotkeys", "holdConsumed":holdDown && holdUp, "repeatConsumed":repeatedDown, "modifierReleasePassed":modifierReleasePassed, "releasedHold":releasedHold, "toggleConsumed":toggleConsumed, "toggleInactive":!bridge.bindings[1].held, "unboundPassed":unboundPassed, "primaryPassed":primaryPassed, "highestConsumed":highestConsumed, "consumedCount":bridge.consumedMouseButtons.count]); exit(0)
}
let nativeApplication = NSApplication.shared
nativeApplication.setActivationPolicy(.prohibited)
bridge.startTap()
DispatchQueue.global().async { while let line = readLine() { guard let data = line.data(using:.utf8), let object = try? JSONSerialization.jsonObject(with:data) as? [String:Any] else { emit(["ok":false,"error":"Invalid JSON"]); continue }; DispatchQueue.main.async { Task { await bridge.command(object) } } }; DispatchQueue.main.async { Task { bridge.indicator.hide(); _ = try? await bridge.stopSystemCapture(); exit(0) } } }
nativeApplication.run()
