'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const forms=require('../src/shared/form-translations.js');
test('every original form catalogue covers all 352 labels with matching parameters and plain text',()=>{
  assert.equal(forms.labels.length,352);assert.equal(new Set(forms.labels).size,352);assert.deepEqual(forms.locales.slice().sort(),['en','bg','cs','de','es','fr','it','ja','ko','pl','pt','ru','sv','tr','uk','vi','zh','zh-TW'].sort());
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
  assert.equal(prose.length,23);
  for(const locale of forms.locales){for(const label of prose){assert.ok(Object.hasOwn(forms.catalogues[locale],label));if(locale!=='en')assert.notEqual(forms.catalogues[locale][label],label);}}
  assert.equal(forms.translate('es','Leave empty to use the selected text or clipboard.'),'Déjalo vacío para usar el texto seleccionado o el portapapeles.');
  assert.equal(forms.translate('ja','Keep a small ready indicator visible.'),'小さな待機インジケーターを表示しておきます。');
});

test('Claude summary disclosure names destination and CLI in every translated catalogue',()=>{const key='Use the configured language model or an already signed-in Claude subscription CLI. Claude summaries send transcript text to Anthropic and use subscription limits.';for(const locale of forms.locales){const value=forms.translate(locale,key);for(const token of ['Claude','Anthropic','CLI'])assert.ok(value.includes(token));if(locale!=='en')assert.notEqual(value,key);for(const label of ['Note summary provider','Claude summary model','Leave blank to use the installed CLI default.'])assert.ok(Object.hasOwn(forms.catalogues[locale],label));}});

test('guided setup has eighteen explicit translated keys in every locale',()=>{const keys=['Make Scribble ready','A local model, your microphone, and one shortcut.','Download a speech model','Choose a model to transcribe on this Mac. Downloads use disk space and bandwidth.','Setup speech model','Model ready','Model not downloaded','Allow your microphone','Record your voice for local transcription.','Allow Accessibility','Use global shortcuts and insert words at the cursor.','Access allowed','Access not yet allowed','Refresh setup status','Finish setup','Do this later','Run setup again','Restart Scribble to enable global shortcuts.'];for(const locale of forms.locales){for(const key of keys){assert.ok(Object.hasOwn(forms.catalogues[locale],key));if(locale!=='en' && !(locale==='fr' && key==='{count} / 32 actions'))assert.notEqual(forms.translate(locale,key),key);}assert.match(forms.translate(locale,'Make Scribble ready'),/Scribble/);assert.match(forms.translate(locale,keys[3]),/Mac/);assert.notEqual(forms.translate(locale,'Access allowed'),forms.translate(locale,'Access not yet allowed'));assert.notEqual(forms.translate(locale,'Model ready'),forms.translate(locale,'Model not downloaded'));}});

test('shortcut recovery retains Scribble and is explicitly translated rather than falling back',()=>{const key='Restart Scribble to enable global shortcuts.';for(const locale of forms.locales){assert.ok(Object.hasOwn(forms.catalogues[locale],key));assert.match(forms.translate(locale,key),/Scribble/);if(locale!=='en' && !(locale==='fr' && key==='{count} / 32 actions'))assert.notEqual(forms.translate(locale,key),key);}assert.equal(forms.translate('es',key),'Reinicia Scribble para activar los atajos globales.');});

test('all eleven file-tool card titles/descriptions and output label are explicitly localized',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
  const ast=require('prettier/plugins/babel').parsers.babel.parse(source,{});
  const fn=ast.program.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='renderUtilities');
  assert.ok(fn);let cards=[];
  function walk(node){if(!node||typeof node!=='object')return;if(node.type==='ArrayExpression'&&node.elements.length===4&&node.elements.every(item=>item?.type==='StringLiteral')&&/^[a-z]+-[a-z]+$/.test(node.elements[0].value))cards.push(node.elements.map(item=>item.value));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  walk(fn);assert.equal(cards.length,11);
  for(const locale of forms.locales){for(const [operation,title,description,format] of cards){for(const label of [title,description,'Output format']){assert.ok(Object.hasOwn(forms.catalogues[locale],label));if(locale!=='en')assert.notEqual(forms.translate(locale,label),label);}assert.equal(forms.translate(locale,operation),operation);if(format)assert.equal(forms.translate(locale,format),format);for(const token of description.match(/JPEG|PNG|WebP|JSON|MP3|WAV|M4A|Opus|MP4|WebM|PDF|YAML|TOML|Markdown/g)||[])assert.ok(forms.translate(locale,description).includes(token),`${locale}: missing ${token}`);}}
});

