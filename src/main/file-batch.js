"use strict";
const fs = require('node:fs/promises'), path = require('node:path');
const INPUT_FORMATS = {
  'image-convert':['png','jpg','jpeg','webp','avif','gif','tif','tiff','heic','heif','jfif'],
  'image-compress':['png','jpg','jpeg','webp','avif','gif','tif','tiff','heic','heif','jfif'],
  'image-palette':['png','jpg','jpeg','webp','avif','gif','tif','tiff','heic','heif','jfif'],
  'audio-convert':['mp3','wav','aac','flac','ogg','m4a','wma','opus','mp4','avi','mov','mkv','webm','flv','wmv'],
  'video-convert':['mp4','avi','mov','mkv','webm','flv','wmv'],
  'config-convert':['json','yaml','yml','toml','xml'],
  'text-markdown':['txt','md','markdown'], 'markdown-pdf':['md','markdown'],
  'archive-extract':['zip'], 'pdf-merge':['pdf'],
};
const OUTPUT_FORMATS = {
  'image-convert':['jpg','png','webp','avif','gif','tiff','heic','heif','jfif'],
  'audio-convert':['mp3','wav','aac','flac','ogg','m4a','wma','opus'],
  'video-convert':['mp4','avi','mov','mkv','webm','flv','wmv'],
  'config-convert':['json','yaml','toml','xml'],
};
const SOURCE_BYTES = {'image-convert':128*1024**2,'image-compress':128*1024**2,'image-palette':128*1024**2,'config-convert':16*1024**2,'text-markdown':16*1024**2,'markdown-pdf':16*1024**2,'archive-extract':512*1024**2};
const DEFAULTS = {'image-convert':'webp','audio-convert':'mp3','video-convert':'mp4','config-convert':'json','image-palette':'json','text-markdown':'md','markdown-pdf':'pdf'};
const normalize = value => value.toLowerCase().replace(/^jpeg$/,'jpg').replace(/^tif$/,'tiff').replace(/^yml$/,'yaml');
const fold = value => value.normalize('NFC').toLowerCase();
function isBatch(operation) { return Object.hasOwn(DEFAULTS,operation) || ['image-compress','archive-extract'].includes(operation); }
function identity(stat) { return {dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs}; }
function same(stat,expected) { return stat.isFile() && !stat.isSymbolicLink() && ['dev','ino','size','mtimeMs','ctimeMs'].every(key=>stat[key]===expected[key]); }
function outputExtension(operation,options,input) {
  if (operation === 'image-compress') {
    const format = normalize(path.extname(input).slice(1));
    if (options.format && normalize(String(options.format)) !== format) throw Error('Image compression must preserve the source format');
    return path.extname(input).slice(1);
  }
  if (operation === 'archive-extract') return '';
  const format = options.format === undefined ? DEFAULTS[operation] : normalize(String(options.format));
  if (OUTPUT_FORMATS[operation] && !OUTPUT_FORMATS[operation].includes(format)) throw Error('Unsupported batch output format');
  if (!/^[a-z0-9]+$/.test(format)) throw Error('Invalid batch output extension');
  return format;
}
async function absent(output) {
  const parent=path.dirname(output), target=fold(path.basename(output));
  const directory=await fs.opendir(parent);let count=0;
  for await (const entry of directory) {
    if (++count > 100000) throw Error('Output directory contains more than 100,000 entries; choose a smaller directory');
    if (fold(entry.name)===target) throw Error('Output already exists (including a case-equivalent name): '+output);
  }
}
async function preflight({operation,files,options={},expected=null}) {
  if(!isBatch(operation)) throw Error('This operation requires a combined output');
  if(!Array.isArray(files)||!files.length||files.length>32) throw Error('Choose between one and 32 input files');
  if(expected && (!Array.isArray(expected)||expected.length!==files.length)) throw Error('Invalid captured input identity list');
  const items=[],inputNames=new Set(),inputNodes=new Set(),outputNames=new Set();
  for(let index=0;index<files.length;index++) {
    const input=files[index];
    if(typeof input!=='string'||!path.isAbsolute(input)||input.includes('\0')||input.length>4096) throw Error('Input paths must be bounded absolute paths');
    const stat=await fs.lstat(input);
    if(!stat.isFile()||stat.isSymbolicLink()) throw Error('Batch inputs must be regular files');
    if(SOURCE_BYTES[operation] && stat.size > SOURCE_BYTES[operation]) throw Error('Input exceeds the '+(SOURCE_BYTES[operation]/1024**2)+' MiB '+operation+' limit: '+input);
    if(expected && (expected[index].path!==input||!same(stat,expected[index]))) throw Error('Selected file changed after command activation');
    const extension=path.extname(input).slice(1).toLowerCase();
    if(!INPUT_FORMATS[operation]?.includes(extension)) throw Error('Selected file format is unsupported for this operation');
    if(operation==='config-convert' && options.from && normalize(extension)!==normalize(String(options.from))) throw Error('Selected config file does not match the requested source format');
    const parent=path.dirname(input),parentStat=await fs.lstat(parent);
    if(!parentStat.isDirectory()||parentStat.isSymbolicLink()) throw Error('Output parents must be regular directories');
    const canonicalParent=await fs.realpath(parent),canonicalInput=await fs.realpath(input),inputKey=fold(canonicalInput),nodeKey=stat.dev+':'+stat.ino;
    if(inputNames.has(inputKey)||inputNodes.has(nodeKey)) throw Error('Duplicate or case-equivalent input files');
    inputNames.add(inputKey);inputNodes.add(nodeKey);
    const format=outputExtension(operation,options,input),stem=path.basename(input,path.extname(input));
    let basename=operation==='archive-extract'?stem:stem+(operation==='image-compress'?'-compressed':'')+'.'+format;
    if(fold(basename)===fold(path.basename(input))) basename=stem+'-converted.'+format;
    const output=path.join(parent,basename),outputKey=fold(path.join(canonicalParent,basename));
    if(output.length>4096||outputNames.has(outputKey)) throw Error('Batch output names collide');
    outputNames.add(outputKey);items.push({input,output,outputKey,identity:identity(stat),parent,canonicalParent,parentIdentity:{dev:parentStat.dev,ino:parentStat.ino}});
  }
  for(const item of items) {
    if(inputNames.has(item.outputKey)) throw Error('Batch output would replace an input');
    await absent(item.output);
  }
  // Recheck every source after output scanning so no item starts with stale identity.
  for(const item of items) if(!same(await fs.lstat(item.input),item.identity)) throw Error('Selected file changed after command activation');
  return {operation,options:{...options,overwrite:false},items};
}
async function verify(item) {
  if(!same(await fs.lstat(item.input),item.identity)) throw Error('Selected file changed after command activation');
  const parent=await fs.lstat(item.parent);
  if(!parent.isDirectory()||parent.isSymbolicLink()||parent.dev!==item.parentIdentity.dev||parent.ino!==item.parentIdentity.ino||await fs.realpath(item.parent)!==item.canonicalParent) throw Error('Output parent changed after preflight');
  await absent(item.output);
}
async function execute(plan,{perform,signal}={}) {
  perform ||= require('./utilities').performUtility;
  if (!signal?.aborted) for (const item of plan.items) await verify(item);
  const items=[];let failure=null,cancelled=false;
  for(let index=0;index<plan.items.length;index++) {
    const item=plan.items[index];
    if(signal?.aborted) {cancelled=true;for(const rest of plan.items.slice(index))items.push({input:rest.input,output:rest.output,status:'skipped',reason:'Cancelled before processing'});break;}
    try {
      await verify(item);
      if(signal?.aborted) {cancelled=true;for(const rest of plan.items.slice(index))items.push({input:rest.input,output:rest.output,status:'skipped',reason:'Cancelled before processing'});break;}
      const result=await perform({operation:plan.operation,files:[item.input],output:item.output,options:plan.options});
      if(result?.output!==item.output) throw Error('Utility did not confirm the planned output');
      const written=await fs.lstat(item.output);
      if(written.isSymbolicLink() || (plan.operation==='archive-extract' ? !written.isDirectory() : !written.isFile())) throw Error('Utility did not produce the expected regular output');
      items.push({input:item.input,output:item.output,status:'completed',details:result.details || {}});
    } catch(error) {
      failure=String(error.message||error).slice(0,2000);items.push({input:item.input,output:item.output,status:'failed',error:failure});
      for(const rest of plan.items.slice(index+1))items.push({input:rest.input,output:rest.output,status:'skipped',reason:'Not processed after failure'});break;
    }
  }
  const outputs=items.filter(item=>item.status==='completed').map(item=>item.output);
  if(signal?.aborted)cancelled=true;
  const summary=cancelled?'Batch cancelled':failure?'Batch stopped after a failure':'Batch completed';
  const lines = items.map(item => item.status==='completed' ? item.output+(item.details.notice ? '\nNotice: '+String(item.details.notice).slice(0,2000) : '') : (item.status==='failed'?'Failed: ':'Skipped: ')+item.input+' — '+(item.error || item.reason));
  const text=summary+'. '+outputs.length+' of '+plan.items.length+' outputs saved.'+(lines.length?'\n'+lines.join('\n'):'');
  return {kind:'file',text,outputs,items,details:{operation:plan.operation,total:plan.items.length,completed:outputs.length,failed:!!failure,cancelled}};
}
module.exports={INPUT_FORMATS,isBatch,outputExtension,preflight,execute};
