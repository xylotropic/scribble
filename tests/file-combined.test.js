"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {outputName,preflight,verify}=require('../src/main/file-combined');
const {performUtility}=require('../src/main/utilities');
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'scribble-combined-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
async function snapshot(files){const result=[];for(const file of files){const stat=await fs.lstat(file);result.push({path:file,dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs,directory:stat.isDirectory()});}return result;}
test('default names and explicit case-preserved names are bounded basenames with matching types',()=>{
 assert.equal(outputName('pdf-merge'),'merged.pdf');assert.equal(outputName('archive-create'),'archive.zip');assert.equal(outputName('pdf-merge','"Quarterly Report.PDF"'),'Quarterly Report.PDF');assert.equal(outputName('archive-create','Case Preserved'),'Case Preserved.zip');
 for(const name of ['../outside','/absolute','a/b','a\\b','..','Folder:Name','Bad\nName','wrong.zip','x'.repeat(151)])assert.throws(()=>outputName('pdf-merge',name),/filename/);
});
test('real PDFs merge in selection order beside the first selected file',async t=>{
 const dir=await fixture(t),{PDFDocument}=require('pdf-lib');const files=[path.join(dir,'first.pdf'),path.join(dir,'second.pdf')];
 for(let i=0;i<files.length;i++){const document=await PDFDocument.create();document.addPage([100+50*i,200]);await fs.writeFile(files[i],await document.save());}
 const ordered=[files[1],files[0]],plan=await preflight({operation:'pdf-merge',files:ordered,expected:await snapshot(ordered)});assert.equal(plan.output,path.join(dir,'merged.pdf'));await verify(plan);
 const result=await performUtility({operation:plan.operation,files:plan.files,output:plan.output,options:{overwrite:false}});const merged=await PDFDocument.load(await fs.readFile(result.output));assert.deepEqual(merged.getPages().map(page=>page.getWidth()),[150,100]);
 await assert.rejects(preflight({operation:'pdf-merge',files:ordered,expected:await snapshot(ordered)}),/already exists/);assert.equal((await PDFDocument.load(await fs.readFile(plan.output))).getPageCount(),2);
});
test('real selected files and folders archive beside the first selection with a custom filename',async t=>{
 const dir=await fixture(t),folder=path.join(dir,'Folder'),file=path.join(dir,'Other.txt');await fs.mkdir(folder);await fs.writeFile(path.join(folder,'inside.txt'),'folder content');await fs.writeFile(file,'other content');
 const files=[folder,file],plan=await preflight({operation:'archive-create',files,expected:await snapshot(files),outputName:'Shared Notes.ZIP'});assert.equal(plan.output,path.join(dir,'Shared Notes.ZIP'));await verify(plan);
 await performUtility({operation:plan.operation,files:plan.files,output:plan.output,options:{overwrite:false}});const zip=new (require('adm-zip'))(await fs.readFile(plan.output));assert.equal(zip.readAsText('Folder/inside.txt'),'folder content');assert.equal(zip.readAsText('Other.txt'),'other content');
});
test('case-equivalent existing outputs, source aliases and inside-folder outputs fail before work',async t=>{
 const dir=await fixture(t),a=path.join(dir,'a.pdf'),b=path.join(dir,'b.pdf');await fs.writeFile(a,'a');await fs.writeFile(b,'b');await fs.writeFile(path.join(dir,'MERGED.PDF'),'existing');let files=[a,b];
 await assert.rejects(preflight({operation:'pdf-merge',files,expected:await snapshot(files)}),/already exists/);
 await fs.rm(path.join(dir,'MERGED.PDF'));files=[a,a];await assert.rejects(preflight({operation:'pdf-merge',files,expected:await snapshot(files)}),/Duplicate/);
 const hardlink=path.join(dir,'alias.pdf');await fs.link(a,hardlink);files=[a,hardlink];await assert.rejects(preflight({operation:'pdf-merge',files,expected:await snapshot(files)}),/Duplicate/);
 files=[a,dir];await assert.rejects(preflight({operation:'archive-create',files,expected:await snapshot(files)}),/inside an input/);
});
test('changed sources or appeared outputs invalidate a plan without overwriting files',async t=>{
 const dir=await fixture(t),a=path.join(dir,'a.txt'),b=path.join(dir,'b.txt');await fs.writeFile(a,'first');await fs.writeFile(b,'second');const files=[a,b];let plan=await preflight({operation:'archive-create',files,expected:await snapshot(files)});
 await fs.writeFile(b,'changed');await assert.rejects(verify(plan),/changed after command activation/);
 plan=await preflight({operation:'archive-create',files,expected:await snapshot(files)});await fs.writeFile(plan.output,'appeared');await assert.rejects(verify(plan),/already exists/);assert.equal(await fs.readFile(plan.output,'utf8'),'appeared');
});
test('known archive byte limits refuse sparse oversized selected files before execution',async t=>{
 const dir=await fixture(t),a=path.join(dir,'a.txt'),b=path.join(dir,'large.bin');await fs.writeFile(a,'small');await fs.writeFile(b,'');await fs.truncate(b,512*1024*1024);
 const files=[a,b];await assert.rejects(preflight({operation:'archive-create',files,expected:await snapshot(files)}),/512 MB/);await assert.rejects(fs.stat(path.join(dir,'archive.zip')), {code:'ENOENT'});
});
