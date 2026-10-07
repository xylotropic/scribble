"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const SETTINGS = {
  name: "",
  theme: "light",
  modelId: "base.en",
  speechProvider: "local",
  resourceMode: "automatic",
  speechCloudModel: "",
  speechCloudVersion: "2026-08-14",
  language: "auto",
  summaryLanguage: "en",
  translate: false,
  microphoneId: "default",
  microphonePriority: [],
  autoPaste: true,
  autoEnter: false,
  restoreClipboard: true,
  insertionMethod: "accessibility",
  removeFillers: true,
  punctuation: true,
  saveAudio: true,
  saveHistory: true,
  launchAtLogin: false,
  hideDock: false,
  startMinimized: false,
  sounds: true,
  soundVolume: 0.4,
  indicatorPosition: "bottom",
  indicatorStyle: "pill",
  idleIndicator: false,
  aiEnhance: false,
  aiProvider: "ollama",
  aiEndpoint: "http://127.0.0.1:11434",
  aiModel: "qwen2.5:7b",
  aiDeployment: "",
  aiVersion: "2024-10-21",
  aiInstructions:
    "Clean up grammar and punctuation. Preserve meaning and names. Return only the final text.",
  hotkeys: [
    { keyCode: 49, modifiers: ["option"], mode: "dictation", toggle: false },
    {
      keyCode: 49,
      modifiers: ["option", "shift"],
      mode: "dictation",
      toggle: true,
    },
    {
      keyCode: 49,
      modifiers: ["option", "control"],
      mode: "command",
      toggle: false,
    },
  ],
  expansionsEnabled: true,
  clipboardHistory: false,
  preferredBrowser: "Google Chrome",
  dailyGoal: 1000,
  recordingsDir: "",
  defaultNoteTemplate: "Meeting",
  suppressedApps: [],
  locale: "en",
  preferIPv4: true,
  spelling: "us",
  memoryEnabled: true,
  pinnedToneId: "",
  defaultToneId: "",
};
const BUILTINS = [
  ["google", "Google", "https://www.google.com/search?q={{text}}"],
  ["ask chat gpt", "ChatGPT", "https://chatgpt.com/?q={{text}}"],
  ["ask claude", "Claude", "https://claude.ai/new?q={{text}}"],
  [
    "ask perplexity",
    "Perplexity",
    "https://www.perplexity.ai/search?q={{text}}",
  ],
  [
    "youtube",
    "YouTube",
    "https://www.youtube.com/results?search_query={{text}}",
  ],
  ["duck duck go", "DuckDuckGo", "https://duckduckgo.com/?q={{text}}"],
  ["navigate to", "Open website", "navigate"],
  ["open", "Open folder", "folder"],
].map(([trigger, name, target]) => ({
  id: crypto.randomUUID(),
  trigger,
  name,
  target,
  type: target === "folder" ? "folder" : "url",
  enabled: true,
  builtin: true,
}));
class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, "workspace.json");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.data = {
      version: 1,
      activity: { recordings: 0, days: {} },
      settings: structuredClone(SETTINGS),
      history: [],
      notes: [],
      dictionary: [],
      threads: [],
      expansions: [
        {
          id: crypto.randomUUID(),
          trigger: ":date",
          replacement: "{date}",
          enabled: true,
          builtin: true,
        },
        {
          id: crypto.randomUUID(),
          trigger: ":time",
          replacement: "{time}",
          enabled: true,
          builtin: true,
        },
      ],
      shortcuts: structuredClone(BUILTINS),
      tones: [],
      memory: [],
      timers: [],
      clipboard: [],
    };
    if (fs.existsSync(this.file)) {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (saved.version !== 1)
        throw Error(
          "Unsupported workspace version; your data has been preserved",
        );
      this.data = this.validateWorkspace(saved);
    }
    this.save();
  }
  save() {
    const tmp = this.file + "." + crypto.randomUUID() + ".tmp";
    let fd;
    try {
      fd = fs.openSync(tmp, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(this.data, null, 2));
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(tmp, this.file);
      // Flush the rename where the filesystem supports directory fsync.
      let dirFd;
      try {
        dirFd = fs.openSync(this.dir, "r");
        fs.fsyncSync(dirFd);
      } catch {
      } finally {
        if (dirFd !== undefined) fs.closeSync(dirFd);
      }
    } catch (error) {
      if (fd !== undefined) fs.closeSync(fd);
      try {
        fs.unlinkSync(tmp);
      } catch {}
      throw error;
    }
  }
  validateSettings(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch))
      throw Error("Invalid preferences");
    if (
      patch.resourceMode !== undefined &&
      !["automatic", "cpu"].includes(patch.resourceMode)
    )
      throw Error("Invalid resource mode");
    if (
      patch.microphonePriority !== undefined &&
      (!Array.isArray(patch.microphonePriority) ||
        patch.microphonePriority.length > 32 ||
        patch.microphonePriority.some(
          (id) => typeof id !== "string" || !id || id.length > 512,
        ) ||
        new Set(patch.microphonePriority).size !==
          patch.microphonePriority.length)
    )
      throw Error("Invalid microphone priority");
    if (patch.locale !== undefined && !require("../shared/i18n").locales.some((locale) => locale.id === patch.locale)) throw Error("Unsupported interface language");
    for (const [k, v] of Object.entries(patch)) {
      if (!Object.hasOwn(SETTINGS, k)) throw Error("Unknown preference: " + k);
      if (
        typeof v !== typeof SETTINGS[k] ||
        Array.isArray(SETTINGS[k]) !== Array.isArray(v) ||
        v === null
      )
        throw Error("Invalid preference: " + k);
      if (typeof v === "string" && v.length > 12000)
        throw Error("Preference is too long");
      if (typeof v === "number" && !Number.isFinite(v))
        throw Error("Invalid preference: " + k);
      if (
        k === "speechProvider" &&
        v !== "local" &&
        !Object.hasOwn(require("./cloud-speech").CATALOG, v)
      )
        throw Error("Unknown speech provider");
      if (
        k === "aiProvider" &&
        v !== "ollama" &&
        v !== "openai-compatible" &&
        !Object.hasOwn(require("./cloud-ai").PROVIDERS, v)
      )
        throw Error("Unknown AI provider");
      if (k === "aiEndpoint" && v) require("./ai").endpoint(v);
      if (k === "hotkeys") {
        if (v.length > 30) throw Error("Too many hotkeys");
        const bindings = new Set();
        const modifierAliases = {
          alt: "option",
          cmd: "command",
          meta: "command",
          ctrl: "control",
        };
        for (const item of v) {
          if (!item || !Array.isArray(item.modifiers))
            throw Error("Invalid hotkey");
          const identity =
            item.keyCode +
            ":" +
            [...new Set(item.modifiers.map((m) => modifierAliases[m] || m))]
              .sort()
              .join("+");
          if (bindings.has(identity)) throw Error("Duplicate hotkey");
          bindings.add(identity);
        }
        for (const item of v)
          if (
            !item ||
            !Number.isInteger(item.keyCode) ||
            item.keyCode < -1 ||
            (item.keyCode > 127 && (item.keyCode < 130 || item.keyCode > 159)) ||
            !Array.isArray(item.modifiers) ||
            item.modifiers.some(
              (x) =>
                ![
                  "option",
                  "alt",
                  "command",
                  "cmd",
                  "meta",
                  "control",
                  "ctrl",
                  "shift",
                  "fn",
                ].includes(x),
            ) ||
            ![
              "dictation",
              "command",
              "shortcut",
              "meeting",
              "note",
              "paste-last",
            ].includes(item.mode) ||
            (item.toggle !== undefined && typeof item.toggle !== "boolean")
          )
            throw Error("Invalid hotkey");
      }
      if (k === "suppressedApps" && v.some((x) => typeof x !== "string"))
        throw Error("Invalid application list");
    }
    return structuredClone(patch);
  }
  validateWorkspace(value) {
    if (!value || value.version !== 1)
      throw Error(
        "Unsupported workspace version; your data has been preserved",
      );
    const next = structuredClone(this.data);
    if (value.activity !== undefined) {
      const a = value.activity;
      if (
        !a ||
        !Number.isSafeInteger(a.recordings) ||
        a.recordings < 0 ||
        !a.days ||
        typeof a.days !== "object" ||
        Array.isArray(a.days)
      )
        throw Error("Invalid activity statistics");
      for (const [date, day] of Object.entries(a.days)) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !day ||
          !Number.isFinite(day.words) ||
          day.words < 0 ||
          !Number.isFinite(day.duration) ||
          day.duration < 0
        )
          throw Error("Invalid daily activity");
      }
      next.activity = structuredClone(a);
    } else {
      next.activity = { recordings: 0, days: {} };
      for (const entry of value.history || [])
        this.accumulateActivity(
          next.activity,
          entry.original || entry.text,
          entry.duration,
          entry.createdAt,
        );
    }
    next.settings = {
      ...structuredClone(SETTINGS),
      ...this.validateSettings(value.settings || {}),
    };
    for (const kind of [
      "history",
      "notes",
      "dictionary",
      "threads",
      "expansions",
      "shortcuts",
      "tones",
      "memory",
      "timers",
      "clipboard",
    ]) {
      if (value[kind] === undefined) continue;
      if (
        !Array.isArray(value[kind]) ||
        value[kind].some((x) => !x || typeof x !== "object" || Array.isArray(x))
      )
        throw Error("Invalid workspace collection: " + kind);
      next[kind] = structuredClone(value[kind]);
    }
    return next;
  }
  restore(value) {
    const next = this.validateWorkspace(value);
    this.data = next;
    this.save();
    return next;
  }
  updateSettings(patch) {
    Object.assign(this.data.settings, this.validateSettings(patch));
    this.save();
    return this.data.settings;
  }
  upsert(kind, item) {
    if (
      ![
        "notes",
        "dictionary",
        "threads",
        "expansions",
        "shortcuts",
        "tones",
        "memory",
      ].includes(kind)
    )
      throw Error("Unsupported collection");
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw Error("Invalid item");
    if (JSON.stringify(item).length > 4e6) throw Error("Item too large");
    const list = this.data[kind];
    const i = item.id ? list.findIndex((x) => x.id === item.id) : -1;
    const value = {
      ...(i < 0 ? {} : list[i]),
      ...item,
      id: i < 0 ? crypto.randomUUID() : list[i].id,
      updatedAt: new Date().toISOString(),
    };
    if (i < 0) value.createdAt = value.updatedAt;
    if (["threads", "expansions", "shortcuts"].includes(kind)) {
      if (typeof value.trigger !== "string" || !value.trigger.trim())
        throw Error("Enter a trigger");
      if (
        list.some(
          (x) =>
            x.id !== value.id &&
            typeof x.trigger === "string" &&
            x.trigger.toLowerCase() === value.trigger.toLowerCase(),
        )
      )
        throw Error("This trigger already exists");
    }
    if (
      kind === "dictionary" &&
      (typeof value.word !== "string" || !value.word.trim())
    )
      throw Error("Enter a word");
    if (i < 0) list.push(value);
    else list[i] = value;
    this.save();
    return value;
  }
  remove(kind, id) {
    if (
      ![
        "notes",
        "dictionary",
        "threads",
        "expansions",
        "shortcuts",
        "tones",
        "memory",
        "history",
        "clipboard",
      ].includes(kind)
    )
      throw Error("Unsupported collection");
    this.data[kind] = this.data[kind].filter((x) => x.id !== id);
    this.save();
  }
  accumulateActivity(
    activity,
    text,
    duration = 0,
    date = new Date().toISOString(),
  ) {
    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return;
    const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
    const words =
      String(text || "")
        .trim()
        .match(/\S+/g)?.length || 0;
    const day = activity.days[key] || { words: 0, duration: 0 };
    day.words += words;
    day.duration += Math.max(0, Number(duration) || 0);
    activity.days[key] = day;
    activity.recordings++;
  }
  recordActivity(text, duration, date) {
    this.accumulateActivity(this.data.activity, text, duration, date);
    this.save();
  }
  addHistory(entry) {
    const value = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.data.history.unshift(value);
    this.save();
    return value;
  }
}
module.exports = { Store, SETTINGS };
