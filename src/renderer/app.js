"use strict";
const api = window.scribble,
  $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const icons = {
  mic: '<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  notes:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  shortcut:
    '<rect x="2" y="2" width="7" height="7" rx="2"/><rect x="15" y="15" width="7" height="7" rx="2"/><path d="M5 9v9h10M9 5h9v10"/>',
  command: '<path d="m4 5 6 7-6 7M13 19h7"/>',
  dictionary:
    '<path d="M12 5c-3-3-6-3-10-2v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-4-1-7-1-10 2v16"/>',
  model: '<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3zM20 2v4M18 4h4"/>',
  tone: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="19" r="2"/>',
  memory:
    '<path d="M9 3a4 4 0 0 0-6 4v2a4 4 0 0 0 0 6v2a4 4 0 0 0 6 4M15 3a4 4 0 0 1 6 4v2a4 4 0 0 1 0 6v2a4 4 0 0 1-6 4M12 2v20M7 7h5M12 17h5"/>',
  settings: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3M12 18h.01"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  trash: '<path d="M3 5h18M8 5V2h8v3M6 5l1 16h10l1-16M10 9v8M14 9v8"/>',
  play: '<path d="m7 3 14 9-14 9z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  shield: '<path d="m12 2 9 4v6c0 5-5 9-9 10-4-1-9-5-9-10V6zM8 12l3 3 5-6"/>',
  check: '<path d="m4 12 5 5 11-11"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  edit: '<path d="m16 3 5 5-12 12-7 2 2-7zM13 6l5 5"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/>',
  link: '<path d="m9 15 6-6M7 17l-2 2a4 4 0 0 1-5-5l6-6a4 4 0 0 1 5 0M17 7l2-2a4 4 0 0 0-5-5l-6 6a4 4 0 0 0 0 5"/>',
  flag: '<path d="M5 22V3h14l-3 5 3 5H5"/>',
  folder: '<path d="M2 6h8l2 3h10v12H2z"/>',
  words: '<path d="M3 4h18M12 4v17M7 21h10"/>',
  fire: '<path d="M12 2c4 6-1 7 3 10 1-1 2-2 2-4 7 7 3 14-5 14S1 14 7 9c0 5 5 5 5 2 0-2-2-4 0-9z"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.mic}</svg>`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const interfaceLabel = (label) => {
  const key = Object.keys(ScribbleI18n.catalogues.en).find((key) => ScribbleI18n.catalogues.en[key] === label);
  return key ? ScribbleI18n.t(state?.settings.locale, key) : ScribbleFormTranslations.translate(state?.settings.locale, label);
};
const interfaceProse = (text) => Object.hasOwn(ScribbleFormTranslations.catalogues.en, text) ? esc(ScribbleFormTranslations.translate(state?.settings.locale, text)) : text;
const date = (v) =>
    new Date(v).toLocaleDateString(ScribbleI18n.formattingLocale(state?.settings.locale), {
      month: "short",
      day: "numeric",
    }),
  time = (v) =>
    new Date(v).toLocaleTimeString(ScribbleI18n.formattingLocale(state?.settings.locale), {
      hour: "numeric",
      minute: "2-digit",
    }),
  words = (t) => (t || "").trim().split(/\s+/).filter(Boolean).length,
  clock = (s) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pages = {
  home: ["Home", "home"],
  notes: ["Notes", "notes"],
  transcribe: ["Transcribe", "mic"],
  shortcuts: ["Voice shortcuts", "shortcut"],
  command: ["Command Mode", "command"],
  dictionary: ["Dictionary", "dictionary"],
  models: ["Speech models", "model"],
  ai: ["Language models", "spark"],
  tones: ["Tones", "tone"],
  memory: ["Memory", "memory"],
  settings: ["Settings", "settings"],
  utilities: ["File tools", "settings"],
  help: ["Help", "help"],
};
let hotkeyCaptureActive = false;
async function stopHotkeyCapture() { if (!hotkeyCaptureActive) return; hotkeyCaptureActive = false; await request("capture-hotkey-stop").catch(() => {}); }
let state = null,
  page = "home",
  tab = "overview",
  dictTab = "dictionary",
  settingsTab = "general",
  noteTab = "summary",
  selectedNote = null,
  selectedFile = null,
  search = "",
  queue = [],
  fileSpeechOptions = {},
  progress = {},
  downloadProgress = {},
  permissions = {},
  commandResult = null,
  utilityResult = null,
  utilityBusy = new Set(),
  commandAttachments = { text: "", images: [], sources: [] },
  commandDraft = "",
  commandTextContext = "",
  historyKind = "all",
  historyLimit = 100,
  microphoneDevices = [],
  originalHistory = new Set(),
  historyRevision = new Map();
let recordingToken = 0,
  startingRecording = false,
  recorder = null,
  stream = null,
  chunks = [],
  cancelled = false,
  recordMode = "dictation",
  recordStart = 0,
  recordInterval,
  levelContext = null,
  levelInterval = null,
  paused = false,
  pauseStarted = 0,
  pausedDuration = 0,
  noteSpec = {},
  flags = [],
  noteDraft = "",
  toastTimer;
