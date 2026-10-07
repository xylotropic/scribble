"use strict";
const BUILTIN_ALIASES = Object.freeze({
  google: ["hey google"],
  youtube: ["you tube"],
  "duck duck go": ["duckduckgo", "duck duckgo"],
  "ask chat gpt": ["ask chat gbt", "ask chatgpt", "ask chat g p t"],
  "ask claude": ["ask clawed"],
  "ask perplexity": [],
  "navigate to": [],
  open: [],
});
const normalized = (value) =>
  value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const canonical = (value) => normalized(value).toLowerCase();
function similarity(a, b) {
  const x = Array.from(a),
    y = Array.from(b);
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    prev = next;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length, 1);
}
function candidates(shortcuts) {
  const out = [];
  outer: for (const [order, shortcut] of shortcuts.slice(0, 512).entries()) {
    if (
      !shortcut ||
      shortcut.enabled === false ||
      typeof shortcut.trigger !== "string" ||
      !shortcut.trigger.trim() ||
      shortcut.trigger.length > 120
    )
      continue;
    const aliases = Array.isArray(shortcut.aliases)
      ? shortcut.aliases.slice(0, 30)
      : [];
    if (shortcut.builtin === true)
      aliases.push(...(BUILTIN_ALIASES[canonical(shortcut.trigger)] || []));
    for (const raw of [shortcut.trigger, ...aliases]) {
      if (typeof raw !== "string" || !raw.trim() || raw.length > 120) continue;
      const trigger = normalized(raw);
      out.push({ shortcut, trigger, key: trigger.toLowerCase(), order });
      if (out.length >= 2048) break outer;
    }
  }
  return out.sort(
    (a, b) =>
      Array.from(b.trigger).length - Array.from(a.trigger).length ||
      Number(a.shortcut.builtin === true) -
        Number(b.shortcut.builtin === true) ||
      a.order - b.order,
  );
}
function prefix(input, trigger) {
  if (!input.toLowerCase().startsWith(trigger)) return null;
  const rest = input.slice(trigger.length);
  return !rest || !/[\p{L}\p{N}\p{M}_]/u.test(rest[0])
    ? rest.replace(/^[\s,:;.!?]+/u, "").trim()
    : null;
}
function matchVoiceShortcut(text, shortcuts = []) {
  if (
    typeof text !== "string" ||
    text.length > 16000 ||
    !Array.isArray(shortcuts)
  )
    return null;
  const input = normalized(text),
    stripped = input.replace(
      /^(?:(?:can you|could you|please|hey|okay|ok|um|uh|so|well|like)[\s,]+)+/i,
      "",
    );
  const options = candidates(shortcuts);
  for (const [tier, value] of [
    ["exact", input],
    ["filler", stripped],
  ]) {
    if (!value || (tier === "filler" && value === input)) continue;
    for (const option of options) {
      const query = prefix(value, option.key);
      if (query !== null)
        return {
          shortcut: option.shortcut,
          query,
          text: value,
          matchTier: tier,
          matchedTrigger: option.trigger,
        };
    }
  }
  const words = stripped.split(" ");
  for (const option of options) {
    if (Array.from(option.key).length < 4) continue;
    const count = option.key.split(" ").length;
    if (words.length < count) continue;
    const spoken = words.slice(0, count).join(" "),
      lower = spoken.toLowerCase();
    // A longer word beginning with an exact trigger is ordinary text, not a fuzzy boundary.
    if (
      lower.startsWith(option.key) &&
      lower.length > option.key.length &&
      /[\p{L}\p{N}\p{M}_]/u.test(lower[option.key.length])
    )
      continue;
    if (similarity(lower, option.key) >= 0.75)
      return {
        shortcut: option.shortcut,
        query: words.slice(count).join(" "),
        text: stripped,
        matchTier: "fuzzy",
        matchedTrigger: option.trigger,
      };
  }
  return null;
}
function resolveWebsite(value, query = "") {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    typeof query !== "string" ||
    query.length > 16000
  )
    return null;
  let address = value
    .trim()
    .replace(/\{\{text\}\}/g, () => encodeURIComponent(query));
  address = address
    .replace(/^["“'‘]+|["”'’]+$/gu, "")
    .replace(/[.!?,;]+$/u, "")
    .replace(/\s+dot\s+/gi, ".");
  if (!address || /\s/u.test(address)) return null;
  const scheme = /^[a-z][a-z\d+.-]*:/i.test(address);
  if (scheme && !/^https?:\/\//i.test(address)) return null;
  if (
    !scheme &&
    !/^(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+(?::\d+)?(?:[/?#]|$)/u.test(address)
  )
    return null;
  try {
    const url = new URL(scheme ? address : "https://" + address);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname ||
      url.hostname.includes("..")
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
function resolveCommonFolder(value) {
  if (typeof value !== "string" || value.length > 200) return null;
  const name = canonical(value)
    .replace(/[.!?,]+$/u, "")
    .replace(/^the /, "")
    .replace(/\s+folder$/, "");
  const folders = {
    document: "Documents",
    documents: "Documents",
    download: "Downloads",
    downloads: "Downloads",
    desktop: "Desktop",
    picture: "Pictures",
    pictures: "Pictures",
    music: "Music",
    movie: "Movies",
    movies: "Movies",
    home: "",
    application: "/Applications",
    applications: "/Applications",
  };
  return Object.hasOwn(folders, name) ? folders[name] : null;
}
module.exports = {
  matchVoiceShortcut,
  resolveWebsite,
  resolveCommonFolder,
  similarity,
};
