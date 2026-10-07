'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createNativeIndicator}=require('../src/main/native-indicator');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
test('latest settings suppress stale native completion and hide before returning to Electron',async()=>{
 const pending=deferred(),calls=[],visible=[];
 const indicator=createNativeIndicator({request:async(command,args)=>{calls.push({command,args});return command==='indicatorShow'?pending.promise:{};},showElectron:value=>visible.push(value)});
 indicator.update({style:'notch',position:'top',text:'first'},true);
 indicator.update({style:'pill',position:'bottom',text:'second'},true);
 pending.resolve({visible:true});await tick();
 assert.deepEqual(calls.map(x=>x.command),['indicatorShow','indicatorHide']);assert.equal(visible.at(-1),true);assert.equal(visible.slice(1).includes(false),false);
});
test('native rejection leaves a visible Electron fallback and hide preference shows neither surface',async()=>{
 const visible=[],calls=[];const indicator=createNativeIndicator({request:async(command)=>{calls.push(command);if(command==='indicatorShow')throw Error('Unavailable');return{};},showElectron:value=>visible.push(value)});
 indicator.update({style:'notch',position:'top'},true);await tick();assert.equal(visible.at(-1),true);assert.deepEqual(calls,['indicatorShow','indicatorHide']);indicator.update({style:'hidden',position:'hidden'},false);await tick();assert.equal(visible.at(-1),false);
});
test('shutdown also hides a native panel whose pending show completes after disposal',async()=>{
 const pending=deferred(),calls=[],visible=[];const indicator=createNativeIndicator({request:async(command)=>{calls.push(command);return command==='indicatorShow'?pending.promise:{};},showElectron:value=>visible.push(value)});
 indicator.update({style:'notch',position:'top'},true);indicator.dispose();pending.resolve({visible:true});await tick();assert.equal(calls.at(-1),'indicatorHide');assert.equal(calls.filter(x=>x==='indicatorHide').length,2);assert.deepEqual(visible,[false]);indicator.update({style:'pill'},true);assert.deepEqual(visible,[false]);
});
