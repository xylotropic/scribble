(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScribbleMicrophonePreferences = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function validatePriority(value, allowNull = false, maximum = 32) {
    if (allowNull && value === null) return null;
    if (!Array.isArray(value) || value.length > maximum || value.some(id => typeof id !== 'string' || !id.trim() || id.length > 512) || new Set(value).size !== value.length) throw Error('Invalid microphone priority');
    return value.slice();
  }
  function validateLabels(value) {
    if (!Array.isArray(value) || value.length > 128) throw Error('Invalid microphone labels');
    const seen = new Set();
    return value.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(key => !['id','name'].includes(key)) || !Object.hasOwn(entry,'id') || !Object.hasOwn(entry,'name') ||
          typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 512 || /[\x00-\x1f\x7f]/.test(entry.id) || seen.has(entry.id) ||
          typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 200 || /[\x00-\x1f\x7f]/.test(entry.name)) throw Error('Invalid microphone labels');
      seen.add(entry.id);
      return {id:entry.id,name:entry.name.trim()};
    });
  }
  function rankedIds(settings) {
    const legacy = settings.microphoneId || 'default';
    validatePriority([legacy]);
    return new Set([...validatePriority(settings.microphonePriority ?? []), settings.microphoneId || 'default', ...(validatePriority(settings.meetingMicrophonePriority ?? null,true,33) || [])].filter(id => id !== 'default'));
  }
  function mergeLabels(settings, updates = []) {
    const ranked = rankedIds(settings), labels = new Map(validateLabels(settings.microphoneLabels ?? []).map(entry => [entry.id,entry.name]));
    for (const entry of validateLabels(updates)) if (ranked.has(entry.id)) labels.set(entry.id,entry.name);
    return [...labels].filter(([id]) => ranked.has(id)).map(([id,name]) => ({id,name}));
  }
  function captureCandidates(settings, mode = 'dictation') {
    if (!settings || typeof settings !== 'object' || !['dictation', 'meeting', 'command'].includes(mode)) throw Error('Invalid microphone capture preferences');
    const global = validatePriority(settings.microphonePriority ?? []);
    const meeting = validatePriority(settings.meetingMicrophonePriority === undefined ? null : settings.meetingMicrophonePriority, true, 33);
    const override = mode === 'meeting' && meeting !== null;
    const chain = override ? meeting : global;
    const auto = chain.indexOf('default');
    if (auto >= 0) return chain.slice(0, auto + 1);
    if (override) return chain.length ? chain.slice() : ['default'];
    const legacy = settings.microphoneId || 'default';
    if (typeof legacy !== 'string' || !legacy.trim() || legacy.length > 512) throw Error('Invalid microphone selection');
    return chain.includes(legacy) ? chain.slice() : [...chain, legacy];
  }
  // Indices are zero-based; callers retain a separate immutable priority array.
  function moveRank(priority, from, to) {
    const result = validatePriority(priority, false, 33);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= result.length || to >= result.length) throw Error('Invalid microphone rank');
    result.splice(to, 0, result.splice(from, 1)[0]);
    return result;
  }
  function removeDisconnected(priority, availableIds) {
    const result = validatePriority(priority, false, 33);
    const available = validatePriority(availableIds, false, 33);
    // Empty enumeration can mean permission has not been granted yet.
    if (!available.length) return result;
    return result.filter(id => id === 'default' || available.includes(id));
  }
  return { validateLabels, rankedIds, mergeLabels, validatePriority, captureCandidates, moveRank, removeDisconnected };
});
