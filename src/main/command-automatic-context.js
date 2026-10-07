"use strict";
// Only choices used by command transcription and AI; no hotkeys, UI history,
// microphone labels, or credential fields belong in a private command snapshot.
const CHOICE_KEYS = [
  'modelId','speechProvider','resourceMode','speechCloudModel','speechCloudVersion',
  'enhancedSilenceDetection','silenceSensitivity','language','translate',
  'removeFillers','punctuation','saveAudio','saveHistory','aiEnhance',
  'aiProvider','aiEndpoint','aiModel','aiDeployment','aiVersion','aiInstructions',
  'memoryEnabled','spelling','preferIPv4','activeToneId','toneInstructions',
];
function recentTerms(dictionary) {
  const entries = (Array.isArray(dictionary) ? dictionary : []).map((entry,index) => ({entry,index,time:typeof entry?.createdAt === 'string' ? Date.parse(entry.createdAt) : NaN})).filter(({entry}) => typeof entry?.word === 'string' && entry.word.trim());
  // Undated legacy entries follow dated additions; equal/unknown dates retain stored order.
  entries.sort((a,b) => (Number.isFinite(b.time) ? b.time : -Infinity) - (Number.isFinite(a.time) ? a.time : -Infinity) || a.index-b.index);
  return entries.slice(0,10).map(({entry}) => {
    const word = entry.word.trim();
    if (word.length > 512 || /[\x00-\x1f\x7f]/.test(word)) throw Error('Dictionary terms in command context must be at most 512 characters without control characters');
    return word;
  });
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze);Object.freeze(value); } return value; }
function captureContext({settings,dictionary,front={},resolution={}}) {
  const choices = {};
  for (const key of CHOICE_KEYS) if (Object.hasOwn(settings,key)) choices[key] = settings[key];
  if (JSON.stringify(choices).length > 256 * 1024) throw Error('Command settings snapshot is too large');
  const language = settings.language || 'auto';
  if (typeof language !== 'string' || language.length > 64 || /[\x00-\x1f\x7f]/.test(language)) throw Error('Invalid command language');
  const name = typeof front.name === 'string' && front.name.trim() && front.name.length <= 512 && !/[\x00-\x1f\x7f]/.test(front.name) ? front.name.trim() : null;
  const directive = resolution.tone ? settings.toneInstructions || '' : '';
  if (typeof directive !== 'string' || directive.length > 12000) throw Error('Command tone directive is too large');
  return freeze({settings:structuredClone(choices),terms:recentTerms(dictionary),appName:name,language,tone:resolution.tone ? {id:resolution.tone.id,directive,reason:resolution.reason || null} : null});
}
function promptContext(context) {
  if (!context) return '';
  return '\nAutomatic command context (activation snapshot; unavailable fields are null):\n' + JSON.stringify({vocabulary:context.terms,activeApp:context.appName,toneDirective:context.tone?.directive || null,transcriptionLanguage:context.language}) + '\nPreserve the vocabulary spellings. Apply the tone directive when present and consistent with the command. Respond in the configured language when it is not auto, unless the command requests another language.';
}
module.exports = {recentTerms,captureContext,promptContext};
