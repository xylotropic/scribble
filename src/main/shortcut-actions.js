"use strict";
const { BROWSER_IDS, GECKO_IDS } = require("./browser-catalog");
const path = require("node:path"),
  os = require("node:os");
const { resolveWebsite, resolveCommonFolder } = require("./voice-routing");
function safeString(value, max = 4096) {
  return typeof value === "string" &&
    value.trim() &&
    value.length <= max &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value.trim()
    : null;
}
function resolvePath(value, homeDir) {
  const text = safeString(value);
  if (!text) return null;
  const expanded =
    text === "~"
      ? homeDir
      : text.startsWith("~/")
        ? path.join(homeDir, text.slice(2))
        : text;
  return path.isAbsolute(expanded) ? path.normalize(expanded) : null;
}
// Pure planning only. No existence checks, Launch Services calls or browsing.
function planShortcutActions(
  shortcut,
  query = "",
  { homeDir = os.homedir() } = {},
) {
  if (
    !shortcut ||
    typeof shortcut !== "object" ||
    typeof query !== "string" ||
    query.length > 16000 ||
    !safeString(homeDir) ||
    !path.isAbsolute(homeDir)
  )
    return null;
  let actions = shortcut.actions;
  if (actions === undefined) {
    const target = shortcut.target || shortcut.url;
    if (target === "navigate") {
      const url = resolveWebsite(query, "", { allowMailto: true });
      return url
        ? {
            actions: [
              { type: "websites", urls: [url], browser: "chrome", profile: "" },
            ],
            query,
          }
        : null;
    }
    if (target === "folder") {
      const folder = resolveCommonFolder(query);
      if (folder === null) return null;
      return {
        actions: [
          {
            type: "folders",
            paths: [
              path.isAbsolute(folder) ? folder : path.join(homeDir, folder),
            ],
          },
        ],
        query,
      };
    }
    if (shortcut.type === "app")
      actions = [
        { type: "application", name: target, folder: shortcut.folder },
      ];
    else if (shortcut.type === "folder")
      actions = [{ type: "folders", paths: [target] }];
    else
      actions = [
        {
          type: "websites",
          urls: [target],
          browser: shortcut.browser || "chrome",
          profile: shortcut.profile || "",
        },
      ];
  }
  if (!Array.isArray(actions) || !actions.length || actions.length > 32)
    return null;
  const plan = [];
  for (const action of actions) {
    if (!action || typeof action !== "object") return null;
    if (action.type === "websites") {
      if (
        !Array.isArray(action.urls) ||
        !action.urls.length ||
        action.urls.length > 16
      )
        return null;
      const urls = action.urls.map((value) => resolveWebsite(value, query));
      if (urls.some((url) => url === null)) return null;
      const profile = action.profile === undefined ? "" : action.profile;
      const browser = action.browser === undefined ? "chrome" : action.browser;
      if (
        typeof browser !== "string" ||
        !["default", ...BROWSER_IDS].includes(browser) ||
        typeof profile !== "string"
      )
        return null;
      if (
        ["default", "safari"].includes(browser)
          ? profile !== ""
          : GECKO_IDS.includes(browser)
            ? !/^$|^Profile[0-9]{1,6}$/.test(profile)
            : !/^$|^Default$|^Profile [0-9]{1,6}$/.test(profile)
      )
        return null;
      plan.push({ type: "websites", urls, browser, profile });
    } else if (action.type === "application") {
      const name = safeString(action.name, 200);
      if (!name) return null;
      const folder =
        action.folder === undefined ||
        action.folder === null ||
        action.folder === ""
          ? ""
          : resolvePath(action.folder, homeDir);
      if (action.folder && folder === null) return null;
      plan.push({ type: "application", name, folder });
    } else if (action.type === "folders") {
      if (
        !Array.isArray(action.paths) ||
        !action.paths.length ||
        action.paths.length > 16
      )
        return null;
      const paths = action.paths.map((value) => resolvePath(value, homeDir));
      if (paths.some((value) => value === null)) return null;
      plan.push({ type: "folders", paths });
    } else return null;
  }
  return { actions: plan, query };
}
module.exports = { planShortcutActions, resolvePath };
