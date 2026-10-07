"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {preflight,execute}=require('../src/main/file-batch');
async function fixture(t,names=['first.txt','second.txt']) {const dir=await fs.mkdtemp(path.join(os.tmpdir(),'scribble-batch-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const files=names.map(name=>path.join(dir,name));for(const file of files)await fs.writeFile(file,'Heading\nParagraph.');return{dir,files};}
test('real ordered text transforms save every output beside its source without changing originals',async t=>{
 const {files}=await fixture(t);const result=await execute(await preflight({operation:'text-markdown',files:[files[1],files[0]]}));
 assert.deepEqual(result.outputs,[files[1].replace('.txt','.md'),files[0].replace('.txt','.md')]);assert.equal(result.details.completed,2);
 for(const output of result.outputs)assert.equal(await fs.readFile(output,'utf8'),'# Heading\nParagraph.');for(const source of files)assert.equal(await fs.readFile(source,'utf8'),'Heading\nParagraph.');
});
test('all destinations are checked before writing, including case aliases and converging names',async t=>{
 const {dir,files}=await fixture(t);await fs.writeFile(path.join(dir,'SECOND.MD'),'existing');let writes=0;
 await assert.rejects(preflight({operation:'text-markdown',files}),/already exists/);assert.equal(writes,0);await assert.rejects(fs.stat(path.join(dir,'first.md')),/ENOENT/);
 await fs.rm(path.join(dir,'SECOND.MD'));const alternate=path.join(dir,'first.markdown');await fs.writeFile(alternate,'other');
 await assert.rejects(preflight({operation:'markdown-pdf',files:[alternate,path.join(dir,'first.md')]}),/ENOENT/);
 const png=path.join(dir,'same.png'),jpg=path.join(dir,'same.jpg');await fs.writeFile(png,'fixture');await fs.writeFile(jpg,'fixture');await assert.rejects(preflight({operation:'image-convert',files:[png,jpg],options:{format:'webp'}}),/collide/);
});
test('duplicate inputs, aliases, hard links, and linked output parents are refused',async t=>{
 const {dir,files}=await fixture(t);await assert.rejects(preflight({operation:'text-markdown',files:[files[0],files[0]]}),/Duplicate/);
 const link=path.join(dir,'linked.txt');await fs.link(files[0],link);await assert.rejects(preflight({operation:'text-markdown',files:[files[0],link]}),/Duplicate/);
 const parentLink=path.join(dir,'parent');await fs.symlink(dir,parentLink);await assert.rejects(preflight({operation:'text-markdown',files:[path.join(parentLink,'first.txt')]}),/regular directories/);
});
test('a failure reports prior committed outputs and stops later files without rollback deletion',async t=>{
 const {files}=await fixture(t,['one.txt','two.txt','three.txt']);let calls=0;
 const result=await execute(await preflight({operation:'text-markdown',files}),{perform:async({output})=>{if(++calls===2)throw Error('decoder failed');await fs.writeFile(output,'done');return{output};}});
 assert.deepEqual(result.items.map(item=>item.status),['completed','failed','skipped']);assert.equal(calls,2);assert.equal(await fs.readFile(result.outputs[0],'utf8'),'done');assert.match(result.text,/1 of 3/);assert.match(result.text,/decoder failed/);assert.match(result.text,new RegExp(result.outputs[0]));
});
test('cancellation preserves the finished current item and stops future outputs',async t=>{
 const {files}=await fixture(t);const controller=new AbortController();let calls=0;
 const result=await execute(await preflight({operation:'text-markdown',files}),{signal:controller.signal,perform:async({output})=>{calls++;await fs.writeFile(output,'done');controller.abort();return{output};}});
 assert.equal(calls,1);assert.equal(result.details.cancelled,true);assert.deepEqual(result.items.map(item=>item.status),['completed','skipped']);assert.equal(await fs.readFile(result.outputs[0],'utf8'),'done');
});
test('changes to any source or destination after planning prevent the first write',async t=>{
 const {dir,files}=await fixture(t);const plan=await preflight({operation:'text-markdown',files});await fs.writeFile(files[1],'different input');let writes=0;
 await assert.rejects(execute(plan,{perform:async()=>{writes++;}}),/changed after command activation/);assert.equal(writes,0);
 const next=await preflight({operation:'text-markdown',files});await fs.writeFile(path.join(dir,'second.md'),'appeared');await assert.rejects(execute(next,{perform:async()=>{writes++;}}),/already exists/);assert.equal(writes,0);
});
test('archive folders and compression extensions stay per-source; combined tools refuse batch planning',async t=>{
 const {files}=await fixture(t,['a.zip','b.zip']);const plan=await preflight({operation:'archive-extract',files});assert.deepEqual(plan.items.map(item=>item.output),files.map(file=>file.slice(0,-4)));
 const other=await fixture(t,['a.JPEG','b.tif']);const compressed=await preflight({operation:'image-compress',files:other.files});assert.deepEqual(compressed.items.map(item=>path.extname(item.output)),['.JPEG','.tif']);assert.ok(compressed.items.every(item=>item.output.includes('-compressed')));
 await assert.rejects(preflight({operation:'image-compress',files:other.files,options:{format:'webp'}}),/preserve/);await assert.rejects(preflight({operation:'pdf-merge',files}),/combined/);
});
test('known per-format source limits preflight every file before a first conversion',async t=>{
 for(const [operation,extension,bytes] of [['text-markdown','txt',16*1024**2],['markdown-pdf','md',16*1024**2],['config-convert','json',16*1024**2],['image-convert','png',128*1024**2],['archive-extract','zip',512*1024**2]]) {
  const {files}=await fixture(t,['first.'+extension,'oversized.'+extension]);await fs.truncate(files[1],bytes+1);let calls=0;
  await assert.rejects(preflight({operation,files}).then(plan=>execute(plan,{perform:async()=>{calls++;}})),/exceeds.*limit/);assert.equal(calls,0);
 }
});
test('real extraction of multiple ZIPs keeps each archive in its own adjacent folder',async t=>{
 const {files}=await fixture(t,['first.zip','second.zip']);const AdmZip=require('adm-zip');
 for(let i=0;i<files.length;i++){const archive=new AdmZip();archive.addFile('same-name.txt',Buffer.from('Archive '+i));await fs.writeFile(files[i],archive.toBuffer());}
 const result=await execute(await preflight({operation:'archive-extract',files}));assert.equal(result.details.completed,2);
 for(let i=0;i<result.outputs.length;i++)assert.equal(await fs.readFile(path.join(result.outputs[i],'same-name.txt'),'utf8'),'Archive '+i);
 await assert.rejects(preflight({operation:'archive-extract',files}),/already exists/);
});
test('real PNG compression preserves each source format and displays any size warning',async t=>{
 const {files}=await fixture(t,['first.png','second.png']);const sharp=require('sharp');
 for(const file of files)await sharp({create:{width:10,height:10,channels:3,background:'#ff7700'}}).png().toFile(file);
 const result=await execute(await preflight({operation:'image-compress',files}));assert.equal(result.details.completed,2);
 for(const item of result.items){assert.equal((await sharp(item.output).metadata()).format,'png');assert.equal(path.extname(item.output),'.png');assert.equal(item.details.quality,80);if(item.details.notice)assert.ok(result.text.includes(item.details.notice));}
});
