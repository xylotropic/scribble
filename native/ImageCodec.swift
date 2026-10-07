import Foundation
import CoreGraphics
import ImageIO
import Darwin
// File-only codec. No screen, application, clipboard, or permission APIs.
func fail(_ message: String) -> Never { FileHandle.standardError.write(Data((message + "\n").utf8)); exit(1) }
func readImageInput(_ path: String) -> Data {
 let descriptor=open(path,O_RDONLY | O_NOFOLLOW)
 guard descriptor>=0 else {fail("Cannot open regular image input")};defer{_ = Darwin.close(descriptor)}
 var before=stat();guard fstat(descriptor,&before)==0,(before.st_mode & mode_t(S_IFMT))==mode_t(S_IFREG),before.st_size>=0,before.st_size<=128*1024*1024 else {fail("Image input must be a regular file at most128MiB")}
 var data=Data(),buffer=[UInt8](repeating:0,count:65536)
 while true {let count=Darwin.read(descriptor,&buffer,buffer.count);if count<0 && errno==EINTR {continue};guard count>=0 else {fail("Cannot read image input")};if count==0 {break};guard data.count+count<=128*1024*1024 else {fail("Image input grew beyond128MiB")};data.append(contentsOf:buffer.prefix(count))}
 var after=stat();guard fstat(descriptor,&after)==0,after.st_size==before.st_size,data.count==Int(before.st_size),after.st_mtimespec.tv_sec==before.st_mtimespec.tv_sec,after.st_mtimespec.tv_nsec==before.st_mtimespec.tv_nsec,after.st_ctimespec.tv_sec==before.st_ctimespec.tv_sec,after.st_ctimespec.tv_nsec==before.st_ctimespec.tv_nsec else {fail("Image input changed while reading")}
 return data
}
let args = CommandLine.arguments
 guard args.count == 5, ["png", "heic"].contains(args[3]), let quality = Double(args[4]), quality.isFinite, quality >= 1, quality <= 100 else { fail("Usage: image-codec input output png|heic quality1..100") }
guard args[1].hasPrefix("/"), args[2].hasPrefix("/"), args[1].utf8.count <= 4096, args[2].utf8.count <= 4096, !args[1].contains("\0"), !args[2].contains("\0") else { fail("Choose bounded absolute file paths") }
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
guard args[1].hasPrefix("/"), args[2].hasPrefix("/"), input.standardizedFileURL != output.standardizedFileURL else { fail("Choose distinct absolute input and output paths") }
do {
 let values = try input.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey,.fileSizeKey])
 guard values.isRegularFile == true, values.isSymbolicLink != true, let size=values.fileSize, size <= 128*1024*1024 else { fail("Image input must be a regular file at most128MiB") }
 guard !FileManager.default.fileExists(atPath:output.path) else { fail("Image output already exists") }
 guard let source=CGImageSourceCreateWithData(readImageInput(input.path) as CFData,[kCGImageSourceShouldCache:false] as CFDictionary), CGImageSourceGetCount(source)==1, let properties=CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any], let width=properties[kCGImagePropertyPixelWidth] as? Int, let height=properties[kCGImagePropertyPixelHeight] as? Int, width>0,height>0,width <= 10000,height <= 10000,width*height <= 64*1024*1024 else { fail("Unsupported image or image dimensions exceed limits; native codec accepts one frame") }
 let inputType=CGImageSourceGetType(source) as String? ?? ""
 if ["heic","heif"].contains(input.pathExtension.lowercased()) && inputType != "public.heic" { fail("HEIC/HEIF input must contain genuine HEVC HEIC image data") }
 guard let image=CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:max(width,height),kCGImageSourceCreateThumbnailWithTransform:true] as CFDictionary) else { fail("ImageIO cannot decode this image") }
 let type=args[3]=="heic" ? "public.heic" : "public.png"
 guard (CGImageDestinationCopyTypeIdentifiers() as! [String]).contains(type) else { fail("ImageIO encoder unavailable for " + type) }
 let encoded=NSMutableData()
 guard let destination=CGImageDestinationCreateWithData(encoded,type as CFString,1,nil) else { fail("Cannot create image destination") }
 CGImageDestinationAddImage(destination,image,[kCGImageDestinationLossyCompressionQuality:quality/100] as CFDictionary)
 guard CGImageDestinationFinalize(destination), let verification=CGImageSourceCreateWithData(encoded,nil),CGImageSourceGetType(verification) as String? == type, let decoded=CGImageSourceCreateImageAtIndex(verification,0,nil),decoded.width==image.width,decoded.height==image.height else { fail("Encoded image failed type/dimension verification for " + output.path) }
 guard encoded.length <= 128*1024*1024 else { fail("Encoded image exceeds128MiB output limit") }
 let descriptor = open(output.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, mode_t(0o600))
 guard descriptor >= 0 else { fail("Cannot exclusively create output: " + String(cString:strerror(errno))) }
 var owned=stat(); _ = fstat(descriptor,&owned)
 var offset=0; var failed=false
 let bytes=encoded.bytes
 while offset < encoded.length { let count=Darwin.write(descriptor,bytes.advanced(by:offset),encoded.length-offset);if count<0 && errno==EINTR {continue};if count<=0 {failed=true;break};offset += count }
 if Darwin.close(descriptor) != 0 { failed=true }
 if failed { var current=stat(); if lstat(output.path,&current)==0 && current.st_dev==owned.st_dev && current.st_ino==owned.st_ino { _=unlink(output.path) };fail("Cannot complete image output") }
 print("{\"format\":\""+args[3]+"\",\"width\":"+String(decoded.width)+",\"height\":"+String(decoded.height)+"}")
} catch { fail(error.localizedDescription) }
