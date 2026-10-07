'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const forms=require('../src/shared/form-translations.js');
test('every original form catalogue covers all 162 labels with matching parameters and plain text',()=>{
  assert.equal(forms.labels.length,162);assert.equal(new Set(forms.labels).size,162);assert.deepEqual(forms.locales.slice().sort(),['en','bg','cs','de','es','fr','it','ja','ko','pl','pt','ru','sv','tr','uk','vi','zh','zh-TW'].sort());
  const parameters=text=>[...text.matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort();
  for(const locale of forms.locales){assert.deepEqual(Object.keys(forms.catalogues[locale]),forms.labels);for(const label of forms.labels){const text=forms.translate(locale,label);assert.ok(text.trim(),`${locale}: ${label}`);assert.doesNotMatch(text,/<[^>]*>/);assert.deepEqual(parameters(text),parameters(label));if(label.endsWith('%'))assert.ok(text.endsWith('%'));if(locale==='en')assert.equal(text,label);}}
});
test('catalogue includes current literal form/dialog/heading labels without translating internal IDs',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
  const ast=require('prettier/plugins/babel').parsers.babel.parse(source,{}),observed=new Set();
  const literals=node=>node?.type==='StringLiteral'?[node.value]:node?.type==='ConditionalExpression'?[...literals(node.consequent),...literals(node.alternate)]:[];
  function walk(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.type==='Identifier'){const name=node.callee.name,args=name==='field'?[node.arguments[1],node.arguments[4]]:name==='area'?[node.arguments[1],node.arguments[3]]:['select','check'].includes(name)?[node.arguments[1]]:name==='setting'?node.arguments.slice(0,2):name==='showModal'?[node.arguments[0]]:name==='heading'?node.arguments.slice(0,3):[];for(const arg of args)literals(arg).forEach(text=>observed.add(text));}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  walk(ast);assert.ok(observed.size>=150);assert.deepEqual([...observed].filter(label=>!forms.labels.includes(label)),[]);
  for(const internal of ['modelId','save-item','command','https://example.com','user-created title'])assert.equal(forms.translate('de',internal),internal);
});
test('browser UMD works in an isolated renderer without Node and immutable maps resist mutation',()=>{
  const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/shared/form-translations.js'),'utf8'),context);assert.equal(context.require,undefined);assert.equal(context.ScribbleFormTranslations.translate('ja','Dictation language'),'音声入力の言語');assert.ok(Object.isFrozen(forms));assert.ok(Object.isFrozen(forms.catalogues.fr));assert.throws(()=>{forms.catalogues.fr.Name='overwritten';},TypeError);
});
test('unknown locales and labels preserve English or exact caller text without markup interpretation',()=>{
  assert.equal(forms.translate('invalid','Rename note'),'Rename note');assert.equal(forms.translate('ZH-tw','Transcript'),'轉錄文字');assert.equal(forms.translate('__proto__','Name'),'Name');assert.equal(forms.translate('de','__proto__'),'__proto__');assert.equal(forms.translate('de','<img src=x onerror=alert(1)> {user}'),'<img src=x onerror=alert(1)> {user}');assert.equal(forms.translate('de',null),'');assert.equal(forms.translate('es','Speech model for new files'),'Modelo de voz para nuevos archivos');assert.equal(forms.translate('pl','Remove speech model?'),'Usunąć model mowy?');
});
test('settings descriptions and hints preserve technical facts and template variables in all locales',()=>{
  const technicalKeys=forms.labels.filter(label=>/IPv4|Automatic uses|docs\.example|One bundle|Keys stay|100 clipboard|Variables:|Use \{\{text\}\}|Space=49|option, command|Adding or re-indexing/.test(label));
  assert.ok(technicalKeys.length>=10);
  for(const locale of forms.locales){for(const label of technicalKeys){const text=forms.translate(locale,label);// Spanish uses the same word ‘Variables’; identical wording here is intentional.
      if(locale!=='en' && !(locale==='es' && label==='Variables: {date}, {time}, {clipboard}.'))assert.notEqual(text,label,`${locale} did not translate ${label}`);for(const token of label.match(/IPv4|IPv6|CPU|GPU|Whisper|CoreML|Ollama|macOS|100|docs\.example\.com\/project|Space=49|L=37|N=45|-1|left-option|right-option|\{\{text\}\}|\{date\}|\{time\}|\{clipboard\}/g)||[])assert.ok(text.includes(token),`${locale} lost technical token ${token}`);}}
});
test('new prose is present rather than relying on fallback for every locale',()=>{
  const prose=forms.labels.filter(label=>label.length>100);
  assert.equal(prose.length,10);
  for(const locale of forms.locales){for(const label of prose){assert.ok(Object.hasOwn(forms.catalogues[locale],label));if(locale!=='en')assert.notEqual(forms.catalogues[locale][label],label);}}
  assert.equal(forms.translate('es','Leave empty to use the selected text or clipboard.'),'Déjalo vacío para usar el texto seleccionado o el portapapeles.');
  assert.equal(forms.translate('ja','Keep a small ready indicator visible.'),'小さな待機インジケーターを表示しておきます。');
});
