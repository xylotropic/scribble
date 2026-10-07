"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const { normalizeSpeechPreferences: normalize } = require('../src/main/speech-preferences');
const models = [ { id:'english', englishOnly:true }, { id:'japanese', engine:'catalog', language:'ja' }, { id:'multi', engine:'parakeet' } ];
test('fixed-language models reset incompatible selections and translation engines reset unsupported mode', () => {
  assert.deepEqual(normalize({ speechProvider:'local', modelId:'english', language:'fr' }, models), { language:'auto' });
  assert.deepEqual(normalize({ speechProvider:'local', modelId:'japanese', language:'ja', translate:true }, models), { translate:false });
  assert.deepEqual(normalize({ speechProvider:'local', modelId:'multi', language:'fr', translate:false }, models), {});
  assert.deepEqual(normalize({ speechProvider:'deepgram', modelId:'english', language:'fr' }, models), {});
});
test('verified multilingual coverage resets incompatible languages while preserving supported hints and auto',()=>{
  const {PARAKEET_MODELS}=require('../src/main/parakeet'),{CATALOG_MODELS}=require('../src/main/catalog-engine');const all=[...PARAKEET_MODELS,...CATALOG_MODELS];
  const pref=(modelId,language)=>normalize({speechProvider:'local',modelId,language},all);
  assert.equal(PARAKEET_MODELS.find(x=>x.id==='parakeet-v3').supportedLanguages.length,25);
  assert.deepEqual(pref('parakeet-v3','ja'),{language:'auto'});assert.deepEqual(pref('parakeet-v3','mt'),{});assert.deepEqual(pref('parakeet-v3','auto'),{});
  assert.deepEqual(pref('nemotron-multilingual','vi-VN'),{});assert.deepEqual(pref('nemotron-multilingual','vi'),{language:'auto'});assert.deepEqual(pref('nemotron-multilingual','fr-CA'),{});assert.deepEqual(pref('nemotron-multilingual','el-GR'),{language:'auto'});
  assert.deepEqual(pref('parakeet-v2','fr'),{language:'auto'});assert.deepEqual(pref('nemotron-en','en'),{});
  for(const m of all)assert.equal(new Set(m.supportedLanguages).size,m.supportedLanguages.length);
});
