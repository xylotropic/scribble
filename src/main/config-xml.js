'use strict';
// Original XML tree representation: {$xml:{name,attributes,children}}. Children
// are homogeneous objects: {$text:string} or element trees (TOML-compatible). They
// retain text and element order; CDATA and entity references become character data.
// XML declarations and comments are ignored as non-data markup; XML 1.0 line
// endings are normalized. The reserved $xml wrapper can be escaped with typed:true.
const LIMITS=Object.freeze({bytes:16*1024**2,depth:64,nodes:100000});
const NS='urn:scribble:config:v1';
const START=':A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}';
const NAME=new RegExp('^['+START+']['+START+'0-9.\\-\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$','u');
function fail(message){throw Error('Invalid configuration XML: '+message);}
function validChars(text){for(const char of text){const n=char.codePointAt(0);if(!(n===9||n===10||n===13||n>=32&&n<=0xd7ff||n>=0xe000&&n<=0xfffd||n>=0x10000&&n<=0x10ffff))fail('invalid XML character');}return text;}
function own(object,key,value){Object.defineProperty(object,key,{value,enumerable:true,writable:true,configurable:true});}
function decode(text){validChars(text);return text.replace(/&([^;]*);|&/g,(whole,entity)=>{if(entity===undefined)fail('unterminated entity');const predefined={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.hasOwn(predefined,entity))return predefined[entity];if(!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity))fail('custom or invalid entity');const n=entity[1]==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));if(!Number.isSafeInteger(n)||n>0x10ffff)fail('invalid character reference');return validChars(String.fromCodePoint(n));});}
function parseXML(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>LIMITS.bytes)fail('size limit');validChars(text);text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');let i=0,nodes=0;
 const count=()=>{if(++nodes>LIMITS.nodes)fail('node limit');};
 const space=()=>{while(/[\t\r\n ]/.test(text[i]||'!'))i++;};
 function name(){const start=i;while(i<text.length&&!/[\t\r\n />=]/.test(text[i]))i++;const value=text.slice(start,i);if(!NAME.test(value))fail('invalid name');return value;}
 function comment(){count();const end=text.indexOf('-->',i+4);if(end<0||text.slice(i+4,end).includes('--')||text[end-1]==='-')fail('invalid comment');i=end+3;}
 function declaration(){const end=text.indexOf('?>',i+2);if(end<0)fail('unterminated declaration');const value=text.slice(i,end+2);if(!/^<\?xml\s+version\s*=\s*(["'])1\.0\1(?:\s+encoding\s*=\s*(["'])[Uu][Tt][Ff]-8\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*\?>$/.test(value))fail('unsupported declaration');i=end+2;}
 function element(depth){if(depth>LIMITS.depth)fail('depth limit');count();if(text[i++]!=='<')fail('expected element');const tag=name(),attributes={},children=[];let separated=false;
  while(true){const before=i;space();separated=i>before;if(text.startsWith('/>',i)){i+=2;return{name:tag,attributes,children};}if(text[i]==='>'){i++;break;}if(!separated)fail('attributes need whitespace');const key=name();if(Object.hasOwn(attributes,key))fail('duplicate attribute');space();if(text[i++]!=='=')fail('attribute assignment');space();const quote=text[i++];if(quote!=="'"&&quote!=='"')fail('quoted attribute required');const end=text.indexOf(quote,i);if(end<0||text.slice(i,end).includes('<'))fail('invalid attribute');const value=decode(text.slice(i,end).replace(/[\t\r\n]/g,' '));own(attributes,key,value);i=end+1;}
  while(i<text.length){if(text.startsWith('</',i)){i+=2;const closing=name();space();if(text[i++]!=='>'||closing!==tag)fail('mismatched closing tag');return{name:tag,attributes,children};}
   if(text.startsWith('<!--',i)){comment();continue;}if(text.startsWith('<![CDATA[',i)){count();const end=text.indexOf(']]>',i+9);if(end<0)fail('unterminated CDATA');children.push(text.slice(i+9,end));i=end+3;continue;}
   if(text[i]==='<'){if(text.startsWith('<!',i)||text.startsWith('<?',i))fail('DTD and processing instructions unsupported');children.push(element(depth+1));continue;}
   const end=text.indexOf('<',i),stop=end<0?text.length:end;const raw=text.slice(i,stop);if(raw.includes(']]>'))fail('CDATA closing sequence in text');count();children.push(decode(raw.replace(/\r\n?/g,'\n')));i=stop;
  }fail('unclosed element');
 }
 if(text.startsWith('<?xml',i))declaration();space();while(text.startsWith('<!--',i)){comment();space();}if(text[i]!=='<'||text.startsWith('<!',i))fail('root element required; DTD unsupported');const root=element(1);space();while(text.startsWith('<!--',i)){comment();space();}if(i!==text.length)fail('multiple roots or trailing content');
 if(root.name==='sc:config'&&root.attributes['xmlns:sc']===NS)return readTypedRoot(root);
 return{$xml:externalTree(root)};
}
function externalTree(node){return{name:node.name,attributes:node.attributes,children:node.children.map(child=>typeof child==='string'?{$text:child}:externalTree(child))};}
function elements(node){if(node.children.some(x=>typeof x==='string'&&x.trim()))fail('typed mixed text');return node.children.filter(x=>typeof x!=='string');}
function attributes(node,keys){if(Object.keys(node.attributes).some(k=>!keys.includes(k)))fail('unexpected typed attribute');}
function readTypedRoot(root){attributes(root,['xmlns:sc']);const children=elements(root);if(children.length!==1)fail('typed root needs one value');return readTyped(children[0]);}
function readTyped(node){
 attributes(node,[]);const type=node.name.replace(/^sc:/,'');if(node.name!=='sc:'+type)fail('invalid typed element');
 if(type==='object'){const result={};for(const entry of elements(node)){if(entry.name!=='sc:entry')fail('object entry required');attributes(entry,['key']);if(!Object.hasOwn(entry.attributes,'key')||Object.hasOwn(result,entry.attributes.key))fail('missing or duplicate object key');const children=elements(entry);if(children.length!==1)fail('entry needs one value');own(result,entry.attributes.key,readTyped(children[0]));}return result;}
 if(type==='array')return elements(node).map(readTyped);
 if(node.children.some(x=>typeof x!=='string'))fail('scalar contains elements');const text=node.children.join('');
 if(type==='string')return text;if(type==='null'){if(text.trim())fail('nonempty null');return null;}if(type==='boolean'){if(!['true','false'].includes(text))fail('invalid boolean');return text==='true';}
 if(type==='number'){if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)||!Number.isFinite(Number(text)))fail('invalid number');return Number(text);}fail('unknown typed value');
}
function escapeText(text,attribute=false){validChars(text);return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,attribute?'&quot;':'"').replace(/\r/g,'&#13;').replace(/\n/g,attribute?'&#10;':'\n').replace(/\t/g,attribute?'&#9;':'\t');}
function stringifyXML(value,{typed=false}={}){
 let nodes=1,bytes=0;const ancestors=new Set();const add=text=>{bytes+=Buffer.byteLength(text);if(bytes>LIMITS.bytes)fail('size limit');return text;};const enter=(value,depth)=>{if(depth>LIMITS.depth||++nodes>LIMITS.nodes)fail('depth or node limit');if(value&&typeof value==='object'){if(ancestors.has(value))fail('cycle');ancestors.add(value);}};
 function tree(node,depth){enter(node,depth);if(!node||typeof node!=='object'||Array.isArray(node)||Object.keys(node).some(k=>!['name','attributes','children'].includes(k))||typeof node.name!=='string'||!NAME.test(node.name)||!node.attributes||typeof node.attributes!=='object'||Array.isArray(node.attributes)||!Array.isArray(node.children))fail('invalid tree representation');let result=add('<'+node.name);for(const [key,text] of Object.entries(node.attributes)){if(!NAME.test(key)||typeof text!=='string')fail('invalid tree attribute');result+=add(' '+key+'="'+escapeText(text,true)+'"');}result+=add('>');for(const child of node.children){if(typeof child==='string'){enter(null,depth+1);result+=add(escapeText(child));}else if(child&&typeof child==='object'&&!Array.isArray(child)&&Object.keys(child).length===1&&Object.hasOwn(child,'$text')){if(typeof child.$text!=='string')fail('invalid text node');enter(child,depth+1);result+=add(escapeText(child.$text));ancestors.delete(child);}else result+=tree(child,depth+1);}result+=add('</'+node.name+'>');ancestors.delete(node);return result;}
 function encode(x,depth){enter(x,depth);if((typeof x==='string'&&x.length)||typeof x==='boolean'||typeof x==='number')enter(null,depth+1);let result;
  if(x===null)result=add('<sc:null/>');else if(typeof x==='string')result=add('<sc:string>'+escapeText(x)+'</sc:string>');else if(typeof x==='boolean')result=add('<sc:boolean>'+x+'</sc:boolean>');else if(typeof x==='number'){if(!Number.isFinite(x))fail('nonfinite number');result=add('<sc:number>'+(Object.is(x,-0)?'-0':String(x))+'</sc:number>');}
  else if(Array.isArray(x)){result=add('<sc:array>');for(const item of x)result+=encode(item,depth+1);result+=add('</sc:array>');}
  else if(x&&typeof x==='object'&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)){result=add('<sc:object>');for(const [key,item]of Object.entries(x)){enter(null,depth+1);result+=add('<sc:entry key="'+escapeText(key,true)+'">')+encode(item,depth+2)+add('</sc:entry>');}result+=add('</sc:object>');}
  else fail('unsupported configuration value');if(x&&typeof x==='object')ancestors.delete(x);return result;
 }
 if(!typed&&value&&typeof value==='object'&&Object.keys(value).length===1&&Object.hasOwn(value,'$xml'))return tree(value.$xml,1);
 return add('<sc:config xmlns:sc="'+NS+'">')+encode(value,2)+add('</sc:config>');
}
module.exports={parseXML,stringifyXML,LIMITS,NAMESPACE:NS};
