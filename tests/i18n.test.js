'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const i18n=require('../src/shared/i18n.js');
test('all eighteen original catalogues cover the same nonempty plain-text keys and parameters',()=>{
  assert.deepEqual(i18n.locales.map(x=>x.id).sort(),['en','bg','cs','de','es','fr','it','ja','ko','pl','pt','ru','sv','tr','uk','vi','zh','zh-TW'].sort());
  const keys=Object.keys(i18n.catalogues.en).sort(),parameters=text=>[...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(x=>x[1]).sort();
  assert.ok(keys.length>=37);
  for(const locale of i18n.locales){assert.equal(locale.dir,'ltr');assert.ok(locale.name);assert.deepEqual(Object.keys(i18n.catalogues[locale.id]).sort(),keys);for(const key of keys){const translated=i18n.t(locale.id,key);assert.equal(typeof translated,'string');assert.ok(translated.trim(),`${locale.id}:${key}`);assert.doesNotMatch(translated,/<[^>]*>/);assert.deepEqual(parameters(translated),parameters(i18n.catalogues.en[key]));}}
});
test('browser without Node gets the same frozen localization API',()=>{
  const context=vm.createContext({Intl,Date});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/shared/i18n.js'),'utf8'),context);
  assert.equal(context.ScribbleI18n.t('ja','action.save'),'保存');assert.equal(context.ScribbleI18n.locales.length,18);assert.equal(context.require,undefined);assert.equal(context.module,undefined);assert.ok(Object.isFrozen(context.ScribbleI18n));assert.ok(Object.isFrozen(i18n.catalogues.de));
});
test('locale validation canonicalizes supported IDs and uses English for invalid preferences',()=>{
  assert.equal(i18n.resolveLocale('ZH-tw'),'zh-TW');assert.equal(i18n.t('DE','nav.home'),'Startseite');for(const value of [undefined,null,{},'invalid','__proto__','constructor','ar']){assert.equal(i18n.resolveLocale(value),'en');assert.equal(i18n.t(value,'action.save'),'Save');}assert.equal(i18n.t('de','missing.key'),'missing.key');assert.equal(i18n.t('de','__proto__'),'__proto__');assert.equal(i18n.t('de',null),'');
});
test('formatting follows selected UI locale and documented regional choices',()=>{
  assert.equal(i18n.formattingLocale('pt'),'pt-BR');assert.equal(i18n.formattingLocale('zh'),'zh-CN');assert.equal(i18n.formattingLocale('zh-TW'),'zh-TW');const instant=new Date('2026-10-07T14:05:00Z'),options={dateStyle:'short',timeStyle:'short',timeZone:'UTC'};
  for(const locale of i18n.locales){assert.equal(i18n.formatDate(locale.id,instant,options),new Intl.DateTimeFormat(locale.formatLocale,options).format(instant));assert.equal(i18n.formatNumber(locale.id,12345.6),new Intl.NumberFormat(locale.formatLocale).format(12345.6));}
  assert.equal(i18n.formatDate('en','not-a-date'),'');assert.equal(i18n.formatNumber('en',Infinity),'');assert.equal(i18n.formatNumber('en','123'),'');
});
test('plural rules select actual locale categories with a bounded other fallback',()=>{
  const forms={one:'one {count}',few:'few {count}',many:'many {count}',other:'other {count}'};
  assert.equal(i18n.plural('en',1,forms),'one 1');assert.equal(i18n.plural('en',2,forms),'other 2');assert.equal(i18n.plural('pl',2,forms),'few 2');assert.equal(i18n.plural('pl',5,forms),'many 5');assert.equal(i18n.plural('ja',1,forms),'other 1');assert.equal(i18n.plural('pl',2,{other:'fallback {count}'}),'fallback 2');assert.equal(i18n.plural('en',NaN,forms),'');assert.equal(i18n.plural('en',1,Object.create({one:'inherited'})),'');
});
test('parameters are single-pass literal text; no markup interpretation or implicit escaping',()=>{
  const hostile='<img src=x onerror=alert(1)> & "quoted"';
  assert.equal(i18n.t('en','{value}',{value:hostile}),hostile);
  assert.equal(i18n.t('en','{value}',{value:'{other}',other:'second pass'}),'{other}');
  assert.equal(i18n.t('en','{value}',Object.create({value:'inherited'})),'{value}');
  assert.equal(i18n.plural('en',1,{one:'{name}: {count}'},{name:hostile}),hostile+': 1');
  assert.equal(i18n.t('fr','action.copy'),'Copier');
});
test('tray and overlay state/control labels exist independently in every catalogue',()=>{
  const keys=['tray.open','tray.startDictation','tray.startNote','tray.pasteLast','tray.quit','tray.tagline','overlay.ready','mode.dictation','mode.command','mode.note','state.recording','state.processing','state.paused','state.muted','overlay.cancelRecording','overlay.stopRecording','overlay.chooseTone','tone.automatic','overlay.microphoneLevel'];
  assert.equal(Object.keys(i18n.catalogues.en).length,61);
  for(const locale of i18n.locales){for(const key of keys){assert.ok(Object.hasOwn(i18n.catalogues[locale.id],key));assert.notEqual(i18n.t(locale.id,key),key);assert.ok(i18n.t(locale.id,key).trim());}assert.notEqual(i18n.t(locale.id,'overlay.cancelRecording'),i18n.t(locale.id,'overlay.stopRecording'));assert.notEqual(i18n.t(locale.id,'state.recording'),i18n.t(locale.id,'state.processing'));assert.match(i18n.t(locale.id,'tray.open'),/Scribble/);assert.match(i18n.t(locale.id,'tray.quit'),/Scribble/);}
  assert.equal(i18n.t('es','tray.startNote'),'Iniciar una nota');assert.equal(i18n.t('ja','state.paused'),'一時停止中');assert.equal(i18n.t('zh-TW','overlay.microphoneLevel'),'麥克風音量');assert.equal(i18n.t('invalid','tray.pasteLast'),'Paste last dictation');
});

test('recording lifecycle messages remain provider neutral with identical level parameters',()=>{for(const locale of i18n.locales){for(const key of ['overlay.starting','overlay.listening','overlay.transcribing','overlay.failed'])assert.ok(Object.hasOwn(i18n.catalogues[locale.id],key));assert.equal(i18n.t(locale.id,'overlay.level',{level:42}),'42%');assert.equal(i18n.t(locale.id,'overlay.level'),'\u007blevel\u007d%');assert.doesNotMatch(i18n.t(locale.id,'overlay.transcribing'),/local|cloud/i);}});
