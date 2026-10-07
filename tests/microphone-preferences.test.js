'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {captureCandidates,moveRank,removeDisconnected,validatePriority}=require('../src/shared/microphone-preferences');
test('global chain terminates at Auto or appends legacy pick, preserving caller arrays',()=>{
 const priority=['usb','default','headset'];const settings={microphonePriority:priority,microphoneId:'legacy'};
 assert.deepEqual(captureCandidates(settings),['usb','default']);assert.deepEqual(priority,['usb','default','headset']);
 assert.deepEqual(captureCandidates({microphonePriority:['usb'],microphoneId:'legacy'}),['usb','legacy']);
 assert.deepEqual(captureCandidates({microphonePriority:['usb'],microphoneId:'usb'}),['usb']);
 assert.deepEqual(captureCandidates({microphonePriority:[],microphoneId:'legacy'}),['legacy']);
 assert.deepEqual(captureCandidates({microphonePriority:[]}),['default']);
});
test('meeting inherit remains live while copied override diverges and empty override selects Auto',()=>{
 const settings={microphonePriority:['usb'],microphoneId:'legacy',meetingMicrophonePriority:null};
 assert.deepEqual(captureCandidates(settings,'meeting'),['usb','legacy']);
 settings.meetingMicrophonePriority=['usb'];settings.microphonePriority=['headset'];
 assert.deepEqual(captureCandidates(settings,'meeting'),['usb']);assert.deepEqual(captureCandidates(settings),['headset','legacy']);
 settings.meetingMicrophonePriority=null;assert.deepEqual(captureCandidates(settings,'meeting'),['headset','legacy']);
 settings.meetingMicrophonePriority=[];assert.deepEqual(captureCandidates(settings,'meeting'),['default']);
 settings.meetingMicrophonePriority=['usb','default','headset'];assert.deepEqual(captureCandidates(settings,'meeting'),['usb','default']);
});
test('immutable rank editing rejects invalid indices; empty enumeration retains disconnected preferences',()=>{
 const list=['usb','default','headset'];assert.deepEqual(moveRank(list,2,0),['headset','usb','default']);assert.deepEqual(list,['usb','default','headset']);
 for(const rank of [-1,3,0.5,NaN])assert.throws(()=>moveRank(list,rank,0),/rank/);
 assert.deepEqual(removeDisconnected(list,[]),list);assert.deepEqual(removeDisconnected(list,['usb']),['usb','default']);
 for(const invalid of [null,[''],[' '],['a','a'],[1],['a'.repeat(513)],Array.from({length:33},(_,i)=>String(i))])assert.throws(()=>validatePriority(invalid),/priority/);
});
test('browser UMD exports the same pure capture API',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../src/shared/microphone-preferences'),'utf8'),context);
 assert.equal(JSON.stringify(context.ScribbleMicrophonePreferences.captureCandidates({meetingMicrophonePriority:[]},'meeting')),JSON.stringify(['default']));
});
test('a full global rank list plus legacy fallback copies and reorders all33 meeting candidates',()=>{
 const global=Array.from({length:32},(_,i)=>'device-'+i);const settings={microphonePriority:global,microphoneId:'legacy'};
 const chain=captureCandidates(settings);assert.equal(chain.length,33);assert.equal(chain[32],'legacy');
 settings.meetingMicrophonePriority=chain.slice();assert.deepEqual(captureCandidates(settings,'meeting'),chain);
 const moved=moveRank(chain,32,0);assert.equal(moved.length,33);assert.equal(moved[0],'legacy');assert.deepEqual(chain.slice(0,32),global);
 assert.deepEqual(removeDisconnected(chain,[]),chain);assert.deepEqual(removeDisconnected(chain,chain),chain);
 assert.throws(()=>validatePriority(chain),/priority/);assert.deepEqual(validatePriority(chain,false,33),chain);
 assert.throws(()=>captureCandidates({...settings,microphonePriority:chain}),/priority/);
 assert.throws(()=>captureCandidates({...settings,meetingMicrophonePriority:[...chain,'extra']},'meeting'),/priority/);
});
