import Foundation
import FluidAudio
import AVFoundation
@preconcurrency import CoreML
struct Segment:Codable {let start:Double;let end:Double;let text:String}
struct Output:Codable {let text:String;let segments:[Segment];let language:String;let duration:Double}
func grouped(_ timings:[TokenTiming],text:String,duration:Double,language:String)->Output{
 let words=buildWordTimings(from:timings);var segments=[Segment]();var current=[WordTiming]()
 for word in words{current.append(word);if current.count>=14||word.word.hasSuffix(".")||word.word.hasSuffix("。")||word.word.hasSuffix("!")||word.word.hasSuffix("?"){segments.append(Segment(start:min(duration,current.first!.startTime),end:min(duration,current.last!.endTime),text:current.map(\.word).joined(separator:language=="ja"||language=="zh" ? "":" ")));current=[]}}
 if !current.isEmpty{segments.append(Segment(start:min(duration,current.first!.startTime),end:min(duration,current.last!.endTime),text:current.map(\.word).joined(separator:language=="ja"||language=="zh" ? "":" ")))}
 if segments.isEmpty && !text.isEmpty{segments=[Segment(start:0,end:duration,text:text)]}
 return Output(text:text,segments:segments,language:language,duration:duration)
}
func audioBuffer(_ samples:[Float])->AVAudioPCMBuffer{let format=AVAudioFormat(standardFormatWithSampleRate:16000,channels:1)!;let buffer=AVAudioPCMBuffer(pcmFormat:format,frameCapacity:AVAudioFrameCount(samples.count))!;buffer.frameLength=AVAudioFrameCount(samples.count);samples.withUnsafeBufferPointer{buffer.floatChannelData![0].update(from:$0.baseAddress!,count:samples.count)};return buffer}
func mandarin(_ samples:[Float],directory:URL)throws->Output{
 let cpu=MLModelConfiguration();cpu.computeUnits = .cpuOnly
 let ane=MLModelConfiguration();ane.computeUnits = .cpuAndNeuralEngine
 let pre=try MLModel(contentsOf:directory.appendingPathComponent("Preprocessor.mlmodelc"),configuration:cpu)
 let encoder=try MLModel(contentsOf:directory.appendingPathComponent("Encoder-v2-int8.mlmodelc"),configuration:ane)
 let decoder=try MLModel(contentsOf:directory.appendingPathComponent("Decoder.mlmodelc"),configuration:ane)
 let vocab=try JSONDecoder().decode([String].self,from:Data(contentsOf:directory.appendingPathComponent("vocab.json")))
 let blank=vocab.count;let stride=240000;let hop=208000;var segments=[Segment]();var allText=[String]()
 for offset in Swift.stride(from:0,to:samples.count,by:hop){
  let count=min(stride,samples.count-offset);let signal=try MLMultiArray(shape:[1,NSNumber(value:stride)],dataType:.float32);let ptr=signal.dataPointer.assumingMemoryBound(to:Float.self);ptr.initialize(repeating:0,count:stride);for i in 0..<count{ptr[i]=samples[offset+i]}
  let length=try MLMultiArray(shape:[1],dataType:.int32);length[0]=NSNumber(value:count)
  let prepared=try pre.prediction(from:MLDictionaryFeatureProvider(dictionary:["audio_signal":signal,"audio_length":length]))
  guard let mel=prepared.featureValue(for:"mel")?.multiArrayValue,let melLength=prepared.featureValue(for:"mel_length")?.multiArrayValue else{throw NSError(domain:"Scribble",code:2,userInfo:[NSLocalizedDescriptionKey:"Mandarin preprocessor did not return required arrays"])}
  let encoded=try encoder.prediction(from:MLDictionaryFeatureProvider(dictionary:["audio_signal":mel,"length":melLength]))
  guard let features=encoded.featureValue(for:"encoder_output")?.multiArrayValue,let encodedLength=encoded.featureValue(for:"encoded_length")?.multiArrayValue else{throw NSError(domain:"Scribble",code:2)}
  let decoded=try decoder.prediction(from:MLDictionaryFeatureProvider(dictionary:["encoder_output":features]))
  guard let logits=decoded.featureValue(for:"ctc_logits")?.multiArrayValue else{throw NSError(domain:"Scribble",code:2)}
  let frames=min(logits.shape[1].intValue,encodedLength[0].intValue),classes=logits.shape[2].intValue;let frameStride=logits.strides[1].intValue,tokenStride=logits.strides[2].intValue
  func value(_ i:Int)->Float{switch logits.dataType{case .float32:return logits.dataPointer.assumingMemoryBound(to:Float.self)[i];case .double:return Float(logits.dataPointer.assumingMemoryBound(to:Double.self)[i]);case .float16:return Float(Float16(bitPattern:logits.dataPointer.assumingMemoryBound(to:UInt16.self)[i]));default:return logits[i].floatValue}}
  let finalWindow=offset+count>=samples.count
  let segmentStart=Double(offset==0 ? 0:offset+16000)/16000
  let segmentEnd=Double(finalWindow ? offset+count:offset+count-16000)/16000
  var last=blank;var pieces=[String]()
  for frame in 0..<frames{var best=0,bestValue = -Float.infinity;for token in 0..<classes{let score=value(frame*frameStride+token*tokenStride);if score>bestValue{bestValue=score;best=token}};let time=Double(offset)/16000+Double(frame)*0.08;if best != blank && best != last && best<vocab.count && time>=segmentStart && time<segmentEnd{pieces.append(vocab[best])};last=best}
  let decodedText=pieces.joined().replacingOccurrences(of:"▁",with:" ").trimmingCharacters(in:.whitespacesAndNewlines)
  let text=decodedText.replacingOccurrences(of:"(?<=[\\p{Han}，。！？、])\\s+(?=[\\p{Han}，。！？、])",with:"",options:.regularExpression)
  if !text.isEmpty{allText.append(text);segments.append(Segment(start:segmentStart,end:segmentEnd,text:text))}
  if finalWindow{break}
 }
 return Output(text:allText.joined(),segments:segments,language:"zh",duration:Double(samples.count)/16000)
}
@main struct ScribbleCatalog{
 static func main() async{
  do{
   let args=CommandLine.arguments;guard args.count>=5 else{throw NSError(domain:"Scribble",code:1,userInfo:[NSLocalizedDescriptionKey:"Usage: ScribbleCatalog directory modelID audio output [language]"])}
   let directory=URL(fileURLWithPath:args[1]),id=args[2],hint=args.count>5 ? args[5]:"auto"
   let samples=try AudioConverter().resampleAudioFile(URL(fileURLWithPath:args[3]));let duration=Double(samples.count)/16000;let output:Output
   switch id{
   case "parakeet-ja":
    let version:AsrModelVersion = .tdtJa;let models=try AsrModels.loadLocal(from:directory,version:version)
    let manager=AsrManager(config:ASRConfig(tdtConfig:TdtConfig(blankId:version.blankId),encoderHiddenSize:version.encoderHiddenSize));try await manager.loadModels(models)
    var state=TdtDecoderState.make(decoderLayers:await manager.decoderLayerCount);let result=try await manager.transcribe(samples,decoderState:&state)
    output=grouped(result.tokenTimings ?? [],text:result.text,duration:duration,language:"ja")
   case "parakeet-zh":output=try mandarin(samples,directory:directory)
   case "nemotron-en":
    let manager=StreamingNemotronAsrManager();try await manager.loadModels(from:directory)
    for offset in Swift.stride(from:0,to:samples.count,by:16000){_ = try await manager.process(audioBuffer:audioBuffer(Array(samples[offset..<min(offset+16000,samples.count)])))}
    let result=try await manager.finishWithTokenTimings();output=grouped(result.timings,text:result.text,duration:duration,language:"en")
   case "nemotron-multilingual":
    let manager=StreamingNemotronMultilingualAsrManager();try await manager.loadModels(from:directory);let regions=["zh":"zh-CN","ja":"ja-JP","en":"en-US","es":"es-ES","fr":"fr-FR","de":"de-DE","it":"it-IT","pt":"pt-BR"]
    await manager.setLanguage(hint=="auto" ? nil:(regions[hint] ?? hint))
    for offset in Swift.stride(from:0,to:samples.count,by:16000){_ = try await manager.process(samples:Array(samples[offset..<min(offset+16000,samples.count)]))}
    let result=try await manager.finishWithTokenTimings();let detected=await manager.detectedLanguage();output=grouped(result.timings,text:result.text,duration:duration,language:detected ?? (hint=="auto" ? "unknown":hint))
   default:throw NSError(domain:"Scribble",code:1,userInfo:[NSLocalizedDescriptionKey:"Unknown catalog model"])
   }
   try JSONEncoder().encode(output).write(to:URL(fileURLWithPath:args[4]),options:.atomic)
  }catch{FileHandle.standardError.write(Data("\(error)\n".utf8));exit(1)}
 }
}