test('bounded shortcut/browser/utility labels and instructions have explicit eighteen-locale coverage',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
 const workflow=source.slice(source.indexOf('function renderAIUtilities()'),source.indexOf('function renderTones()'))+source.slice(source.indexOf('function shortcutBrowserOptions('),source.indexOf('function shortcutDescription('));
 const observed=[...workflow.matchAll(/(?:interfaceLabel|workflowText)\("([^"\n]+)"/g)].map(m=>m[1]);
 assert.ok(new Set(observed).size>=35);
 for(const key of observed)for(const locale of forms.locales)assert.ok(Object.hasOwn(forms.catalogues[locale],key),`${locale}: ${key}`);
 for(const key of ['{count} / 32 actions','Move action {number} up','Browser discovery unavailable: {error}','Up to 16 websites. Use {{text}} to insert the spoken query.'])for(const locale of forms.locales){assert.notEqual(forms.translate(locale,key),'');if(locale!=='en' && !(locale==='fr' && key==='{count} / 32 actions'))assert.notEqual(forms.translate(locale,key),key);}
 assert.equal(forms.translate('ja','System default browser'),'システムの既定ブラウザー');
});

test('experimental silence controls have original eighteen-locale labels and explicit scope',()=>{
  const keys=['Experimental','Enhanced cloud silence detection','Compare recorded audio with a measured noise baseline before cloud upload. Skip audio classified as silence.','Silence sensitivity','Higher values can skip quiet speech. This applies only to cloud speech; local transcription is unchanged.'];
  for(const locale of forms.locales) for(const key of keys) { assert.ok(Object.hasOwn(forms.catalogues[locale],key)); if(locale!=='en' && !(['es','pt'].includes(locale) && key==='Experimental')) assert.notEqual(forms.translate(locale,key),key); }
});

test('provider disclosures preserve technical names, parameter shape and local/cloud boundaries in all locales',()=>{
  const keys=['Choose where speech is transcribed','Local models run on this Mac for free. Choosing a cloud service sends the audio you transcribe to that provider. Its API may charge for usage.','Save speech configuration','Local transcription does not upload audio. Switching back to Local restores that behavior. Cloud file-size and duration limits depend on the provider.','Configure a language model','Save configuration','Test connection','Get Ollama','Download selected model','Ollama serves a local language model for cleanup, commands, summaries, and tones. No API key is needed.','Scribble starts its bundled Ollama runtime when needed. You can use a smaller model on a Mac with limited memory.','What gets sent?','Commands can include text, selected files and screen images you attach. Memory indexing sends reference text or supported PDF files to the configured provider. Scribble does not send audio to a text model or use telemetry.','Connection ready: {result}','Language model is connected.'];
  assert.equal(keys.length,15); for(const locale of forms.locales)for(const key of keys){assert.ok(Object.hasOwn(forms.catalogues[locale],key)); if(locale!=='en')assert.notEqual(forms.translate(locale,key),key); for(const token of key.match(/Ollama|Scribble|Mac|API|\{result\}/g)||[])assert.ok(forms.translate(locale,key).includes(token));}
});

test('every provider privacy disclosure explicitly includes PDF uploads',()=>{const key='Commands can include text, selected files and screen images you attach. Memory indexing sends reference text or supported PDF files to the configured provider. Scribble does not send audio to a text model or use telemetry.';for(const locale of forms.locales)assert.match(forms.translate(locale,key),/PDF/);});

test("Command context controls have original translations in all 18 locales",()=>{const keys=["Command Mode enabled", "Screen context", "Drag to choose screen regions while recording", "Turn off to disable voice and typed commands.", "Include a screen image when a command starts. Selected images are sent to your configured AI provider.", "Choose at least one region while recording. With this option on, typed commands use only screen images you attach manually.", "Allow Screen Recording", "Refresh screen permission", "Screen Recording access is required for screen context."];for(const locale of forms.locales)for(const key of keys){assert.ok(Object.hasOwn(forms.catalogues[locale],key));if(locale!=="en")assert.notEqual(forms.translate(locale,key),key);}});

test("native region instructions preserve bounded plain labels and literal count parameters in all locales",()=>{const keys=["Drag to select up to five regions. Stop recording when finished.", "{count} of {max} regions selected.", "Five screen regions are already selected."];for(const locale of forms.locales)for(const key of keys){const text=forms.translate(locale,key);assert.ok(Object.hasOwn(forms.catalogues[locale],key));assert.ok(text.length<=200);assert.doesNotMatch(text,/[<>]/);if(locale!=="en")assert.notEqual(text,key);if(key.includes("{count}")){assert.ok(text.includes("{count}"));assert.ok(text.includes("{max}"));}}});
