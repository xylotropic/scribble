"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const {CommandScreenSession,mergeImages} = require('../src/main/command-screen');
const image = {mimeType:'image/jpeg',data:Buffer.from('jpeg fixture').toString('base64'),width:10,height:10};
const ready = (token,dragRegions) => ({token,dragRegions,started:true,status:'ready'});
test('pending start cancellation discards late readiness and permits a new owner only after confirmation',async()=>{
 let late; const calls=[];
 const screen=new CommandScreenSession(async(command,args)=>{calls.push({command,...args});if(command==='commandScreenStart')return new Promise(r=>late=r);return {token:args.token,cancelled:true};});
 const start=screen.start('a',false); await screen.cancel('a'); late(ready('a',false));
 await assert.rejects(start,{name:'AbortError'});assert.equal(screen.owner,null);
 assert.deepEqual(calls.map(x=>x.command),['commandScreenStart','commandScreenCancel']);
});
test('region mode refuses zero-region/full-frame response without exposing images',async()=>{
 const screen=new CommandScreenSession(async(command,{token,dragRegions})=>command==='commandScreenStart'?ready(token,dragRegions):command==='commandScreenFinish'?{token,source:'display',regionCount:0,images:[image]}:{token,cancelled:true});
 await screen.start('a',true);await assert.rejects(screen.finish('a'),/Select at least one/);assert.equal(screen.owner,null);
});
test('failed cancellation retains blocked ownership until a confirmed retry',async()=>{
 let fail=true; const screen=new CommandScreenSession(async(command,{token,dragRegions})=>{if(command==='commandScreenStart')return ready(token,dragRegions);if(fail)throw Error('cancel failed');return {token,cancelled:true};});
 await screen.start('a',false);await assert.rejects(screen.cancel('a'),/cancel failed/);await assert.rejects(screen.start('b',false),/previous/);fail=false;await screen.cancel('a');assert.equal(screen.owner,null);
});
test('finish validates token/dimensions and merges attachments without truncation',async()=>{
 const screen=new CommandScreenSession(async(command,{token,dragRegions})=>command==='commandScreenStart'?ready(token,dragRegions):{token,source:'regions',regionCount:1,images:[image]});
 await screen.start('a',true);assert.deepEqual(await screen.finish('a'),[{mimeType:image.mimeType,data:image.data}]);
 assert.equal(mergeImages([image],[image]).length,2);assert.throws(()=>mergeImages(Array(5).fill(image),[image]),/five/);
 assert.throws(()=>mergeImages([{...image,data:'abcd='}]),/Invalid/);
});
test('metadata forwarding rejects obsolete tokens and strips pixel-bearing extra fields',async()=>{
 const screen=new CommandScreenSession(async(command,{token,dragRegions})=>command==='commandScreenStart'?ready(token,dragRegions):{token,cancelled:true});
 await screen.start('owner',true);
 assert.equal(screen.metadata('command-region-count',{token:'old',count:1,maxRegions:5}),null);
 assert.deepEqual(screen.metadata('command-region-count',{token:'owner',count:2,maxRegions:5,images:[image]}),{token:'owner',count:2,maxRegions:5});
 assert.deepEqual(screen.metadata('command-screen-status',{token:'owner',status:'ready',data:image.data}),{token:'owner',status:'ready'});
 await screen.cancel('owner');assert.equal(screen.metadata('command-screen-status',{token:'owner',status:'ready'}),null);
});
test('capture timeout retains failed cleanup ownership and shutdown blocks late readiness',async()=>{
 const screen=new CommandScreenSession(()=>new Promise(()=>{}),{timeoutMs:3});
 await assert.rejects(screen.start('a',false),/timed out/);assert.ok(screen.owner);screen.bridgeClosing();
 await assert.rejects(screen.start('b',false),/previous/);screen.bridgeExited();assert.equal(screen.owner,null);
});
