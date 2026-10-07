import Foundation
import FluidAudio
struct Segment: Codable {let start: Double; let end: Double; let text: String}
struct Output: Codable {let text: String; let segments: [Segment]; let language: String; let duration: Double}
@main struct ScribbleParakeet {
 static func main() async {
  do {
   let args=CommandLine.arguments
   guard args.count >= 5 else {throw NSError(domain:"Scribble",code:1,userInfo:[NSLocalizedDescriptionKey:"Usage: ScribbleParakeet modelsDirectory v2|v3 audioPath outputJSON [language]"])}
   let version: AsrModelVersion=args[2] == "v2" ? .v2 : .v3
   let models=try AsrModels.loadLocal(from:URL(fileURLWithPath:args[1]),version:version)
   let manager=AsrManager(config:ASRConfig(tdtConfig:TdtConfig(blankId:version.blankId),encoderHiddenSize:version.encoderHiddenSize))
   try await manager.loadModels(models)
   var decoderState=TdtDecoderState.make(decoderLayers:await manager.decoderLayerCount)
   let hint=args.count>5 ? Language(rawValue:args[5]) : nil
   let result=try await manager.transcribe(URL(fileURLWithPath:args[3]),decoderState:&decoderState,language:hint)
   let words=buildWordTimings(from:result.tokenTimings ?? [])
   var segments=[Segment]();var current=[WordTiming]()
   for word in words {current.append(word);if current.count>=14 || word.word.hasSuffix(".") || word.word.hasSuffix("?") || word.word.hasSuffix("!"){segments.append(Segment(start:current.first!.startTime,end:current.last!.endTime,text:current.map(\.word).joined(separator:" ")));current=[]}}
   if !current.isEmpty{segments.append(Segment(start:current.first!.startTime,end:current.last!.endTime,text:current.map(\.word).joined(separator:" ")))}
   if segments.isEmpty && !result.text.isEmpty{segments=[Segment(start:0,end:result.duration,text:result.text)]}
   let language=args[2]=="v2" ? "en" : (args.count>5 && args[5] != "auto" ? args[5] : "unknown")
   let output=Output(text:result.text,segments:segments,language:language,duration:result.duration)
   try JSONEncoder().encode(output).write(to:URL(fileURLWithPath:args[4]),options:.atomic)
  } catch {FileHandle.standardError.write(Data("\(error)\n".utf8));exit(1)}
 }
}
