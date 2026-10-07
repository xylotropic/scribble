'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TOOLS,validatePlan,mapPlan,parseSelection,selectionPrompt}=require('../src/main/command-tool-plan');
const plan=(tool,args={})=>({version:1,tool,arguments:args});
test('all seventeen public action families map without side effects or paths',()=>{
 const targets={code:{kind:'editor'},chrome:{kind:'app'},docs:{kind:'website'}};
 const fixtures={'image-convert':{format:'heic'},'config-convert':{format:'xml',from:'toml'},'audio-convert':{format:'opus'},'video-convert':{format:'mkv'},'pdf-merge':{outputName:'合併.pdf'},'image-compress':{quality:70},'archive-create':{outputName:'資料.zip'},'archive-extract':{},'text-markdown':{firstLineHeading:false},'markdown-pdf':{style:'minimal'},'editor-open':{targetId:'code'},'app-open':{targetId:'chrome'},'website-open':{targetId:'docs'},timer:{seconds:600,title:'休憩'},translate:{language:'fr'},'settings-open':{pane:'microphone'},'screen-palette':{}};
 assert.equal(TOOLS.length,17);assert.deepEqual(Object.keys(fixtures).sort(),[...TOOLS].sort());
 for(const [tool,args] of Object.entries(fixtures)){const result=mapPlan(plan(tool,args),{targets});assert.ok(result.kind);assert.equal(JSON.stringify(result).includes('/Users'),false);}
});
test('synthetic multilingual model selections preserve same execution mapping, not inference proof',()=>{
 const fixtures=[['Set a ten minute timer',plan('timer',{seconds:600})],['Pon un temporizador de diez minutos',plan('timer',{seconds:600})],['Règle un minuteur de dix minutes',plan('timer',{seconds:600})],['10分のタイマーを設定',plan('timer',{seconds:600})]];
 for(const [,response] of fixtures)assert.deepEqual(mapPlan(JSON.stringify(response)),{kind:'timer',seconds:600,title:null});
 assert.deepEqual(mapPlan(plan('translate'),{translationLanguage:'ja'}),{kind:'translation',language:'ja',inputSource:'captured-text-or-clipboard'});
});
test('rejects unknown fields, compound plans, shell/path/URI injection and untrusted targets',()=>{
 for(const input of [plan('shell',{command:'rm'}),{...plan('timer',{seconds:1}),steps:[]},plan('archive-create',{outputName:'../x.zip'}),plan('archive-create',{outputName:'-x.zip'}),plan('settings-open',{pane:'x-apple.systempreferences:evil'}),plan('editor-open',{targetId:'/bin/sh'}),plan('image-convert',{format:'png',files:['/etc/passwd']}),plan('timer',{seconds:1,title:'x\ncommand'})])assert.throws(()=>validatePlan(input));
 assert.throws(()=>mapPlan(plan('app-open',{targetId:'chrome'}),{targets:{chrome:{kind:'website'}}}));assert.throws(()=>mapPlan(plan('website-open',{targetId:'missing'})));
});
test('enforces duration, quality, size, format and exact JSON response bounds',()=>{
 for(const seconds of [0,86401,1.5,Infinity,'600'])assert.throws(()=>validatePlan(plan('timer',{seconds})));
 assert.equal(validatePlan(plan('timer',{seconds:86400})).arguments.seconds,86400);
 for(const quality of [0,101,1.5])assert.throws(()=>validatePlan(plan('image-compress',{quality})));
 assert.throws(()=>validatePlan(plan('config-convert',{format:'exe'})));assert.throws(()=>validatePlan(plan('translate',{language:'en;sh'})));
 assert.throws(()=>parseSelection(' '.repeat(8193)));assert.throws(()=>parseSelection('```json\n{}\n```'));assert.deepEqual(parseSelection('{"kind":"text"}'),{kind:'text'});assert.throws(()=>parseSelection({kind:'text',tool:'timer'}));
});
test('prototype/accessor inputs refused without getter execution and outputs detached',()=>{
 let read=false;const args={};Object.defineProperty(args,'quality',{enumerable:true,get(){read=true;return 80;}});assert.throws(()=>validatePlan(plan('image-compress',args)));assert.equal(read,false);
 assert.throws(()=>validatePlan(JSON.parse('{"version":1,"tool":"timer","arguments":{"seconds":1,"__proto__":{}}}')));
 const input=plan('timer',{seconds:5});const mapped=validatePlan(input);input.arguments.seconds=99;assert.equal(mapped.arguments.seconds,5);
});
test('prompt exposes trusted opaque IDs only, not endpoint or execution configuration',()=>{
 const prompt=selectionPrompt({targets:{code:{kind:'editor',path:'/private/secret'},'../evil':{kind:'app'}}});assert.ok(prompt.includes('code'));assert.equal(prompt.includes('/private/secret'),false);assert.equal(prompt.includes('../evil'),false);
});
test('single-call text selections preserve generated content and reject oversized or unknown fields',()=>{
 const {parseSelection}=require('../src/main/command-tool-plan');assert.deepEqual(parseSelection('{"kind":"text","text":"Bonjour 日本語"}'),{kind:'text',text:'Bonjour 日本語'});
 assert.throws(()=>parseSelection({kind:'text',text:'x'.repeat(100001)}),/generated text/);assert.throws(()=>parseSelection({kind:'text',text:'answer',tool:'timer'}),/field/);assert.throws(()=>parseSelection('x'.repeat(512*1024+1)),/limit/);
});
