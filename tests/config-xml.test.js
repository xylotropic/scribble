'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseXML,stringifyXML,LIMITS}=require('../src/main/config-xml');
test('ordinary XML retains attributes, repeated nodes and mixed Unicode character data explicitly',()=>{
 const value=parseXML('<?xml version="1.0" encoding="UTF-8"?><config mode="safe &amp; sound"><server port="8080">a</server><server>b</server>before<![CDATA[<日本語>]]>&#x1F600;after</config>');
 assert.deepEqual(value,{$xml:{name:'config',attributes:{mode:'safe & sound'},children:[{name:'server',attributes:{port:'8080'},children:[{$text:'a'}]},{name:'server',attributes:{},children:[{$text:'b'}]},{$text:'before'},{$text:'<日本語>'},{$text:'😀after'}]}});
 assert.deepEqual(parseXML(stringifyXML(value)),{$xml:{...value.$xml,children:[...value.$xml.children.slice(0,2),{$text:'before<日本語>😀after'}]}});
});
test('typed XML reversibly handles nested JSON types, arbitrary keys and reserved tree representation',()=>{
 const value=JSON.parse('{"":null,"true":true,"false":false,"number":-1.25e3,"list":[null,"日本語 & < >",[],{}],"a b/🍀":{"__proto__":{"polluted":true},"constructor":1}}');
 assert.deepEqual(parseXML(stringifyXML(value)),value);assert.equal({}.polluted,undefined);
 const collision={$xml:{name:'root',attributes:{},children:[]}};assert.deepEqual(parseXML(stringifyXML(collision,{typed:true})),collision);
 const generic=parseXML('<root __proto__="safe" constructor="ok"/>');assert.equal(generic.$xml.attributes.__proto__,'safe');assert.equal(Object.getPrototypeOf(generic.$xml.attributes),Object.prototype);
});
test('XML newline normalization and escaped key/attribute whitespace preserve character values',()=>{
 assert.equal(parseXML('<r a="x\r\ny">a\r\nb<![CDATA[c\r\nd]]></r>').$xml.attributes.a,'x y');
 const value={'a\r\n\tb':'line\r\n\tend'};assert.deepEqual(parseXML(stringifyXML(value)),value);
});
test('syntax rejects mismatches, duplicate attributes, malformed references, illegal characters and trailing roots',()=>{
 for(const text of ['<a><b></a>','<a x="1" x="2"/>','<a>&custom;</a>','<a>&bare</a>','<a>&#0;</a>','<a>&#xD800;</a>','<a>\0</a>','<a/><b/>','<a b="x"c="y"/>','<a a="<"/>','<a>]]></a>','<?xml version="1.1"?><a/>','<1bad/>','<a><!-- bad -- comment --></a>'])assert.throws(()=>parseXML(text),/Invalid configuration XML/,text);
});
test('DTD, custom entities, external resources and instructions are rejected without resolution',()=>{
 for(const text of ['<!DOCTYPE root SYSTEM "file:///etc/passwd"><root/>','<!DOCTYPE root [<!ENTITY x SYSTEM "https://example.test/">]><root>&x;</root>','<?fetch url="https://example.test"?><root/>','<root><?fetch anything?></root>'])assert.throws(()=>parseXML(text),/Invalid configuration XML/);
});
test('typed schema rejects ambiguous structures and invented values',()=>{
 const wrap=x=>`<sc:config xmlns:sc="urn:scribble:config:v1">${x}</sc:config>`;
 for(const x of ['<sc:number>NaN</sc:number>','<sc:boolean>1</sc:boolean>','<sc:null>text</sc:null>','<sc:string><sc:null/></sc:string>','<sc:array extra="1"/>','<sc:object><sc:entry key="a"><sc:null/></sc:entry><sc:entry key="a"><sc:null/></sc:entry></sc:object>','<sc:object><sc:entry><sc:null/></sc:entry></sc:object>','<sc:array>mixed<sc:null/></sc:array>'])assert.throws(()=>parseXML(wrap(x)),/Invalid configuration XML/);
});
test('depth, node and byte budgets apply on both parse and serialization; cycles and non-JSON values fail',()=>{
 assert.throws(()=>parseXML('<a>'.repeat(65)+'</a>'.repeat(65)),/depth/);assert.throws(()=>parseXML('<r>'+'<a/>'.repeat(LIMITS.nodes)+'</r>'),/node/);assert.throws(()=>parseXML('<r>'+'x'.repeat(LIMITS.bytes)+'</r>'),/size/);
 let nested=null;for(let i=0;i<65;i++)nested=[nested];assert.throws(()=>stringifyXML(nested),/depth/);assert.throws(()=>stringifyXML(Array(LIMITS.nodes).fill(null)),/node/);assert.throws(()=>stringifyXML('x'.repeat(LIMITS.bytes)),/size/);
 const cycle={};cycle.self=cycle;for(const value of [cycle,undefined,()=>{},new Date(),NaN,Infinity,1n])assert.throws(()=>stringifyXML(value),/Invalid configuration XML/);
});

test('XML literal CDATA line endings normalize while numeric CR references retain their character',()=>{const result=parseXML('<r><![CDATA[a\r\nb\rc]]>&#13;</r>');assert.deepEqual(result.$xml.children,[{$text:'a\nb\nc'},{$text:'\r'}]);assert.throws(()=>parseXML('<?xml VERSION="1.0"?><r/>'),/declaration/);assert.equal(parseXML('<\u200Cname/>').$xml.name,'\u200Cname');assert.ok(Object.is(parseXML(stringifyXML(-0)),-0));});

test('serialized scalar-heavy arrays respect the same lexical node budget as parsing',()=>{const value=Array(49999).fill('x');assert.deepEqual(parseXML(stringifyXML(value)),value);assert.throws(()=>stringifyXML(Array(50000).fill('x')),/node/);});

test('ordinary indented and mixed XML round-trips through real TOML without mixed-type arrays',()=>{
 const toml=require('@iarna/toml');
 for(const source of ['<root mode="fast">\n  <item id="1">first</item>\n  <item id="2">second</item>\n</root>','<r a="x">before<child/>after<![CDATA[<literal>]]>&amp;end</r>']){
  const tree=parseXML(source),serialized=toml.stringify(tree),restored=toml.parse(serialized);assert.deepEqual(restored,tree);assert.deepEqual(parseXML(stringifyXML(restored)),parseXML(stringifyXML(tree)));
 }
});
test('generic text node compatibility remains bounded and malformed text representations fail',()=>{
 const legacy={$xml:{name:'r',attributes:{},children:['legacy',{name:'child',attributes:{},children:[]}]}};assert.deepEqual(parseXML(stringifyXML(legacy)).$xml.children,[{$text:'legacy'},{name:'child',attributes:{},children:[]}]);
 for(const child of [{$text:42},{$text:'secret',extra:1}])assert.throws(()=>stringifyXML({$xml:{name:'r',attributes:{},children:[child]}}),/Invalid configuration XML/);
});
