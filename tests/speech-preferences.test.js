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