const noteSaveTimers = new Map();
const langList = [
  ["auto", "Auto-detect"],
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["nl", "Dutch"],
  ["ru", "Russian"],
  ["uk", "Ukrainian"],
  ["pl", "Polish"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["ja", "Japanese"],
  ["zh", "Chinese"],
  ["ko", "Korean"],
  ["tr", "Turkish"],
  ["vi", "Vietnamese"],
  ["sv", "Swedish"],
  ["da", "Danish"],
  ["no", "Norwegian"],
  ["fi", "Finnish"],
  ["el", "Greek"],
  ["he", "Hebrew"],
  ["id", "Indonesian"],
  ["th", "Thai"],
  ["cs", "Czech"],
  ["ro", "Romanian"],
  ["hu", "Hungarian"],
  ["fa", "Persian"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["ur", "Urdu"],
  ["ms", "Malay"],
  ["ca", "Catalan"],
  ["sk", "Slovak"],
  ["bg", "Bulgarian"],
  ["hr", "Croatian"],
  ["sr", "Serbian"],
  ["sl", "Slovenian"],
  ["et", "Estonian"],
  ["lv", "Latvian"],
  ["lt", "Lithuanian"],
  ["is", "Icelandic"],
  ["af", "Afrikaans"],
  ["sw", "Swahili"],
  ["tl", "Tagalog"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["pa", "Punjabi"],
  ["ne", "Nepali"],
  ["si", "Sinhala"],
  ["my", "Burmese"],
  ["km", "Khmer"],
  ["lo", "Lao"],
  ["mn", "Mongolian"],
  ["hy", "Armenian"],
  ["ka", "Georgian"],
  ["az", "Azerbaijani"],
  ["kk", "Kazakh"],
  ["uz", "Uzbek"],
  ["be", "Belarusian"],
  ["mk", "Macedonian"],
  ["bs", "Bosnian"],
  ["sq", "Albanian"],
  ["eu", "Basque"],
  ["gl", "Galician"],
  ["cy", "Welsh"],
  ["ga", "Irish"],
  ["mt", "Maltese"],
  ["la", "Latin"],
  ["yo", "Yoruba"],
  ["ha", "Hausa"],
  ["so", "Somali"],
  ["am", "Amharic"],
  ["sn", "Shona"],
  ["mg", "Malagasy"],
  ["sa", "Sanskrit"],
  ["bo", "Tibetan"],
  ["ps", "Pashto"],
  ["sd", "Sindhi"],
  ["tt", "Tatar"],
  ["tk", "Turkmen"],
  ["tg", "Tajik"],
  ["ky", "Kyrgyz"],
  ["fo", "Faroese"],
  ["lb", "Luxembourgish"],
  ["nn", "Nynorsk"],
  ["br", "Breton"],
  ["oc", "Occitan"],
  ["mi", "Maori"],
  ["haw", "Hawaiian"],
  ["ht", "Haitian Creole"],
  ["jw", "Javanese"],
  ["su", "Sundanese"],
  ["as", "Assamese"],
  ["yue", "Cantonese"],
];
function speechLanguageOptions(model) {
  const fixed = model && (model.englishOnly ? "en" : model.language && model.language !== "auto" ? model.language : "");
  if (fixed) return [[fixed, langList.find(([code]) => code === fixed)?.[1] || fixed]];
  if (!Array.isArray(model?.supportedLanguages)) return langList;
  const names = new Intl.DisplayNames([ScribbleI18n.formattingLocale(state?.settings.locale)], { type: "language" });
  return [["auto", "Auto-detect"], ...model.supportedLanguages.map((code) => [code, langList.find(([id]) => id === code)?.[1] || names.of(code) || code])];
}
function toneSpeechModel(modelId) {
  return (modelId || state.settings.speechProvider === "local") && state.models.find((m) => m.id === (modelId || state.settings.modelId));
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 5500);
}
async function request(action, args) {
  try {
    return await api.request(action, args);
  } catch (e) {
    toast(e.message);
    throw e;
  }
}
function button(label, action, ico, cls = "", data = "") {
  return `<button type="button" class="${cls}" data-action="${action}" ${data}>${ico ? icon(ico) : ""}${interfaceLabel(label)}</button>`;
}
function field(name, label, value = "", type = "text", hint = "") {
  return `<label class="field">${esc(interfaceLabel(label))}<input name="${name}" type="${type}" value="${esc(value)}" ${type === "password" ? 'autocomplete="off"' : ""}>${hint ? `<small>${interfaceProse(hint)}</small>` : ""}</label>`;
}
function area(name, label, value = "", hint = "") {
  return `<label class="field">${esc(interfaceLabel(label))}<textarea name="${name}">${esc(value)}</textarea>${hint ? `<small>${interfaceProse(hint)}</small>` : ""}</label>`;
}
function select(name, label, options, value, disabled = false) {
  return `<label class="field">${esc(interfaceLabel(label))}<select name="${name}" ${disabled ? "disabled" : ""}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
}
function check(name, label, value = false) {
  return `<label class="row"><input name="${name}" type="checkbox" ${value ? "checked" : ""}>${esc(interfaceLabel(label))}</label>`;
}
function heading(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${esc(interfaceLabel(eyebrow))}</p><h1>${esc(interfaceLabel(title))}</h1><p class="lead">${interfaceProse(subtitle)}</p></div><div class="row wrap">${actions}</div></div>`;
}
function empty(ico, title, description, action = "") {
  return `<div class="empty">${icon(ico)}<h3>${title}</h3><p>${description}</p>${action}</div>`;
}
function showModal(title, html, onSubmit) {
  void stopHotkeyCapture();
  const dialog = $("#modal");
  dialog.innerHTML = `<form method="dialog"><div class="row between"><h2>${esc(interfaceLabel(title))}</h2>${button("", "close-modal", "close", "ghost icon")}</div>${html}<div class="dialog-footer">${button("Cancel", "close-modal", "", "ghost")}<button type="submit" class="primary">${esc(interfaceLabel("Save"))}</button></div></form>`;
  dialog.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const values = Object.fromEntries(new FormData(form));
    form
      .querySelectorAll("input[type=checkbox]")
      .forEach((i) => (values[i.name] = i.checked));
    try {
      await stopHotkeyCapture();
      await onSubmit(values);
      dialog.close();
    } catch (error) {
      toast(error.message || "Unable to save");
    }
  });
  dialog.showModal();
}
function openWorkspacePalette() {
  const dialog = $("#modal");
  dialog.innerHTML = `<div class="row between"><h2>Go to a workspace</h2>${button("", "close-modal", "close", "ghost icon")}</div><input id="workspace-search" class="search" aria-label="Find a workspace" placeholder="Search pages…"><div id="workspace-results" class="stack"></div>`;
  const input = $("#workspace-search");
  const update = () => {
    const query = input.value.trim().toLocaleLowerCase();
    const matches = Object.entries(pages).filter(([key, [label]]) =>
      (key + " " + label).toLocaleLowerCase().includes(query),
    );
    $("#workspace-results").innerHTML = matches.length
      ? matches
          .map(([key, [label, iconName]]) =>
            button(
              label,
              "palette-navigate",
              iconName,
              "ghost",
              `data-page="${key}"`,
            ),
          )
          .join("")
      : `<p class="muted">No matching workspace.</p>`;
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("#workspace-results button")?.click();
    }
  });
  update();
  dialog.showModal();
  input.focus();
}
function render() {
  if (!state) return;
  const active = document.activeElement,
    focus = active?.dataset?.focus,
    selection = active?.selectionStart;
  document.documentElement.lang = ScribbleI18n.resolveLocale(state.settings.locale);
  document.documentElement.dir = "ltr";
  document.body.classList.toggle("dark", state.settings.theme === "dark");
  const nav = (keys) =>
    keys
      .map(
        (k) =>
          `<button class="nav-button ${page === k ? "active" : ""}" data-action="navigate" data-page="${k}">${icon(pages[k][1])}${esc(interfaceLabel(pages[k][0]))}</button>`,
      )
      .join("");
  $("#sidebar").innerHTML =
    `<div class="brand"><div class="brand-mark">${icon("mic")}</div><div>Scribble<small>VOICE WORKSPACE</small></div></div><div class="nav-section">${nav(["home", "notes", "transcribe", "shortcuts", "command", "dictionary", "utilities"])}</div><div class="nav-section"><div class="nav-label">Make it yours</div>${nav(["models", "ai", "tones", "memory"])}</div><div class="sidebar-bottom nav-section">${nav(["settings", "help"])}<div class="local-card">${icon("shield")}<div>Local by default.<br>Your voice stays yours.</div></div></div>`;
  $("#header").innerHTML =
    `<div class="breadcrumb">Workspace <span>/</span> <strong>${esc(interfaceLabel(pages[page][0]))}</strong></div><div class="header-actions"><span class="pill optional"><i class="dot ${state.speechStatus.ready ? "" : "warn"}"></i>${esc(state.settings.speechProvider === "local" ? state.settings.modelId : state.settings.speechProvider)}</span>${button("Search workspace", "workspace-palette", "search", "ghost small")}${button("", "theme", state.settings.theme === "dark" ? "sun" : "moon", "ghost icon", 'title="Toggle appearance"')}${button("Dictate", "record", "mic", "primary")}</div>`;
  $("#content").innerHTML = {
    home: renderHome,
    notes: renderNotes,
    transcribe: renderTranscribe,
    shortcuts: renderShortcuts,
    command: renderCommand,
    dictionary: renderDictionary,
    models: renderModels,
    ai: renderAI,
    tones: renderTones,
    memory: renderMemory,
    settings: renderSettings,
    utilities: renderUtilities,
    help: renderHelp,
  }[page]();
  if (focus) {
    const input = $(`[data-focus="${focus}"]`);
    input?.focus();
    if (selection !== undefined)
      input?.setSelectionRange?.(selection, selection);
  }
  if (page === "transcribe") setupDrop();
}
function renderUtilities() {
  return `${heading("All on this Mac", "Make your files work for you.", "Choose a tool, select the inputs, then choose a new output. Your originals stay intact.")}<div class="grid two">${[
    [
      "image-convert",
      "Convert an image",
      "Resize or compress into JPEG, PNG, or WebP.",
      "webp",
    ],
    [
      "image-compress",
      "Compress an image",
      "Re-encode into a new file and report whether its size decreased.",
      "webp",
    ],
    [
      "image-palette",
      "Extract image colors",
      "Save dominant colors and their proportions as JSON.",
      "",
    ],
    [
      "audio-convert",
      "Convert audio",
      "Save a recording as MP3, WAV, M4A, or Opus.",
      "mp3",
    ],
    ["video-convert", "Convert video", "Create MP4 or WebM video.", "mp4"],
    [
      "pdf-merge",
      "Merge PDFs",
      "Select PDFs in the order you want to combine them.",
      "",
    ],
    [
      "archive-create",
      "Create ZIP",
      "Bundle files or folders into one archive.",
      "",
    ],
    ["archive-extract", "Extract ZIP", "Unpack into a new folder.", ""],
    [
      "config-convert",
      "Convert configuration",
      "Convert JSON, YAML, or TOML.",
      "json",
    ],
    [
      "markdown-pdf",
      "Markdown to PDF",
      "Create a readable PDF from Markdown.",
      "",
    ],
    [
      "text-markdown",
      "Text to Markdown",
      "Save a plain text file as Markdown.",
      "",
    ],
  ]
    .map(
      ([operation, title, description, format]) =>
        `<div class="card"><h3>${esc(interfaceLabel(title))}</h3><p class="muted">${esc(interfaceLabel(description))}</p>${format ? `<label class="field">${esc(interfaceLabel("Output format"))}<select data-format-for="${operation}">${{ "image-convert": ["webp", "jpg", "png"], "image-compress": ["webp", "jpg", "png"], "audio-convert": ["mp3", "wav", "m4a", "opus"], "video-convert": ["mp4", "webm"], "config-convert": ["json", "yaml", "toml"] }[operation].map((f) => `<option>${f}</option>`).join("")}</select></label>` : ""}${button("Choose files", "utility", "upload", "", `data-operation="${operation}"`)}</div>`,
    )
    .join("")}</div>`;
}
function setupReady() {
  return state.settings.speechProvider === "local" && state.speechStatus.ready &&
    state.models.some((model) => model.id === state.settings.modelId && model.installed) &&
    (permissions.microphone === 3 || permissions.microphone === true) && permissions.accessibility && permissions.hotkeys === true;
}
function renderSetup() {
  if (state.settings.onboardingCompleted !== false) return "";
  const text = (label) => esc(interfaceLabel(label));
  const model = state.models.find((model) => model.id === state.settings.modelId);
  const progress = model && (downloadProgress[model.id] || (model.downloading ? {progress:0} : null));
  const permissionStep = (title, description, kind, allowed) => `<section class="onboard-step"><h3>${text(title)}</h3><p>${text(description)}</p><p role="status">${text(allowed ? "Access allowed" : "Access not yet allowed")}</p>${kind === "accessibility" && allowed && permissions.hotkeys !== true ? `<p class="notice">${text("Restart Scribble to enable global shortcuts.")}</p>` : ""}<div class="row wrap">${!allowed ? button("Request", "request-permission", "shield", "small", `data-kind="${kind}"`) : ""}${button("Open settings", "permission-settings", "arrow", "small", `data-kind="${kind}"`)}</div></section>`;
  return `<section class="card" aria-labelledby="setup-title"><h2 id="setup-title">${text("Make Scribble ready")}</h2><p class="muted">${text("A local model, your microphone, and one shortcut.")}</p><div class="onboard-grid"><section class="onboard-step"><h3>${text("Download a speech model")}</h3><p>${text("Choose a model to transcribe on this Mac. Downloads use disk space and bandwidth.")}</p>${select("onboardingModel", "Setup speech model", state.models.filter((model) => model.supported !== false).map((model) => [model.id, model.name + " · " + Math.round(model.bytes / 1e6) + " MB"]), state.settings.modelId)}<p role="status">${text(model?.installed ? "Model ready" : "Model not downloaded")}</p>${model && !model.installed ? progress ? `<div class="progress-track"><div class="progress-fill" data-progress="${model.id}"></div></div><p data-progress-label="${model.id}">${Math.round((progress.progress || 0) * 100)}%</p>` + button("Cancel", "cancel-download", "close", "small", `data-id="${model.id}"`) : button("Download", "download-model", "download", "small primary", `data-id="${model.id}"`) : model && state.settings.speechProvider !== "local" ? button("Use model", "use-model", "check", "small", `data-id="${model.id}"`) : ""}</section>${permissionStep("Allow your microphone", "Record your voice for local transcription.", "microphone", permissions.microphone === 3 || permissions.microphone === true)}${permissionStep("Allow Accessibility", "Use global shortcuts and insert words at the cursor.", "accessibility", permissions.accessibility)}</div><div class="row wrap">${button("Refresh setup status", "refresh-setup", "refresh")}${button("Finish setup", "complete-setup", "check", "primary", setupReady() ? "" : "disabled")}${button("Do this later", "complete-setup", "", "ghost", 'data-skip="true"')}</div></section>`;
}
function renderHome() {
  const stats = state.stats || {},
    today = stats.today || 0,
    total = stats.totalWords || stats.words || 0,
    count = stats.recordings ?? state.history.length;
  const daily = stats.daily?.slice(-7) || [],
    max = Math.max(1, ...daily.map((x) => x.words));
  return `${heading("A little less typing", `Your words, in motion${state.settings.name ? ", " + esc(state.settings.name) : ""}.`, `${today.toLocaleString()} words spoken today. What’s on your mind?`)}${renderSetup()}${!state.speechStatus.ready ? `<div class="banner">The local speech runtime needs setup. Run <code>npm run setup:speech</code> from this repository.</div>` : ""}<div class="hero"><div><p class="eyebrow">Speak naturally. Stay in flow.</p><h2>A thought worth saying.</h2><p class="muted">Hold <kbd>⌥ Space</kbd> in any app. Release to write.<br>Use <kbd>⌥ ⇧ Space</kbd> for hands-free dictation.</p><div class="row">${button("Start dictating", "record", "mic", "lime")}${button("Set up shortcuts", "navigate", "arrow", "", 'data-page="settings"')}</div></div><div class="hero-graphic">${'<div class="wave"></div>'.repeat(7)}</div></div><div class="grid four">${[
    ["words", total.toLocaleString(), "Words captured", "Your ideas, saved"],
    ["fire", stats.streak || 0, "Day streak", "Keep your momentum"],
    [
      "clock",
      ((stats.timeSavedSeconds || 0) / 3600).toFixed(1) + "h",
      "Typing time saved",
      "Estimated at 40 words/min",
    ],
    ["mic", count, "Transcriptions", "Local and private"],
  ]
    .map(
      ([i, v, l, f]) =>
        `<div class="card stat"><div class="stat-icon">${icon(i)}</div><div class="number">${v}</div><div class="label">${l}</div><div class="foot">${f}</div></div>`,
    )
    .join(
      "",
    )}</div><div class="grid two"><div class="card" data-card="activity"><div class="section-heading"><h3>Finding your rhythm</h3><span class="caps">Last 7 days</span></div><div class="chart">${daily.length ? daily.map((x) => `<div class="chart-bar" title="${x.date}: ${x.words} words" data-height="${Math.max(3, (x.words / max) * 90)}"></div>`).join("") : '<p class="muted">Your daily activity appears after the first dictation.</p>'}</div><div class="chart-labels">${daily.map((x) => `<span>${new Date(x.date + "T12:00:00").toLocaleDateString(ScribbleI18n.formattingLocale(state?.settings.locale), { weekday: "short" })}</span>`).join("")}</div></div><div class="card"><div class="section-heading"><h3>Ready when you are</h3>${icon("shield")}</div><p class="muted">A private microphone, a local model, a shortcut. That’s all you need.</p><div class="row wrap">${button("Check permissions", "check-permissions", "shield")}${button("Speech models", "navigate", "model", "ghost", 'data-page="models"')}</div><p class="tip">No account, subscription, or transcription limit.</p></div></div><div class="section-heading"><h2>Voice log</h2><div class="tabs">${["overview", "history"].map((t) => button(t === "history" ? "All history" : "Recent", "home-tab", "", tab === t ? "active" : "", `data-tab="${t}"`)).join("")}</div></div>${
    tab === "history"
      ? `${select(
          "historyKind",
          "Filter history",
          [
            ["all", "All entries"],
            ["dictation", "Dictations"],
            ["command", "Commands"],
            ["file", "Files"],
            ["shortcut", "Voice shortcuts"],
            ["errors", "Errors"],
          ],
          historyKind,
        )}<input class="search" data-focus="search" id="search" value="${esc(search)}" placeholder="Search words, commands, or recordings…">`
      : ""
  }<div class="card">${historyRows(state.history.filter(historyMatches).slice(0, tab === "history" ? historyLimit : 5))}</div>${tab === "history" && state.history.filter(historyMatches).length > historyLimit ? button("Load older entries", "history-more", "arrow") : ""}`;
}
function historyText(entry) {
  if (originalHistory.has(entry.id)) return entry.original || entry.text || "";
  const index = historyRevision.get(entry.id);
  return index === undefined
    ? entry.text || ""
    : entry.revisions?.[index]?.text || entry.text || "";
}
function historyMatches(entry) {
  if (
    historyKind !== "all" &&
    (historyKind === "errors" ? !entry.error : entry.kind !== historyKind)
  )
    return false;
  const haystack = [
    entry.text,
    entry.original,
    entry.title,
    entry.command,
    entry.error,
    entry.warning,
    ...(entry.revisions || []).flatMap((r) => [r.text, r.instruction]),
  ].join(" ");
  return (
    !search || haystack.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
}
function historyRows(entries) {
  if (!entries.length)
    return empty(
      "mic",
      "A clean slate.",
      "Your dictations and commands will show up here. Start with one sentence.",
    );
  let lastDay;
  return entries
    .map((entry) => {
      const day = date(entry.createdAt);
      const heading =
        day === lastDay ? "" : `<h3 class="history-day">${esc(day)}</h3>`;
      lastDay = day;
      const revisions = entry.revisions || [];
      const revision = Math.min(
        historyRevision.get(entry.id) ?? revisions.length - 1,
        revisions.length - 1,
      );
      return `${heading}<article class="history-row"><div class="history-meta"><span>${time(entry.createdAt)}</span><span>${esc(entry.kind)}</span><span>${words(entry.text)} words</span><span>${esc(entry.modelId || "")}</span></div><div class="history-text">${esc(historyText(entry) || (entry.error ? "Transcription failed" : "No speech detected"))}</div>${entry.error ? `<p class="notice">${esc(entry.error)}</p>` : ""}${entry.warning ? `<p class="notice">${esc(entry.warning)}</p>` : ""}<div class="history-actions">${entry.original && entry.original !== entry.text ? button(originalHistory.has(entry.id) ? "Show final" : "Show original", "history-original", "", "small", `data-id="${entry.id}"`) : ""}${revisions.length > 1 ? button("Earlier", "history-revision", "", "small", `data-id="${entry.id}" data-index="${Math.max(0, revision - 1)}"`) + `<span>${revision + 1} / ${revisions.length}</span>` + button("Later", "history-revision", "", "small", `data-id="${entry.id}" data-index="${Math.min(revisions.length - 1, revision + 1)}"`) : ""}${button("Copy", "copy-history", "copy", "", `data-id="${entry.id}"`)}${button("Edit", "edit-history", "edit", "", `data-id="${entry.id}"`)}${entry.audioPath ? button("Retry", "retry", "refresh", "", `data-id="${entry.id}"`) : ""}${button("Export", "export-history", "download", "", `data-id="${entry.id}"`)}${button("Delete", "delete", "trash", "danger", `data-id="${entry.id}" data-kind="history"`)}</div>${entry.audioPath ? `<audio controls preload="none" src="scribble-audio://recording/${entry.id}"></audio>` : ""}</article>`;
    })
    .join("");
}
function renderFileLanguageSetting() {
  const model = (fileSpeechOptions.modelId || state.settings.speechProvider === "local") && state.models.find((m) => m.id === (fileSpeechOptions.modelId || state.settings.modelId));
  const fixed = model && (model.englishOnly ? "en" : model.language && model.language !== "auto" ? model.language : "");
  if (fixed) return select("fileLanguage", "Language for new files", [[fixed, langList.find(([code]) => code === fixed)?.[1] || fixed]], fixed, true);
  return select("fileLanguage", "Language for new files", [["", "Use configured language"], ...speechLanguageOptions(model)], fileSpeechOptions.language || "");
}
function renderTranscribe() {
  const entries = state.history.filter((x) => x.kind === "file"),
    entry = entries.find((x) => x.id === selectedFile);
  return `${heading("Audio in. Words out.", "Give your recordings a voice.", "Drop audio or video files. Transcribe with your selected local or cloud speech provider, with time-aligned text and subtitles.", button("Browse files", "browse-files", "upload"))}<div class="card"><div class="grid two">${select("fileModel", "Speech model for new files", [["", "Use configured provider"], ...state.models.filter((m) => m.installed).map((m) => [m.id, m.name + " · local"])], fileSpeechOptions.modelId || "")}${renderFileLanguageSetting()}</div><p class="tip">Selecting a local model transcribes these files on this Mac. Choices apply to files added next.</p></div><div id="dropzone" class="dropzone" tabindex="0" role="button" aria-label="Choose audio or video files">${icon("upload")}<h2>Drop a recording here</h2><p>MP3 · WAV · M4A · MP4 · MOV · FLAC · OGG · and more</p><span class="badge">${esc(state.settings.modelId)} · ${esc(state.settings.language)}</span></div>${queue.length ? `<div class="card"><h3>Transcription queue</h3>${queue.map((q) => `<div class="list-row"><div class="body"><strong>${esc(q.name)}</strong><p>${esc(q.status)}</p></div>${q.status === "Waiting" ? button("Remove", "remove-queue", "close", "icon", `data-id="${q.id}"`) : ""}</div>`).join("")}</div>` : ""}<div class="section-heading"><h2>Your transcriptions</h2><span class="muted">${entries.length} files</span></div>${entry ? `<div class="card"><div class="row between"><h2>${esc(entry.title)}</h2>${button("Back to files", "close-file", "close", "ghost")}</div><audio controls id="file-audio" preload="none" src="scribble-audio://recording/${entry.id}"></audio><div class="row wrap">${button("Copy text", "copy-history", "copy", "", `data-id="${entry.id}"`)}${["txt", "srt", "vtt", "md", "json"].map((f) => button(f.toUpperCase(), "export-format", "download", "small", `data-id="${entry.id}" data-format="${f}" data-kind="history"`)).join("")}</div><div class="section-heading"><h3>Transcript</h3>${button("Edit", "edit-history", "edit", "ghost", `data-id="${entry.id}"`)}${entry.segments?.length ? button("Edit captions", "edit-segments", "edit", "ghost", `data-id="${entry.id}"`) : ""}</div>${entry.segments?.map((s) => `<div class="segment">${button(clock(s.start), "seek", "", "timestamp", `data-time="${s.start}"`)}<span>${esc(s.text)}</span></div>`).join("") || esc(entry.text)}</div>` : `<div class="card">${entries.length ? entries.map((e) => `<div class="list-row"><span class="list-icon">${icon("mic")}</span><div class="body"><strong>${esc(e.title)}</strong><p>${date(e.createdAt)} · ${words(e.text)} words · ${clock(e.duration || 0)}</p></div>${button("Open", "open-file", "arrow", "ghost", `data-id="${e.id}"`)}</div>`).join("") : empty("notes", "Your first transcript starts here.", "Audio or video, short memo or long conversation. There’s no artificial quota.")}</div>`}`;
}
function renderNotes() {
  const notes = state.notes.filter(
    (n) =>
      !search ||
      [n.title, n.transcript, n.summary]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const note = notes.find((n) => n.id === selectedNote) || notes[0];
  if (note) selectedNote = note.id;
  return `${heading("Keep the conversation", "Notes, without the busywork.", "Record a meeting, capture ideas, or import a recording. Keep the audio, transcript, and notes together.", button("Import", "import-note", "upload") + button("Take notes", "new-note", "mic", "primary"))}${!notes.length ? `<div class="card">${empty("notes", "Nothing lost. Everything remembered.", "Capture microphone and meeting audio, then get a local summary and editable notes.", button("Start a note", "new-note", "plus", "primary"))}</div>` : `<div class="split"><div><input id="search" class="search" data-focus="search" value="${esc(search)}" placeholder="Search notes…">${notes.map((n) => `<button class="note-item ${n.id === selectedNote ? "active" : ""}" data-action="select-note" data-id="${n.id}"><strong class="truncate">${esc(n.title)}</strong><small>${date(n.createdAt)} · ${clock(n.duration || 0)}</small></button>`).join("")}</div><div class="card"><div class="row between"><h2>${esc(note.title)}</h2>${button("", "edit-note-title", "edit", "ghost icon", `data-id="${note.id}"`)}</div><div class="row wrap"><span class="badge">${esc(note.template || "Meeting")}</span>${button("Regenerate", "summarize-note", "spark", "small", `data-id="${note.id}"`)}${button("Export", "export-note", "download", "small", `data-id="${note.id}"`)}${button("Delete", "delete", "trash", "danger small", `data-id="${note.id}" data-kind="notes"`)}</div>${note.summaryDraft ? '<p class="smallprint">AI summary draft. Review its wording against the quoted transcript evidence.</p>' : ""}${note.summaryFallback ? `<p class="notice" role="status">Local extractive notes used because the selected summary provider failed: ${esc(note.summaryError || "Provider unavailable")}</p>` : note.summaryProvider ? `<p class="smallprint">Summary provider: ${esc(note.summaryProvider)}</p>` : ""}${note.audioPath ? `<audio controls preload="none" src="scribble-audio://recording/${note.id}"></audio>` : ""}<div class="tabs">${["summary", "transcript", "personal"].map((t) => button(t === "personal" ? "My notes" : t[0].toUpperCase() + t.slice(1), "note-tab", "", noteTab === t ? "active" : "", `data-tab="${t}"`)).join("")}</div><textarea class="editor" id="note-editor" data-focus="note-editor" data-id="${note.id}" data-field="${noteTab === "summary" ? "summary" : noteTab === "transcript" ? "transcript" : "personalNotes"}" placeholder="Your own notes, decisions, or follow-ups…">${esc(noteTab === "summary" ? note.summary : noteTab === "transcript" ? note.transcript : note.personalNotes || "")}</textarea><div class="smallprint">Edits save automatically on this Mac.</div></div></div>`}`;
}
function renderShortcuts() {
  return `${heading("A phrase. An action.", "Your voice is a shortcut.", "Search the web, launch an app, or open a folder. Built-in shortcuts work without an AI provider.", button("Add shortcut", "add-item", "plus", "primary", 'data-kind="shortcuts"'))}<div class="banner">Say “google best coffee near me” while dictating. Scribble routes the phrase instead of typing it.</div><div class="card">${state.shortcuts.map((s) => `<div class="list-row"><span class="list-icon">${icon(s.type === "folder" ? "folder" : "shortcut")}</span><div class="body"><strong>${esc(s.name || s.trigger)}</strong><p><span class="shortcut-trigger">${esc(s.trigger)}</span> ${esc(shortcutDescription(s))}</p></div>${s.builtin ? '<span class="badge">BUILT-IN</span>' : ""}<input type="checkbox" data-toggle-kind="shortcuts" data-id="${s.id}" ${s.enabled !== false ? "checked" : ""} aria-label="Enable ${esc(s.name)}">${!s.builtin ? button("", "edit-item", "edit", "ghost icon", `data-kind="shortcuts" data-id="${s.id}"`) + button("", "delete", "trash", "ghost icon danger", `data-kind="shortcuts" data-id="${s.id}"`) : ""}</div>`).join("")}</div><div class="card"><h3>Try a shortcut</h3><div class="row"><input class="inline-input" id="shortcut-test" placeholder="google public hiking trails">${button("Run", "test-shortcut", "play")}</div><p class="tip">Running a shortcut opens the selected app, folder, or browser destination.</p></div>`;
}
function renderCommand() {
  return `${heading("Say what should happen", "Command Mode.", "Transform selected text, set a timer, or ask your own language model. Review a result before inserting it.")}<div class="card"><p class="eyebrow">Hold ⌥ ⌃ Space for a voice command</p><label class="field">What would you like to do?<input id="command-text" value="${esc(commandDraft)}" placeholder="Make this more concise, set a timer for 5 minutes…"></label>${area("command-context", "Text to work with", commandTextContext, "Leave empty to use the selected text or clipboard.")}<div class="row wrap">${["Clean up", "Formal", "Polish", "Summarize", "Bullets", "Email"].map((label) => button(label, "command-preset", "", "small", `data-preset="${label}"`)).join("")}</div><div class="row">${button("Choose context files", "command-files", "upload")}${button("Capture screen context", "command-screen", "image")}${commandAttachments.sources.length ? button("Clear files", "clear-command-files", "close", "ghost") + `<span class="muted">${commandAttachments.sources.map((source) => esc(source.name)).join(", ")}</span>` : ""}${button("Run command", "run-command", "spark", "primary")}${button("Speak a command", "record-command", "mic")}<span class="muted">Local utilities are ready. AI commands use your configured provider.</span></div>${commandResult ? `<div class="command-panel"><div class="command-result" id="command-result" tabindex="0">${esc(commandResult.text)}</div><div class="row">${button("Copy", "copy-command", "copy")}${commandResult.kind === "text" && commandResult.canInsert ? button("Insert", "paste-command", "arrow", "primary") : ""}</div>${commandResult.kind === "text" ? `<label class="field">Refine this result<input id="refine-command" placeholder="Make it shorter, change the tone…"></label>${button("Refine", "refine-command", "spark", "small")}` : ""}<p class="smallprint">${esc(interfaceLabel(commandResult.kind === "text" && commandResult.canInsert ? "Focus the result and press Tab to insert, or Escape to dismiss." : "Copy the result or dismiss it. Press Escape to dismiss."))}</p></div>` : ""}</div>${state.timers.length ? `<div class="section-heading"><h2>Timers</h2></div><div class="grid three">${state.timers.map((t) => `<div class="card"><h3>${esc(t.title)}</h3><p class="number">${clock(Math.max(0, (t.endsAt - Date.now()) / 1000))}</p>${button("Cancel", "cancel-timer", "close", "small", `data-id="${t.id}"`)}</div>`).join("")}</div>` : ""}<div class="section-heading"><h2>A few things to try</h2></div><div class="grid three">${[
    [
      "clock",
      "“Set a timer for 5 minutes”",
      "A local reminder with a notification.",
    ],
    ["words", "“Uppercase”", "Transform the selected text instantly."],
    [
      "spark",
      "“Rewrite this as an email”",
      "Use a local or BYOK language model.",
    ],
  ]
    .map(
      ([i, t, d]) =>
        `<div class="card">${icon(i)}<h3>${t}</h3><p class="muted">${d}</p></div>`,
    )
    .join("")}</div>`;
}
function renderDictionary() {
  const kind = dictTab,
    items = state[kind].filter(
      (x) =>
        !search ||
        JSON.stringify(x).toLowerCase().includes(search.toLowerCase()),
    );
  const descriptions = {
    dictionary: [
      "Words that are yours.",
      "Names, technical terms, and vocabulary to guide the speech model.",
    ],
    threads: [
      "Say less. Write more.",
      "Spoken phrases expand into longer text, using case-insensitive phrase matching.",
    ],
    expansions: [
      "A few keys. A whole thought.",
      "Type a shortcut in any app to expand it. Accessibility access enables system-wide expansions.",
    ],
  };
  return `${heading("Your personal language", descriptions[kind][0], descriptions[kind][1], button("Import", "import-items", "upload", "", `data-kind="${kind}"`) + button("Add " + { dictionary: "word", threads: "thread", expansions: "expansion" }[kind], "add-item", "plus", "primary", `data-kind="${kind}"`))}<div class="tabs">${["dictionary", "threads", "expansions"].map((t) => button(t[0].toUpperCase() + t.slice(1), "dictionary-tab", "", kind === t ? "active" : "", `data-tab="${t}"`)).join("")}</div><input id="search" class="search" data-focus="search" value="${esc(search)}" placeholder="Search ${kind}…"><div class="card">${items.length ? items.map((x) => `<div class="list-row"><span class="list-icon">${icon(kind === "dictionary" ? "dictionary" : "shortcut")}</span><div class="body"><strong>${esc(x.word || x.trigger)}</strong><p>${esc(x.replacement || x.aliases?.join(", ") || "Vocabulary prompt")}</p></div>${x.builtin ? '<span class="badge">BUILT-IN</span>' : ""}${kind === "expansions" ? `<input type="checkbox" data-toggle-kind="expansions" data-id="${x.id}" ${x.enabled !== false ? "checked" : ""} aria-label="Enable expansion">` : ""}${button("", "edit-item", "edit", "ghost icon", `data-kind="${kind}" data-id="${x.id}"`)}${!x.builtin ? button("", "delete", "trash", "ghost icon danger", `data-kind="${kind}" data-id="${x.id}"`) : ""}</div>`).join("") : empty("dictionary", "Make it sound like you.", "Add a name, a term, or a phrase you say often. Your dictionary is stored locally.")}</div>${kind === "expansions" ? '<p class="tip">Variables: {date}, {time}, {clipboard}. Start a trigger with a colon, such as :intro. Secure password fields are excluded.</p>' : ""}`;
}
function renderSpeechProvider() {
  const settings = state.settings;
  return `<div class="card"><h2>Choose where speech is transcribed</h2><p class="muted">Local models run on this Mac for free. Choosing a cloud service sends the audio you transcribe to that provider. Its API may charge for usage.</p><form id="speech-provider-form">${select("speechProvider", "Speech provider", [["local", "Local · no usage fees"], ...(state.speechProviders || []).map((p) => [p.id, p.id])], settings.speechProvider)}${field("speechCloudModel", "Cloud model (blank uses provider default)", settings.speechCloudModel)}${field("speechCloudVersion", "Cartesia API version", settings.speechCloudVersion)}${field("speechKey", "Selected provider API key", "", "password", "Leave blank to retain your saved key. Keys stay in macOS secure storage.")}<button type="submit" class="primary">Save speech configuration</button></form><p class="tip">Local transcription does not upload audio. Switching back to Local restores that behavior. Cloud file-size and duration limits depend on the provider.</p></div>`;
}
function renderModels() {
  return `${renderSpeechProvider()}${heading("Speech, on your terms", "A model for every moment.", "Smaller is faster. Larger handles nuance. Models download once and run locally on your Mac.")}<div class="banner">${state.speechStatus.ready ? "Local speech runtime is installed and ready." : "Install the speech runtime using npm run setup:speech."}<span class="badge">${state.platform}</span></div><div class="grid three">${state.models
    .map((m) => {
      const p = downloadProgress[m.id];
      return `<div class="card model-card ${state.settings.speechProvider === "local" && state.settings.modelId === m.id ? "active" : ""}"><div class="row between"><h3>${esc(m.name)}</h3>${state.settings.speechProvider === "local" && state.settings.modelId === m.id ? '<span class="badge">ACTIVE</span>' : ""}</div><p class="muted">${esc(m.language && m.language !== "auto" ? m.language : m.englishOnly ? "English" : "Multilingual")} · ${Math.round(m.bytes / 1e6)} MB</p><p class="smallprint">SHA-256 verified downloads. ${esc(m.engine === "catalog" ? "CoreML · " + m.license : m.id.startsWith("parakeet") ? "CoreML · Apache-2.0 runtime" : "Whisper.cpp · MIT")}</p>${p ? `<div class="progress-track"><div class="progress-fill" data-progress="${m.id}"></div></div><span class="smallprint" data-progress-label="${m.id}">${Math.round((p.progress || 0) * 100)}%</span>` : ""}<div class="model-actions">${m.installed ? button(state.settings.speechProvider === "local" && state.settings.modelId === m.id ? "Selected" : "Use model", "use-model", state.settings.speechProvider === "local" && state.settings.modelId === m.id ? "check" : "arrow", "small", `data-id="${m.id}"`) + button("", "delete-model", "trash", "ghost icon small", `data-id="${m.id}"`) : m.downloading || p ? button("Cancel", "cancel-download", "close", "small", `data-id="${m.id}"`) : button("Download", "download-model", "download", "small primary", `data-id="${m.id}"`)}</div></div>`;
    })
    .join(
      "",
    )}</div><p class="tip">Model files stay outside the source repository. You can move them by changing SCRIBBLE_DATA_DIR.</p>`;
}
function renderAI() {
  const s = state.settings;
  return `${heading("Your assistant. Your choice.", "A little help with your words.", "Use a free local model through Ollama, or connect a provider with your own key. Cloud providers may charge for usage.")}<div class="grid two"><div class="card"><h2>Configure a language model</h2><form id="ai-form">${select(
    "aiProvider",
    "Provider",
    [
      ["ollama", "Ollama · local and free"],
      ["openai", "OpenAI"],
      ["anthropic", "Anthropic"],
      ["gemini", "Gemini"],
      ["groq", "Groq"],
      ["deepseek", "DeepSeek"],
      ["openrouter", "OpenRouter"],
      ["cerebras", "Cerebras"],
      ["azure", "Azure OpenAI"],
      ["bedrock", "AWS Bedrock · bearer API key"],
      ["custom", "Custom OpenAI-compatible API"],
    ],
    s.aiProvider,
  )}${field("aiEndpoint", s.aiProvider === "ollama" ? "Ollama server" : "API base URL", s.aiEndpoint)}${field("aiModel", "Model", s.aiModel)}${field("aiDeployment", "Azure deployment (Azure only)", s.aiDeployment)}${field("aiVersion", "Azure API version (Azure only)", s.aiVersion)}${field("apiKey", "Cloud API key (unused for Ollama)", "", "password", "Leave blank to keep this provider’s saved key.")}${area("aiInstructions", "Dictation instructions", s.aiInstructions)}${check("aiEnhance", "Enhance dictation after transcription", s.aiEnhance)}<div class="row"><button type="submit" class="primary">Save configuration</button>${button("Test connection", "ai-test", "check")}</div></form></div><div class="card"><p class="eyebrow">Local intelligence</p><h2>Keep the whole loop private.</h2><p class="muted">Ollama serves a local language model for cleanup, commands, summaries, and tones. No API key is needed.</p><div class="code">ollama pull ${esc(s.aiModel)}</div><div class="row wrap">${button("Get Ollama", "open-url", "download", "", 'data-url="https://ollama.com/download/mac"')}${button("Download selected model", "ai-download", "model")}</div><div id="ai-status" class="notice"></div><p class="tip">Scribble starts its bundled Ollama runtime when needed. You can use a smaller model on a Mac with limited memory.</p><h3>What gets sent?</h3><p class="muted">Commands can include text, selected files and screen images you attach. Memory indexing sends reference text to the configured provider. Scribble does not send audio to a text model or use telemetry.</p></div></div>${renderAIUtilities()}`;
}
const utilityPresets = [["grammar", "Fix grammar"], ["professional", "Professional"], ["polish", "Polish"], ["summary", "Summary"], ["bullets", "Bullet points"], ["email", "Email"]];
function utilityBinding(id) { return (state.settings.hotkeys || []).find(h => h.mode === "utility" && h.utilityId === id); }
function renderAIUtilities() {
  return `<div class="card"><div class="row between"><h2>${esc(interfaceLabel("AI utilities"))}</h2>${button("Add utility", "add-ai-utility", "plus")}</div><p class="muted">${esc(interfaceLabel("Transform selected text or clipboard text with your configured language model. Cloud providers receive this text and may charge for usage. Results stay available for review before insertion. An empty selection is never replaced with clipboard text."))}</p>${(state.settings.aiUtilities || []).map(u => `<div class="list-row"><div class="body"><strong>${esc(u.name)}</strong><p>${esc(interfaceLabel(utilityPresets.find(p => p[0] === u.preset)?.[1] || u.preset))} · ${esc(interfaceLabel(u.source === "clipboard" ? "Clipboard" : "Selected text"))}${utilityBinding(u.id) ? " · " + esc(utilityBinding(u.id).modifiers.join(" + ")) + " + " + esc(utilityBinding(u.id).keyCode) : " · " + esc(interfaceLabel("No shortcut"))}</p></div>${button(u.enabled !== false ? "Disable" : "Enable", "toggle-ai-utility", "", "small", `data-id="${esc(u.id)}"`)}${utilityBusy.has(u.id) ? button("Cancel", "cancel-ai-utility", "close", "small", `data-id="${esc(u.id)}"`) : button("Run", "run-ai-utility", "play", "small", `data-id="${esc(u.id)}" ${u.enabled === false ? "disabled" : ""}`)}${button("Edit", "edit-ai-utility", "edit", "small", `data-id="${esc(u.id)}"`)}${button("Delete", "delete-ai-utility", "trash", "small danger", `data-id="${esc(u.id)}"`)}</div>`).join("") || `<p class="muted">${esc(interfaceLabel("Add a utility to turn a keyboard shortcut into a text transformation."))}</p>`}${utilityResult ? `<div class="command-panel"><h3>${esc(utilityResult.name)}</h3><div class="command-result" id="utility-result" tabindex="0">${esc(utilityResult.text)}</div><div class="row">${button("Copy", "copy-ai-utility", "copy")}${utilityResult.canInsert ? button("Insert", "paste-ai-utility", "arrow", "primary") : ""}${button("Dismiss", "dismiss-ai-utility", "close")}</div><p class="smallprint">${esc(interfaceLabel(utilityResult.canInsert ? "Focus the result and press Tab to insert, or Escape to dismiss." : "Copy the result or dismiss it. Press Escape to dismiss."))}</p></div>` : ""}</div>`;
}
async function insertCommandResult() {
  const result = commandResult;
  if (result?.kind !== "text" || !result.canInsert || !result.reviewId) return;
  await request("paste-command-result", {id: result.reviewId});
  if (commandResult?.reviewId === result.reviewId) { commandResult = null; render(); }
}
async function insertAIUtility() {
  const result = utilityResult;
  if (!result?.canInsert) return;
  await request("paste-ai-utility", {id: result.id});
  // A later result may arrive while insertion is pending. Keep that new review.
  if (utilityResult === result) { utilityResult = null; render(); }
}
function workflowText(text, params = {}) {
  return interfaceLabel(text).replace(/\{([a-zA-Z]+)\}/g, (token, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : token);
}
function editAIUtility(id) {
  const item = (state.settings.aiUtilities || []).find(u => u.id === id) || {id: crypto.randomUUID(), name: "", preset: "grammar", source: "selection", enabled: true};
  const binding = utilityBinding(item.id);
  const title = id ? "Edit AI utility" : "Add AI utility";
  const presetLabel = "Transformation", sourceLabel = "Text source";
  showModal(title, field("name", "Name", item.name) + select("preset", presetLabel, utilityPresets.map(([id,label]) => [id,interfaceLabel(label)]), item.preset) + select("source", sourceLabel, [["selection", interfaceLabel("Selected text")], ["clipboard", interfaceLabel("Clipboard")]], item.source) + `<label class="field"><input type="checkbox" name="enabled" ${item.enabled !== false ? "checked" : ""}> ${esc(interfaceLabel("Enabled"))}</label>` + `<label class="field">${esc(interfaceLabel("Keyboard shortcut (optional)"))}<input type="checkbox" name="bindShortcut" ${binding ? "checked" : ""}> ${esc(interfaceLabel("Enable this binding"))}</label><div class="row">${button("Capture binding", "capture-hotkey", "keyboard")}<span id="capture-hotkey-status" role="status">${esc(interfaceLabel("Use a regular key with at least one modifier."))}</span></div><label class="field">${esc(interfaceLabel("Modifiers (comma-separated)"))}<input name="modifiers" value="${esc(binding?.modifiers.join(", ") || "option, command")}"></label><label class="field">${esc(interfaceLabel("macOS key code"))}<input type="number" name="keyCode" min="0" max="127" value="${binding?.keyCode ?? 5}"></label><p class="tip">${esc(interfaceLabel("G=5, L=37, N=45. Modifier-only and mouse bindings are unavailable for AI utilities."))}</p>`, async v => {
    const name = v.name.trim();
    if (!name || name.length > 200) throw new Error(interfaceLabel("Enter a utility name of at most 200 characters."));
    const hotkeys = (state.settings.hotkeys || []).filter(h => !(h.mode === "utility" && h.utilityId === item.id));
    if (v.bindShortcut) {
      const modifiers = v.modifiers.split(",").map(x => x.trim()).filter(Boolean), keyCode = Number(v.keyCode);
      const allowed = ["option", "command", "control", "shift", "fn", "left-option", "right-option", "left-command", "right-command", "left-control", "right-control", "left-shift", "right-shift"];
      if (!modifiers.length || modifiers.some(m => !allowed.includes(m)) || !Number.isInteger(keyCode) || keyCode < 0 || keyCode > 127 || [54,55,56,57,58,59,60,61,62,63].includes(keyCode)) throw new Error(interfaceLabel("Choose a regular keyboard key and at least one valid modifier."));
      if (hotkeys.some(h => h.keyCode === keyCode && [...h.modifiers].sort().join(",") === [...modifiers].sort().join(","))) throw new Error(interfaceLabel("This shortcut is already assigned. Choose another binding."));
      hotkeys.push({mode: "utility", utilityId: item.id, keyCode, modifiers, toggle: true});
    }
    const aiUtilities = [...(state.settings.aiUtilities || [])];
    const utility = {...item, name, preset: v.preset, source: v.source, enabled: v.enabled};
    const index = aiUtilities.findIndex(u => u.id === item.id); if (index < 0) aiUtilities.push(utility); else aiUtilities[index] = utility;
    await request("preferences", {aiUtilities, hotkeys});
  });
}
function renderTones() {
  return `${heading("Sound like yourself", "The right tone, in the right place.", "Match an application to a style, speech model, and cleanup preference. Add as many profiles as you need.", button("Automatic", "select-tone", "refresh", "", 'data-id=""') + button("Create tone", "add-item", "plus", "primary", 'data-kind="tones"'))}<div class="grid two">${state.tones.length ? state.tones.map((t) => `<div class="card"><div class="row between"><h2>${esc(t.name)}</h2>${icon("tone")}</div><p class="muted">${esc(t.instructions || "Keep the original wording.")}</p><div class="row wrap"><span class="badge">${esc(t.modelId || "Default model")}</span><span class="badge">${t.enhance ? "AI cleanup" : "Original words"}</span></div><p class="tip">${esc(t.apps?.join(", ") || "No application rules")}</p><div class="row">${button(state.settings.pinnedToneId === t.id ? "Pinned" : "Use tone", "select-tone", "check", "small", `data-id="${t.id}"`)}${button("Edit", "edit-item", "edit", "small", `data-kind="tones" data-id="${t.id}"`)}${button("Delete", "delete", "trash", "small danger", `data-kind="tones" data-id="${t.id}"`)}</div></div>`).join("") : empty("tone", "Every app has its own rhythm.", "Set a concise tone for Slack, a polished one for email, or keep your words untouched.")}</div>`;
}
function renderMemory() {
  return `${heading("A little context goes a long way", "Remember what matters.", "Reference notes and files are indexed with your selected language model. Adding or re-indexing sends their text to that provider. Choose Ollama to keep indexing on this Mac.", button("Import file", "import-items", "upload", "", 'data-kind="memory"') + button("Add memory", "add-item", "plus", "primary", 'data-kind="memory"'))}<div class="card">${state.memory.length ? state.memory.map((m) => `<div class="list-row"><span class="list-icon">${icon("memory")}</span><div class="body"><strong>${esc(m.name)}</strong><p>${esc(m.status || "Not indexed")}${m.error ? " · " + esc(m.error) : ""}</p><p class="truncate">${esc((m.summary || m.content)?.slice(0, 180))}</p></div><input type="checkbox" data-toggle-kind="memory" data-id="${m.id}" ${m.enabled !== false ? "checked" : ""} aria-label="Include memory">${button("Edit", "edit-item", "edit", "small", `data-kind="memory" data-id="${m.id}"`)}${button("Re-index", "memory-reindex", "refresh", "small", `data-id="${m.id}"`)}${button("", "delete", "trash", "ghost icon danger", `data-kind="memory" data-id="${m.id}"`)}</div>`).join("") : empty("memory", "Your useful context, on hand.", "Names, project details, preferred writing style, or a reference document.")}</div>`;
}
function setting(label, description, key, type = "checkbox", options, disabled = false) {
  const s = state.settings;
  let control =
    type === "checkbox"
      ? `<input type="checkbox" data-setting="${key}" ${disabled ? "disabled" : ""} ${s[key] ? "checked" : ""} aria-label="${esc(interfaceLabel(label))}">`
      : type === "select"
        ? `<select data-setting="${key}" aria-label="${esc(interfaceLabel(label))}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(s[key]) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
        : `<input data-setting="${key}" data-type="${type}" type="${type}" value="${esc(s[key])}" aria-label="${esc(interfaceLabel(label))}">`;
  return `<div class="setting-row"><div><h3>${esc(interfaceLabel(label))}</h3><p>${interfaceProse(description)}</p></div>${control}</div>`;
}
function renderSpeechLanguageSetting() {
  const model = state.settings.speechProvider === "local" && state.models.find((m) => m.id === state.settings.modelId);
  const fixed = model && (model.englishOnly ? "en" : model.language && model.language !== "auto" ? model.language : "");
  if (!fixed) return setting("Dictation language", "Auto-detect works with multilingual speech models.", "language", "select", speechLanguageOptions(model));
  const label = langList.find(([code]) => code === fixed)?.[1] || fixed;
  return `<div class="setting-row"><div><h3>Dictation language</h3><p>${esc(model.name)} transcribes ${esc(label)}. Choose a multilingual model to change languages.</p></div><select data-setting="language" aria-label="Dictation language" disabled><option value="${esc(fixed)}">${esc(label)}</option></select></div>`;
}
function renderSettings() {
  const s = state.settings;
  const tabs = {
    general: "General",
    audio: "Microphone",
    language: "Languages",
    recording: "Recording",
    hotkeys: "Shortcuts",
    permissions: "Permissions",
    privacy: "Privacy & data",
    developer: "Developer",
  };
  let body = "";
  if (settingsTab === "general")
    body = `<h2>A workspace that fits.</h2>${setting("Interface language", "Choose the language for navigation, common actions and dates.", "locale", "select", ScribbleI18n.locales.map((locale) => [locale.id, locale.name]))}${setting("Your name", "Used only for your dashboard greeting.", "name", "text")}${setting(
      "Appearance",
      "Choose the look of your workspace.",
      "theme",
      "select",
      [
        ["light", "Light"],
        ["dark", "Dark"],
      ],
    )}${setting("Launch at login", "Start Scribble when you sign into this Mac.", "launchAtLogin")}${setting("Hide Dock icon", "Open Scribble through its menu bar microphone.", "hideDock")}${setting("Start in the menu bar", "Keep the main window hidden on launch.", "startMinimized")}${setting("Auto Enter", "Press Return after inserting a dictation.", "autoEnter")}${setting("Restore clipboard", "Put your previous clipboard back after insertion.", "restoreClipboard")}${setting("Remove filler words", "Remove common speech fillers without changing the meaning.", "removeFillers")}${setting("Punctuation", "Apply the speech model’s punctuation.", "punctuation")}${setting("Recording sounds", "Play a quiet sound when recording starts and stops.", "sounds")}${setting(
      "Browser for shortcuts",
      "Voice searches open Google Chrome or your system browser.",
      "preferredBrowser",
      "select",
      [
        ["Google Chrome", "Google Chrome"],
        ["default", "System browser"],
      ],
    )}`;
  if (settingsTab === "audio")
    body = `<h2>Your microphone.</h2><p class="muted">Choose a connected input. Refreshing devices asks the browser for microphone access so labels are available.</p>${button("Refresh microphones", "refresh-mics", "refresh")}<div id="microphone-list" class="stack"></div><p class="tip">The system default follows your Mac’s selected microphone. Unavailable preferred inputs fall through to the next choice and then the system default.</p><h3>Preferred order</h3><ol>${(s.microphonePriority || []).map((id) => `<li>${esc(id === "default" ? "System default" : microphoneDevices.find((device) => device.deviceId === id)?.label || "Saved microphone (refresh for name)")}</li>`).join("")}</ol>${button("Clear preferred order", "clear-mic-priority", "close", "ghost")}`;
  if (settingsTab === "language")
    body = `<h2>Every word, understood.</h2>${setting(
      "Whisper resource mode",
      "Automatic uses available acceleration. CPU mode disables GPU use and limits Whisper to two CPU threads. CoreML and cloud engines manage their own resources.",
      "resourceMode",
      "select",
      [
        ["automatic", "Automatic"],
        ["cpu", "CPU · reduced parallelism"],
      ],
    )}${renderSpeechLanguageSetting()}${setting("Translate to English", "Whisper can translate other languages during transcription.", "translate", "checkbox", undefined, state.settings.speechProvider !== "local" || ["parakeet", "catalog"].includes(state.models.find((m) => m.id === state.settings.modelId)?.engine))}${setting(
      "Summary language",
      "The language model writes notes in this language.",
      "summaryLanguage",
      "select",
      langList.filter((x) => x[0] !== "auto"),
    )}${setting("Note summary provider", "Use the configured language model or an already signed-in Claude subscription CLI. Claude summaries send transcript text to Anthropic and use subscription limits.", "summaryProvider", "select", [["configured-ai", "Configured language model"], ["claude-cli", "Claude subscription CLI"]])}${s.summaryProvider === "claude-cli" ? setting("Claude summary model", "Leave blank to use the installed CLI default.", "summaryModel", "text") + button("Check Claude CLI", "summary-cli-status", "check") + '<p id="summary-cli-status" class="notice" role="status"></p>' : ""}${setting(
      "English spelling",
      "Preferred writing convention for AI instructions.",
      "spelling",
      "select",
      [
        ["us", "American English"],
        ["uk", "British English"],
      ],
    )}<p class="tip">Whisper .en models transcribe English only. Select Base or a larger multilingual model for other languages.</p>`;
  if (settingsTab === "recording")
    body = `<h2>Stay in the flow.</h2>${setting("Auto-paste dictation", "Insert the result in the active application after speech ends.", "autoPaste")}${setting("Keep audio recordings", "Retain audio for playback and retry.", "saveAudio")}${setting("Keep voice log", "Store dictations in searchable history. Files and notes stay in the workspace.", "saveHistory")}${setting("Indicator style", "Native notch uses the display cutout. Displays without a notch use the pill. Hidden removes the recording indicator.", "indicatorStyle", "select", [["pill", interfaceLabel("Pill")], ["notch", interfaceLabel("Native notch")], ["hidden", interfaceLabel("Hidden")]])}${setting(
      "Indicator position",
      "A small recording indicator follows the current display.",
      "indicatorPosition",
      "select",
      [
        ["bottom", "Bottom"],
        ["top", "Top"],
        ["hidden", "Hidden"],
      ],
    )}${setting("Idle indicator", "Keep a small ready indicator visible.", "idleIndicator")}${setting("Enhance with AI", "Clean up words using your configured language model.", "aiEnhance")}<div class="setting-row"><div><h3>Recordings folder</h3><p>${esc(s.recordingsDir || state.dataDir + "/recordings")}</p></div>${button("Choose folder", "recordings-folder", "folder")}</div><p class="tip">Changing folders applies to new recordings. Existing audio keeps its original path so playback and retries still work.</p>`;
  if (settingsTab === "hotkeys")
    body = `<h2>A shortcut for every thought.</h2><p class="muted">Bindings are global when Accessibility access is enabled. Use hold for push-to-talk, or toggle for hands-free recording.</p>${s.hotkeys.map((h, i) => `<div class="list-row"><div class="body"><strong>${esc(h.mode === "utility" ? workflowText("AI utility · {name}", {name: (s.aiUtilities || []).find(u => u.id === h.utilityId)?.name || h.utilityId}) : h.mode)}</strong><p>${h.mode === "utility" ? esc(interfaceLabel("Tap to transform text")) : h.toggle ? "Tap to start / tap to stop" : "Hold to speak"}</p></div><kbd>${esc(h.modifiers.join(" + "))} + ${h.keyCode === 49 ? "Space" : h.keyCode === 37 ? "L" : h.keyCode === -1 ? "modifier" : h.keyCode >= 130 ? `M${h.keyCode - 127}` : h.keyCode}</kbd>${button("Edit", "edit-hotkey", "edit", "small", `data-index="${i}"`)}${button("Remove", "remove-hotkey", "trash", "small danger", `data-index="${i}"`)}</div>`).join("")}<div class="row">${button("Add binding", "add-hotkey", "plus")}${button("Restore defaults", "reset-hotkeys", "refresh")}</div><p class="tip">Escape cancels an active recording. Cmd+Shift+L can be configured to paste the last dictation.</p>${area("suppressed-apps", "Pause shortcuts in these applications", s.suppressedApps.join("\n"), "One bundle identifier per line.")} ${button("Save exclusions", "save-suppressed", "check")}`;
  if (settingsTab === "permissions")
    body = `<h2>Only what’s needed.</h2><p class="muted">Scribble needs microphone access for recording and Accessibility access for shortcuts, insertion, and expansions. Screen recording is optional for meeting audio.</p>${[
      ["microphone", "Microphone", "Record your voice."],
      [
        "accessibility",
        "Accessibility",
        "Global shortcuts and cursor insertion.",
      ],
      [
        "screen",
        "Screen & system audio",
        "Capture a meeting’s system audio when you request it.",
      ],
    ]
      .map(
        ([k, l, d]) =>
          `<div class="setting-row"><div><h3>${l}</h3><p>${d}</p><span class="permission-state">${k === "microphone" ? (permissions.microphone === 3 || permissions.microphone === true ? "Allowed" : { denied: "Denied — enable in System Settings", restricted: "Restricted by macOS", "not-determined": "Not yet requested", unknown: "Status unavailable" }[permissions.microphoneStatus] || "Not verified") : permissions[k === "screen" ? "screenRecording" : k] ? "Allowed" : "Not yet allowed"}</span></div><div class="row">${button("Request", "request-permission", "shield", "small", `data-kind="${k}"`)}${button("Open settings", "permission-settings", "arrow", "small", `data-kind="${k}"`)}</div></div>`,
      )
      .join("")}${button("Refresh status", "check-permissions", "refresh")}`;
  if (settingsTab === "privacy")
    body = `<h2>Your workspace belongs to you.</h2>${setting("Typed expansions", "Observe typed trigger text for system-wide expansions. Password fields are skipped.", "expansionsEnabled")}${setting("Clipboard history", "Opt in to saving up to 100 clipboard text entries locally.", "clipboardHistory")}${setting("Memory in commands", "Include enabled memory items in language-model command requests.", "memoryEnabled")}<div class="setting-row"><div><h3>Export backup</h3><p>Settings, vocabulary, transcripts, notes, and history. API keys are excluded.</p></div>${button("Export", "backup", "download")}</div><div class="setting-row"><div><h3>Restore backup</h3><p>Your current workspace is backed up before replacement.</p></div>${button("Restore", "restore", "upload")}</div><div class="setting-row"><div><h3>Data folder</h3><p>${esc(state.dataDir)}</p></div>${button("Open", "open-data", "folder")}</div>${
      state.clipboard.length
        ? `<h3>Recent clipboard</h3>${state.clipboard
            .slice(0, 10)
            .map(
              (c) =>
                `<div class="list-row"><span class="body truncate">${esc(c.text)}</span>${button("Copy", "copy-clipboard", "copy", "small", `data-id="${c.id}"`)}${button("Delete", "delete", "trash", "small danger", `data-kind="clipboard" data-id="${c.id}"`)}</div>`,
            )
            .join("")}`
        : ""
    }`;
  if (settingsTab === "developer")
    body = `<h2>A voice workspace you can build on.</h2>${setting("Prefer IPv4", "Try IPv4 addresses first for new provider and model-download connections. IPv6 fallback remains available; existing connections keep their current address.", "preferIPv4")}<p class="muted">Use the CLI to search your history, transcribe a file, manage vocabulary, or expose an MCP server to your coding agent.</p><div class="code">node scripts/scribble.cjs status\nnode scripts/scribble.cjs transcribe /path/to/audio.wav\nnode scripts/scribble.cjs search "meeting"\nnode scripts/scribble.cjs --mcp</div><h3>Speech runtime</h3><div class="code">${esc(state.speechStatus.runtime)}</div><p class="tip">Communication uses a local Unix socket with owner-only permissions. Scribble does not expose a public HTTP server.</p><p>Version ${esc(state.version)} · MIT licensed original source</p>`;
  return `${heading("Make it yours", "Small details. Better flow.", "Your preferences are saved locally and take effect immediately.")}<div class="settings-layout"><div class="settings-nav">${Object.entries(
    tabs,
  )
    .map(([k, l]) =>
      button(
        l,
        "settings-tab",
        "",
        settingsTab === k ? "active" : "",
        `data-tab="${k}"`,
      ),
    )
    .join("")}</div><div class="card">${body}</div></div>`;
}
function renderHelp() {
  return `${heading("A voice worth keeping", "Meet Scribble.", "An independent, open-source voice workspace. Local speech, useful tools, and no account required.")}<div class="grid two"><div class="card"><h2>Start with one sentence.</h2><ol><li>Download a speech model in Speech models.</li><li>Allow microphone and Accessibility access.</li><li>Hold Option+Space in the app where you want to write.</li><li>Release. Your words appear at the cursor.</li></ol>${button("Check permissions", "navigate", "shield", "primary", 'data-page="settings"')}${button("Run setup again", "restart-setup", "refresh", "ghost")}</div><div class="card"><h2>Free, local components.</h2><p>Speech recognition uses Whisper.cpp and optional Parakeet. Language-model features use Ollama or your explicitly configured provider.</p><p class="muted">Scribble’s source is original. Vowen’s public behavior informed the feature checklist. No Vowen application code or artwork ships with Scribble.</p><span class="badge">MICROPHONE ICON · SCRIBBLE</span></div></div><div class="section-heading"><h2>Useful shortcuts</h2></div><div class="card">${[
    ["⌥ Space", "Hold to dictate"],
    ["⌥ ⇧ Space", "Hands-free recording"],
    ["⌥ ⌃ Space", "Voice command"],
    ["Esc", "Cancel recording"],
    ["⌘ ,", "Open settings"],
  ]
    .map(
      ([k, l]) =>
        `<div class="list-row"><kbd>${k}</kbd><span>${l}</span></div>`,
    )
    .join(
      "",
    )}</div><p class="tip">Closing the window keeps Scribble in the menu bar. Use Quit Scribble to exit completely.</p>`;
}
function safeRichHTML(html) {
  const documentFragment = new DOMParser().parseFromString(
    String(html),
    "text/html",
  );
  const allowed = new Set([
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "P",
    "BR",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
  ]);
  function clean(node) {
    if (node.nodeType === 3) return document.createTextNode(node.textContent);
    if (node.nodeType !== 1) return document.createTextNode("");
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.tagName))
      return document.createTextNode("");
    const element = allowed.has(node.tagName)
      ? document.createElement(node.tagName.toLowerCase())
      : document.createElement("span");
    for (const child of node.childNodes) element.appendChild(clean(child));
    return element;
  }
  const container = document.createElement("div");
  for (const child of documentFragment.body.childNodes)
    container.appendChild(clean(child));
  return container.innerHTML;
}
document.addEventListener("mousedown", (event) => {
  if (event.target.closest('[data-action="rich-format"]'))
    event.preventDefault();
});
let shortcutBrowserCatalogue = [];
let shortcutBrowserGeneration = 0;
let shortcutBrowserLoading = false;
function shortcutDrafts(item) {
  const actions = Array.isArray(item.actions) ? item.actions : item.target || item.url ? [item.type === "app" ? {type:"application", name:item.target, folder:item.folder || ""} : item.type === "folder" ? {type:"folders", paths:[item.target]} : {type:"websites", urls:[item.target || item.url], browser:item.browser || "chrome", profile:item.profile || ""}] : [];
  return actions.map(action => ({type:action.type, urlsText:(action.urls || []).join("\n"), browser:action.browser || "chrome", profile:action.profile || "", name:action.name || "", folder:action.folder || "", pathsText:(action.paths || []).join("\n")}));
}
function shortcutBrowserOptions(selected = "chrome") {
  const options = [["default",interfaceLabel("System default browser")],...shortcutBrowserCatalogue.map(browser=>[browser.id,browser.name])];
  if (!options.some(([id])=>id === selected)) options.push([selected,(selected === "chrome" ? "Google Chrome" : selected) + " (" + interfaceLabel(shortcutBrowserLoading ? "loading…" : "unavailable") + ")"]);
  return options;
}
function shortcutProfileOptions(browser,selected = "") {
  const profiles = shortcutBrowserCatalogue.find(entry=>entry.id === browser)?.profiles || [];
  const options = [["",interfaceLabel("Browser default profile")],...profiles.map(profile=>[profile.id,profile.name])];
  if (selected && !options.some(([id])=>id === selected)) options.push([selected,selected + " (" + interfaceLabel(shortcutBrowserLoading ? "loading…" : "unavailable") + ")"]);
  return options;
}
function shortcutOptionsHTML(options,selected) {
  return options.map(([id,name])=>`<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(name)}</option>`).join("");
}
function shortcutBrowserControls(action) {
  const browser = action.browser || "chrome", profile = action.profile || "", profiles = shortcutProfileOptions(browser,profile);
  return `<label class="field">${esc(interfaceLabel("Browser"))}<select data-shortcut-field="browser">${shortcutOptionsHTML(shortcutBrowserOptions(browser),browser)}</select></label><label class="field">${esc(interfaceLabel("Browser profile"))}<select data-shortcut-field="profile" ${profiles.length === 1 ? "disabled" : ""}>${shortcutOptionsHTML(profiles,profile)}</select></label>`;
}
function refreshShortcutBrowserMenus() {
  for (const block of $$('#shortcut-actions [data-shortcut-type="websites"]')) {
    const browser = block.querySelector('[data-shortcut-field="browser"]'), profile = block.querySelector('[data-shortcut-field="profile"]');
    const previousBrowser = browser.value || "chrome", previousProfile = profile.value;
    browser.innerHTML = shortcutOptionsHTML(shortcutBrowserOptions(previousBrowser),previousBrowser);
    const options = shortcutProfileOptions(previousBrowser,previousProfile);
    profile.innerHTML = shortcutOptionsHTML(options,previousProfile); profile.disabled = options.length === 1;
  }
}
async function discoverShortcutBrowsers() {
  const container = $("#shortcut-actions"), generation = ++shortcutBrowserGeneration;
  shortcutBrowserLoading = true; refreshShortcutBrowserMenus();
  const status = $("#shortcut-browser-status"); status.textContent = interfaceLabel("Finding installed browsers and profiles…");
  const current = () => generation === shortcutBrowserGeneration && $("#modal").open && $("#shortcut-actions") === container;
  try {
    const catalogue = await api.request("browser-catalog");
    if (!current()) return;
    if (!Array.isArray(catalogue)) throw Error(interfaceLabel("Browser discovery did not return a list."));
    shortcutBrowserCatalogue = catalogue.filter(browser=>browser && typeof browser.id === "string" && browser.id !== "default" && typeof browser.name === "string").map(browser=>({id:browser.id,name:browser.name,family:browser.family,profiles:Array.isArray(browser.profiles)?browser.profiles.filter(profile=>profile && typeof profile.id === "string" && typeof profile.name === "string"):[]}));
    shortcutBrowserLoading = false; refreshShortcutBrowserMenus();
    status.textContent = shortcutBrowserCatalogue.length ? interfaceLabel("Choose an installed browser and, when available, a profile.") : interfaceLabel("No supported browsers found. Saved unavailable choices are retained.");
  } catch(error) {
    if (!current()) return;
    shortcutBrowserLoading = false; refreshShortcutBrowserMenus();
    status.textContent = workflowText("Browser discovery unavailable: {error}", {error:error.message || interfaceLabel("Unknown error")});
  }
}
function shortcutActionHTML(actions) {
  const titles = {websites:"Open websites", application:"Open an application", folders:"Open folders"};
  const input = (key,label,value,hint="",multiline=false) => `<label class="field">${esc(interfaceLabel(label))}${multiline ? `<textarea data-shortcut-field="${key}">${esc(value)}</textarea>` : `<input data-shortcut-field="${key}" value="${esc(value)}">`}${hint ? `<small>${esc(interfaceLabel(hint))}</small>` : ""}</label>`;
  return actions.map((action,index) => `<section class="card" data-shortcut-action="${index}" data-shortcut-type="${esc(action.type)}" aria-label="${esc(workflowText("Action {number}",{number:index+1}))}"><div class="row between"><h3>${index + 1}. ${esc(interfaceLabel(titles[action.type] || "Unsupported action"))}</h3><div class="row">${button("↑","shortcut-action-up","","small",`data-index="${index}" aria-label="${esc(workflowText("Move action {number} up",{number:index+1}))}" ${index === 0 ? "disabled" : ""}`)}${button("↓","shortcut-action-down","","small",`data-index="${index}" aria-label="${esc(workflowText("Move action {number} down",{number:index+1}))}" ${index === actions.length - 1 ? "disabled" : ""}`)}${button("Remove","shortcut-action-remove","close","small",`data-index="${index}" aria-label="${esc(workflowText("Remove action {number}",{number:index+1}))}"`)}</div></div>${action.type === "websites" ? input("urlsText","Websites, one per line",action.urlsText,"Up to 16 websites. Use {{text}} to insert the spoken query.",true) + shortcutBrowserControls(action) : action.type === "application" ? input("name","Application name",action.name) + input("folder","Open a folder with this application (optional)",action.folder,"Use an absolute folder path or ~/ for your home folder.") : action.type === "folders" ? input("pathsText","Folders, one per line",action.pathsText,"Up to 16 absolute folder paths or ~/ paths.",true) : `<p>${esc(interfaceLabel("Remove unsupported actions before saving."))}</p>`}</section>`).join("");
}
function readShortcutDrafts() {
  return $$("#shortcut-actions [data-shortcut-action]").map(block => {
    const draft = {type:block.dataset.shortcutType};
    block.querySelectorAll("[data-shortcut-field]").forEach(input => { draft[input.dataset.shortcutField] = input.value; });
    return draft;
  });
}
function updateShortcutActionControls(actions) {
  $("#shortcut-actions").innerHTML = shortcutActionHTML(actions);
  $("#shortcut-action-count").textContent = workflowText("{count} / 32 actions",{count:actions.length});
  $$('#modal [data-action="shortcut-action-add"]').forEach(button => { button.disabled = actions.length >= 32; });
}
function editShortcutAction(button,action) {
  if (!$("#shortcut-actions")) return;
  const drafts = readShortcutDrafts();
  let focusIndex = Number(button.dataset.index);
  if (action === "shortcut-action-add") {
    if (drafts.length >= 32) throw Error(interfaceLabel("Add between 1 and 32 actions to this shortcut."));
    if (!["websites","application","folders"].includes(button.dataset.actionType)) return;
    drafts.push({type:button.dataset.actionType,urlsText:"",browser:"chrome",profile:"",name:"",folder:"",pathsText:""});
    focusIndex = drafts.length - 1;
  } else {
    if (!Number.isInteger(focusIndex) || focusIndex < 0 || focusIndex >= drafts.length) return;
    if (action === "shortcut-action-remove") drafts.splice(focusIndex,1);
    else {
      const other = focusIndex + (action === "shortcut-action-up" ? -1 : 1);
      if (other < 0 || other >= drafts.length) return;
      [drafts[focusIndex],drafts[other]] = [drafts[other],drafts[focusIndex]];
      focusIndex = other;
    }
  }
  updateShortcutActionControls(drafts);
  const blocks = $$("#shortcut-actions [data-shortcut-action]");
  blocks[Math.min(focusIndex,blocks.length - 1)]?.querySelector("[data-shortcut-field]")?.focus();
}
function shortcutActionsForSave() {
  const drafts = readShortcutDrafts();
  if (!drafts.length || drafts.length > 32) throw Error(interfaceLabel("Add between 1 and 32 actions to this shortcut."));
  const list = (value,label) => {
    const entries = (value || "").split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    if (!entries.length || entries.length > 16) throw Error(workflowText("{label} must contain between 1 and 16 entries.",{label:interfaceLabel(label === "Websites" ? "Websites, one per line" : "Folders, one per line")}));
    return entries;
  };
  return drafts.map(draft => {
    if (draft.type === "websites") {
      const profile = draft.profile.trim();
      const browser = draft.browser || "chrome";
      if (!/^[a-zA-Z0-9._-]{1,100}$/.test(browser) || profile && (!/^[a-zA-Z0-9._ -]{1,200}$/.test(profile) || [".",".."].includes(profile))) throw Error(interfaceLabel("Choose a valid browser and browser profile."));
      return {type:"websites",urls:list(draft.urlsText,"Websites"),browser,profile};
    }
    if (draft.type === "folders") return {type:"folders",paths:list(draft.pathsText,"Folders")};
    if (draft.type === "application") {
      const name = draft.name.trim(), folder = draft.folder.trim();
      if (!name) throw Error(interfaceLabel("Enter an application name."));
      if (folder && !folder.startsWith("/") && !folder.startsWith("~/") && folder !== "~") throw Error(interfaceLabel("Use an absolute folder path or ~/ for your home folder."));
      return {type:"application",name,folder};
    }
    throw Error(interfaceLabel("Remove unsupported actions before saving."));
  });
}
function shortcutDescription(shortcut) {
  if (Array.isArray(shortcut.actions)) return shortcut.actions.map(action => action.type === "websites" ? action.urls?.join(", ") : action.type === "application" ? action.name : action.paths?.join(", ")).filter(Boolean).join(" · ");
  return shortcut.target === "navigate" ? "Open a spoken website" : shortcut.target === "folder" ? "Open a common folder" : shortcut.target;
}
function editItem(kind, id) {
  const item = state[kind].find((x) => x.id === id) || {};
  let html;
  if (kind === "dictionary")
    html =
      field("word", "Word or phrase", item.word) +
      field(
        "aliases",
        "Often misheard as (comma-separated)",
        item.aliases?.join(", ") || "",
      );
  if (kind === "threads" || kind === "expansions")
    html =
      field(
        "trigger",
        kind === "threads" ? "Spoken trigger" : "Typed shortcut",
        item.trigger,
      ) +
      area(
        "replacement",
        "Expands to",
        item.replacement,
        kind === "expansions"
          ? "Variables: {date}, {time}, {clipboard}."
          : "Replaces matching phrases in your transcription.",
      );
  if (kind === "threads" || kind === "expansions")
    html =
      field(
        "trigger",
        kind === "threads" ? "Spoken trigger" : "Typed shortcut",
        item.trigger,
      ) +
      `<label class="field">Replacement<div class="row wrap">${[
        ["bold", "Bold"],
        ["italic", "Italic"],
        ["underline", "Underline"],
        ["insertUnorderedList", "List"],
      ]
        .map(([command, label]) =>
          button(
            label,
            "rich-format",
            "",
            "small",
            `data-command="${command}"`,
          ),
        )
        .join(
          "",
        )}</div><div id="rich-editor" class="editor" contenteditable="true" role="textbox" aria-label="Replacement text"></div><small>Formatting is included when inserting through the clipboard. AI cleanup returns plain text. Variables: {date}, {time}, {clipboard}, {selection}.</small></label>`;
  if (kind === "shortcuts")
    html = field("name", "Name", item.name) + field("trigger", "Trigger phrase", item.trigger) + `<label class="field">${esc(interfaceLabel("Aliases (comma-separated)"))}<input name="aliases" value="${esc(Array.isArray(item.aliases) ? item.aliases.join(", ") : item.aliases || "")}"></label><h3>${esc(interfaceLabel("Actions"))}</h3><p class="tip">${esc(interfaceLabel("Actions run in the numbered order. Choose where each website action opens."))}</p><div class="row wrap">${button("Add websites","shortcut-action-add","plus","small",'data-action-type="websites"')}${button("Add application","shortcut-action-add","plus","small",'data-action-type="application"')}${button("Add folders","shortcut-action-add","plus","small",'data-action-type="folders"')}</div><p id="shortcut-action-count" class="smallprint" role="status"></p><p id="shortcut-browser-status" class="smallprint" role="status"></p><div id="shortcut-actions" class="stack"></div>`;
  if (kind === "tones")
    html =
      field("name", "Tone name", item.name) +
      area("instructions", "Writing instructions", item.instructions) +
      field(
        "apps",
        "Application names or bundle IDs (comma-separated)",
        item.apps?.join(", ") || "",
      ) +
      select(
        "modelId",
        "Speech model",
        [["", "Default"], ...state.models.map((m) => [m.id, m.name])],
        item.modelId || "",
      ) +
      select(
        "language",
        "Dictation language",
        [["", "Default language"], ...speechLanguageOptions(toneSpeechModel(item.modelId))],
        item.language || "",
      ) +
      field(
        "websites",
        "Website rules (comma-separated)",
        item.websites?.join(", ") || "",
        "text",
        "For example docs.example.com/project. Website rules use the current Chrome URL when Accessibility makes it available.",
      ) +
      check("isDefault", "Default tone", item.isDefault || false) +
      check("enhance", "Use language model cleanup", item.enhance || false);
  if (kind === "memory")
    html =
      field("name", "Memory name", item.name) +
      (item.filePath
        ? `<p class="muted">Source file: ${esc(item.filePath)}. Saving re-reads this file and rebuilds its summary using your configured AI provider.</p>`
        : area(
            "content",
            "Reference text",
            item.content,
            "Saving rebuilds the summary using your configured AI provider.",
          )) +
      check("enabled", "Include in commands", item.enabled !== false);
  showModal(
    kind === "shortcuts" ? (id ? "Edit shortcut" : "Add shortcut") : (id ? "Edit " : "Add ") +
      {
        dictionary: "word",
        threads: "thread",
        expansions: "expansion",
        shortcuts: "shortcut",
        tones: "tone",
        memory: "memory",
      }[kind],
    html,
    async (values) => {
      if (kind === "threads" || kind === "expansions") {
        const editor = $("#rich-editor");
        values.replacement = editor.innerText || editor.textContent;
        values.html = safeRichHTML(editor.innerHTML);
      }
      if (kind === "shortcuts") {
        values.actions = shortcutActionsForSave();
        values.aliases = (values.aliases || "").split(",").map(value=>value.trim()).filter(Boolean);
      }
      if (kind === "dictionary")
        values.aliases = values.aliases
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      if (kind === "tones") {
        for (const key of ["apps", "websites"])
          values[key] = values[key]
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
      }
      await request("save-item", {
        kind,
        item: {
          ...item,
          ...values,
          enabled: values.enabled ?? item.enabled !== false,
        },
      });
      toast("Saved locally.");
    },
  );
  if (kind === "shortcuts") {
    shortcutBrowserCatalogue = []; shortcutBrowserLoading = true;
    updateShortcutActionControls(shortcutDrafts(item));
    void discoverShortcutBrowsers();
  }
  if (kind === "threads" || kind === "expansions")
    $("#rich-editor").innerHTML = safeRichHTML(
      item.html || "<p>" + esc(item.replacement || "") + "</p>",
    );
}
function editHotkey(index) {
  const existing = state.settings.hotkeys[index];
  if (existing?.mode === "utility") { editAIUtility(existing.utilityId); return; }
  const h = state.settings.hotkeys[index] || {
    modifiers: ["option"],
    keyCode: 49,
    mode: "dictation",
    toggle: false,
  };
  showModal(
    "Shortcut",
    select(
      "mode",
      "Action",
      [
        ["dictation", "Dictation"],
        ["command", "Command Mode"],
        ["shortcut", "Voice shortcuts"],
        ["note", "Start a note"],
        ["paste-last", "Paste last dictation"],
      ],
      h.mode,
    ) +
      select(
        "behavior",
        "Behavior",
        [
          ["hold", "Hold"],
          ["toggle", "Toggle"],
        ],
        h.toggle ? "toggle" : "hold",
      ) +
      `<div class="row">${button("Capture binding", "capture-hotkey", "keyboard")}<span id="capture-hotkey-status" role="status">${esc(interfaceLabel("Press a key, modifier chord or auxiliary mouse button."))}</span></div>` +
      field(
        "modifiers",
        "Modifiers (comma-separated)",
        h.modifiers.join(", "),
        "text",
        "option, command, control, shift, fn; use left-option or right-option (also command, control, shift) for a specific side.",
      ) +
      select(
        "mouseButton",
        "Mouse button (overrides keyboard code)",
        [["", "Use keyboard code"], ...Array.from({ length: 30 }, (_, i) => [String(130 + i), `M${i + 3}${i === 0 ? " (middle button)" : ""}`])],
        h.keyCode >= 130 ? String(h.keyCode) : "",
      ) +
      field(
        "keyCode",
        "macOS key code",
        h.keyCode,
        "number",
        "Space=49, L=37, N=45; use -1 for modifiers only.",
      ) +
      select(
        "toneId",
        "Dictation tone for this shortcut",
        [["", "Automatic tone"], ...state.tones.map((t) => [t.id, t.name])],
        h.toneId || "",
      ),
    async (v) => {
      const binding = {
        mode: v.mode,
        toggle: v.behavior === "toggle",
        modifiers: v.modifiers
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        keyCode: Number(v.mouseButton || v.keyCode),
        toneId: v.toneId || undefined,
      };
      const keys = state.settings.hotkeys.slice();
      if (index < keys.length) keys[index] = binding;
      else keys.push(binding);
      await request("preferences", { hotkeys: keys });
    },
  );
}
function startNoteDialog() {
  showModal(
    "Start a note",
    field("title", "Title", "Untitled meeting") +
      select(
        "template",
        "Note style",
        [
          ["Meeting", "Meeting"],
          ["Brainstorm", "Brainstorm"],
          ["Interview", "Interview"],
          ["Lecture", "Lecture"],
          ["Personal", "Personal"],
        ],
        state.settings.defaultNoteTemplate,
      ) +
      check("systemAudio", "Include system audio from the meeting", false) +
      area("personalNotes", "A few notes to start with", ""),
    async (values) => {
      noteSpec = values;
      flags = [];
      noteDraft = values.personalNotes;
      await request("start-recording", { mode: "note" });
    },
  );
  $("#modal button[type=submit]").textContent = "Start recording";
}
function stopLevels() {
  clearInterval(levelInterval);
  levelInterval = null;
  if (levelContext) levelContext.close().catch(() => {});
  levelContext = null;
}
function startLevels(media) {
  stopLevels();
  try {
    const context = new AudioContext();
    const source = context.createMediaStreamSource(media);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    levelContext = context;
    levelInterval = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) sum += value * value;
      const level = paused
        ? 0
        : Math.min(1, Math.sqrt(sum / samples.length) * 4);
      request("recording-level", { level }).catch(() => {});
    }, 100);
    context.resume().catch(() => {});
  } catch {
    stopLevels();
  }
}
async function recordingStart(mode) {
  if (startingRecording || (recorder && recorder.state !== "inactive")) return;
  const token = ++recordingToken;
  startingRecording = true;
  recorder = null;
  recordMode = mode || "dictation";
  cancelled = false;
  paused = false;
  chunks = [];
  try {
    const candidates = [
      ...new Set([
        ...(state.settings.microphonePriority || []),
        state.settings.microphoneId,
        "default",
      ]),
    ];
    for (const [index, device] of candidates.entries()) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: device === "default" ? true : { deviceId: { exact: device } },
        });
        if (index > 0)
          toast(
            "Preferred microphone unavailable. Using the next available input.",
          );
        break;
      } catch (error) {
        if (token !== recordingToken) return;
        if (
          !["NotFoundError", "OverconstrainedError"].includes(error.name) ||
          index === candidates.length - 1
        )
          throw error;
      }
    }
    if (token !== recordingToken) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      startingRecording = false;
      return;
    }
    if (recordMode === "note" && noteSpec.systemAudio) {
      try {
        await request("start-system-audio");
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
        throw e;
      }
    }
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    if (token !== recordingToken) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      startingRecording = false;
      return;
    }
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      audioBitsPerSecond: 128000,
    });
    startingRecording = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      clearInterval(recordInterval);
      stopLevels();
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      $("#record-bar").hidden = true;
      const blob = new Blob(chunks, { type: mime });
      chunks = [];
      if (cancelled) return;
      toast(
        state.settings.speechProvider === "local"
          ? "Transcribing on this Mac…"
          : "Transcribing with " + state.settings.speechProvider + "…",
      );
      try {
        const entry = await request("save-recording", {
          bytes: await blob.arrayBuffer(),
          mime,
          mode: recordMode,
          title: noteSpec.title,
          template: noteSpec.template,
          personalNotes: noteDraft,
          flags,
          attachments:
            recordMode === "command" ? commandAttachments : undefined,
        });
        if (recordMode === "note" && entry.noteId) {
          page = "notes";
          selectedNote = entry.noteId;
          noteTab = "summary";
        }
        render();
      } catch {}
      noteSpec = {};
    };
    recorder.onerror = (e) => {
      toast("Recording failed: " + e.error.message);
      request("cancel-recording").catch(() => {});
    };
    recorder.start(1000);
    for (const track of stream.getAudioTracks())
      track.addEventListener?.(
        "ended",
        () => {
          if (recorder && recorder.state !== "inactive") {
            toast("Microphone disconnected. Finishing the captured audio.");
            recorder.stop();
          }
        },
        { once: true },
      );
    startLevels(stream);
    recordStart = Date.now();
    pausedDuration = 0;
    pauseStarted = 0;
    renderRecordBar();
    recordInterval = setInterval(renderRecordBar, 500);
    playCue(600);
    await request("recording-started");
  } catch (e) {
    startingRecording = false;
    recorder = null;
    stopLevels();
    stream?.getTracks().forEach((t) => t.stop());
    await request("recording-failed", { message: e.message }).catch(() => {});
  }
}
function playCue(freq) {
  if (!state.settings.sounds) return;
  try {
    const ctx = new AudioContext(),
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = state.settings.soundVolume * 0.07;
    osc.frequency.value = freq;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {}
}
function recordingStop(cancel = false) {
  if (startingRecording) {
    recordingToken++;
    startingRecording = false;
    api.request("cancel-recording").catch(() => {});
    return;
  }
  if (!recorder || recorder.state === "inactive") return;
  cancelled = cancel;
  recorder.stop();
  playCue(cancel ? 220 : 420);
}
function renderRecordBar() {
  if (!recorder || recorder.state === "inactive") return;
  const bar = $("#record-bar");
  bar.hidden = false;
  bar.innerHTML = `<span class="pulse"></span><span>${paused ? "Paused" : recordMode === "note" ? "Taking notes" : recordMode === "command" ? "Command Mode" : "Listening"}</span><span class="record-time">${clock(((paused ? pauseStarted : Date.now()) - recordStart - pausedDuration) / 1000)}</span>${button("", "pause-record", paused ? "play" : "pause", "icon", 'title="Pause or resume"')}${recordMode === "note" ? button("", "flag-record", "flag", "icon", 'title="Flag this moment"') + button("", "mute-mic", "mic", "icon", 'title="Mute microphone"') : ""}${button("", "stop-record", "stop", "icon", 'title="Finish recording"')}${button("", "cancel-record", "close", "icon", 'title="Discard recording"')}`;
}
async function addFiles(files, kind = "file") {
  files.forEach((file) =>
    queue.push({
      id: crypto.randomUUID(),
      file,
      name: file.split("/").pop(),
      status: "Waiting",
      speechOptions: { ...fileSpeechOptions },
      kind,
    }),
  );
  render();
  if (queue.some((q) => q.status === "Transcribing")) return;
  for (const q of queue) {
    if (q.status !== "Waiting") continue;
    q.status = "Transcribing";
    render();
    try {
      const entry = await request("transcribe-file", {
        file: q.file,
        kind: q.kind,
        speechOptions: q.speechOptions,
      });
      q.status = "Done";
      if (q.kind === "note") {
        page = "notes";
        selectedNote = entry.noteId;
      } else selectedFile = entry.id;
    } catch (e) {
      q.status = "Failed: " + e.message;
    }
    render();
  }
}
function setupDrop() {
  const dz = $("#dropzone");
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("dragover");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  dz.addEventListener("drop", async (e) => {
    e.preventDefault();
    const paths = [...e.dataTransfer.files].map((f) => api.filePath(f));
    await request("allow-drop", { paths });
    await addFiles(paths);
  });
  dz.addEventListener("click", async () =>
    addFiles(await request("choose-files")),
  );
  dz.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await addFiles(await request("choose-files"));
  });
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = b.dataset.id,
    kind = b.dataset.kind;
  try {
    if (["shortcut-action-add","shortcut-action-remove","shortcut-action-up","shortcut-action-down"].includes(a)) {
      editShortcutAction(b,a);
      return;
    }
    if (a === "rich-format") {
      const command = b.dataset.command;
      if (
        ["bold", "italic", "underline", "insertUnorderedList"].includes(command)
      ) {
        $("#rich-editor").focus();
        document.execCommand(command, false, null);
      }
      return;
    }
    if (a === "add-ai-utility" || a === "edit-ai-utility") { editAIUtility(b.dataset.id); return; }
    if (["delete-ai-utility", "toggle-ai-utility"].includes(a)) {
      const id = b.dataset.id;
      const aiUtilities = (state.settings.aiUtilities || []).filter(u => a !== "delete-ai-utility" || u.id !== id).map(u => u.id === id && a === "toggle-ai-utility" ? {...u, enabled: u.enabled === false} : u);
      const hotkeys = (state.settings.hotkeys || []).filter(h => a !== "delete-ai-utility" || h.mode !== "utility" || h.utilityId !== id);
      await request("preferences", {aiUtilities, hotkeys}); return;
    }
    if (a === "run-ai-utility") { b.disabled = true; try { await request("run-ai-utility", {id: b.dataset.id}); } finally { b.disabled = false; } return; }
    if (a === "copy-ai-utility" && utilityResult) { await request("copy", {text: utilityResult.text}); return; }
    if (a === "paste-ai-utility" && utilityResult?.canInsert) { await insertAIUtility(); return; }
    if (a === "dismiss-ai-utility") { await request("dismiss-ai-utility", {id: utilityResult.id}); utilityResult = null; render(); return; }
    if (a === "cancel-ai-utility") { await request("cancel-ai-utility", {id: b.dataset.id}); return; }
    if (a === "navigate") {
      page = b.dataset.page;
      search = "";
      if (page === "settings") settingsTab = "general";
      render();
      return;
    }
    if (a === "utility") {
      b.disabled = true;
      try {
        const operation = b.dataset.operation,
          format = $(`[data-format-for="${operation}"]`)?.value;
        const result = await request("utility", {
          operation,
          options: format ? { format } : {},
        });
        if (result) toast("Saved: " + result.output);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (a === "workspace-palette") {
      openWorkspacePalette();
      return;
    }
    if (a === "palette-navigate") {
      $("#modal").close();
      page = b.dataset.page;
      search = "";
      render();
      return;
    }
    if (a === "capture-hotkey") {
      await stopHotkeyCapture();
      hotkeyCaptureActive = true;
      try { await request("capture-hotkey-start"); if (hotkeyCaptureActive && $("#capture-hotkey-status")) $("#capture-hotkey-status").textContent = interfaceLabel("Listening for a binding… Escape cancels. Capture expires after 30 seconds."); } catch (error) { hotkeyCaptureActive = false; throw error; }
      return;
    }
    if (a === "close-modal") {
      await stopHotkeyCapture();
      $("#modal").close();
      return;
    }
    if (a === "theme") {
      await request("preferences", {
        theme: state.settings.theme === "dark" ? "light" : "dark",
      });
      return;
    }
    if (a === "record") {
      noteSpec = {};
      await request("start-recording", { mode: "dictation" });
      return;
    }
    if (a === "record-command") {
      noteSpec = {};
      await request("start-recording", { mode: "command" });
      return;
    }
    if (a === "stop-record") {
      recordingStop();
      return;
    }
    if (a === "cancel-record") {
      cancelled = true;
      await request("cancel-recording");
      return;
    }
    if (a === "pause-record") {
      if (!recorder) return;
      if (recorder.state === "recording") {
        if (recordMode === "note" && noteSpec.systemAudio)
          await request("pause-system-audio");
        recorder.pause();
        paused = true;
        pauseStarted = Date.now();
      } else if (recorder.state === "paused") {
        if (recordMode === "note" && noteSpec.systemAudio)
          await request("resume-system-audio");
        recorder.resume();
        pausedDuration += Date.now() - pauseStarted;
        paused = false;
      }
      await request("recording-paused", {
        paused,
        muted: stream?.getAudioTracks()[0]?.enabled === false,
      });
      renderRecordBar();
      return;
    }
    if (a === "mute-mic") {
      stream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      await request("recording-paused", {
        paused,
        muted: stream?.getAudioTracks()[0]?.enabled === false,
      });
      toast(
        stream?.getAudioTracks()[0]?.enabled
          ? "Microphone on."
          : "Microphone muted.",
      );
      return;
    }
    if (a === "flag-record") {
      flags.push({
        time:
          ((paused ? pauseStarted : Date.now()) -
            recordStart -
            pausedDuration) /
          1000,
        label: "Flagged moment",
      });
      toast("Moment flagged.");
      return;
    }
    if (a === "history-more") {
      historyLimit += 100;
      render();
      return;
    }
    if (a === "home-tab") {
      historyLimit = 100;
      tab = b.dataset.tab;
      search = "";
      render();
      return;
    }
    if (a === "dictionary-tab") {
      dictTab = b.dataset.tab;
      search = "";
      render();
      return;
    }
    if (a === "settings-tab") {
      settingsTab = b.dataset.tab;
      render();
      if (settingsTab === "permissions") await refreshPermissions();
      return;
    }
    if (a === "note-tab") {
      noteTab = b.dataset.tab;
      render();
      return;
    }
    if (a === "add-item" || a === "edit-item") {
      editItem(kind, id);
      return;
    }
    if (a === "delete") {
      showModal(
        "Delete this item?",
        `<p>This removes the item from Scribble’s workspace. Your source audio files are kept.</p>`,
        async () => {
          await request("delete-item", { kind, id });
          toast("Item deleted.");
        },
      );
      $("#modal button[type=submit]").textContent = "Delete";
      return;
    }
    if (a === "history-original") {
      if (originalHistory.has(id)) originalHistory.delete(id);
      else originalHistory.add(id);
      render();
      return;
    }
    if (a === "history-revision") {
      historyRevision.set(id, Number(b.dataset.index));
      originalHistory.delete(id);
      render();
      return;
    }
    if (a === "copy-history") {
      await request("copy", {
        text: historyText(state.history.find((x) => x.id === id)),
      });
      toast("Copied.");
      return;
    }
    if (a === "edit-segments") {
      const entry = state.history.find((e) => e.id === id);
      showModal(
        "Edit subtitle segments",
        entry.segments
          .map((segment, index) =>
            area(
              "segment" + index,
              clock(segment.start) + " – " + clock(segment.end),
              segment.text,
            ),
          )
          .join(""),
        async (values) =>
          request("update-history", {
            id,
            segments: entry.segments.map((segment, index) => ({
              ...segment,
              text: values["segment" + index],
            })),
          }),
      );
      return;
    }
    if (a === "edit-history") {
      const entry = state.history.find((x) => x.id === id);
      showModal(
        "Edit transcript",
        area("text", "Transcript", entry.text),
        async (v) => request("update-history", { id, text: v.text }),
      );
      return;
    }
    if (a === "retry") {
      await request("retry", { id });
      return;
    }
    if (a === "export-history" || a === "export-note") {
      showModal(
        "Export",
        select(
          "format",
          "Format",
          (a === "export-note"
            ? ["md", "txt", "json", "pdf"]
            : ["txt", "md", "srt", "vtt", "json"]
          ).map((x) => [x, x.toUpperCase()]),
          "txt",
        ),
        async (v) => {
          await request("export", {
            kind: a === "export-note" ? "notes" : "history",
            id,
            format: v.format,
          });
        },
      );
      $("#modal button[type=submit]").textContent = "Export";
      return;
    }
    if (a === "export-format") {
      await request("export", { kind, id, format: b.dataset.format });
      return;
    }
    if (a === "browse-files") {
      await addFiles(await request("choose-files"));
      return;
    }
    if (a === "import-note") {
      await addFiles(await request("choose-files"), "note");
      return;
    }
    if (a === "remove-queue") {
      queue = queue.filter((x) => x.id !== id);
      render();
      return;
    }
    if (a === "open-file") {
      selectedFile = id;
      render();
      return;
    }
    if (a === "close-file") {
      selectedFile = null;
      render();
      return;
    }
    if (a === "seek") {
      const audio = $("#file-audio");
      audio.currentTime = Number(b.dataset.time);
      audio.play();
      return;
    }
    if (a === "new-note") {
      startNoteDialog();
      return;
    }
    if (a === "select-note") {
      selectedNote = id;
      render();
      return;
    }
    if (a === "edit-note-title") {
      const note = state.notes.find((n) => n.id === id);
      showModal("Rename note", field("title", "Title", note.title), async (v) =>
        request("save-item", {
          kind: "notes",
          item: { ...note, title: v.title },
        }),
      );
      return;
    }
    if (a === "summary-cli-status") {
      const status = await request("summary-cli-status");
      const display = $("#summary-cli-status");
      if (display) display.textContent = status.available ? `Claude CLI ${status.version}: subscription sign-in detected; inference has not been tested.` : status.reason;
      return;
    }
    if (a === "summarize-note") {
      b.disabled = true;
      await request("summarize-note", { id });
      return;
    }
    if (a === "import-items") {
      await request("import", { kind });
      render();
      return;
    }
    if (a === "use-model") {
      await request("preferences", { modelId: id, speechProvider: "local" });
      toast("Speech model selected.");
      return;
    }
    if (a === "download-model") {
      downloadProgress[id] = { progress: 0 };
      render();
      try {
        await request("download-model", { id });
        toast("Model verified and installed.");
      } finally {
        delete downloadProgress[id];
        state.models = await request("models");
        render();
      }
      return;
    }
    if (a === "cancel-download") {
      await request("cancel-download", { id });
      delete downloadProgress[id];
      render();
      return;
    }
    if (a === "delete-model") {
      showModal(
        "Remove speech model?",
        "<p>You can download it again whenever you need it.</p>",
        async () => request("delete-model", { id }),
      );
      return;
    }
    if (a === "command-preset") {
      const instructions = {
        "Clean up":
          "Clean up grammar and punctuation without changing meaning.",
        Formal: "Rewrite in a formal professional tone.",
        Polish: "Polish the wording while preserving meaning.",
        Summarize: "Summarize the provided text accurately.",
        Bullets: "Format the provided text as concise bullet points.",
        Email: "Rewrite the provided text as an email.",
      };
      commandDraft = instructions[b.dataset.preset];
      $("#command-text").value = commandDraft;
      $("#command-text").focus();
      return;
    }
    if (a === "refine-command") {
      const instruction = $("#refine-command").value;
      b.disabled = true;
      try {
        commandResult = await request("command", {
          text: instruction,
          context: commandResult.text,
          historyId: commandResult.historyId,
          reviewId: commandResult.reviewId,
        });
        render();
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (a === "command-screen") {
      const screens = await request("screen-context");
      if (!screens.length)
        throw Error(
          "No screen image available. Check Screen Recording permission.",
        );
      showModal(
        "Choose screen context",
        `<p class="muted">Only the selected preview is attached. Running the command sends it to your configured AI provider. Use a vision-capable model.</p><label class="field">Screen<select name="screenIndex">${screens.map((screen, index) => `<option value="${index}">${esc(screen.name)}</option>`).join("")}</select></label><p class="muted">Region within the preview, in percentages. Leave 0, 0, 100, 100 for the full screen.</p>${field("cropLeft", "Left %", 0, "number")}${field("cropTop", "Top %", 0, "number")}${field("cropWidth", "Width %", 100, "number")}${field("cropHeight", "Height %", 100, "number")}<div>${screens.map((screen) => `<figure><figcaption>${esc(screen.name)}</figcaption><img alt="Screen context preview" style="max-width:100%" src="${esc(screen.image)}"></figure>`).join("")}</div>`,
        async (values) => {
          const screen = screens[Number(values.screenIndex)];
          const match = screen?.image.match(
            /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/,
          );
          if (!match)
            throw Error("Screen capture did not return a usable image");
          if (commandAttachments.images.length >= 5)
            throw Error("Remove an image before adding another screen");
          const region = {
            left: Number(values.cropLeft),
            top: Number(values.cropTop),
            width: Number(values.cropWidth),
            height: Number(values.cropHeight),
          };
          const cropped =
            region.left === 0 &&
            region.top === 0 &&
            region.width === 100 &&
            region.height === 100
              ? { mimeType: match[1], data: match[2] }
              : await request("crop-screen-context", {
                  image: screen.image,
                  region,
                });
          commandAttachments = {
            ...commandAttachments,
            images: [
              ...commandAttachments.images,
              { mimeType: cropped.mimeType, data: cropped.data },
            ],
            sources: [
              ...commandAttachments.sources,
              { name: screen.name + " (screen preview)", type: "image" },
            ],
          };
          render();
        },
      );
      $("#modal button[type=submit]").textContent = "Attach selected screen";
      return;
    }
    if (a === "command-files") {
      const chosen = await request("choose-command-files");
      if (chosen) commandAttachments = chosen;
      render();
      return;
    }
    if (a === "clear-command-files") {
      commandAttachments = { text: "", images: [], sources: [] };
      render();
      return;
    }
    if (a === "run-command") {
      const text = $("#command-text").value,
        context = $("[name=command-context]").value;
      b.disabled = true;
      commandResult = await request("command", {
        text,
        context,
        attachments: commandAttachments,
      });
      render();
      return;
    }
    if (a === "test-shortcut") {
      const text = $("#shortcut-test").value;
      commandResult = await request("command", { text });
      toast(commandResult.text);
      return;
    }
    if (a === "copy-command") {
      await request("copy", { text: commandResult.text });
      toast("Copied.");
      return;
    }
    if (a === "paste-command") {
      await insertCommandResult();
      return;
    }
    if (a === "ai-test") {
      b.disabled = true;
      const result = await request("ai-test");
      $("#ai-status").textContent = "Connection ready: " + result;
      toast("Language model is connected.");
      return;
    }
    if (a === "ai-download") {
      b.disabled = true;
      await request("ai-download");
      toast("Language model downloaded.");
      return;
    }
    if (a === "open-url") {
      await request("open-url", { url: b.dataset.url });
      return;
    }
    if (a === "refresh-setup") {
      await refreshPermissions();
      return;
    }
    if (a === "complete-setup") {
      if (b.dataset.skip !== "true" && !setupReady()) return;
      await request("preferences", { onboardingCompleted: true });
      return;
    }
    if (a === "restart-setup") {
      page = "home";
      await request("preferences", { onboardingCompleted: false });
      await refreshPermissions();
      return;
    }
    if (a === "check-permissions") {
      await refreshPermissions();
      if (page !== "settings") {
        page = "settings";
        settingsTab = "permissions";
        render();
      }
      return;
    }
    if (a === "request-permission") {
      await request("request-permissions", { kind });
      await refreshPermissions();
      return;
    }
    if (a === "permission-settings") {
      await request("open-permissions", { kind });
      return;
    }
    if (a === "refresh-mics") {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      media.getTracks().forEach((t) => t.stop());
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "audioinput",
      );
      microphoneDevices = inputs;
      $("#microphone-list").innerHTML =
        `<label class="field">Input device<select data-setting="microphoneId"><option value="default">System default</option>${inputs
          .filter((d) => d.deviceId !== "default")
          .map(
            (d) =>
              `<option value="${esc(d.deviceId)}" ${d.deviceId === state.settings.microphoneId ? "selected" : ""}>${esc(d.label || "Microphone")}</option>`,
          )
          .join(
            "",
          )}</select></label>${button("Prefer selected input", "prefer-mic", "mic")}`;
      return;
    }
    if (a === "prefer-mic") {
      const selected = $("[data-setting=microphoneId]")?.value;
      if (!selected) return;
      await request("preferences", {
        microphonePriority: [
          selected,
          ...(state.settings.microphonePriority || []).filter(
            (id) => id !== selected,
          ),
        ],
      });
      toast("Selected input moved to the top of microphone priorities.");
      return;
    }
    if (a === "clear-mic-priority") {
      await request("preferences", { microphonePriority: [] });
      return;
    }
    if (a === "recordings-folder") {
      const dir = await request("choose-recordings-folder");
      if (dir) await request("preferences", { recordingsDir: dir });
      return;
    }
    if (a === "backup") {
      await request("backup");
      toast("Backup exported.");
      return;
    }
    if (a === "restore") {
      showModal(
        "Restore workspace?",
        `<p>This replaces the current workspace from a backup. Scribble saves a copy of the current data first.</p>`,
        async () => request("restore"),
      );
      $("#modal button[type=submit]").textContent = "Choose backup";
      return;
    }
    if (a === "open-data") {
      await request("open-data");
      return;
    }
    if (a === "copy-clipboard") {
      await request("copy", {
        text: state.clipboard.find((c) => c.id === id).text,
      });
      return;
    }
    if (a === "edit-hotkey") {
      editHotkey(Number(b.dataset.index));
      return;
    }
    if (a === "add-hotkey") {
      editHotkey(state.settings.hotkeys.length);
      return;
    }
    if (a === "remove-hotkey") {
      await request("preferences", {
        hotkeys: state.settings.hotkeys.filter(
          (_, i) => i !== Number(b.dataset.index),
        ),
      });
      return;
    }
    if (a === "reset-hotkeys") {
      await request("preferences", {
        hotkeys: [
          {
            keyCode: 49,
            modifiers: ["option"],
            mode: "dictation",
            toggle: false,
          },
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
      });
      return;
    }
    if (a === "save-suppressed") {
      await request("preferences", {
        suppressedApps: $("[name=suppressed-apps]")
          .value.split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
      });
      toast("Exclusions saved.");
      return;
    }
    if (a === "memory-reindex") {
      await request("memory-reindex", { id });
      return;
    }
    if (a === "select-tone") {
      await request("select-tone", { id });
      return;
    }
    if (a === "cancel-timer") {
      await request("cancel-timer", { id });
      return;
    }
  } catch (e) {
    console.error(e);
    toast(e.message || "Operation failed");
  } finally {
    if (document.contains(b)) b.disabled = false;
  }
});
document.addEventListener("change", async (e) => {
  const input = e.target;
  try {
    if (input.matches('[data-shortcut-field="browser"]') && input.closest("#shortcut-actions")) {
      const profile = input.closest("[data-shortcut-action]").querySelector('[data-shortcut-field="profile"]');
      const options = shortcutProfileOptions(input.value, "");
      profile.innerHTML = shortcutOptionsHTML(options, ""); profile.disabled = options.length === 1;
      return;
    }
    if (input.name === "historyKind") {
      historyKind = input.value;
      historyLimit = 100;
      render();
      return;
    }
    if (input.name === "modelId" && input.closest("#modal")) {
      const language = input.form?.querySelector('[name="language"]');
      if (language) {
        const previous = language.value;
        const choices = [["", "Default language"], ...speechLanguageOptions(toneSpeechModel(input.value))];
        language.innerHTML = choices.map(([code, label]) => `<option value="${esc(code)}">${esc(label)}</option>`).join("");
        language.value = choices.some(([code]) => code === previous) ? previous : "auto";
        if (!language.value && previous) language.value = choices[1]?.[0] || "";
      }
      return;
    }
    if (input.name === "onboardingModel") {
      await request("preferences", { modelId: input.value, speechProvider: "local" });
      return;
    }
    if (input.name === "fileModel") {
      if (input.value)
        Object.assign(fileSpeechOptions, {
          modelId: input.value,
          speechProvider: "local",
        });
      else {
        delete fileSpeechOptions.modelId;
        delete fileSpeechOptions.speechProvider;
      }
      const model = state.models.find((m) => m.id === (fileSpeechOptions.modelId || state.settings.modelId));
      const fixed = model && (model.englishOnly ? "en" : model.language && model.language !== "auto" ? model.language : "");
      if (fixed) fileSpeechOptions.language = fixed;
      else if (fileSpeechOptions.language) fileSpeechOptions.language = "auto";
      render();
      return;
    }
    if (input.name === "fileLanguage") {
      if (input.value) fileSpeechOptions.language = input.value;
      else delete fileSpeechOptions.language;
      return;
    }
    if (input.name === "aiProvider" && input.form?.id === "ai-form") {
      const defaults = {
        ollama: "http://127.0.0.1:11434",
        openai: "https://api.openai.com/v1",
        anthropic: "https://api.anthropic.com",
        gemini: "https://generativelanguage.googleapis.com",
        groq: "https://api.groq.com/openai/v1",
        deepseek: "https://api.deepseek.com",
        openrouter: "https://openrouter.ai/api/v1",
        cerebras: "https://api.cerebras.ai/v1",
      };
      input.form.elements.aiEndpoint.value = defaults[input.value] || "";
      input.form.elements.aiModel.value =
        input.value === "ollama" ? "qwen2.5:7b" : "";
      input.form.elements.apiKey.value = "";
      return;
    }
    if (input.dataset.setting) {
      let value =
        input.type === "checkbox"
          ? input.checked
          : input.dataset.type === "number"
            ? Number(input.value)
            : input.value;
      await request("preferences", { [input.dataset.setting]: value });
    }
    if (input.dataset.toggleKind) {
      const kind = input.dataset.toggleKind,
        item = state[kind].find((x) => x.id === input.dataset.id);
      await request("save-item", {
        kind,
        item:
          kind === "memory"
            ? { id: item.id, enabled: input.checked }
            : { ...item, enabled: input.checked },
      });
    }
  } catch {}
});
document.addEventListener("input", (e) => {
  if (e.target.id === "command-text") commandDraft = e.target.value;
  if (e.target.name === "command-context") commandTextContext = e.target.value;
  if (e.target.id === "search") {
    search = e.target.value;
    render();
  }
  if (e.target.id === "note-editor") {
    const input = e.target,
      id = input.dataset.id,
      field = input.dataset.field,
      text = input.value;
    const saveKey = id + ":" + field;
    clearTimeout(noteSaveTimers.get(saveKey));
    noteSaveTimers.set(
      saveKey,
      setTimeout(async () => {
        noteSaveTimers.delete(saveKey);
        const note = state.notes.find((n) => n.id === id);
        if (!note) return;
        try {
          await request("save-item", {
            kind: "notes",
            item: { ...note, [field]: text },
          });
        } catch {}
      }, 500),
    );
  }
});
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "speech-provider-form") return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  try {
    if (values.speechKey) {
      if (values.speechProvider === "local")
        throw Error("Choose a cloud provider before saving its key");
      await request("save-speech-key", {
        provider: values.speechProvider,
        key: values.speechKey,
      });
    }
    await request("preferences", {
      speechProvider: values.speechProvider,
      speechCloudModel: values.speechCloudModel,
      speechCloudVersion: values.speechCloudVersion,
    });
    toast("Speech configuration saved.");
  } catch {}
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "ai-form") return;
  e.preventDefault();
  const form = e.target,
    v = Object.fromEntries(new FormData(form));
  const key = v.apiKey;
  delete v.apiKey;
  v.aiEnhance = form.elements.aiEnhance.checked;
  try {
    await request("preferences", v);
    if (key && v.aiProvider !== "ollama")
      await request("save-api-key", { key, provider: v.aiProvider });
    toast("Language model preferences saved.");
  } catch {}
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openWorkspacePalette();
    return;
  }
  if (
    e.key === "Escape" &&
    (startingRecording ||
      (recorder && recorder.state !== "inactive") ||
      state?.speechStatus.busy)
  ) {
    cancelled = true;
    request("cancel-recording").catch(() => {});
    return;
  }
  if (page === "ai" && utilityResult && !$("#modal").open) {
    if (e.key === "Escape") { request("dismiss-ai-utility", {id: utilityResult.id}).catch(() => {}); utilityResult = null; render(); e.preventDefault(); return; }
    if (utilityResult.canInsert && e.key === "Tab" && !e.shiftKey && e.target.id === "utility-result") { e.preventDefault(); insertAIUtility().catch(error => toast(error.message || interfaceLabel("Unable to insert result"))); return; }
  }
  if (page === "command" && commandResult && e.key === "Escape") {
    request("dismiss-command-result", {id: commandResult.reviewId}).catch(() => {});
    commandResult = null;
    render();
    e.preventDefault();
  }
  if (
    page === "command" &&
    commandResult?.kind === "text" &&
    commandResult.canInsert &&
    e.key === "Tab" &&
    !e.shiftKey &&
    e.target.id === "command-result"
  ) {
    e.preventDefault();
    insertCommandResult().catch(error => toast(error.message || interfaceLabel("Unable to insert result")));
  }
});
async function refreshPermissions() {
  permissions = await request("permissions").catch(() => ({}));
  if ((page === "settings" && settingsTab === "permissions") || (page === "home" && state.settings.onboardingCompleted === false)) render();
}
$("#modal").addEventListener("close", () => void stopHotkeyCapture());
api.on(({ event, data }) => {
  if (event === "hotkey-captured" && hotkeyCaptureActive) {
    hotkeyCaptureActive = false;
    const form = $("#modal form");
    if (form?.elements.keyCode && Number.isInteger(data.keyCode)) {
      form.elements.keyCode.value = data.keyCode;
      form.elements.modifiers.value = (data.modifiers || []).join(", ");
      if (form.elements.mouseButton) form.elements.mouseButton.value = data.keyCode >= 130 ? String(data.keyCode) : "";
      if (form.elements.bindShortcut) form.elements.bindShortcut.checked = true;
      $("#capture-hotkey-status").textContent = workflowText("Captured: {binding}", {binding:(data.modifiers || []).join(" + ") + (data.keyCode < 0 ? "" : " + " + (data.label || data.keyCode))});
    }
  }
  if (["hotkey-capture-cancelled", "hotkey-capture-ended"].includes(event) && hotkeyCaptureActive) {
    hotkeyCaptureActive = false;
    const label = $("#capture-hotkey-status"); if (label) label.textContent = data.reason === "timeout" ? interfaceLabel("Capture expired. Try again.") : interfaceLabel("Capture cancelled.");
  }
  if (event === "open-files") {
    page = "transcribe";
    addFiles(data);
  }
  if (event === "state") {
    state = data;
    if (document.activeElement?.id !== "note-editor") render();
  }
  if (event === "recording-control") {
    if (data.action === "start") recordingStart(data.mode);
    if (data.action === "stop") recordingStop();
    if (data.action === "cancel") {
      cancelled = true;
      recordingStop(true);
    }
  }
  if (event === "notice") toast(data.body || data.title);
  if (event === "speech-progress") {
    progress = data;
    toast(
      data.stage === "complete"
        ? "Transcript ready."
        : `${data.stage === "decoding" ? "Preparing audio" : "Transcribing locally"}${data.progress ? " · " + Math.round(data.progress * 100) + "%" : ""}…`,
    );
  }
  if (event === "model-download") {
    downloadProgress[data.id] = data;
    const fill = $(`[data-progress="${data.id}"]`);
    if (fill) fill.style.width = Math.min(100, data.progress * 100) + "%";
    const label = $(`[data-progress-label="${data.id}"]`);
    if (label)
      label.textContent =
        Math.round(Math.min(1, data.progress || 0) * 100) + "%";
  }
  if (event === "utility-state") { if (data.busy) utilityBusy.add(data.id); else utilityBusy.delete(data.id); if (page === "ai") render(); }
  if (event === "utility-result") { utilityResult = data; page = "ai"; render(); }
  if (event === "command-result") {
    commandResult = data;
    page = "command";
    render();
  }
  if (event === "navigate") {
    page = data.page;
    search = "";
    if (data.id) selectedNote = data.id;
    render();
    if (data.record) startNoteDialog();
  }
  if (event === "ai-download") {
    const el = $("#ai-status");
    if (el)
      el.textContent =
        data.status +
        (data.total
          ? " · " + Math.round(((data.completed || 0) / data.total) * 100) + "%"
          : "");
  }
  if (event === "native-error") console.warn(data);
});
api
  .request("state")
  .then((x) => {
    state = x;
    render();
    if (state.settings.onboardingCompleted === false) void refreshPermissions();
  })
  .catch((e) => {
    $("#content").textContent = "Scribble could not connect: " + e.message;
  });
const resizeObserver = new MutationObserver(() => {
  $$("[data-height]").forEach((el) => {
    el.style.height = el.dataset.height + "px";
  });
  $$("[data-progress]").forEach((el) => {
    el.style.width =
      Math.min(
        100,
        (downloadProgress[el.dataset.progress]?.progress || 0) * 100,
      ) + "%";
  });
});
resizeObserver.observe($("#content"), { childList: true, subtree: true });
