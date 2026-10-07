"use strict";
const path = require("node:path"),
  os = require("node:os"),
  defaultFS = require("node:fs").promises;
const CATALOG = [
  ["chrome", "Google Chrome", "chromium", "Google Chrome.app", "Google/Chrome"],
  [
    "chrome-beta",
    "Google Chrome Beta",
    "chromium",
    "Google Chrome Beta.app",
    "Google/Chrome Beta",
  ],
  [
    "chrome-canary",
    "Google Chrome Canary",
    "chromium",
    "Google Chrome Canary.app",
    "Google/Chrome Canary",
  ],
  [
    "edge",
    "Microsoft Edge",
    "chromium",
    "Microsoft Edge.app",
    "Microsoft Edge",
  ],
  [
    "edge-beta",
    "Microsoft Edge Beta",
    "chromium",
    "Microsoft Edge Beta.app",
    "Microsoft Edge Beta",
  ],
  [
    "brave",
    "Brave",
    "chromium",
    "Brave Browser.app",
    "BraveSoftware/Brave-Browser",
  ],
  [
    "brave-beta",
    "Brave Beta",
    "chromium",
    "Brave Browser Beta.app",
    "BraveSoftware/Brave-Browser-Beta",
  ],
  ["vivaldi", "Vivaldi", "chromium", "Vivaldi.app", "Vivaldi"],
  ["opera", "Opera", "chromium", "Opera.app", "com.operasoftware.Opera"],
  [
    "opera-gx",
    "Opera GX",
    "chromium",
    "Opera GX.app",
    "com.operasoftware.OperaGX",
  ],
  ["chromium", "Chromium", "chromium", "Chromium.app", "Chromium"],
  ["arc", "Arc", "chromium", "Arc.app", "Arc/User Data"],
  ["dia", "Dia", "chromium", "Dia.app", "Dia/User Data"],
  ["comet", "Comet", "chromium", "Comet.app", "Comet"],
  ["firefox", "Firefox", "gecko", "Firefox.app", "Firefox"],
  [
    "firefox-developer",
    "Firefox Developer Edition",
    "gecko",
    "Firefox Developer Edition.app",
    "Firefox",
  ],
  ["zen", "Zen Browser", "gecko", "Zen.app", "zen"],
  ["librewolf", "LibreWolf", "gecko", "LibreWolf.app", "LibreWolf"],
  ["safari", "Safari", "webkit", "Safari.app", null],
];
const BROWSER_IDS = Object.freeze(CATALOG.map((row) => row[0]));
const GECKO_IDS = Object.freeze(
  CATALOG.filter((row) => row[2] === "gecko").map((row) => row[0]),
);
const BINARIES = {
  firefox: "firefox",
  "firefox-developer": "firefox",
  zen: "zen",
  librewolf: "librewolf",
};
const MAX_FILE = 2 * 1024 * 1024;
function label(value, max = 100) {
  return typeof value === "string" &&
    value.trim() &&
    value.length <= max &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value.trim()
    : null;
}
function beneath(base, target) {
  const relative = path.relative(base, target);
  return (
    !relative.startsWith(".." + path.sep) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}
async function safeStat(fs, base, target) {
  if (!beneath(base, target)) return null;
  try {
    let current = base;
    let info = await fs.lstat(current);
    if (info.isSymbolicLink()) return null;
    for (const part of path
      .relative(base, target)
      .split(path.sep)
      .filter(Boolean)) {
      current = path.join(current, part);
      info = await fs.lstat(current);
      if (info.isSymbolicLink()) return null;
    }
    return info;
  } catch {
    return null;
  }
}
async function readMetadata(fs, homeDir, file) {
  const stat = await safeStat(fs, homeDir, file);
  if (!stat || !stat.isFile() || stat.size > MAX_FILE) return null;
  try {
    const text = await fs.readFile(file, "utf8");
    return Buffer.byteLength(text, "utf8") <= MAX_FILE ? text : null;
  } catch {
    return null;
  }
}
async function chromiumProfiles(fs, homeDir, root) {
  const text = await readMetadata(fs, homeDir, path.join(root, "Local State"));
  if (text === null) return [];
  try {
    const cache = JSON.parse(text)?.profile?.info_cache;
    if (!cache || typeof cache !== "object" || Array.isArray(cache)) return [];
    const profiles = [];
    for (const [id, info] of Object.entries(cache).slice(0, 64)) {
      if (
        !/^(Default|Profile [0-9]{1,6})$/.test(id) ||
        !info ||
        typeof info !== "object"
      )
        continue;
      const name = label(info.name) || id;
      const stat = await safeStat(fs, homeDir, path.join(root, id));
      if (stat?.isDirectory()) profiles.push({ id, name });
    }
    return profiles;
  } catch {
    return [];
  }
}
function iniSections(text) {
  const sections = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^[;#]/.test(trimmed)) continue;
    const section = trimmed.match(/^\[(Profile[0-9]{1,6})\]$/);
    if (section) {
      if (sections.length >= 64) break;
      current = { section: section[1] };
      sections.push(current);
    } else if (/^\[/.test(trimmed)) {
      current = null;
    } else if (current) {
      const equal = trimmed.indexOf("=");
      if (equal > 0) {
        const key = trimmed.slice(0, equal);
        if (["Name", "Path", "IsRelative"].includes(key))
          current[key] = trimmed.slice(equal + 1);
      }
    }
  }
  return sections;
}
async function geckoProfiles(fs, homeDir, root) {
  const text = await readMetadata(fs, homeDir, path.join(root, "profiles.ini"));
  if (text === null) return [];
  const profiles = [];
  for (const entry of iniSections(text)) {
    const name = label(entry.Name),
      relative = entry.Path;
    if (
      !name ||
      entry.IsRelative !== "1" ||
      typeof relative !== "string" ||
      relative.length > 300 ||
      relative.includes("\\") ||
      relative
        .split("/")
        .some((p) => !p || p === "." || p === ".." || !label(p, 100)) ||
      path.isAbsolute(relative)
    )
      continue;
    const target = path.join(root, relative);
    const stat = await safeStat(fs, root, target);
    if (stat?.isDirectory()) profiles.push({ id: entry.section, name });
  }
  return profiles;
}
async function listBrowsers({ fs = defaultFS, homeDir = os.homedir() } = {}) {
  if (!label(homeDir, 4096) || !path.isAbsolute(homeDir))
    throw Error("Invalid home directory");
  const result = [];
  for (const [id, name, family, app, metadata] of CATALOG) {
    let executable = null,
      bundlePath = null;
    for (const base of [
      "/Applications",
      path.join(homeDir, "Applications"),
      ...(id === "safari" ? ["/System/Applications", "/System/Cryptexes/App/System/Applications"] : []),
    ]) {
      const candidate = path.join(base, app),
        stat = await safeStat(fs, base, candidate);
      if (stat?.isDirectory()) {
        const binary = path.join(
          candidate,
          "Contents/MacOS",
          BINARIES[id] || app.replace(/\.app$/, ""),
        );
        const binaryStat = await safeStat(fs, base, binary);
        if (binaryStat?.isFile()) {
          bundlePath = candidate;
          executable = binary;
          break;
        }
      }
    }
    if (!executable) continue;
    const root = metadata
      ? path.join(homeDir, "Library/Application Support", metadata)
      : null;
    const profiles =
      family === "chromium"
        ? await chromiumProfiles(fs, homeDir, root)
        : family === "gecko"
          ? await geckoProfiles(fs, homeDir, root)
          : [];
    result.push({ id, name, family, bundlePath, executable, profiles });
  }
  return result;
}
module.exports = { listBrowsers, BROWSER_IDS, GECKO_IDS };
