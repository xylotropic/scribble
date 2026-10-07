"use strict";
// OS effects are injected so a failed step never becomes a successful action.
async function executeShortcutPlan(plan, effects) {
  for (const action of plan) {
    if (action.type === "websites") await effects.openWebsites(action.urls, action.profile, action.browser || "chrome");
    else if (action.type === "application") await effects.launchApplication(action.name, action.folder);
    else if (action.type === "folders") {
      for (const folder of action.paths) {
        const error = await effects.openFolder(folder);
        if (error) throw Error(error);
      }
    } else throw Error("Unsupported shortcut action");
  }
  return { completed: plan.length };
}
module.exports = { executeShortcutPlan };
