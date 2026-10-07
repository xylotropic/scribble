'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const supported=process.platform==='darwin';let binary,temporary;
const diagnostics=result=>[result.error?.stack,result.signal,result.stderr,result.stdout].filter(Boolean).join('\n');
test.after(()=>{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});});
test.before(()=>{if(!supported)return;binary=process.env.SCRIBBLE_COMMAND_SCREEN_BINARY;if(!binary){temporary=fs.mkdtempSync(path.join(os.tmpdir(),'scribble-command-screen-test-'));binary=path.join(temporary,'scribble-bridge');const build=spawnSync(process.execPath,['scripts/build-native.mjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,SCRIBBLE_NATIVE_OUTPUT:binary},encoding:'utf8',timeout:120000});assert.equal(build.status,0,diagnostics(build));assert.doesNotMatch(build.stderr,/warning:|error:/i);}});
function run(argument){const result=spawnSync(binary,[argument],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,diagnostics(result));return JSON.parse(result.stdout.trim());}
test('pure screen-region geometry and privacy plan handle negative origins, scaling, clamps and explicit empty selection', {skip:!supported},()=>{
 const result=run('--command-screen-self-test');for(const key of ['negativeOrigin','sourceTopLeftPoints','clamped','tinyRejected','nonfiniteRejected','retinaBounded','dragZeroNeverFull','fiveRegionLimit','regionsReplaceAutomatic','automaticOnlyWhenDisabled','labelsPlain','labelsValidation','noWindowCreated'])assert.equal(result[key],true,key);
});
test('real native continuation ownership rejects stale cancel/delivery, bounds timeouts and never returns full screen for empty regions', {skip:!supported},()=>{
 const result=run('--command-screen-race-self-test');for(const key of ['staleCancelSafe','cancelledPending','lateDeliverySafe','timeoutBounded','emptyRegionsReject','eventsMetadataOnly','invalidTokensRejected','cancelBeforeStartSafe','pendingStartNeverReady','shutdownBlocksLateStart','noWindowCreated'])assert.equal(result[key],true,key);
});
test('Intel screen-context bridge compiles without warnings and carries an x86_64 slice without executing it',{skip:!supported},()=>{
 let intel=process.env.SCRIBBLE_COMMAND_SCREEN_INTEL_BINARY;
 if(!intel){if(!temporary)temporary=fs.mkdtempSync(path.join(os.tmpdir(),'scribble-command-screen-test-'));intel=path.join(temporary,'scribble-bridge-intel');const build=spawnSync(process.execPath,['scripts/build-native.mjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,SCRIBBLE_NATIVE_ARCH:'x64',SCRIBBLE_NATIVE_OUTPUT:intel},encoding:'utf8',timeout:120000});assert.equal(build.status,0,diagnostics(build));assert.doesNotMatch(build.stderr,/warning:|error:/i);}
 const result=spawnSync('/usr/bin/lipo',['-archs',intel],{encoding:'utf8'});assert.equal(result.status,0,diagnostics(result));assert.equal(result.stdout.trim(),'x86_64');
});
