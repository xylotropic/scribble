'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const supported=process.platform==='darwin';
let binary, temporaryFolder;
function spawnDiagnostics(result){return [result.error?.stack,result.signal && `signal: ${result.signal}`,result.stderr,result.stdout].filter(Boolean).join("\n");}
test.after(()=>{if(temporaryFolder)fs.rmSync(temporaryFolder,{recursive:true,force:true});});
test.before(()=>{
 if(!supported)return;
 binary=process.env.SCRIBBLE_NOTCH_BINARY;
 if(!binary){temporaryFolder=fs.mkdtempSync(path.join(os.tmpdir(),'scribble-native-notch-'));binary=path.join(temporaryFolder,'scribble-bridge');const build=spawnSync(process.execPath,['scripts/build-native.mjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,SCRIBBLE_NATIVE_OUTPUT:binary},encoding:'utf8',timeout:120000});assert.equal(build.status,0,spawnDiagnostics(build));assert.ok(fs.existsSync(binary),`Build did not create ${binary}`);}
});
function selfTest(argument){const result=spawnSync(binary,[argument],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,spawnDiagnostics(result));return JSON.parse(result.stdout.trim());}
test('native notch pure geometry covers hardware gap, cursor-display coordinates and pill fallback',{skip:!supported},()=>{
 const value=selfTest('--notch-indicator-self-test');for(const key of ['notch','topAnchored','gapCentered','externalFallback','bottomPill','bottomHardwareMetadata','topFallbackReason','pillAvoidsMenuDock','levelRetainsContext','atomicValidation','noWindowCreated'])assert.equal(value[key],true,key);assert.equal(value.rejected,8);
});
test('private clipboard item carries transient marker and restores original content/types without keyboard events',{skip:!supported},()=>{
 const value=selfTest('--clipboard-history-self-test');for(const key of ['privateTagged','publicUntagged','plainRichPreserved','invalidRejected','legacyDefault','originalTypesRestored'])assert.equal(value[key],true,key);
});
test('hidden native indicator protocol validates updates and never shows a panel',{skip:!supported},()=>{
 const requests=[{id:1,command:'indicatorConfigure',enabled:false,labels:{stop:'停止'},text:'Plain <text>',tone:'Local tone'}, {id:2,command:'indicatorUpdate',level:0.6,state:'paused'}, {id:3,command:'indicatorUpdate',text:'Invalid replacement',level:2}, {id:4,command:'indicatorHide'}, {id:5,command:'paste',allowClipboardHistory:'false',dryRun:true},{id:6,command:'paste',allowClipboardHistory:false,text:'Private',html:'<b>Private</b>',dryRun:true}];
 const result=spawnSync(binary,['--no-event-tap'],{input:requests.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:15000});assert.equal(result.status,0,spawnDiagnostics(result));const replies=result.stdout.trim().split('\n').map(x=>JSON.parse(x)).filter(x=>x.id);assert.equal(replies.length,6);const reply=id=>replies.find(x=>x.id===id);assert.equal(reply(1).result.visible,false);assert.equal(reply(2).result.state,'paused');assert.equal(reply(3).ok,false);assert.equal(reply(4).result.visible,false);assert.equal(reply(5).ok,false);assert.ok(reply(6).result.clipboardTypes.includes('org.nspasteboard.TransientType'));
});

test('native controls remain stable across repeated meter/text updates and change only with displayed controls or geometry',{skip:!supported},()=>{
 const value=selfTest('--notch-controls-self-test');for(const key of ['meterAndTextStable','mutedStable','actionsChange','labelsChange','toneChange','availabilityChange','geometryChange','noWindowCreated'])assert.equal(value[key],true,key);
});
