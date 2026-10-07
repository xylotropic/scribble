"use strict";
function normalizeSpeechPreferences(settings, models) {
  if (settings.speechProvider !== "local") return {};
  const model = models.find((item) => item.id === settings.modelId);
  if (!model) return {};
  const fixed = model.englishOnly ? "en" : model.language && model.language !== "auto" ? model.language : null;
  const patch = {};
  if (fixed && !["auto", fixed].includes(settings.language)) patch.language = "auto";
  if (Array.isArray(model.supportedLanguages) && settings.language !== "auto" && !model.supportedLanguages.includes(settings.language)) patch.language = "auto";
  if (["parakeet", "catalog"].includes(model.engine) && settings.translate) patch.translate = false;
  return patch;
}
module.exports = { normalizeSpeechPreferences };
