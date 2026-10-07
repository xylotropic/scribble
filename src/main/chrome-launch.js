"use strict";
const path = require("node:path");
const defaults = { fs: require("node:fs"), spawn: require("node:child_process").spawn, homeDir: require("node:os").homedir() };
async function launchChromeWebsites(urls, profile = "", { fs, spawn, homeDir } = defaults) {
  if (!Array.isArray(urls) || !urls.length || urls.length > 16 || urls.some((url) => {
    if (typeof url !== "string" || url.length > 8192) return true;
    try { const parsed = new URL(url); return !["http:", "https:"].includes(parsed.protocol) || !!parsed.username || !!parsed.password; }
    catch { return true; }
  })) throw Error("Enter valid websites to open");
  const locations = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    path.join(homeDir, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  ];
  const executable = locations.find((location) => fs.existsSync(location));
  if (!executable) throw Error("Google Chrome is not installed");
  if (profile) {
    if (!/^(?:Default|Profile [0-9]{1,6})$/.test(profile))
      throw Error("Invalid Chrome profile directory");
    const profilePath = path.join(homeDir, "Library/Application Support/Google/Chrome", profile);
    const info = await fs.promises.lstat(profilePath).catch(() => null);
    if (!info?.isDirectory() || info.isSymbolicLink())
      throw Error("The selected Chrome profile is unavailable");
  }
  // Launch arguments are separate values, never shell text or a new profile path.
  await new Promise((resolve, reject) => {
    const child = spawn(executable, ["--new-window", ...(profile ? ["--profile-directory=" + profile] : []), ...urls], {
      detached: true, stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}
module.exports = { launchChromeWebsites };
