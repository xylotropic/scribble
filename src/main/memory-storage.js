'use strict';
const fs=require('node:fs/promises'),constants=require('node:fs').constants,path=require('node:path'),crypto=require('node:crypto');
const {MAX_BYTES,SUPPORTED_EXTENSIONS}=require('./memory-index');
async function storageDirectory(dataDir) {
 const directory=path.join(path.resolve(dataDir),'memory-files');await fs.mkdir(directory,{recursive:true,mode:0o700});
 const stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Memory storage must be a private regular directory');return directory;
}
async function copyMemoryFile(source,dataDir,{signal}={}) {
 if(typeof source!=='string'||!path.isAbsolute(source)||!SUPPORTED_EXTENSIONS.includes(path.extname(source).toLowerCase()))throw Error('Unsupported memory file');
 const canceled=()=>{if(signal?.aborted)throw signal.reason||new DOMException('Memory import canceled','AbortError');};canceled();
 const input=await fs.open(source,constants.O_RDONLY|constants.O_NOFOLLOW);let output,destination;
 try {
  const stat=await input.stat();if(!stat.isFile()||stat.size>MAX_BYTES)throw Error('Memory file must be regular and at most 8 MiB');
  const directory=await storageDirectory(dataDir);destination=path.join(directory,crypto.randomUUID()+path.extname(source).toLowerCase());
  output=await fs.open(destination,'wx',0o600);let total=0;const buffer=Buffer.alloc(65536);
  while(true){canceled();const {bytesRead}=await input.read(buffer,0,buffer.length,null);if(!bytesRead)break;total+=bytesRead;if(total>MAX_BYTES)throw Error('Memory file exceeds 8 MiB');await output.writeFile(buffer.subarray(0,bytesRead));}
  canceled();await output.close();output=null;
  return {filePath:destination,managedFile:true,originalFileName:path.basename(source)};
 } catch(error){if(output)await output.close();if(destination)await fs.unlink(destination).catch(()=>{});throw error;}
 finally {await input.close();}
}
async function deleteMemoryFile(item,dataDir) {
 if(item?.managedFile!==true||typeof item.filePath!=='string')return false;
 const directory=path.join(path.resolve(dataDir),'memory-files'),file=path.resolve(item.filePath);
 if(path.dirname(file)!==directory||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}\.[a-z]+$/.test(path.basename(file)))return false;
 try {const parent=await fs.lstat(directory),stat=await fs.lstat(file);if(parent.isSymbolicLink()||!parent.isDirectory()||!stat.isFile()||stat.isSymbolicLink())return false;await fs.unlink(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}
}
module.exports={copyMemoryFile,deleteMemoryFile};
