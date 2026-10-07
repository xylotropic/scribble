'use strict';
// Original selection policy. Context discovery and persistence belong to main.
function normalizeSite(value) {
  if (typeof value !== 'string' || !value.trim()) throw Error('Website required');
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) throw Error('Invalid website');
  return { host: url.hostname.toLowerCase().replace(/^www\./, ''), path: url.pathname.replace(/\/$/, '') || '/' };
}
function siteMatch(rule, current) {
  try { const a = normalizeSite(rule), b = normalizeSite(current); return a.host === b.host && (a.path === '/' || b.path === a.path || b.path.startsWith(`${a.path}/`)); } catch { return false; }
}
function enabled(tone) { return !!tone && tone.enabled !== false && typeof tone.id === 'string' && !!tone.id; }
function validateTone(tone) {
  if (!enabled({ ...tone, enabled: true }) || typeof tone.name !== 'string' || !tone.name.trim() || tone.name.length > 100) throw Error('Tone needs an ID and name');
  if (tone.apps != null && (!Array.isArray(tone.apps) || tone.apps.some(x => typeof x !== 'string' || !x.trim()))) throw Error('Invalid tone applications');
  if (tone.websites != null && !Array.isArray(tone.websites)) throw Error('Invalid tone websites');
  for (const website of tone.websites || []) normalizeSite(website);
  for (const key of ['speechEngine','speechModel','language','customInstructions']) if (tone[key] != null && typeof tone[key] !== 'string') throw Error(`Invalid tone ${key}`);
  if (tone.languageModel != null && (typeof tone.languageModel !== 'object' || Array.isArray(tone.languageModel) || typeof tone.languageModel.provider !== 'string' || typeof tone.languageModel.model !== 'string')) throw Error('Invalid language model');
  return structuredClone(tone);
}
function resolveTone(tones, context = {}, selection = {}) {
  const candidates = (Array.isArray(tones) ? tones : []).filter(enabled);
  const byID = id => candidates.find(t => t.id === id);
  // A invocation shortcut takes precedence over a session pin; pin beats automatic context.
  let tone = byID(context.hotkeyToneId); let reason = tone ? 'hotkey' : null;
  if (!tone) { tone = byID(selection.pinnedToneId); if (tone) reason = 'manual'; }
  if (!tone && context.url) {
    const matches = candidates.flatMap((t,index) => (t.websites || []).filter(r => siteMatch(r,context.url)).map(r => ({tone:t,index,length:normalizeSite(r).path.length})));
    matches.sort((a,b) => b.length-a.length || a.index-b.index); tone = matches[0]?.tone; if (tone) reason = 'website';
  }
  if (!tone && context.app) { tone = candidates.find(t => (t.apps || []).includes(context.app)); if (tone) reason = 'app'; }
  if (!tone) { tone = byID(selection.defaultToneId) || candidates.find(t => t.isDefault); if (tone) reason = 'default'; }
  return { tone: tone ? structuredClone(tone) : null, reason: reason || 'global' };
}
function applyTone(settings, resolution) {
  const next = structuredClone(settings); const tone = resolution?.tone; if (!enabled(tone)) return next;
  const mapping = { speechEngine:'speechProvider', speechModel:'modelId', language:'language' };
  for (const [from,to] of Object.entries(mapping)) if (tone[from] != null && tone[from] !== '') next[to] = tone[from];
  if (typeof tone.aiEnhancement === 'boolean') next.aiEnhance = tone.aiEnhancement;
  if (tone.languageModel) { next.aiProvider = tone.languageModel.provider; next.aiModel = tone.languageModel.model; }
  if (tone.customInstructions != null) next.toneInstructions = tone.customInstructions;
  next.activeToneId = tone.id; return next;
}
function pinTone(tones,id,selection = {}) { if (!tones.some(t => enabled(t) && t.id === id)) throw Error('Tone is unavailable'); return { ...selection,pinnedToneId:id }; }
function resetTone(selection = {}) { return { ...selection,pinnedToneId:null }; }
function shortcutConflicts(tones) { const seen = new Map(), conflicts=[]; for(const tone of tones.filter(enabled)){if(!tone.shortcut)continue;const key=typeof tone.shortcut==='string'?tone.shortcut:JSON.stringify({modifiers:[...(tone.shortcut.modifiers||[])].sort(),keys:[...(tone.shortcut.keys||[])].sort(),mouseButton:tone.shortcut.mouseButton??null});if(seen.has(key))conflicts.push({first:seen.get(key),second:tone.id});else seen.set(key,tone.id);}return conflicts; }
module.exports={normalizeSite,siteMatch,enabled,validateTone,resolveTone,applyTone,pinTone,resetTone,shortcutConflicts};
