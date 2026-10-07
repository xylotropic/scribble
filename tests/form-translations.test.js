'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const forms=require('../src/shared/form-translations.js');
test('every original form catalogue covers all 87 labels with matching parameters and plain text',()=>{
  assert.equal(forms.labels.length,87);assert.equal(new Set(forms.labels).size,87);assert.deepEqual(forms.locales.slice().sort(),['en','bg','cs','de','es','fr','it','ja','ko','pl','pt','ru','sv','tr','uk','vi','zh','zh-TW'].sort());
  const parameters=text=>[...text.matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
  for(const locale of forms.locales){assert.deepEqual(Object.keys(forms.catalogues[locale]),forms.labels);for(const label of forms.labels){const text=forms.translate(locale,label);assert.ok(text.trim(),`${locale}: ${label}`);assert.doesNotMatch(text,/<[^>]*>/);assert.deepEqual(parameters(text),parameters(label));if(label.endsWith('%'))assert.ok(text.endsWith('%'));if(locale==='en')assert.equal(text,label);}}
});
test('catalogue includes current literal form/dialog/heading labels without translating internal IDs',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
  const ast=require('prettier/plugins/babel').parsers.babel.parse(source,{}),observed=new Set();
  const literals=node=>node?.type==='StringLiteral'?[node.value]:node?.type==='ConditionalExpression'?[...literals(node.consequent),...literals(node.alternate)]:[];
  function walk(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.type==='Identifier'){const name=node.callee.name,args=['field','area','select','check'].includes(name)?[node.arguments[1]]:name==='showModal'?[node.arguments[0]]:name==='heading'?node.arguments.slice(0,2):[];for(const arg of args)literals(arg).forEach(text=>observed.add(text));}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  walk(ast);assert.ok(observed.size>=70);assert.deepEqual([...observed].filter(label=>!forms.labels.includes(label)),[]);
  for(const internal of ['modelId','save-item','command','https://example.com','user-created title'])assert.equal(forms.translate('de',internal),internal);
});
test('browser UMD works in an isolated renderer without Node and immutable maps resist mutation',()=>{
  const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/shared/form-translations.js'),'utf8'),context);assert.equal(context.require,undefined);assert.equal(context.ScribbleFormTranslations.translate('ja','Dictation language'),'音声入力の言語');assert.ok(Object.isFrozen(forms));assert.ok(Object.isFrozen(forms.catalogues.fr));assert.throws(()=>{forms.catalogues.fr.Name='overwritten';},TypeError);
});
test('unknown locales and labels preserve English or exact caller text without markup interpretation',()=>{
  assert.equal(forms.translate('invalid','Rename note'),'Rename note');assert.equal(forms.translate('ZH-tw','Transcript'),'轉錄文字');assert.equal(forms.translate('__proto__','Name'),'Name');assert.equal(forms.translate('de','__proto__'),'__proto__');assert.equal(forms.translate('de','<img src=x onerror=alert(1)> {user}'),'<img src=x onerror=alert(1)> {user}');assert.equal(forms.translate('de',null),'');assert.equal(forms.translate('es','Speech model for new files'),'Modelo de voz para nuevos archivos');assert.equal(forms.translate('pl','Remove speech model?'),'Usunąć model mowy?');
});
