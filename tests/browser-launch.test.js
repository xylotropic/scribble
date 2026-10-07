"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {launchWebsites}=require('../src/main/browser-launch');
const urls=['https://example.com/','https://example.org/'];
function harness(items,failed=false){const seen=[];return {seen,options:{catalog:async()=>items,launch:async(exe,args)=>{seen.push([exe,args]);if(failed&&exe!='/usr/bin/open')throw Error('launch failed');}}};}
test('grouped Chromium and Gecko links use only discovered profile selectors',async()=>{
 for(const [item,profile,args] of [[{id:'chrome',family:'chromium',executable:'/chrome',profiles:[{id:'Profile 2',name:'Work'}]},'Profile 2',['--new-window','--profile-directory=Profile 2',...urls]],[{id:'firefox',family:'gecko',executable:'/firefox',profiles:[{id:'Profile1',name:'Work'}]},'Profile1',['-P','Work','-new-window',urls[0],'-new-tab',urls[1]]]]){
  const h=harness([item]);assert.equal((await launchWebsites(urls,profile,item.id,h.options)).fallback,false);assert.deepEqual(h.seen,[[item.executable,args]]);
 }
});
test('uninstalled browser, removed profile or launch failure uses default browser without creating a profile',async()=>{
 for(const [items,profile,failed] of [[[],'',false],[[{id:'chrome',executable:'/chrome',profiles:[]}],'Profile 9',false],[[{id:'chrome',family:'chromium',executable:'/chrome',profiles:[]}],'',true]]){
  const h=harness(items,failed);assert.equal((await launchWebsites(urls,profile,'chrome',h.options)).fallback,true);assert.deepEqual(h.seen.at(-1),['/usr/bin/open',urls]);
 }
});
test('invalid destinations fail before catalog or process effects',async()=>{
 const h=harness([]);await assert.rejects(launchWebsites(['javascript:alert(1)'],'','chrome',h.options),/valid/);assert.deepEqual(h.seen,[]);
});


test('immediate browser process failure rejects while a forwarded request succeeds',async()=>{
 const {launchProcess}=require('../src/main/browser-launch'),{EventEmitter}=require('node:events');
 const spawnWith=code=>()=>{const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>{child.emit('spawn');child.emit('exit',code,null);});return child;};
 await assert.rejects(launchProcess('/browser',[],spawnWith(1)),/failed/);await launchProcess('/browser',[],spawnWith(0));
});
