"use strict";

const defaults = Object.freeze({
  autoPaste: true,
  restoreClipboard: true,
  autoEnter: false,
  insertionMethod: "paste",
  removeFillers: true,
  punctuation: true,
  saveHistory: true,
  saveAudio: true,
  launchAtLogin: false,
  hideDock: false,
  soundEffects: true,
  soundVolume: 0.5,
  microphone: "default",
  microphonePriority: [],
  language: "auto",
  summaryLanguage: "auto",
  interfaceLanguage: "en",
  spelling: "us",
  indicatorStyle: "pill",
  indicatorPosition: "top",
  idlePill: false,
  transcriptionEngine: "whisper",
  speechModel: "base",
  enhance: false,
  enhancementInstructions: "",
  aiProvider: "local",
  aiModel: "",
  aiEndpoint: "http://localhost:11434/v1",
  commandEnabled: true,
  dictationShortcut: "CommandOrControl+Shift+Space",
  commandShortcut: "Alt+Shift+Space",
  handsFreeShortcut: "CommandOrControl+Alt+Space",
  recordingMode: "hold",
  theme: "system",
});

function freshState() {
  return {
    version: 1,
    settings: JSON.parse(JSON.stringify(defaults)),
    dictionary: [],
    threads: [],
    expansions: [],
    shortcuts: [],
    tones: [],
    memory: [],
    history: [],
    transcriptions: [],
    notes: [],
    reminders: [],
  };
}
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordEdge = (character) =>
  /[\p{L}\p{N}_]/u.test(character || "") &&
  !/[\u0e00-\u0fff\u1000-\u109f\u1780-\u17ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(
    character || "",
  );
function replacePhrase(text, trigger, replacement) {
  if (!String(trigger || "").trim()) return text;
  const t = String(trigger).trim();
  const pattern = `${wordEdge(t[0]) ? "(?<![\\p{L}\\p{N}_])" : ""}${escapeRegex(t)}${wordEdge(t.at(-1)) ? "(?![\\p{L}\\p{N}_])" : ""}`;
  return text.replace(new RegExp(pattern, "giu"), () =>
    String(replacement ?? ""),
  );
}
function normalizeTranscript(text, options = {}) {
  let result = String(text ?? "").trim();
  const replacements = [];
  for (const item of options.dictionary || []) {
    const preferred =
      typeof item === "string"
        ? item
        : item.word || item.preferred || item.replacement;
    if (!preferred) continue;
    const aliases = item.aliases || item.misspellings || [];
    for (const alias of Array.isArray(aliases)
      ? aliases
      : String(aliases).split("|"))
      replacements.push({ trigger: alias, replacement: preferred });
  }
  for (const item of options.threads || [])
    if (item.enabled !== false)
      replacements.push({
        trigger: item.trigger,
        replacement: item.replacement ?? item.expansion ?? item.text,
      });
  replacements.sort(
    (a, b) => String(b.trigger).length - String(a.trigger).length,
  );
  for (const item of replacements)
    result = replacePhrase(result, item.trigger, item.replacement);
  if (options.removeFillers)
    result = result.replace(
      /(?<![\p{L}\p{N}_])(?:um+|uh+|erm|you know)(?![\p{L}\p{N}_])[, ]*/giu,
      "",
    );
  if (options.punctuation) {
    const spoken = [
      ["new paragraph", "\n\n"],
      ["new line", "\n"],
      ["question mark", "?"],
      ["exclamation mark", "!"],
      ["full stop", "."],
      ["period", "."],
      ["comma", ","],
      ["colon", ":"],
      ["semicolon", ";"],
    ];
    for (const [trigger, replacement] of spoken)
      result = replacePhrase(result, trigger, replacement);
  }
  result = result
    .replace(/[ \t]+/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .replace(/ *\n */g, "\n")
    .trim();
  return result;
}
function expandTemplate(text, context = {}) {
  const date = new Date(context.date || Date.now());
  const values = {
    clipboard: context.clipboard || "",
    date: date.toLocaleDateString("en-CA"),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    selected_text: context.selected_text || "",
    ...context,
  };
  values.date = date.toLocaleDateString("en-CA");
  return String(text || "").replace(
    /\{\{(clipboard|date|time|selected_text|text)\}\}/g,
    (_, key) => String(values[key] ?? ""),
  );
}
function matchShortcut(text, shortcuts = []) {
  return require("./voice-routing").matchVoiceShortcut(text, shortcuts);
}
function parseCommand(text) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();
  let match;
  if (
    (match = lower.match(
      /^(?:set (?:a )?)?timer (?:for )?(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?)$/,
    ))
  )
    return {
      type: "timer",
      seconds:
        Number(match[1]) *
        (/hour/.test(match[2]) ? 3600 : /minute/.test(match[2]) ? 60 : 1),
    };
  if (
    (match = input.match(
      /^(?:remind me (?:to )?)(.+?)\s+in\s+(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?)$/i,
    ))
  )
    return {
      type: "reminder",
      message: match[1],
      seconds:
        Number(match[2]) *
        (/hour/i.test(match[3]) ? 3600 : /minute/i.test(match[3]) ? 60 : 1),
    };
  if (
    (match = input.match(
      /^(?:google|search(?: (?:google|the web))?(?: for)?)\s+(.+)$/i,
    ))
  )
    return {
      type: "url",
      url: `https://www.google.com/search?q=${encodeURIComponent(match[1])}`,
    };
  if ((match = input.match(/^(?:youtube|search youtube for)\s+(.+)$/i)))
    return {
      type: "url",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(match[1])}`,
    };
  if ((match = input.match(/^(?:navigate to|open website|go to)\s+(.+)$/i))) {
    const url = require("./voice-routing").resolveWebsite(match[1]);
    if (url) return { type: "url", url };
    return { type: "unknown", instruction: input };
  }
  if (
    (match = input.match(
      /^open\s+(?:the\s+)?(documents?|downloads?|desktop|pictures?|music|movies?|home|applications?)(?:\s+folder)?$/i,
    ))
  )
    return { type: "folder", folder: match[1].toLowerCase() };
  if ((match = input.match(/^(?:open|launch)(?: app)?\s+(.+)$/i)))
    return { type: "app", app: match[1] };
  if (/^(?:copy(?: to clipboard)?|copy selection)$/.test(lower))
    return { type: "clipboard", action: "copy" };
  if (/^(?:paste(?: clipboard)?|paste selection)$/.test(lower))
    return { type: "clipboard", action: "paste" };
  if (/^(?:undo|undo that)$/.test(lower))
    return { type: "edit", action: "undo" };
  if (/^(?:redo|redo that)$/.test(lower))
    return { type: "edit", action: "redo" };
  if (/^(?:select all|select everything)$/.test(lower))
    return { type: "edit", action: "selectAll" };
  if (/^(?:uppercase|upper case|make (?:this|it) uppercase)$/.test(lower))
    return { type: "transform", action: "uppercase" };
  if (/^(?:lowercase|lower case|make (?:this|it) lowercase)$/.test(lower))
    return { type: "transform", action: "lowercase" };
  if ((match = input.match(/^replace\s+(.+?)\s+with\s+(.+)$/i)))
    return {
      type: "transform",
      action: "replace",
      find: match[1],
      replacement: match[2],
    };
  if ((match = input.match(/^find\s+(.+)$/i)))
    return { type: "edit", action: "find", query: match[1] };
  return { type: "ai", instruction: input };
}
function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function countWords(text) {
  return (
    String(text || "")
      .trim()
      .match(/\S+/g)?.length || 0
  );
}
function computeStats(history = [], now = new Date()) {
  const today = dayKey(now);
  const dayCounts = {};
  let words = 0;
  let duration = 0;
  for (const item of history) {
    const date = item.createdAt || item.timestamp || item.date;
    if (!date || Number.isNaN(new Date(date).getTime())) continue;
    const count = Number.isFinite(item.wordCount)
      ? item.wordCount
      : countWords(item.text || item.transcript);
    const key = dayKey(date);
    dayCounts[key] = (dayCounts[key] || 0) + count;
    words += count;
    duration += Number(item.duration || 0);
  }
  const daily = [];
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    daily.push({ date: key, words: dayCounts[key] || 0 });
  }
  let streak = 0;
  const cursor = new Date(now);
  if (!dayCounts[today]) cursor.setDate(cursor.getDate() - 1);
  while (dayCounts[dayKey(cursor)] > 0) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    words,
    totalWords: words,
    recordings: history.length,
    duration,
    daily,
    today: dayCounts[today] || 0,
    week: daily.reduce((n, d) => n + d.words, 0),
    streak,
    timeSaved: Math.max(0, (words / 40) * 60 - duration),
    timeSavedSeconds: Math.max(0, (words / 40) * 60 - duration),
  };
}
function timecode(seconds, separator = ",") {
  const milliseconds = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor(milliseconds / 60000) % 60;
  const secs = Math.floor(milliseconds / 1000) % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(milliseconds % 1000).padStart(3, "0")}`;
}
function exportTranscript(entry, format = "txt") {
  const text = String(entry.text || entry.transcript || "");
  const segments = (entry.segments || [])
    .map((s) => ({
      ...s,
      text: String(s.text || "").trim(),
      start: Number(s.start || 0),
      end: Number(s.end || 0),
    }))
    .filter((s) => s.text);
  if (format === "json") return JSON.stringify(entry, null, 2);
  if (format === "txt") return text || segments.map((s) => s.text).join("\n");
  if (format === "md")
    return `${entry.title ? `# ${entry.title}\n\n` : ""}${text || segments.map((s) => s.text).join("\n\n")}\n`;
  if (!["srt", "vtt"].includes(format))
    throw new Error(`Unsupported export format: ${format}`);
  if (entry.timestampsStale)
    throw new Error(
      "Transcript was edited. Correct the subtitle segments before exporting captions.",
    );
  if (!segments.length)
    throw new Error("Subtitle export requires timestamped segments");
  if (
    segments.some(
      (s) =>
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.end) ||
        s.start < 0 ||
        s.end <= s.start,
    )
  )
    throw new Error("Invalid subtitle timing");
  const body = segments
    .map(
      (s, index) =>
        `${format === "srt" ? `${index + 1}\n` : ""}${timecode(s.start, format === "srt" ? "," : ".")} --> ${timecode(s.end, format === "srt" ? "," : ".")}\n${s.speaker ? `${s.speaker}: ` : ""}${s.text}`,
    )
    .join("\n\n");
  return `${format === "vtt" ? "WEBVTT\n\n" : ""}${body}\n`;
}
function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  const input = String(text).replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || field === "") quoted = !quoted;
      else field += c;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Unclosed CSV quoted field");
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
function validateEntity(item, kind) {
  if (!item || typeof item !== "object") throw new Error("Expected an object");
  if (kind === "dictionary") {
    const word = String(item.word || item.preferred || "").trim();
    if (!word) throw new Error("Dictionary word is required");
    return {
      ...item,
      word,
      aliases: Array.isArray(item.aliases)
        ? item.aliases.map(String)
        : String(item.aliases || "")
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean),
    };
  }
  const trigger = String(item.trigger || "").trim();
  const replacement = String(
    item.replacement ?? item.expansion ?? item.text ?? "",
  );
  if (!trigger) throw new Error("Trigger is required");
  if (!replacement) throw new Error("Replacement is required");
  return { ...item, trigger, replacement };
}
function parseImport(text, kind = "dictionary") {
  if (!["dictionary", "threads", "expansions"].includes(kind))
    throw new Error("Unsupported import kind");
  let items;
  const value = String(text)
    .trim()
    .replace(/^\uFEFF/, "");
  if (/^[\[{]/.test(value)) {
    const parsed = JSON.parse(value);
    items = Array.isArray(parsed) ? parsed : parsed[kind];
    if (!Array.isArray(items))
      throw new Error(`JSON must contain a ${kind} array`);
  } else {
    const rows = parseCSV(value);
    if (!rows.length) return [];
    const recognized = [
      "word",
      "preferred",
      "trigger",
      "replacement",
      "expansion",
      "aliases",
      "text",
    ];
    const hasHeader = rows[0].some((x) =>
      recognized.includes(x.trim().toLowerCase()),
    );
    const headers = hasHeader
      ? rows.shift().map((x) => x.trim().toLowerCase())
      : kind === "dictionary"
        ? ["word", "aliases"]
        : ["trigger", "replacement"];
    items = rows.map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] || ""]),
      ),
    );
  }
  const seen = new Set();
  return items.map((item) => {
    const normalized = validateEntity(
      typeof item === "string" ? { word: item } : item,
      kind,
    );
    const key = String(
      normalized.word || normalized.trigger,
    ).toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate ${kind} entry: ${key}`);
    seen.add(key);
    return normalized;
  });
}
module.exports = {
  defaults,
  freshState,
  normalizeTranscript,
  expandTemplate,
  matchShortcut,
  matchVoiceShortcut: matchShortcut,
  parseCommand,
  computeStats,
  exportTranscript,
  parseImport,
  parseCSV,
  validateEntity,
  replacePhrase,
  countWords,
  timecode,
  normalizeRichTranscript,
  sanitizeRichHTML,
};

function sanitizeRichHTML(html) {
  return require("sanitize-html")(String(html || ""), {
    allowedTags: [
      "b",
      "strong",
      "i",
      "em",
      "u",
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "blockquote",
    ],
    allowedAttributes: {},
    nonTextTags: ["script", "style", "textarea", "option", "iframe"],
  });
}
function escapeHTML(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function normalizeRichTranscript(text, options = {}) {
  const fragments = [];
  const nonce = require("node:crypto").randomUUID();
  const threads = (options.threads || []).map((thread) => {
    if (!thread.html || thread.enabled === false) return thread;
    const html = sanitizeRichHTML(thread.html);
    if (!html) return thread;
    const token = "\uE000" + nonce + ":" + fragments.length + "\uE001";
    fragments.push({ token, html, text: String(thread.replacement || "") });
    return { ...thread, replacement: token };
  });
  let plain = normalizeTranscript(text, { ...options, threads }),
    html = escapeHTML(plain),
    matched = false;
  for (const fragment of fragments) {
    if (plain.includes(fragment.token)) matched = true;
    plain = plain.replaceAll(fragment.token, fragment.text);
    html = html.replaceAll(fragment.token, fragment.html);
  }
  return { text: plain, html: matched ? html : null };
}
