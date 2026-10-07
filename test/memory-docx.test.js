'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),AdmZip=require('adm-zip');
const {docxText,MAX_BYTES}=require('../src/main/memory-docx');
const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const types='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
function fixture(xml,more=[],contentTypes=types){const zip=new AdmZip();zip.addFile('[Content_Types].xml',Buffer.from(contentTypes));zip.addFile('word/document.xml',Buffer.from(xml));for(const [name,text]of more)zip.addFile(name,Buffer.from(text));return zip.toBuffer();}
const document=body=>`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${ns}"><w:body>${body}</w:body></w:document>`;
function central(buffer,name){let i=0;while(i<buffer.length-46){if(buffer.readUInt32LE(i)===0x02014b50){const n=buffer.readUInt16LE(i+28);if(buffer.subarray(i+46,i+46+n).toString()===name)return i;i+=46+n+buffer.readUInt16LE(i+30)+buffer.readUInt16LE(i+32);}else i++;}throw Error('missing central entry');}
test('generated DOCX extracts Unicode paragraphs, runs, table cells, tabs, breaks and XML entities',()=>{
 const xml=document('<w:p><w:r><w:t xml:space="preserve"> Hello &amp; 日本語 👋 </w:t><w:tab/><w:t>&lt;world&gt; &#x1F680; &#169;</w:t><w:br/><w:t>line two</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>cell one</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>cell two</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
 assert.equal(docxText(fixture(xml,[['word/media/image.png','ignored']])), ' Hello & 日本語 👋 \t<world> 🚀 ©\nline two\ncell one\ncell two');
});
test('strict namespace and alternate prefix are accepted; unrelated drawing and metadata text are ignored',()=>{
 const xml='<x:document xmlns:x="http://purl.oclc.org/ooxml/wordprocessingml/main" xmlns:a="urn:drawing"><x:body><x:p><x:r><x:t><![CDATA[plain <text>]]></x:t></x:r><a:t>not body text</a:t></x:p></x:body></x:document>';
 assert.equal(docxText(fixture(xml)),'plain <text>');
});
test('rejects missing or wrong DOCX content types and malformed XML instead of pretending extraction succeeded',()=>{
 for(const xml of [document('<w:p><w:t>bad &unknown;</w:t></w:p>'),document('<w:p><w:t>bad &#0;</w:t></w:p>'),document('<w:p></w:r>'),document('<w:p>'),'<w:document xmlns:w="urn:wrong"><w:body/></w:document>',document('<w:p><w:t>bad & missing</w:t></w:p>')])assert.throws(()=>docxText(fixture(xml)));
 assert.throws(()=>docxText(fixture(document('<w:p/>'),[],types.replace('wordprocessingml.document.main+xml','wordprocessingml.template.main+xml'))),/content type/);
 const zip=new AdmZip();zip.addFile('ordinary.txt',Buffer.from('hello'));assert.throws(()=>docxText(zip.toBuffer()),/missing Word/);
});
test('external entities and declarations are rejected without resolving files or network',()=>{
 const malicious='<!DOCTYPE w:document [<!ENTITY secret SYSTEM "file:///etc/passwd">]>'+document('<w:p><w:t>&secret;</w:t></w:p>');assert.throws(()=>docxText(fixture(malicious)),/DTD/);
 assert.throws(()=>docxText(fixture(document('<w:p/>'),[],types.replace('<Types','<!DOCTYPE Types SYSTEM "https://example.invalid/types"><Types'))),/DTD/);
});
test('rejects encrypted local and central flags, symlink entries, unsafe paths and corrupted CRC',()=>{
 const original=fixture(document('<w:p><w:t>safe</w:t></w:p>'));
 const encrypted=Buffer.from(original),offset=central(encrypted,'word/document.xml');encrypted.writeUInt16LE(encrypted.readUInt16LE(offset+8)|1,offset+8);assert.throws(()=>docxText(encrypted),/encrypted/);
 const local=Buffer.from(original);const index=central(local,'word/document.xml'),start=local.readUInt32LE(index+42);local.writeUInt16LE(local.readUInt16LE(start+6)|1,start+6);assert.throws(()=>docxText(local),/encrypted/);
 const symlink=Buffer.from(original);symlink.writeUInt32LE(0xa1ff0000,central(symlink,'word/document.xml')+38);assert.throws(()=>docxText(symlink),/unsafe/);
 const traversal=fixture(document('<w:p/>'),[['xx/outside','no extraction']]);const unsafe=central(traversal,'xx/outside');Buffer.from('../outside').copy(traversal,unsafe+46);assert.throws(()=>docxText(traversal),/unsafe/);
 const corrupt=Buffer.from(original);corrupt.writeUInt32LE(0,central(corrupt,'word/document.xml')+16);assert.throws(()=>docxText(corrupt),/checksum/);
});
test('bounded source, entry count, expansion metadata and actual inflate output reject ZIP bombs',()=>{
 assert.throws(()=>docxText(Buffer.alloc(MAX_BYTES+1)),/8 MiB/);
 assert.throws(()=>docxText(fixture(document('<w:p/>'),Array.from({length:511},(_,i)=>['extra/'+i,'']))),/too many/);
 const metadata=fixture(document('<w:p/>'));metadata.writeUInt32LE(MAX_BYTES+1,central(metadata,'word/document.xml')+24);assert.throws(()=>docxText(metadata),/expansion/);
 const bomb=fixture(document('<w:p><w:t>'+'a'.repeat(MAX_BYTES+1)+'</w:t></w:p>'));bomb.writeUInt32LE(100,central(bomb,'word/document.xml')+24);assert.throws(()=>docxText(bomb));
 assert.throws(()=>docxText(fixture(document('<w:p><w:t>'+'a'.repeat(500001)+'</w:t></w:p>'))),/500000/);
 assert.throws(()=>docxText(fixture(document('<w:p>'.repeat(130)+'</w:p>'.repeat(130)))),/nesting/);
});

function withParts(body,parts){
 const overrides=parts.map(([name,kind])=>`<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}+xml"/>`).join('');
 return fixture(document(body),parts.map(([name,_kind,xml])=>[name,xml]),types.replace('</Types>',overrides+'</Types>'));
}
const para=text=>`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const part=(root,body)=>`<w:${root} xmlns:w="${ns}">${body}</w:${root}>`;
test('headers, footers, footnotes and endnotes retain Unicode facts in deterministic labeled sections',()=>{
 const parts=[
  ['word/endnotes.xml','endnotes',part('endnotes',`<w:endnote w:id="8">${para('終注: Project Ζ')}</w:endnote>`) ],
  ['word/header10.xml','header',part('hdr',para('Client 10'))],
  ['word/footer1.xml','footer',part('ftr',para('Contract № 42 &amp; © 2026'))],
  ['word/footnotes.xml','footnotes',part('footnotes',`<w:footnote w:type="separator" w:id="-1">${para('not a fact')}</w:footnote><w:footnote w:type="continuationSeparator" w:id="0">${para('also excluded')}</w:footnote><w:footnote w:id="2">${para('脚注: São Paulo')}</w:footnote>`) ],
  ['word/header2.xml','header',part('hdr',para('Case α 日本語'))],
 ];
 const expected='Body fact\n\n[Header: header2.xml]\nCase α 日本語\n\n[Header: header10.xml]\nClient 10\n\n[Footer: footer1.xml]\nContract № 42 & © 2026\n\n[Footnotes]\n脚注: São Paulo\n\n[Endnotes]\n終注: Project Ζ';
 assert.equal(docxText(withParts(para('Body fact'),parts)),expected);assert.equal(docxText(withParts(para('Body fact'),parts.slice().reverse())),expected);
});
test('reference parts validate roots, namespaces, content types and reject entities while ignoring external relationships',()=>{
 for(const xml of [part('ftr',para('wrong root')),'<w:hdr xmlns:w="urn:wrong"><w:p/></w:hdr>','<!DOCTYPE x SYSTEM "https://example.invalid/x">'+part('hdr',para('bad'))])assert.throws(()=>docxText(withParts(para('Body'),[['word/header1.xml','header',xml]])));
 assert.throws(()=>docxText(withParts(para('Body'),[['word/header1.xml','footer',part('hdr',para('bad type'))]])),/content type/);
 const relationships='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="header" Target="https://example.invalid/private-header" TargetMode="External"/></Relationships>';
 assert.equal(docxText(fixture(document(para('Local body')),[['word/_rels/document.xml.rels',relationships]])),'Local body');
});
test('combined body and reference-part text limit includes section labels',()=>{
 const body=para('a'.repeat(300000)),notes=part('footnotes',`<w:footnote w:id="1">${para('b'.repeat(200001))}</w:footnote>`);assert.throws(()=>docxText(withParts(body,[['word/footnotes.xml','footnotes',notes]])),/500000/);
 const small=part('hdr',para('a'.repeat(499990)));assert.throws(()=>docxText(withParts('',[['word/header1.xml','header',small]])),/500000/);
 assert.equal(docxText(withParts(para('Body'),[['word/header1.xml','header',part('hdr','')]]) ),'Body');
});
