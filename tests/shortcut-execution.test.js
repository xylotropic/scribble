"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {executeShortcutPlan}=require('../src/main/shortcut-execution');
test('shortcut execution preserves ordered grouped websites, application folder and folders',async()=>{
 const seen=[];const result=await executeShortcutPlan([{type:'websites',urls:['https://example.com/','https://example.org/'],profile:'Profile 2'},{type:'application',name:'TextEdit',folder:'/tmp/project'},{type:'folders',paths:['/tmp/a','/tmp/b']}],{openWebsites:async(...args)=>seen.push(['web',...args]),launchApplication:async(...args)=>seen.push(['app',...args]),openFolder:async p=>{seen.push(['folder',p]);return '';}});
 assert.deepEqual(seen,[['web',['https://example.com/','https://example.org/'],'Profile 2'],['app','TextEdit','/tmp/project'],['folder','/tmp/a'],['folder','/tmp/b']]);assert.equal(result.completed,3);
});
test('failed OS step stops subsequent actions and rejects instead of claiming success',async()=>{
 const seen=[];await assert.rejects(executeShortcutPlan([{type:'folders',paths:['/missing','/later']},{type:'application',name:'Later'}],{openFolder:async p=>{seen.push(p);return 'Missing folder';},launchApplication:async()=>seen.push('app')}),/Missing folder/);assert.deepEqual(seen,['/missing']);
});
