'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const binary=process.env.SCRIBBLE_SYSTEM_CAPTURE_TEST_BINARY;
test('native capture ownership rejects cancelled starts/resumes and protects replacement sessions', {skip:!binary?'Set SCRIBBLE_SYSTEM_CAPTURE_TEST_BINARY to a freshly built helper':false},()=>{
 assert.ok(path.isAbsolute(binary));assert.ok(fs.existsSync(binary));
 const result=spawnSync(binary,['--system-capture-self-test'],{encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);const lines=result.stdout.trim().split('\n');assert.equal(lines.length,1,'self-test must exit before native services start');
 const value=JSON.parse(lines[0]);assert.equal(value.selfTest,'system-capture');
 for(const key of ['ok','lateStartRejected','pendingStartGuarded','newOwnerPreserved','lateResumeRejected','staleStopCannotOwnNew','failedStopRetains','replacementRefused','retryConfirmed','coalescedStops'])assert.equal(value[key],true,key);
});
