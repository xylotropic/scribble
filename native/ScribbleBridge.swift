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
// Original countdown pill. Validation, ordering, countdown and geometry need no desktop access.
struct TimerPillEntry { let id:String; let title:String; let endsAt:Double }
struct TimerPillSnapshot {
    var entries:[TimerPillEntry]=[]
    var labels=["cancel":"Cancel","countPattern":"{count} timers","timer":"Timer"]
    static func plain(_ value:Any?, max:Int) -> String? { guard let text=value as? String,!text.isEmpty,text.count<=max,!text.unicodeScalars.contains(where:{CharacterSet.controlCharacters.contains($0) || CharacterSet.newlines.contains($0)}) else{return nil};return text }
    mutating func apply(_ request:[String:Any],now:Double) throws {
        guard let raw=request["timers"] as? [[String:Any]],raw.count<=32 else {throw IndicatorState.invalid("Timer pill accepts at most32 timers")}
        var next=TimerPillSnapshot();next.labels=labels;var ids=Set<String>()
        for item in raw {
            guard Set(item.keys).isSubset(of:["id","title","endsAt"]),let id=Self.plain(item["id"],max:100),ids.insert(id).inserted,let title=Self.plain(item["title"],max:200),let number=item["endsAt"] as? NSNumber,CFGetTypeID(number) != CFBooleanGetTypeID() else {throw IndicatorState.invalid("Invalid timer pill item")}
            let end=number.doubleValue
            guard end.isFinite,end>0,end<=now+30*86400*1000 else {throw IndicatorState.invalid("Timer pill deadline exceeds30 days")}
            next.entries.append(TimerPillEntry(id:id,title:title,endsAt:end))
        }
        if let raw=request["labels"] {
            guard let values=raw as? [String:Any],Set(values.keys).isSubset(of:["cancel","countPattern","timer"]) else {throw IndicatorState.invalid("Invalid timer pill labels")}
            for (key,value) in values {guard let text=Self.plain(value,max:200) else {throw IndicatorState.invalid("Invalid timer pill label")};if key=="countPattern" && text.components(separatedBy:"{count}").count != 2 {throw IndicatorState.invalid("Timer count label requires exactly one {count}")};next.labels[key]=text}
        }
        entries=next.entries.sorted {$0.endsAt==$1.endsAt ? $0.id<$1.id : $0.endsAt<$1.endsAt};labels=next.labels
    }
    func active(now:Double)->[TimerPillEntry] {entries.filter {$0.endsAt>now}}
    func metadata(now:Double)->[String:Any] {let active=active(now:now);var result:[String:Any]=["visible":!active.isEmpty,"count":active.count];if let first=active.first {result["nextId"]=first.id;result["remainingMs"]=max(0,first.endsAt-now)};return result}
    static func countdown(end:Double,now:Double)->String {let total=Int(ceil(max(0,end-now)/1000));let hours=total/3600;return hours>0 ? String(format:"%d:%02d:%02d",hours,(total/60)%60,total%60) : String(format:"%d:%02d",total/60,total%60)}
}
func timerPillGeometry(visible:NSRect,indicator:NSRect?=nil)->NSRect {
    let margin=min(32,max(0,min(visible.width,visible.height)/8));let width=min(330,max(1,visible.width-2*margin)),height=min(76,max(1,visible.height-2*margin))
    var result=NSRect(x:visible.maxX-margin-width,y:visible.minY+margin,width:width,height:height)
    if let indicator,result.intersects(indicator) {let top=NSRect(x:result.minX,y:visible.maxY-margin-height,width:width,height:height);if !top.intersects(indicator) {result=top}}
    return result
}
func timerPillAccessibilitySummary(timer:String,title:String,countdown:String,count:String)->String {[timer,title,countdown,count].joined(separator:". ")}
final class TimerPillView:NSView {
    let titleField=NSTextField(labelWithString:""),countdownField=NSTextField(labelWithString:""),countField=NSTextField(labelWithString:"")
    override init(frame:NSRect) {
        super.init(frame:frame)
        setAccessibilityElement(true);setAccessibilityRole(.group)
        for field in [titleField,countdownField,countField] {field.lineBreakMode = .byTruncatingTail;field.isSelectable=false;field.setAccessibilityElement(true);field.setAccessibilityRole(.staticText);addSubview(field)}
        titleField.font=NSFont.systemFont(ofSize:13,weight:.medium);titleField.textColor = .white
        countdownField.font=NSFont.monospacedDigitSystemFont(ofSize:17,weight:.semibold);countdownField.textColor=NSColor(calibratedRed:0.6,green:0.94,blue:0.43,alpha:1)
        countField.font=NSFont.systemFont(ofSize:11);countField.textColor = .lightGray
    }
    required init?(coder:NSCoder) {fatalError("Timer pill uses programmatic views")}
    func update(title:String,countdown:String,count:String,timerLabel:String,cancelButton:NSButton) {
        titleField.stringValue=title;countdownField.stringValue=countdown;countField.stringValue=count
        titleField.setAccessibilityLabel(timerLabel)
        setAccessibilityLabel(timerPillAccessibilitySummary(timer:timerLabel,title:title,countdown:countdown,count:count))
        // Explicit children retain the localized Cancel button alongside standard readable text.
        setAccessibilityChildren([titleField,countdownField,countField,cancelButton])
        titleField.frame=NSRect(x:46,y:43,width:max(1,bounds.width-128),height:20)
        countdownField.frame=NSRect(x:46,y:15,width:100,height:22)
        countField.frame=NSRect(x:147,y:18,width:max(1,bounds.width-165),height:17)
        needsDisplay=true
    }
    override func draw(_ dirtyRect:NSRect) {
        NSColor.clear.setFill();bounds.fill();NSColor(calibratedWhite:0.03,alpha:0.97).setFill();NSBezierPath(roundedRect:bounds,xRadius:19,yRadius:19).fill()
        NSColor(calibratedRed:0.6,green:0.94,blue:0.43,alpha:1).setStroke()
        let clock=NSBezierPath(ovalIn:NSRect(x:15,y:35,width:21,height:21));clock.lineWidth=2;clock.stroke()
        let hand=NSBezierPath();hand.move(to:NSPoint(x:25.5,y:51));hand.line(to:NSPoint(x:25.5,y:45.5));hand.line(to:NSPoint(x:30,y:43));hand.lineWidth=2;hand.stroke()
    }
}
final class NativeTimerPill:NSObject {
    private var snapshot=TimerPillSnapshot(),panel:IndicatorPanel?,view:TimerPillView?,cancelButton:NSButton?,tick:Timer?,selectedId:String?,closing=false
    var indicatorFrame:()->NSRect? = {nil}
    func sync(_ request:[String:Any]) throws->[String:Any] {guard !closing else {throw IndicatorState.invalid("Timer pill is shutting down")};let now=Date().timeIntervalSince1970*1000;try snapshot.apply(request,now:now);refresh(now:now);if tick==nil && !snapshot.active(now:now).isEmpty {tick=Timer.scheduledTimer(withTimeInterval:0.25,repeats:true){[weak self] _ in self?.refresh(now:Date().timeIntervalSince1970*1000)}};return snapshot.metadata(now:now)}
    func hide(){tick?.invalidate();tick=nil;panel?.orderOut(nil);selectedId=nil}
    func shutdown(){closing=true;hide();panel?.close();panel=nil;view=nil;cancelButton=nil;snapshot.entries=[]}
    private func refresh(now:Double) {
        let active=snapshot.active(now:now);guard let first=active.first else {hide();return}
        let point=NSEvent.mouseLocation;guard let screen=NSScreen.screens.first(where:{$0.frame.contains(point)}) ?? NSScreen.main else {hide();return}
        let layout=timerPillGeometry(visible:screen.visibleFrame,indicator:indicatorFrame())
        if panel==nil {let window=IndicatorPanel(contentRect:layout,styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false);window.isOpaque=false;window.backgroundColor = .clear;window.hasShadow=true;window.level=NSWindow.Level(rawValue:NSWindow.Level.statusBar.rawValue+1);window.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary,.stationary,.ignoresCycle];window.hidesOnDeactivate=false;window.isFloatingPanel=true;window.becomesKeyOnlyIfNeeded=true;window.isReleasedWhenClosed=false;let content=TimerPillView(frame:NSRect(origin:.zero,size:layout.size));window.contentView=content;let button=NSButton(title:"",target:self,action:#selector(cancelTimer));button.bezelStyle = .rounded;button.isBordered=false;button.font=NSFont.systemFont(ofSize:11);button.contentTintColor = .white;content.addSubview(button);panel=window;view=content;cancelButton=button}
        guard let panel,let view,let cancelButton else{return};if panel.frame != layout {panel.setFrame(layout,display:false)}
        view.update(title:first.title,countdown:TimerPillSnapshot.countdown(end:first.endsAt,now:now),count:snapshot.labels["countPattern"]!.replacingOccurrences(of:"{count}",with:String(active.count)),timerLabel:snapshot.labels["timer"]!,cancelButton:cancelButton);selectedId=first.id
        cancelButton.title=snapshot.labels["cancel"]!;cancelButton.setAccessibilityLabel(snapshot.labels["cancel"]!);cancelButton.frame=NSRect(x:max(0,layout.width-78),y:43,width:min(70,layout.width),height:22)
        if !panel.isVisible {panel.orderFrontRegardless()}
    }
    @objc private func cancelTimer(){guard let id=selectedId,snapshot.active(now:Date().timeIntervalSince1970*1000).contains(where:{$0.id==id}) else{return};emit(["event":"timer-cancel","id":id])}
}
func timerPillSelfTest()->[String:Any] {
    let now=1000000.0;var state=TimerPillSnapshot();try! state.apply(["timers":[["id":"b","title":"Later","endsAt":now+120000],["id":"a","title":"日本語 <plain>","endsAt":now+1501],["id":"expired","title":"Old","endsAt":now-1]],"labels":["countPattern":"{count}件","cancel":"取消"]],now:now)
    let initial=state.metadata(now:now);var rejected=0;for invalid:[String:Any] in [["timers":[["id":"a","title":"Control\n","endsAt":now+1000]]],["timers":[["id":"a","title":"A","endsAt":Double.nan]]],["timers":[["id":"a","title":"A","endsAt":true]]],["timers":[["id":"a","title":"A","endsAt":now+31*86400*1000]]],["timers":Array(repeating:["id":"a","title":"A","endsAt":now+1000],count:33)],["timers":[["id":"a","title":"A","endsAt":now+1000],["id":"a","title":"B","endsAt":now+2000]]],["timers":[],"labels":["countPattern":"{count} {count}"]],["timers":[["id":String(repeating:"a",count:101),"title":"A","endsAt":now+1000]]],["timers":[["id":"a","title":String(repeating:"a",count:201),"endsAt":now+1000]]],["timers":[],"labels":["cancel":"Control\u{0085}"]]] {do{try state.apply(invalid,now:now)}catch{rejected+=1}}
    var maximum=TimerPillSnapshot();try! maximum.apply(["timers":(0..<32).map{["id":"timer-\($0)","title":"Timer","endsAt":now+1000] as [String:Any]}],now:now)
    let atomic = state.metadata(now:now)["nextId"] as? String == "a" && state.metadata(now:now)["count"] as? Int == 2 && state.labels["cancel"]=="取消"
    let visible=NSRect(x:-1800,y:-400,width:1800,height:970),indicator=NSRect(x:-340,y:-370,width:320,height:100),frame=timerPillGeometry(visible:visible,indicator:indicator),tiny=NSRect(x:10,y:20,width:20,height:20)
    let expired=state.metadata(now:now+121000);try! state.apply(["timers":[]],now:now)
    return ["selfTest":"timer-pill","accessiblePlainSummary":timerPillAccessibilitySummary(timer:"タイマー",title:"日本語 <plain>",countdown:"0:02",count:"2件") == "タイマー. 日本語 <plain>. 0:02. 2件","maxAccepted":maximum.active(now:now).count == 32,"nearest":initial["nextId"] as? String == "a","count":initial["count"] as? Int == 2,"ceilSeconds":TimerPillSnapshot.countdown(end:now+1501,now:now)=="0:02","hourCountdown":TimerPillSnapshot.countdown(end:now+3600001,now:now)=="1:00:01","expiredZero":TimerPillSnapshot.countdown(end:now-1,now:now)=="0:00","allExpiredHidden":expired["visible"] as? Bool == false,"emptyHidden":state.metadata(now:now)["visible"] as? Bool == false,"rejected":rejected,"atomic":atomic,"negativeOriginAndDock":visible.contains(frame),"avoidsIndicator":!frame.intersects(indicator),"tinyClamped":tiny.contains(timerPillGeometry(visible:tiny)),"noWindowCreated":true]
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
func commandScreenError(_ message:String) -> NSError { NSError(domain:"Scribble.CommandScreen",code:40,userInfo:[NSLocalizedDescriptionKey:message]) }
struct CommandScreenLabels {
    var instruction="Drag to select up to five regions. Stop recording when finished."
    var regionCountPattern="{count} of {max} regions selected."
    var maxReached="Five screen regions are already selected."
    init(_ value:Any?=nil) throws {
        guard let value else{return}
        guard let labels=value as? [String:Any],labels.keys.allSatisfy({["instruction","regionCountPattern","maxReached"].contains($0)}) else {throw commandScreenError("Invalid screen selection labels")}
        for (key,raw) in labels {guard let text=raw as? String,!text.isEmpty,text.count<=300,!text.unicodeScalars.contains(where:{$0.value<32||$0.value==127}) else {throw commandScreenError("Invalid screen selection labels")};switch key {case "instruction":instruction=text;case "regionCountPattern":regionCountPattern=text;default:maxReached=text}}
    }
    func countText(_ count:Int) -> String {regionCountPattern.replacingOccurrences(of:"{count}",with:String(min(5,max(0,count)))).replacingOccurrences(of:"{max}",with:"5")}
}
struct CommandScreenRegion {
    let displayID:CGDirectDisplayID
    let screenFrame:CGRect
    let rect:CGRect
}
func commandRegionRect(_ start:CGPoint,_ end:CGPoint,screen:CGRect) -> CGRect? {
    guard [start.x,start.y,end.x,end.y,screen.minX,screen.minY,screen.width,screen.height].allSatisfy({$0.isFinite}),screen.width>0,screen.height>0 else {return nil}
    let raw=CGRect(x:min(start.x,end.x),y:min(start.y,end.y),width:abs(start.x-end.x),height:abs(start.y-end.y)).intersection(screen)
    return !raw.isNull && raw.width>=8 && raw.height>=8 ? raw : nil
}
func commandSourceRect(_ region:CommandScreenRegion,logical:CGSize) -> CGRect? {
    guard logical.width.isFinite,logical.height.isFinite,logical.width>0,logical.height>0,region.screenFrame.width>0,region.screenFrame.height>0 else {return nil}
    let crop=region.rect.intersection(region.screenFrame)
    guard !crop.isNull,crop.width>=8,crop.height>=8 else {return nil}
    let x=logical.width/region.screenFrame.width,y=logical.height/region.screenFrame.height
    return CGRect(x:(crop.minX-region.screenFrame.minX)*x,y:(region.screenFrame.maxY-crop.maxY)*y,width:crop.width*x,height:crop.height*y)
}
func commandImageSize(_ logical:CGSize,scale:CGFloat) -> CGSize {
    let width=max(1,logical.width*max(1,scale)),height=max(1,logical.height*max(1,scale)),factor=min(1,1536/max(width,height))
    return CGSize(width:max(1,floor(width*factor)),height:max(1,floor(height*factor)))
}
final class CommandScreenPlan {
    let dragRegions:Bool
    var regions:[CommandScreenRegion]=[]
    init(dragRegions:Bool){self.dragRegions=dragRegions}
    func add(_ region:CommandScreenRegion) -> Bool {guard dragRegions,regions.count<5 else {return false};regions.append(region);return true}
    func source() throws -> String {if dragRegions && regions.isEmpty {throw commandScreenError("Select at least one screen region, or turn off region capture.")};return dragRegions ? "regions":"display"}
}
@available(macOS 14.0, *) final class CommandRegionPanel:NSPanel {
    override var canBecomeKey:Bool {false}
    override var canBecomeMain:Bool {false}
}
@available(macOS 14.0, *) final class CommandRegionView:NSView {
    var begin:CGPoint?
    var current:CGPoint?
    var selected:[(rect:CGRect,index:Int)]=[]
    var labels=try! CommandScreenLabels()
    var count=0
    var maxMessage=false
    var select:((CGRect)->Void)?
    override var isFlipped:Bool {false}
    override func acceptsFirstMouse(for event:NSEvent?) -> Bool {true}
    override func resetCursorRects(){addCursorRect(bounds,cursor:.crosshair)}
    override func mouseDown(with event:NSEvent){begin=convert(event.locationInWindow,from:nil);current=begin;needsDisplay=true}
    override func mouseDragged(with event:NSEvent){current=convert(event.locationInWindow,from:nil);needsDisplay=true}
    override func mouseUp(with event:NSEvent){
        defer {begin=nil;current=nil;needsDisplay=true}
        guard let start=begin,let rect=commandRegionRect(start,convert(event.locationInWindow,from:nil),screen:bounds) else {return}
        select?(rect)
    }
    override func draw(_ dirtyRect:NSRect){
        NSColor.black.withAlphaComponent(0.08).setFill();bounds.fill()
        let instruction=labels.instruction+"  "+(maxMessage ? labels.maxReached:labels.countText(count))
        let attrs:[NSAttributedString.Key:Any]=[.font:NSFont.systemFont(ofSize:13,weight:.medium),.foregroundColor:NSColor.white,.backgroundColor:NSColor.black.withAlphaComponent(0.75)]
        (instruction as NSString).draw(in:CGRect(x:30,y:bounds.height-85,width:max(1,bounds.width-60),height:45),withAttributes:attrs)
        var rects=selected;if let start=begin,let end=current,let rect=commandRegionRect(start,end,screen:bounds){rects.append((rect,count+1))}
        for (rect,index) in rects{
            NSColor.systemGreen.withAlphaComponent(0.15).setFill();rect.fill();NSColor.systemGreen.setStroke();let border=NSBezierPath(rect:rect);border.lineWidth=2;border.stroke()
            let label="\(index)" as NSString;label.draw(at:NSPoint(x:rect.minX+7,y:rect.maxY-23),withAttributes:[.font:NSFont.boldSystemFont(ofSize:14),.foregroundColor:NSColor.white,.backgroundColor:NSColor.black.withAlphaComponent(0.7)])
        }
    }
}
@available(macOS 14.0, *) @MainActor final class CommandScreenSession {
    let token:String
    let plan:CommandScreenPlan
    let labels:CommandScreenLabels
    var phase="starting"
    var content:SCShareableContent?
    var activeDisplay:SCDisplay?
    var automatic:[String:Any]?
    var panels:[CGDirectDisplayID:CommandRegionPanel]=[:]
    var screenFrames:[CGDirectDisplayID:CGRect]=[:]
    var pending:[UUID: @MainActor (Error)->Void]=[:]
    var deadline:Date
    init(token:String,dragRegions:Bool,labels:CommandScreenLabels=try! CommandScreenLabels()){self.token=token;plan=CommandScreenPlan(dragRegions:dragRegions);self.labels=labels;deadline=Date().addingTimeInterval(10)}
}
@available(macOS 14.0, *) @MainActor final class CommandScreenController {
    var session:CommandScreenSession?
    private var shuttingDown=false
    func shutdown(){shuttingDown=true;_ = cancel()}
    private let eventSink:([String:Any])->Void
    init(eventSink:@escaping ([String:Any])->Void=emit){self.eventSink=eventSink}
    private var displayObserver:NSObjectProtocol?
    private var closedTokens:[String:Date]=[:]
    private func rememberClosed(_ token:String){
        let cutoff=Date().addingTimeInterval(-600);closedTokens=closedTokens.filter{$0.value>cutoff};closedTokens[token]=Date()
        while closedTokens.count>128 {if let oldest=closedTokens.min(by:{$0.value<$1.value})?.key {closedTokens.removeValue(forKey:oldest)}}
    }
    private func isClosed(_ token:String)->Bool {guard let date=closedTokens[token] else{return false};if date.timeIntervalSinceNow < -600 {closedTokens.removeValue(forKey:token);return false};return true}

    private func owns(_ candidate:CommandScreenSession) -> Bool {session === candidate}
    private func assertOwner(_ candidate:CommandScreenSession) throws {guard owns(candidate) else {throw commandScreenError("Screen capture cancelled")}}
    private func status(_ candidate:CommandScreenSession,_ value:String,error:String?=nil){guard owns(candidate) else{return};var event:[String:Any]=["event":"command-screen-status","token":candidate.token,"status":value];if let error {event["error"]=error};eventSink(event)}
    private func token(_ request:[String:Any]) throws -> String {guard let value=request["token"] as? String,value.range(of:"^[A-Za-z0-9_-]{1,100}$",options:.regularExpression) != nil else {throw commandScreenError("Invalid command screen token")};return value}
    private func metadata(_ candidate:CommandScreenSession) -> [String:Any] {["token":candidate.token,"started":true,"status":candidate.phase,"dragRegions":candidate.plan.dragRegions,"regionCount":candidate.plan.regions.count,"maxRegions":5]}
    private func hidePanels(_ candidate:CommandScreenSession){for panel in candidate.panels.values {panel.orderOut(nil);panel.close()};candidate.panels.removeAll();if let displayObserver {NotificationCenter.default.removeObserver(displayObserver);self.displayObserver=nil}}
    func cancel(token:String?=nil) -> Bool {
        if let token {rememberClosed(token)}
        guard let candidate=session,token==nil || token==candidate.token else {return false}
        rememberClosed(candidate.token);status(candidate,"cancelled");session=nil;hidePanels(candidate);candidate.automatic=nil;candidate.content=nil;candidate.activeDisplay=nil;candidate.plan.regions.removeAll()
        let pending=Array(candidate.pending.values);for cancel in pending {cancel(commandScreenError("Screen capture cancelled"))};return true
    }
    func cancel(_ request:[String:Any]) throws -> [String:Any] {let value=try token(request);return ["token":value,"cancelled":cancel(token:value)]}
    fileprivate func operation<T>(_ candidate:CommandScreenSession,start:(_ complete:@escaping (Result<T,Error>)->Void)->Void) async throws -> T {
        try assertOwner(candidate)
        let remaining=candidate.deadline.timeIntervalSinceNow;guard remaining>0 else {throw commandScreenError("Screen capture timed out")}
        return try await withCheckedThrowingContinuation { (continuation:CheckedContinuation<T,Error>) in
            let key=UUID();var timer:Timer?
            @MainActor func complete(_ result:Result<T,Error>){guard candidate.pending.removeValue(forKey:key) != nil else{return};timer?.invalidate();timer=nil;continuation.resume(with:result)}
            candidate.pending[key]={error in complete(.failure(error))}
            timer=Timer.scheduledTimer(withTimeInterval:remaining,repeats:false){_ in Task { @MainActor in complete(.failure(commandScreenError("Screen capture timed out"))) }}
            start {result in DispatchQueue.main.async {guard self.owns(candidate) else {complete(.failure(commandScreenError("Screen capture cancelled")));return};complete(result)}}
        }
    }
    private func shareable(_ candidate:CommandScreenSession) async throws -> SCShareableContent {
        guard CGPreflightScreenCaptureAccess() else {throw commandScreenError("Screen Recording permission is required. Enable it in System Settings.")}
        return try await operation(candidate){done in SCShareableContent.getExcludingDesktopWindows(false,onScreenWindowsOnly:true){content,error in if let error {done(.failure(error))}else if let content {done(.success(content))}else {done(.failure(commandScreenError("No screen capture content available")))}}}
    }
    private func snapshot(_ candidate:CommandScreenSession,display:SCDisplay,region:CommandScreenRegion?=nil) async throws -> [String:Any] {
        try assertOwner(candidate);guard CGPreflightScreenCaptureAccess() else {throw commandScreenError("Screen Recording permission is required. Enable it in System Settings.")}
        guard let content=candidate.content else {throw commandScreenError("Screen capture content is unavailable")}
        let ownPids:Set<pid_t>=[ProcessInfo.processInfo.processIdentifier,getppid()]
        let applications=content.applications.filter{ownPids.contains($0.processID)}
        let filter=SCContentFilter(display:display,excludingApplications:applications,exceptingWindows:[])
        let logical=CGSize(width:filter.contentRect.width,height:filter.contentRect.height)
        let source:CGRect
        if let region {guard NSScreen.screens.contains(where:{(($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value)==region.displayID && $0.frame==region.screenFrame}) else {throw commandScreenError("A selected display changed. Start the command again.")};guard let rect=commandSourceRect(region,logical:logical) else {throw commandScreenError("Invalid screen region")};source=rect}
        else {source=CGRect(origin:.zero,size:logical)}
        let size=commandImageSize(source.size,scale:CGFloat(filter.pointPixelScale))
        let config=SCStreamConfiguration();config.sourceRect=source;config.width=Int(size.width);config.height=Int(size.height);config.showsCursor=false;config.capturesAudio=false;config.scalesToFit=true
        let image:CGImage=try await operation(candidate){done in SCScreenshotManager.captureImage(contentFilter:filter,configuration:config){image,error in if let error {done(.failure(error))}else if let image {done(.success(image))}else {done(.failure(commandScreenError("Screen capture returned no image")))}}}
        try assertOwner(candidate)
        guard image.width<=1536,image.height<=1536,image.width>0,image.height>0 else {throw commandScreenError("Screen image dimensions exceed the limit")}
        let bitmap=NSBitmapImageRep(cgImage:image);var encoded:Data?
        for quality in [0.85,0.7,0.5] {if let data=bitmap.representation(using:.jpeg,properties:[.compressionFactor:quality]),data.count<=3*1024*1024 {encoded=data;break}}
        guard let encoded else {throw commandScreenError("Screen image exceeds 3 MiB")}
        return ["mimeType":"image/jpeg","data":encoded.base64EncodedString(),"width":image.width,"height":image.height]
    }
    private func showPanels(_ candidate:CommandScreenSession){
        guard owns(candidate),let content=candidate.content else {return}
        for screen in NSScreen.screens {
            guard let id=(screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value,content.displays.contains(where:{$0.displayID==id}) else {continue}
            candidate.screenFrames[id]=screen.frame
            let panel=CommandRegionPanel(contentRect:screen.frame,styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
            panel.isOpaque=false;panel.backgroundColor = .clear;panel.hasShadow=false;panel.level = .statusBar;panel.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary,.stationary,.ignoresCycle];panel.hidesOnDeactivate=false;panel.isFloatingPanel=true;panel.becomesKeyOnlyIfNeeded=true;panel.isReleasedWhenClosed=false
            let view=CommandRegionView(frame:CGRect(origin:.zero,size:screen.frame.size));view.labels=candidate.labels;panel.contentView=view
            view.select={ [weak self,weak candidate,weak view] local in
                guard let self,let candidate,let view,self.owns(candidate),candidate.phase=="ready",let frame=candidate.screenFrames[id] else {return}
                let rect=local.offsetBy(dx:frame.minX,dy:frame.minY)
                guard candidate.plan.add(CommandScreenRegion(displayID:id,screenFrame:frame,rect:rect)) else {view.maxMessage=true;view.needsDisplay=true;self.status(candidate,"selecting",error:candidate.labels.maxReached);return}
                for (displayID,window) in candidate.panels {if let contentView=window.contentView as? CommandRegionView,let frame=candidate.screenFrames[displayID]{contentView.selected=candidate.plan.regions.enumerated().filter{$0.element.displayID==displayID}.map{($0.element.rect.offsetBy(dx:-frame.minX,dy:-frame.minY),$0.offset+1)};contentView.count=candidate.plan.regions.count;contentView.maxMessage=false;contentView.needsDisplay=true}}
                self.eventSink(["event":"command-region-count","token":candidate.token,"count":candidate.plan.regions.count,"maxRegions":5])
            }
            candidate.panels[id]=panel;panel.orderFrontRegardless()
        }
        displayObserver=NotificationCenter.default.addObserver(forName:NSApplication.didChangeScreenParametersNotification,object:nil,queue:.main){[weak self,weak candidate] _ in Task { @MainActor in guard let self,let candidate,self.owns(candidate) else{return};self.status(candidate,"error",error:"Displays changed during screen selection. Start the command again.");_ = self.cancel(token:candidate.token) }}
    }
    func start(_ request:[String:Any]) async throws -> [String:Any] {
        guard !shuttingDown else {throw commandScreenError("Screen capture is shutting down")}
        let value=try token(request)
        let labels=try CommandScreenLabels(request["labels"])
        guard let boolean=request["dragRegions"] as? NSNumber,CFGetTypeID(boolean)==CFBooleanGetTypeID() else {throw commandScreenError("dragRegions must be a boolean")}
        guard !isClosed(value) else {throw commandScreenError("Command screen session was already cancelled or completed")}
        if let session {guard session.token==value,session.plan.dragRegions==boolean.boolValue else {throw commandScreenError("Another command screen session is active")};guard session.phase=="ready" else {throw commandScreenError("Command screen capture is already starting or finishing")};return metadata(session)}
        guard CGPreflightScreenCaptureAccess() else {throw commandScreenError("Screen Recording permission is required. Enable it in System Settings.")}
        let candidate=CommandScreenSession(token:value,dragRegions:boolean.boolValue,labels:labels);session=candidate
        do {
            let content=try await shareable(candidate)
            try assertOwner(candidate);candidate.content=content
            let point=NSEvent.mouseLocation
            guard let screen=NSScreen.screens.first(where:{$0.frame.contains(point)}) ?? NSScreen.main,let id=(screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value,let display=content.displays.first(where:{$0.displayID==id}) else {throw commandScreenError("The active display is unavailable")}
            candidate.activeDisplay=display
            if !candidate.plan.dragRegions {candidate.automatic=try await snapshot(candidate,display:display)}
            try assertOwner(candidate);candidate.phase="ready";if candidate.plan.dragRegions {showPanels(candidate)};status(candidate,"ready");return metadata(candidate)
        }catch {if owns(candidate){status(candidate,"error",error:error.localizedDescription);_ = cancel(token:value)};throw error}
    }
    func finish(_ request:[String:Any]) async throws -> [String:Any] {
        let value=try token(request);guard let candidate=session,candidate.token==value else {throw commandScreenError("Command screen session is no longer active")};guard candidate.phase=="ready" else {throw commandScreenError("Command screen capture is not ready")}
        do {
            let source=try candidate.plan.source();candidate.phase="capturing";candidate.deadline=Date().addingTimeInterval(20);status(candidate,"capturing")
            var images:[[String:Any]]=[]
            if source=="regions" {
                // Refresh while panels exist so their owning application can be excluded, then hide before capture.
                candidate.content=try await shareable(candidate);try assertOwner(candidate);hidePanels(candidate)
                guard let content=candidate.content else {throw commandScreenError("Screen capture content is unavailable")}
                for region in candidate.plan.regions {try assertOwner(candidate);guard let display=content.displays.first(where:{$0.displayID==region.displayID}) else {throw commandScreenError("A selected display is unavailable")};images.append(try await snapshot(candidate,display:display,region:region))}
            } else {hidePanels(candidate);guard let automatic=candidate.automatic else {throw commandScreenError("Automatic screen image is unavailable")};images=[automatic]}
            try assertOwner(candidate);let count=candidate.plan.regions.count;rememberClosed(value);session=nil;candidate.automatic=nil;candidate.content=nil;candidate.activeDisplay=nil;candidate.plan.regions.removeAll()
            return ["token":value,"source":source,"images":images,"regionCount":count]
        }catch {if owns(candidate){status(candidate,"error",error:error.localizedDescription);_ = cancel(token:value)};throw error}
    }
}
func commandScreenSelfTest() -> [String:Any] {
    let frame=CGRect(x:-1600,y:900,width:1600,height:900)
    let rect=commandRegionRect(CGPoint(x:-100,y:1700),CGPoint(x:-1500,y:1000),screen:frame)!
    let region=CommandScreenRegion(displayID:7,screenFrame:frame,rect:rect)
    let source=commandSourceRect(region,logical:CGSize(width:1600,height:900))!
    let clamp=commandRegionRect(CGPoint(x:-2000,y:800),CGPoint(x:100,y:2000),screen:frame)
    let plan=CommandScreenPlan(dragRegions:true);var noFallback=false;do{_ = try plan.source()}catch{noFallback=error.localizedDescription=="Select at least one screen region, or turn off region capture."}
    let added=(0..<5).allSatisfy{_ in plan.add(region)},sixth = !plan.add(region)
    let automatic=CommandScreenPlan(dragRegions:false)
    let labels=try! CommandScreenLabels(["instruction":"日本語 <text>","regionCountPattern":"{count}/{max} 選択 %s"])
    var invalidLabels=0;for value:Any in [["unknown":"x"],["instruction":12],["instruction":"a\nb"],["instruction":String(repeating:"x",count:301)]] {do{_ = try CommandScreenLabels(value)}catch{invalidLabels+=1}}
    let size=commandImageSize(CGSize(width:1400,height:700),scale:2)
    return ["selfTest":"command-screen","negativeOrigin":rect==CGRect(x:-1500,y:1000,width:1400,height:700),"sourceTopLeftPoints":source==CGRect(x:100,y:100,width:1400,height:700),"clamped":clamp==frame,"tinyRejected":commandRegionRect(.zero,CGPoint(x:1,y:1),screen:CGRect(x:0,y:0,width:100,height:100))==nil,"nonfiniteRejected":commandRegionRect(CGPoint(x:CGFloat.nan,y:0),.zero,screen:frame)==nil,"retinaBounded":size==CGSize(width:1536,height:768),"dragZeroNeverFull":noFallback,"fiveRegionLimit":added&&sixth&&plan.regions.count==5,"regionsReplaceAutomatic":(try? plan.source())=="regions","automaticOnlyWhenDisabled":(try? automatic.source())=="display" && !automatic.add(region),"labelsPlain":labels.instruction=="日本語 <text>" && labels.countText(99)=="5/5 選択 %s","labelsValidation":invalidLabels==4,"noWindowCreated":true]
}

@available(macOS 14.0, *) @MainActor func commandScreenRaceSelfTest() async -> [String:Any] {
    var events:[[String:Any]]=[]
    let controller=CommandScreenController(eventSink:{events.append($0)})
    let first=CommandScreenSession(token:"first",dragRegions:true);controller.session=first
    var callback:((Result<String,Error>)->Void)?
    let pending=Task {try await controller.operation(first){callback=$0}}
    while callback==nil {await Task.yield()}
    let staleCancel = !controller.cancel(token:"wrong") && controller.session === first
    let cancelled=controller.cancel(token:"first")
    let second=CommandScreenSession(token:"second",dragRegions:true);controller.session=second
    callback?(.success("private late result"));callback?(.success("duplicate late result"))
    var cancelledPending=false;do{_ = try await pending.value}catch{cancelledPending=error.localizedDescription.contains("cancelled")}
    try? await Task.sleep(nanoseconds:20_000_000)
    let lateSafe=controller.session === second && first.pending.isEmpty && first.automatic==nil
    second.deadline=Date().addingTimeInterval(0.02)
    var timedOut=false;do{let _:String=try await controller.operation(second){_ in}}catch{timedOut=error.localizedDescription.contains("timed out")}
    let timeoutReleased=second.pending.isEmpty
    _ = controller.cancel(token:"second")
    let empty=CommandScreenSession(token:"empty",dragRegions:true);empty.phase="ready";controller.session=empty
    var noFallback=false;do{_ = try await controller.finish(["token":"empty"])}catch{noFallback=error.localizedDescription=="Select at least one screen region, or turn off region capture."}
    let emptyReleased=controller.session==nil && empty.panels.isEmpty && empty.automatic==nil
    let beforeStartCancelled = !controller.cancel(token:"before_start")
    var startBlocked=false;do{_ = try await controller.start(["token":"before_start","dragRegions":true])}catch{startBlocked=error.localizedDescription.contains("already cancelled")}
    let pendingAgain=CommandScreenSession(token:"pending_again",dragRegions:false);controller.session=pendingAgain
    var pendingNotReady=false;do{_ = try await controller.start(["token":"pending_again","dragRegions":false])}catch{pendingNotReady=error.localizedDescription.contains("already starting")}
    _ = controller.cancel(token:"pending_again")
    controller.shutdown()
    var shutdownBlocksStart=false;do{_ = try await controller.start(["token":"after_eof","dragRegions":true])}catch{shutdownBlocksStart=error.localizedDescription.contains("shutting down")}
    var invalid=0;for request:[String:Any] in [["token":"bad token"],["token":1],["token":String(repeating:"x",count:101)]] {do{_ = try controller.cancel(request)}catch{invalid+=1}}
    return ["selfTest":"command-screen-races","staleCancelSafe":staleCancel,"cancelledPending":cancelled&&cancelledPending,"lateDeliverySafe":lateSafe,"timeoutBounded":timedOut&&timeoutReleased,"emptyRegionsReject":noFallback&&emptyReleased,"eventsMetadataOnly":events.allSatisfy{$0["images"]==nil&&$0["data"]==nil},"invalidTokensRejected":invalid==3,"cancelBeforeStartSafe":beforeStartCancelled&&startBlocked,"pendingStartNeverReady":pendingNotReady,"shutdownBlocksLateStart":shutdownBlocksStart,"noWindowCreated":true]
}

final class Bridge: NSObject, SCStreamOutput, SCStreamDelegate {
    let indicator = NativeIndicator()
    let timerPill = NativeTimerPill()
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
    var commandScreenStorage:AnyObject?
    var commandScreenShutdown=false
    @available(macOS 14.0, *) @MainActor func commandScreenController() -> CommandScreenController {
        if let controller=commandScreenStorage as? CommandScreenController{return controller};let controller=CommandScreenController();commandScreenStorage=controller;return controller
    }
    @MainActor func cancelCommandScreen(){commandScreenShutdown=true;if #available(macOS 14.0, *),let controller=commandScreenStorage as? CommandScreenController{controller.shutdown()}}
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
    static func finderSelection<Node>(_ root:Node, equal:(Node,Node)->Bool, children:(Node)->[Node], selectedChildren:(Node)->[Node], isSelected:(Node)->Bool, role:(Node)->String, filePath:(Node)->String?) -> (paths:[String], bounded:Bool) {
        var queue:[(Node,Int)]=[(root,0)], visited:[Node]=[], resolved:[Node]=[], paths:[String]=[], seen=Set<String>(), budget=0
        let decorative:Set<String>=["AXCell","AXText","AXStaticText","AXImage","AXGroup"]
        func resolve(_ selected:Node) -> Bool {
            if resolved.contains(where:{equal($0,selected)}) {return true};resolved.append(selected)
            var candidates:[(Node,Int)]=[(selected,0)], local:[Node]=[]
            while !candidates.isEmpty {
                let (node,depth)=candidates.removeFirst()
                if local.contains(where:{equal($0,node)}) {continue};local.append(node);budget+=1
                if budget>1024 {return false}
                if let path=filePath(node) { if seen.insert(path).inserted {paths.append(path)};return paths.count<=32 }
                if depth<4 {let items=children(node);if items.count>512 {return false};candidates.append(contentsOf:items.filter{decorative.contains(role($0))}.map{($0,depth+1)})}
            }
            return true
        }
        while !queue.isEmpty {
            let (node,depth)=queue.removeFirst()
            if isSelected(node), !resolve(node) {return([],false)}
            let selected=selectedChildren(node);if selected.count>512 {return([],false)}
            for item in selected {if !resolve(item) {return([],false)}}
            if visited.contains(where:{equal($0,node)}) {continue};visited.append(node)
            if visited.count>512 {return([],false)}
            if depth<12 {let items=children(node);if items.count>512 || queue.count+items.count>1024 {return([],false)};queue.append(contentsOf:items.map{($0,depth+1)})}
        }
        return(paths,true)
    }
    static func selectedFilePath(_ value: Any) -> String? {
        let url: URL?
        if let candidate=value as? URL { url=candidate } else if let raw=value as? String, raw.count<=16384 { url=URL(string:raw) } else { return nil }
        guard let url, url.isFileURL, url.host == nil || url.host == "" || url.host == "localhost", url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else { return nil }
        guard let decoded=URLComponents(url:url,resolvingAgainstBaseURL:false)?.percentEncodedPath.removingPercentEncoding, !decoded.contains("\0") else { return nil }
        let path=url.path
        guard path.hasPrefix("/"), path.utf8.count<=4096, !path.contains("\0") else { return nil }
        return path
    }
    func captureCommandContext() -> [String:Any] {
        guard AXIsProcessTrusted(), let app=NSWorkspace.shared.frontmostApplication else { return ["text":"","selectedFiles":[],"available":false] }
        let pid=app.processIdentifier, application=AXUIElementCreateApplication(pid)
        let windowValue=attribute(application,kAXFocusedWindowAttribute as CFString)
        let window:AXUIElement? = windowValue.flatMap { CFGetTypeID($0) == AXUIElementGetTypeID() ? ($0 as! AXUIElement) : nil }
        var text=""
        if let field=focused(), !secure(field) { var owner:Int32=0; if AXUIElementGetPid(field,&owner) == .success, owner == pid { text=String((attribute(field,kAXSelectedTextAttribute as CFString) as? String ?? "").prefix(100000)) } }
        var paths:[String]=[], overflow=false, wrongOwner=false
        if app.bundleIdentifier == "com.apple.finder", let window {
            func owned(_ element:AXUIElement)->Bool { var owner:Int32=0;let valid=AXUIElementGetPid(element,&owner) == .success && owner == pid;if !valid {wrongOwner=true};return valid }
            let result=Self.finderSelection(window,equal:{CFEqual($0,$1)},children:{element in guard owned(element) else {return []};return self.attribute(element,kAXChildrenAttribute as CFString) as? [AXUIElement] ?? []},selectedChildren:{element in guard owned(element) else {return []};return self.attribute(element,kAXSelectedChildrenAttribute as CFString) as? [AXUIElement] ?? []},isSelected:{element in guard owned(element) else {return false};return self.attribute(element,kAXSelectedAttribute as CFString) as? Bool == true},role:{element in self.attribute(element,kAXRoleAttribute as CFString) as? String ?? ""},filePath:{element in guard owned(element), let value=self.attribute(element,kAXURLAttribute as CFString) else {return nil};return Self.selectedFilePath(value)})
            paths=result.paths;overflow = !result.bounded || wrongOwner
        }
        guard let current=NSWorkspace.shared.frontmostApplication, current.processIdentifier == pid, current.launchDate == app.launchDate else { return ["text":"","selectedFiles":[],"available":false] }
        if let window { guard let currentWindow=attribute(application,kAXFocusedWindowAttribute as CFString), CFEqual(window,currentWindow) else { return ["text":"","selectedFiles":[],"available":false] } }
        return ["pid":pid,"bundleId":app.bundleIdentifier ?? "","text":text,"selectedFiles":overflow ? []:paths,"available":!overflow]
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
            case "commandScreenStart": guard !commandScreenShutdown else {throw commandScreenError("Screen capture is shutting down")};guard #available(macOS 14.0, *) else {throw commandScreenError("Command screen capture requires macOS 14 or later")};result = try await commandScreenController().start(request)
            case "commandScreenFinish": guard !commandScreenShutdown else {throw commandScreenError("Screen capture is shutting down")};guard #available(macOS 14.0, *) else {throw commandScreenError("Command screen capture requires macOS 14 or later")};result = try await commandScreenController().finish(request)
            case "commandScreenCancel": guard #available(macOS 14.0, *) else {throw commandScreenError("Command screen capture requires macOS 14 or later")};result = try commandScreenController().cancel(request)
            case "indicatorConfigure": result = try indicator.configure(request)
            case "timerPillSync": timerPill.indicatorFrame = { [weak self] in guard let self,let frame=self.indicator.metadata()["frame"] as? [String:CGFloat],self.indicator.visible else{return nil};return NSRect(x:frame["x"] ?? 0,y:frame["y"] ?? 0,width:frame["width"] ?? 0,height:frame["height"] ?? 0) }; result = try timerPill.sync(request)
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
            case "captureCommandContext": result = captureCommandContext()
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
if CommandLine.arguments.contains("--timer-pill-self-test") {emit(timerPillSelfTest());exit(0)}
if CommandLine.arguments.contains("--clipboard-history-self-test") {
    let transient=NSPasteboard.PasteboardType("org.nspasteboard.TransientType")
    let privateItem=pasteboardInsertionItem("Private",html:"<b>Private</b>",allowClipboardHistory:false), publicItem=pasteboardInsertionItem("Public",html:nil,allowClipboardHistory:true)
    var invalid=false;do{_ = try requestedClipboardHistory(["allowClipboardHistory":1])}catch{invalid=true}
    emit(["selfTest":"clipboard-history","privateTagged":privateItem.types.contains(transient),"publicUntagged":!publicItem.types.contains(transient),"plainRichPreserved":privateItem.string(forType:.string)=="Private" && privateItem.string(forType:.html)=="<b>Private</b>","invalidRejected":invalid,"legacyDefault":(try? requestedClipboardHistory([:])) ?? false,"originalTypesRestored":clipboardSelfTest()]);exit(0)
}
if CommandLine.arguments.contains("--command-screen-race-self-test") {
    if #available(macOS 14.0, *) {Task { @MainActor in emit(await commandScreenRaceSelfTest());exit(0)};RunLoop.main.run()}else{emit(["unsupported":true]);exit(0)}
}
if CommandLine.arguments.contains("--command-screen-self-test") {emit(commandScreenSelfTest());exit(0)}
if CommandLine.arguments.contains("--notch-controls-self-test") { emit(notchControlSelfTest()); exit(0) }
if CommandLine.arguments.contains("--notch-indicator-self-test") { emit(notchIndicatorSelfTest()); exit(0) }
if CommandLine.arguments.contains("--finder-selection-self-test") {
    func run(_ kids:[Int:[Int]],_ selected:[Int:[Int]],_ urls:[Int:String],_ roles:[Int:String]=[:])->(paths:[String],bounded:Bool) {Bridge.finderSelection(0,equal:{$0==$1},children:{kids[$0] ?? []},selectedChildren:{selected[$0] ?? []},isSelected:{_ in false},role:{roles[$0] ?? "AXRow"},filePath:{urls[$0]})}
    let folder=run([0:[1],1:[2]],[0:[1]],[1:"/folder",2:"/unselected"])
    let decorative=run([0:[1],1:[2],2:[3]],[0:[1]],[3:"/decorated"],[2:"AXCell",3:"AXStaticText"])
    let unselectedFirst=run([0:[1,2]],[2:[1]],[1:"/later-selected"])
    let order=run([0:[1,2]],[0:[2,1]],[1:"/one",2:"/two"])
    let overflow=run([0:Array(1...33)],[0:Array(1...33)],Dictionary(uniqueKeysWithValues:(1...33).map{($0,"/file\($0)")}))
    let blocked=run([0:[1],1:[2]],[0:[1]],[2:"/unselected-child"])
    emit(["expandedFolder":folder.paths == ["/folder"],"decorativeURL":decorative.paths == ["/decorated"],"visitedThenSelected":unselectedFirst.paths == ["/later-selected"],"order":order.paths == ["/two","/one"],"overflowAtomic":!overflow.bounded && overflow.paths.isEmpty,"unselectedRowExcluded":blocked.paths.isEmpty]);exit(0)
}
if CommandLine.arguments.contains("--finder-path-self-test") { emit(["local":Bridge.selectedFilePath("file:///tmp/one%20two.pdf") ?? "","remoteRejected":Bridge.selectedFilePath("file://remote/tmp/file") == nil,"webRejected":Bridge.selectedFilePath("https://example.test/file") == nil,"nulRejected":Bridge.selectedFilePath("file:///tmp/a%00b") == nil,"bounded":Bridge.selectedFilePath("file:///"+String(repeating:"x",count:4097)) == nil]);exit(0) }
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
DispatchQueue.global().async { while let line = readLine() { guard let data = line.data(using:.utf8), let object = try? JSONSerialization.jsonObject(with:data) as? [String:Any] else { emit(["ok":false,"error":"Invalid JSON"]); continue }; DispatchQueue.main.async { Task { await bridge.command(object) } } }; DispatchQueue.main.async { Task { bridge.cancelCommandScreen(); bridge.timerPill.shutdown(); bridge.indicator.hide(); _ = try? await bridge.stopSystemCapture(); exit(0) } } }
nativeApplication.run()
