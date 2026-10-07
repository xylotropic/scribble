"use strict";
const { spawn } = require("node:child_process");
const { listBrowsers } = require("./browser-catalog");
function launchProcess(executable, args, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(executable, args, { detached: true, stdio: "ignore" });
    let timer;
    const finish = (error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
    child.once("error", finish);
    child.once("exit", (code, signal) => finish(code === 0 ? null : Error(`Browser launch failed (${signal || code})`)));
    child.once("spawn", () => {
      child.unref();
      // Existing browser processes generally return immediately after forwarding
      // the request. Catch immediate launch failures without waiting for the
      // lifetime of a newly opened browser. Window creation needs runtime checks.
      timer = setTimeout(() => finish(), 300);
    });
  });
}
async function launchWebsites(urls, profile = "", browser = "chrome", { catalog = listBrowsers, launch = launchProcess } = {}) {
  if (!Array.isArray(urls) || !urls.length || urls.length > 16 || urls.some(value => {
    try { const url = new URL(value); return typeof value !== "string" || value.length > 8192 || !["http:", "https:"].includes(url.protocol) || !!url.username || !!url.password; }
    catch { return true; }
  })) throw Error("Enter valid websites to open");
  const fallback = async () => { await launch("/usr/bin/open", urls); return { browser: "default", fallback: browser !== "default" }; };
  if (browser === "default") return fallback();
  const installed = await catalog().catch(() => []);
  const selected = installed.find(item => item.id === browser);
  const selectedProfile = profile ? selected?.profiles.find(item => item.id === profile) : null;
  if (!selected || (profile && !selectedProfile)) return fallback();
  const args = selected.family === "chromium"
    ? ["--new-window", ...(profile ? ["--profile-directory=" + profile] : []), ...urls]
    : selected.family === "gecko"
      ? [...(profile ? ["-P", selectedProfile.name] : []), "-new-window", urls[0], ...urls.slice(1).flatMap(url => ["-new-tab", url])]
      : urls;
  try {
    await launch(selected.executable, args);
    return { browser, fallback: false };
  } catch { return fallback(); }
}
module.exports = { launchWebsites, launchProcess };
