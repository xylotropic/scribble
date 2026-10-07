'use strict';
const AdmZip = require('adm-zip');
const {inflateRawSync,crc32} = require('node:zlib');
const MAX_BYTES=8*1024*1024, MAX_CHARS=500000, MAX_ENTRIES=512, MAX_EXPANDED=32*1024*1024;
const WORD=new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
const CONTENT='http://schemas.openxmlformats.org/package/2006/content-types';
function invalid(message){throw Error('Invalid DOCX: '+message);}
function entities(text){
 return text.replace(/&([^;]*);|&/g,(all,value)=>{
  if(value===undefined)invalid('malformed XML entity');
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.hasOwn(named,value))return named[value];
  if(!/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(value))invalid('unsupported XML entity');
  const n=value[1].toLowerCase()==='x'?parseInt(value.slice(2),16):Number(value.slice(1));
  if(!Number.isInteger(n)||!(n===9||n===10||n===13||(n>=32&&n<=0xd7ff)||(n>=0xe000&&n<=0xfffd)||(n>=0x10000&&n<=0x10ffff)))invalid('invalid XML character');
  return String.fromCodePoint(n);
 });
}
// Bounded XML recognizer for DOCX text, not a general XML renderer. DTDs and custom entities are unsupported.
function xmlEvents(buffer,onOpen,onText,onClose){
 const xml=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))invalid('DTD or control characters are unsupported');
 const stack=[];let offset=0,count=0,roots=0;
 const tokens=/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>|[^<]+/g;
 for(const match of xml.matchAll(tokens)){
  if(match.index!==offset)invalid('malformed XML');offset+=match[0].length;if(++count>200000)invalid('too many XML tokens');const token=match[0];
  if(token.startsWith('<!--')||token.startsWith('<?'))continue;
  if(token.startsWith('<![CDATA[')){if(!stack.length)invalid('text outside root');onText(token.slice(9,-3),stack);continue;}
  if(!token.startsWith('<')){const text=entities(token);if(!stack.length&&text.trim())invalid('text outside root');onText(text,stack);continue;}
  if(token.startsWith('</')){const name=token.slice(2,-1).trim();const node=stack.pop();if(!node||name!==node.name)invalid('mismatched XML tags');onClose(node,stack);continue;}
  const tag=/^<([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)>$/.exec(token);if(!tag)invalid('unsupported XML markup');
  const attrs=Object.create(null);let rest=tag[2],attributes=0;while(rest.trim()){
   const attr=/^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(rest);if(!attr||++attributes>64||Object.hasOwn(attrs,attr[1]))invalid('malformed XML attributes');attrs[attr[1]]=entities(attr[2]??attr[3]);rest=rest.slice(attr[0].length);
  }
  const ns={...(stack.at(-1)?.ns||{})};for(const [key,value]of Object.entries(attrs)){if(key==='xmlns')ns['']=value;else if(key.startsWith('xmlns:'))ns[key.slice(6)]=value;}
  const parts=tag[1].split(':');if(parts.length>2)invalid('invalid XML namespace');const prefix=parts.length===2?parts[0]:'';if(prefix&&!Object.hasOwn(ns,prefix))invalid('unbound XML namespace');
  const node={name:tag[1],local:parts.at(-1),uri:ns[prefix]||'',attrs,ns};if(!stack.length&&++roots>1)invalid('multiple XML roots');if(stack.length>=128)invalid('XML nesting too deep');onOpen(node,stack);if(tag[3])onClose(node,stack);else stack.push(node);
 }
 if(offset!==xml.length||stack.length||roots!==1)invalid('incomplete XML');
}
function readEntry(buffer,entry,limit){
 const h=entry.header,o=h.offset;if(o+30>buffer.length||buffer.readUInt32LE(o)!==0x04034b50)invalid('bad ZIP local header');
 const flags=buffer.readUInt16LE(o+6),method=buffer.readUInt16LE(o+8);if(flags&1||h.encrypted)invalid('encrypted ZIP');if(method!==h.method||![0,8].includes(method))invalid('unsupported ZIP compression');
 const start=o+30+buffer.readUInt16LE(o+26)+buffer.readUInt16LE(o+28),end=start+h.compressedSize;if(end>buffer.length||end<start)invalid('bad ZIP extent');
 const data=method===0?buffer.subarray(start,end):inflateRawSync(buffer.subarray(start,end),{maxOutputLength:limit});
 if(data.length>limit||data.length!==h.size||crc32(data)!==h.crc)invalid('ZIP size or checksum mismatch');return data;
}
function wordPartText(buffer, root, scope, limit=MAX_CHARS) {
 let output='',body=false;
 function append(text){if(output.length+text.length>limit)invalid('combined text exceeds 500000 characters');output+=text;}
 function included(parents){
  if(scope==='body')return parents.some(p=>WORD.has(p.uri)&&p.local==='body');
  if(scope==='notes')return parents.some(p=>WORD.has(p.uri)&&['footnote','endnote'].includes(p.local))&&!parents.some(p=>p.separator);
  return parents.length>0;
 }
 xmlEvents(buffer,(node,parents)=>{
  if(!parents.length&&(node.local!==root||!WORD.has(node.uri)))invalid('invalid Word '+root+' part');
  if(WORD.has(node.uri)&&node.local==='body')body=true;
  if(WORD.has(node.uri)&&['footnote','endnote'].includes(node.local))node.separator=Object.entries(node.attrs).some(([name,value])=>name.split(':').at(-1)==='type'&&['separator','continuationSeparator','continuationNotice'].includes(value));
  if(WORD.has(node.uri)&&included(parents)){if(node.local==='tab')append('\t');if(['br','cr'].includes(node.local))append('\n');}
 },(text,parents)=>{if(included(parents)&&WORD.has(parents.at(-1)?.uri)&&parents.at(-1)?.local==='t')append(text);},(node,parents)=>{if(WORD.has(node.uri)&&node.local==='p'&&included(parents))append('\n');});
 if(scope==='body'&&!body)invalid('missing Word body');return output.replace(/\n+$/,'');
}
function docxText(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length>MAX_BYTES)invalid('source exceeds 8 MiB');
 let eocd=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50&&i+22+buffer.readUInt16LE(i+20)===buffer.length){eocd=i;break;}
 if(eocd<0||buffer.readUInt16LE(eocd+4)||buffer.readUInt16LE(eocd+6)||buffer.readUInt16LE(eocd+8)!==buffer.readUInt16LE(eocd+10))invalid('unsupported ZIP archive');
 const count=buffer.readUInt16LE(eocd+10);if(!count||count>MAX_ENTRIES)invalid('too many ZIP entries');
 const entries=new AdmZip(buffer).getEntries();if(entries.length!==count)invalid('ZIP entry count mismatch');const names=new Set();let expanded=0;
 for(const entry of entries){const h=entry.header;if(h.encrypted)invalid('encrypted ZIP');if(names.has(entry.entryName))invalid('duplicate ZIP entry');names.add(entry.entryName);if(entry.entryName.includes('\\')||entry.entryName.split('/').some(part=>part==='..')||entry.entryName.startsWith('/')||((h.attr>>>16)&0xf000)===0xa000)invalid('unsafe ZIP entry');if(h.size>MAX_BYTES||(expanded+=h.size)>MAX_EXPANDED)invalid('ZIP expansion exceeds limit');if(h.offset+8>buffer.length||buffer.readUInt16LE(h.offset+6)&1)invalid('encrypted or malformed ZIP entry');}
 const typeEntry=entries.find(e=>e.entryName==='[Content_Types].xml'),document=entries.find(e=>e.entryName==='word/document.xml');if(!typeEntry||!document||document.isDirectory)invalid('missing Word document');const contentTypes=new Map();
 xmlEvents(readEntry(buffer,typeEntry,256*1024),(node,parents)=>{
  if(!parents.length&&(node.local!=='Types'||node.uri!==CONTENT))invalid('invalid content types');
  if(node.uri===CONTENT&&node.local==='Override'){
   if(contentTypes.has(node.attrs.PartName))invalid('duplicate part content type');contentTypes.set(node.attrs.PartName,node.attrs.ContentType);
  }
 },()=>{},()=>{});
 if(contentTypes.get('/word/document.xml')!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')invalid('not a DOCX main content type');
 let output=wordPartText(readEntry(buffer,document,MAX_BYTES),'document','body');
 const extraParts=entries.map(entry=>{
  const numbered=/^word\/(header|footer)([0-9]+)\.xml$/.exec(entry.entryName);
  if(numbered)return {entry,kind:numbered[1],root:numbered[1]==='header'?'hdr':'ftr',scope:'all',label:(numbered[1]==='header'?'Header: ':'Footer: ')+entry.entryName.slice(5),group:numbered[1]==='header'?0:1,number:Number(numbered[2])};
  if(entry.entryName==='word/footnotes.xml')return {entry,kind:'footnotes',root:'footnotes',scope:'notes',label:'Footnotes',group:2,number:0};
  if(entry.entryName==='word/endnotes.xml')return {entry,kind:'endnotes',root:'endnotes',scope:'notes',label:'Endnotes',group:3,number:0};
  return null;
 }).filter(Boolean).sort((a,b)=>a.group-b.group||a.number-b.number||(a.entry.entryName<b.entry.entryName?-1:1));
 for(const part of extraParts){
  if(part.entry.isDirectory||contentTypes.get('/'+part.entry.entryName)!=='application/vnd.openxmlformats-officedocument.wordprocessingml.'+part.kind+'+xml')invalid('invalid '+part.kind+' content type');
  const text=wordPartText(readEntry(buffer,part.entry,MAX_BYTES),part.root,part.scope,MAX_CHARS-output.length);
  if(!text.trim())continue;
  const section=(output?'\n\n':'')+'['+part.label+']\n'+text;if(output.length+section.length>MAX_CHARS)invalid('combined text exceeds 500000 characters');output+=section;
 }
 return output;
}
module.exports={docxText,MAX_BYTES,MAX_CHARS};
