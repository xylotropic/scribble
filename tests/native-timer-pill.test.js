'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createNativeTimerPill}=require('../src/main/native-timer-pill');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('native timer snapshots serialize and disposal hides after an outstanding response',async()=>{
 const calls=[];let resolve;
 const controller=createNativeTimerPill({now:()=>100,request:async(command,args)=>{calls.push({command,args});if(calls.length===1)await new Promise(r=>resolve=r);}});
 controller.sync([{id:'one',title:'First',endsAt:200}]);controller.sync([{id:'two',title:'Second',endsAt:300}]);controller.dispose();controller.sync([{id:'late',title:'Late',endsAt:400}]);
 assert.equal(calls.length,1);resolve();await tick();assert.equal(calls.length,2);assert.deepEqual(calls[1],{command:'timerPillSync',args:{timers:[]}});
});
test('timer snapshots preserve nearest deadlines, bound legacy collections, and copy their data',async()=>{
 const calls=[],timers=Array.from({length:40},(_,i)=>({id:String(i),title:'Timer',endsAt:200+i,private:'excluded'}));
 const controller=createNativeTimerPill({now:()=>100,request:async(_,args)=>calls.push(args)});controller.sync([{id:'expired',title:'Expired',endsAt:99},...timers]);timers[0].title='Changed';await tick();
 assert.equal(calls[0].timers.length,32);assert.deepEqual(calls[0].timers[0],{id:'0',title:'Timer',endsAt:200});controller.dispose();await tick();
});
test('native timer failures remain visible through the error hook and do not block a later update',async()=>{
 let attempts=0;const errors=[];const controller=createNativeTimerPill({now:()=>0,request:async()=>{if(++attempts===1)throw Error('Unavailable');},onError:e=>errors.push(e.message)});
 controller.sync([{id:'a',title:'Timer',endsAt:100}]);await tick();controller.sync([]);await tick();assert.equal(attempts,2);assert.deepEqual(errors,['Unavailable']);controller.dispose();await tick();
});

test('legacy display titles are bounded without mutating stored timer data',async()=>{
 const calls=[],timers=[{id:'valid',title:'Line\nTwo'+'.'.repeat(300),endsAt:200},{id:'valid',title:'Duplicate',endsAt:300},{id:'bad\n',title:'Bad',endsAt:400}];
 const controller=createNativeTimerPill({now:()=>100,request:async(_,args)=>calls.push(args)});controller.sync(timers);await tick();
 assert.equal(calls[0].timers.length,1);assert.equal(calls[0].timers[0].title.length,200);assert.equal(calls[0].timers[0].title.includes('\n'),false);assert.equal(timers[0].title.includes('\n'),true);controller.dispose();await tick();
});
