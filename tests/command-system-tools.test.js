"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const tools=require('../src/main/command-system-tools');
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'scribble-system-tools-'));t.after(()=>fs.rm(dir,{force:true,recursive:true}));const file=path.join(dir,'file with spaces $(literal).txt');await fs.writeFile(file,'text');const stat=await fs.lstat(file);return{dir,file,captured:{files:[{path:file,dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs,directory:false}]}};}
test('all eight documented editors resolve to app bundle display names rather than CLI commands',()=>{
 for(const [spoken,application] of [['VS Code','Visual Studio Code'],['Cursor','Cursor'],['Sublime Text','Sublime Text'],['Atom','Atom'],['WebStorm','WebStorm'],['PhpStorm','PhpStorm'],['IntelliJ IDEA','IntelliJ IDEA'],['PyCharm','PyCharm']])assert.deepEqual(tools.parseSystemCommand('Open this folder in '+spoken),{type:'editor',application,kind:'folder'});
 assert.equal(tools.parseSystemCommand('open these in code').application,'Visual Studio Code');assert.throws(()=>tools.parseSystemCommand('open this file in arbitrary-cli'),/eight editors/);
});
test('common macOS app aliases normalize while literal app names are kept as bounded arguments',()=>{
 for(const [alias,name] of [['code','Visual Studio Code'],['Chrome','Google Chrome'],['Word','Microsoft Word'],['Excel','Microsoft Excel'],['PowerPoint','Microsoft PowerPoint'],['Outlook','Microsoft Outlook'],['Teams','Microsoft Teams'],['Photoshop','Adobe Photoshop'],['VLC','VLC']])assert.equal(tools.appName(alias),name);
 assert.equal(tools.appName('Fixture $(echo literal)'), 'Fixture $(echo literal)');
 for(const value of ['--args','x-apple.systempreferences:bad','https://example.com','App\nName','name?foo=bar','x'.repeat(201)])assert.throws(()=>tools.appName(value),/Invalid/);
});
test('seventeen panes and canonical spoken aliases use only fixed System Settings URIs',()=>{
 assert.equal(Object.keys(tools.SETTINGS).length,17);
 for(const [pane,uri]of Object.entries(tools.SETTINGS))assert.equal(tools.parseSystemCommand('open '+pane+' settings').uri,uri);
 assert.equal(tools.parseSystemCommand('open Wi-Fi settings').pane,'wifi');assert.equal(tools.parseSystemCommand('show location services preferences').pane,'location');assert.match(tools.parseSystemCommand('open keyboard shortcuts settings').instruction,/Choose Keyboard Shortcuts/);
 for(const text of ['open microphone settings?foo=bar','open camera &foo settings','open x-apple.systempreferences:evil settings','open unknown settings'])assert.throws(()=>tools.parseSystemCommand(text),/Invalid|Unknown/);
});
test('selected files remain ordered and identity/type/symlink checks happen before editor launch',async t=>{
 const {dir,file,captured}=await fixture(t);assert.deepEqual(await tools.capturedPaths(captured,{kind:'files'}),[file]);await assert.rejects(tools.capturedPaths(captured,{kind:'folders'}),/match/);
 await assert.rejects(tools.capturedPaths({files:[]}),/Select/);await assert.rejects(tools.capturedPaths({files:Array(33).fill(captured.files[0])}),/32/);
 await assert.rejects(tools.capturedPaths({files:[captured.files[0],captured.files[0]]}),/Duplicate/);
 await fs.writeFile(file,'changed');await assert.rejects(tools.capturedPaths(captured),/changed/);
 const link=path.join(dir,'link');await fs.symlink(file,link);await assert.rejects(tools.capturedPaths({files:[{...captured.files[0],path:link}]}),/changed/);
 await fs.rm(file);await assert.rejects(tools.capturedPaths(captured),/changed/);
});
