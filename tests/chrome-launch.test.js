"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {launchChromeWebsites}=require('../src/main/chrome-launch');
function harness({missing=false,profileMissing=false,spawnError=false}={}){
 const calls=[];return {calls,options:{homeDir:'/Users/test',fs:{existsSync:()=>!missing,promises:{lstat:async p=>{calls.push(['profile',p]);if(profileMissing)throw Error('missing');return {isDirectory:()=>true,isSymbolicLink:()=>false};}}},spawn:(exe,args,opts)=>{calls.push(['spawn',exe,args,opts]);const child=new EventEmitter();child.unref=()=>calls.push(['unref']);queueMicrotask(()=>child.emit(spawnError?'error':'spawn',spawnError?Error('Launch failed'):undefined));return child;}}};
}
test('Chrome launch groups websites in one window using only an existing selected profile',async()=>{
 const h=harness();await launchChromeWebsites(['https://example.com/','https://example.org/'],'Profile 2',h.options);
 assert.equal(h.calls[0][1],'/Users/test/Library/Application Support/Google/Chrome/Profile 2');
 assert.deepEqual(h.calls[1][2],['--new-window','--profile-directory=Profile 2','https://example.com/','https://example.org/']);assert.deepEqual(h.calls.at(-1),['unref']);
});
test('missing browser/profile, invalid profile and spawn errors reject without silently changing destination',async()=>{
 for(const [opts,profile,pattern] of [[{missing:true},'',/not installed/],[{profileMissing:true},'Profile 2',/unavailable/],[{},'../../Other',/Invalid/],[{spawnError:true},'',/Launch failed/]]){
 const h=harness(opts);await assert.rejects(launchChromeWebsites(['https://example.com/'],profile,h.options),pattern);
 if(!opts.spawnError)assert.ok(!h.calls.some(c=>c[0]==='spawn'));
 }
});


test('Chrome launch rejects non-web destinations before spawning',async()=>{
 const h=harness();for(const urls of [[],['javascript:alert(1)'],['https://user:password@example.com'],['mailto:user@example.com']])await assert.rejects(launchChromeWebsites(urls,'',h.options),/valid/);assert.deepEqual(h.calls,[]);
});
