"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {recentTerms,captureContext,promptContext}=require('../src/main/command-automatic-context');
test('dictionary context selects ten additions by creation time instead of alphabet or edits',()=>{
 const entries=Array.from({length:12},(_,i)=>({word:String.fromCharCode(65+i),createdAt:new Date(Date.UTC(2026,0,i+1)).toISOString()}));
 entries[0].updatedAt='2099-01-01';const original=structuredClone(entries);
 assert.deepEqual(recentTerms(entries),['L','K','J','I','H','G','F','E','D','C']);assert.deepEqual(entries,original);
});
test('tied and undated legacy terms retain deterministic stored order without inventing addition dates',()=>{
 assert.deepEqual(recentTerms([{word:'legacy first',updatedAt:'2099-01-01'},{word:'tied one',createdAt:'2026-01-01'},{word:'tied two',createdAt:'2026-01-01'},{word:'legacy second',createdAt:'invalid'}]),['tied one','tied two','legacy first','legacy second']);
});
test('selected term bounds reject oversized or controlled text without silently replacing recent entries',()=>{
 assert.throws(()=>recentTerms([{word:'x'.repeat(513),createdAt:'2026-01-01'}]),/512/);assert.throws(()=>recentTerms([{word:'term\nvalue'}]),/control/);
 assert.equal(recentTerms([{word:'日本語'}])[0],'日本語');
});
test('private snapshot is immutable, excludes unknown credentials and describes missing context truthfully',()=>{
 const settings={aiProvider:'ollama',aiModel:'fixture',language:'auto',apiKey:'secret',password:'secret'};
 const context=captureContext({settings,dictionary:[],front:{bundleId:'unknown.bundle'}});settings.aiModel='changed';
 assert.equal(context.settings.aiModel,'fixture');assert.equal(context.appName,null);assert.equal(context.settings.apiKey,undefined);assert.equal(context.settings.password,undefined);
 assert.throws(()=>{context.settings.aiModel='mutated';},TypeError);assert.match(promptContext(context),/"activeApp":null/);assert.match(promptContext(context),/"transcriptionLanguage":"auto"/);
});
test('matched tone and known app/language are bounded snapshot data',()=>{
 const context=captureContext({settings:{language:'ja',toneInstructions:'Use polite Japanese.'},dictionary:[{word:'Scribble'}],front:{name:'TextEdit'},resolution:{tone:{id:'formal'},reason:'app'}});
 assert.equal(context.tone.directive,'Use polite Japanese.');assert.match(promptContext(context),/TextEdit/);assert.match(promptContext(context),/"transcriptionLanguage":"ja"/);
 assert.throws(()=>captureContext({settings:{toneInstructions:'x'.repeat(12001)},dictionary:[],resolution:{tone:{id:'huge'}}}),/too large/);
 assert.throws(()=>captureContext({settings:{aiInstructions:'x'.repeat(300000)},dictionary:[]}),/snapshot is too large/);
});
