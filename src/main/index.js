"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  Notification,
  shell,
  clipboard,
  safeStorage,
  protocol,
  net,
  desktopCapturer,
  systemPreferences,
} = require("electron");
const fs = require("node:fs"),
  fsp = fs.promises,
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  http = require("node:http"),
  { spawn } = require("node:child_process");
const { Store } = require("./store"),
  { SpeechEngine } = require("./speech"),
  { NativeBridge } = require("./native"),
  domain = require("./domain"),
  ai = require("./ai");
const summaryTools = require("./summary");
const voiceRouting = require("./voice-routing");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "scribble-audio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
app.setName("Scribble");
const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
  process.exit(0);
}
let window,
  overlay,
  tray,
  store,
  speech,
  native,
  dataDir,
  server,
  recordTarget = null,
  activeProcess = null,
  activeMode = "dictation",
  systemRecording = null,
  memoryIndex,
  memoryTasks = new Map(),
  quitting = false;
const timers = new Map(),
  allowedFiles = new Set(),
  pendingOpenFiles = [];
function emit(event, data) {
  for (const w of [window, overlay])
    if (w && !w.isDestroyed())
      w.webContents.send("scribble:event", { event, data });
}
function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
  emit("notice", { title, body });
}
function show() {
  if (!window || window.isDestroyed()) createWindow();
  window.show();
  window.focus();
}
function interfaceText(key, params) { return require("../shared/i18n").t(store.data.settings.locale, key, params); }
function refreshInterfaceMenus() {
  if (!tray) return;
  tray.setToolTip("Scribble · " + interfaceText("tray.tagline"));
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: interfaceText("tray.open"), click: show },
        { label: interfaceText("tray.startDictation"), click: () => beginRecording() },
        {
          label: interfaceText("tray.startNote"),
          click: () => {
            show();
            emit("navigate", { page: "notes", record: true });
          },
        },
        { label: interfaceText("tray.pasteLast"), click: () => actions["paste-last"]() },
        { type: "separator" },
        {
          label: interfaceText("tray.quit"),
          click: () => {
            quitting = true;
            app.quit();
          },
        },
      ]),
    );
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Scribble",
          submenu: [
            { role: "about" },
            {
              label: interfaceText("nav.settings"),
              accelerator: "CmdOrCtrl+,",
              click: () => {
                show();
                emit("navigate", { page: "settings" });
              },
            },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
      ]),
    );
}
function snapshot() {
  return {
    ...store.data,
    models: speech.listModels(),
    overlayActions: ["show-tone-menu", "select-tone"],
    speechProviders: Object.entries(require("./cloud-speech").CATALOG).map(
      ([id, spec]) => ({ id, model: spec.model }),
    ),
    speechStatus: {
      ...speech.status(),
      busy: !!activeProcess || speech.status().busy,
    },
    nativeAvailable: native.available,
    stats: {
      ...domain.computeStats(
        Object.entries(store.data.activity.days).map(([date, value]) => ({
          createdAt: date + "T12:00:00",
          wordCount: value.words,
          duration: value.duration,
        })),
      ),
      recordings: store.data.activity.recordings,
    },
    version: app.getVersion(),
    dataDir,
    platform: process.platform,
  };
}
function createWindow() {
  window = new BrowserWindow({
    width: 1240,
    height: 850,
    minWidth: 940,
    minHeight: 660,
    title: "Scribble",
    backgroundColor: "#f8f9fc",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadFile(path.join(__dirname, "../renderer/index.html"));
  window.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      window.hide();
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
  window.webContents.on("did-finish-load", () => {
    emit("state", snapshot());
    if (pendingOpenFiles.length) emit("open-files", pendingOpenFiles.splice(0));
  });
}
function createOverlay() {
  overlay = new BrowserWindow({
    width: 360,
    height: 90,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, "../renderer/overlay.html"));
  overlay.webContents.on("did-finish-load", () =>
    indicator("idle", "Ready to listen"),
  );
}
function indicator(state, text) {
  if (!overlay || overlay.isDestroyed()) return;
  if (store.data.settings.indicatorPosition === "hidden") {
    overlay.hide();
    return;
  }
  const { screen } = require("electron");
  const display = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  ).workArea;
  overlay.setPosition(
    Math.round(display.x + (display.width - 360) / 2),
    store.data.settings.indicatorPosition === "top"
      ? display.y + 15
      : display.y + display.height - 110,
  );
  if (state === "idle" && !store.data.settings.idleIndicator) overlay.hide();
  else overlay.showInactive();
  emit("recording-state", {
    state,
    text,
    mode: activeMode,
    style: store.data.settings.indicatorStyle,
    position: store.data.settings.indicatorPosition,
    tones: store.data.tones,
    selectedTone: store.data.settings.pinnedToneId,
    canSelectTone: true,
    locale: store.data.settings.locale,
  });
}
async function ensureAI(settings) {
  if (
    settings.aiProvider === "ollama" &&
    settings.aiEndpoint.replace(/\/$/, "") === "http://127.0.0.1:11434"
  )
    await require("./ai-runtime").ensureLocalAI({
      endpoint: settings.aiEndpoint,
      dataDir,
      resourcesPath: app.isPackaged
        ? process.resourcesPath
        : path.resolve(__dirname, "../../release"),
    });
}
async function chat(settings, messages, key, options) {
  await ensureAI(settings);
  const provider = settings.aiProvider;
  if (provider !== "ollama") {
    if (
      !Object.hasOwn(require("./cloud-ai").PROVIDERS, provider) &&
      provider !== "openai-compatible"
    )
      throw Error("Unknown AI provider");
    const file = path.join(dataDir, "ai-" + provider + ".key");
    key = fs.existsSync(file)
      ? safeStorage.decryptString(fs.readFileSync(file))
      : "";
  }
  return ai.chat(settings, messages, key, options);
}
async function generateNoteSummary(
  settings,
  transcript,
  template,
  { signal } = {},
) {
  const requested = settings.summaryProvider || "configured-ai";
  const prompt = summaryTools.prompt(
    template || "Meeting",
    settings.summaryLanguage,
  );
  let summary,
    provider,
    error = null;
  try {
    if (requested === "claude-cli") {
      const result = await require("./summary-cli").summarize({
        transcript,
        prompt,
        model: settings.summaryModel || undefined,
        signal,
      });
      summary = result.text;
      provider = "claude-cli";
    } else if (requested === "configured-ai") {
      summary = await chat(
        settings,
        [
          { role: "system", content: prompt },
          { role: "user", content: transcript },
        ],
        apiKey(),
        { signal },
      );
      provider = settings.aiProvider;
    } else throw Error("Unknown summary provider");
  } catch (cause) {
    if (signal?.aborted || cause.name === "AbortError") throw cause;
    summary = ai.extractiveSummary(transcript, template || "Meeting");
    provider = "local-extractive";
    error = cause.message;
  }
  if (signal?.aborted)
    throw signal.reason || new DOMException("Cancelled", "AbortError");
  return {
    summary: summaryTools.formatGrounded(
      transcript,
      summary,
      template || "Meeting",
      settings.summaryLanguage,
    ),
    summaryDraft: provider !== "local-extractive",
    summaryProvider: provider,
    summaryRequestedProvider: requested,
    summaryFallback: provider === "local-extractive",
    summaryError: error,
  };
}
function apiKey(provider) {
  if (provider && !Object.hasOwn(require("./cloud-speech").CATALOG, provider))
    throw Error("Unknown speech provider");
  const file = path.join(
    dataDir,
    provider
      ? "speech-" + provider + ".key"
      : "ai-" + store.data.settings.aiProvider + ".key",
  );
  if (!fs.existsSync(file)) return "";
  if (!safeStorage.isEncryptionAvailable())
    throw Error("Secure key storage is unavailable");
  return safeStorage.decryptString(fs.readFileSync(file));
}
function updateNative() {
  if (!native.available) return;
  native
    .request("setHotkeys", { hotkeys: store.data.settings.hotkeys })
    .catch((e) => emit("native-error", e.message));
  native
    .request("setExpansions", {
      expansions: store.data.settings.expansionsEnabled
        ? store.data.expansions
            .filter((x) => x.enabled !== false)
            .map((x) => ({
              trigger: x.trigger,
              html: x.html ? domain.sanitizeRichHTML(x.html) : undefined,
              replacement: x.replacement
                .replace(/\{\{DATE\}\}/g, "{date}")
                .replace(/\{\{TIME\}\}/g, "{time}")
                .replace(/\{\{CLIPBOARD\}\}/g, "{clipboard}"),
            }))
        : [],
    })
    .catch(() => {});
  native
    .request("clipboardMonitoring", {
      enabled: store.data.settings.clipboardHistory,
    })
    .catch(() => {});
}
async function beginRecording(mode = "dictation", toneId) {
  if (recordTarget || activeProcess || speech.status().busy) {
    emit("notice", {
      title: "Scribble is busy",
      body: "Finish the current recording or transcription first.",
    });
    return;
  }
  const reservation = { starting: true };
  recordTarget = reservation;
  const front = await native.request("frontmost").catch(() => ({}));
  if (recordTarget !== reservation) return;
  if (store.data.settings.suppressedApps.includes(front.bundleId)) {
    recordTarget = null;
    return;
  }
  recordTarget = { ...front, toneId };
  activeMode = mode;
  emit("recording-control", { action: "start", mode });
  indicator("starting", "Starting microphone…");
}
const { launchChromeWebsites } = require("./chrome-launch");
async function openUrl(url) {
  const parsed = new URL(url);
  if (!["http:", "https:", "mailto:"].includes(parsed.protocol))
    throw Error("Only web and email links are supported");
  if (
    store.data.settings.preferredBrowser === "Google Chrome" &&
    process.platform === "darwin" &&
    parsed.protocol !== "mailto:"
  ) {
    await new Promise((resolve, reject) => {
      const p = spawn("/usr/bin/open", ["-a", "Google Chrome", url]);
      p.on("error", reject);
      p.on("exit", (c) =>
        c ? reject(Error("Chrome could not open the link")) : resolve(),
      );
    });
  } else await shell.openExternal(url);
}
async function pasteText(text, html) {
  if (!text) return;
  if (native.available)
    return native.request("paste", {
      text,
      expectedPid: recordTarget?.pid,
      html: html ? domain.sanitizeRichHTML(html) : undefined,
      restoreClipboard: store.data.settings.restoreClipboard,
      autoEnter: store.data.settings.autoEnter,
    });
  clipboard.writeText(text);
  return { inserted: false };
}
function resolveCurrentTone(front) {
  const tones = store.data.tones.map((t) => ({
    ...t,
    apps: (t.apps || []).map((a) => (a === front?.name ? front?.bundleId : a)),
    speechEngine: t.speechEngine || (t.modelId ? "local" : ""),
    speechModel: t.speechModel || t.modelId || "",
    aiEnhancement: t.aiEnhancement ?? t.enhance,
    customInstructions: t.customInstructions ?? t.instructions,
  }));
  return require("./tones").resolveTone(
    tones,
    { app: front?.bundleId, url: front?.url, hotkeyToneId: front?.toneId },
    store.data.settings,
  );
}
function applyTone(settings, front) {
  const resolution = resolveCurrentTone(front);
  const value = require("./tones").applyTone(settings, resolution);
  if (value.toneInstructions) value.aiInstructions = value.toneInstructions;
  if (value.speechProvider !== "local" && resolution.tone?.speechModel)
    value.speechCloudModel = resolution.tone.speechModel;
  return value;
}
async function indexMemory(value, { summarize = true } = {}) {
  memoryTasks.get(value.id)?.abort();
  const controller = new AbortController();
  memoryTasks.set(value.id, controller);
  const update = (patch) => {
    if (
      controller.signal.aborted ||
      !store.data.memory.some((m) => m.id === value.id)
    )
      return;
    store.upsert("memory", {
      ...patch,
      enabled: store.data.memory.find((m) => m.id === value.id).enabled,
      id: value.id,
    });
    emit("state", snapshot());
  };
  update({ status: "indexing", error: null });
  try {
    const parsed = await memoryIndex.index(value);
    if (controller.signal.aborted || parsed.status === "superseded") return;
    if (parsed.status === "error") throw Error(parsed.error);
    let summary = value.summary || "";
    if (summarize) {
      const settings = { ...store.data.settings };
      const result = await require("./memory-summary").summarizeMemory(
        parsed.content,
        (messages) =>
          chat(settings, messages, "", { signal: controller.signal }),
        { signal: controller.signal },
      );
      summary = result.summary;
    }
    if (!summarize && value.sha256 && value.sha256 !== parsed.sha256)
      summary = "";
    update({
      ...parsed,
      summary,
      status: summary ? "indexed" : "needs-index",
      summaryProvider: summarize
        ? store.data.settings.aiProvider
        : value.summaryProvider,
    });
  } catch (error) {
    if (!controller.signal.aborted) memoryIndex.remove(value.id);
    update({ status: "error", error: error.message, summary: "" });
  } finally {
    if (memoryTasks.get(value.id) === controller) memoryTasks.delete(value.id);
  }
}
async function enhance(text, settings) {
  return chat(
    settings,
    [
      {
        role: "system",
        content: `${settings.aiInstructions}
Use ${settings.spelling === "uk" ? "British" : "American"} English spelling for ordinary English prose. Preserve proper names, exact quotations, URLs, code and these vocabulary terms: ${store.data.dictionary.map((item) => item.word).join(", ")}. Do not translate non-English text.`,
      },
      { role: "user", content: text },
    ],
    apiKey(),
    { signal: activeProcess?.controller.signal },
  );
}
async function runShortcut(text) {
  const match = domain.matchShortcut(text, store.data.shortcuts);
  if (!match) return null;
  const shortcut = match.shortcut || match;
  if (!shortcut.builtin) {
    const plan = require("./shortcut-actions").planShortcutActions(shortcut, match.query || "");
    if (!plan) return null;
    await require("./shortcut-execution").executeShortcutPlan(plan.actions, {
      openWebsites: launchChromeWebsites,
      launchApplication,
      openFolder: (folder) => shell.openPath(folder),
    });
    return { action: shortcut.name || shortcut.trigger, query: match.query || "" };
  }
  let query =
    match.query ?? match.text ?? text.slice(shortcut.trigger.length).trim();
  const target = shortcut.target || shortcut.url;
  if (target === "navigate") {
    const url = voiceRouting.resolveWebsite(query, "", { allowMailto: true });
    if (!url) return null;
    await openUrl(url);
  } else if (target === "folder") {
    const folder = voiceRouting.resolveCommonFolder(query);
    if (folder === null) return null;
    const error = await shell.openPath(
      path.isAbsolute(folder) ? folder : path.join(os.homedir(), folder),
    );
    if (error) throw Error(error);
  } else if (shortcut.type === "app") {
    await launchApplication(target);
  } else if (shortcut.type === "folder") {
    const error = await shell.openPath(target);
    if (error) throw Error(error);
  } else {
    const url = voiceRouting.resolveWebsite(target, query);
    if (!url) return null;
    await openUrl(url);
  }
  return { action: shortcut.name || shortcut.trigger, query };
}
async function scheduleReminder(seconds, title) {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400 * 30)
    throw Error("Choose a duration from one second to 30 days");
  const entry = {
    id: crypto.randomUUID(),
    title,
    endsAt: Date.now() + seconds * 1000,
  };
  store.data.timers.push(entry);
  store.save();
  armTimer(entry);
  emit("state", snapshot());
  return {
    kind: "timer",
    text: `${title} — scheduled for ${new Date(entry.endsAt).toLocaleString()}.`,
  };
}
function armTimer(entry) {
  const remaining = entry.endsAt - Date.now();
  timers.set(
    entry.id,
    setTimeout(
      () => {
        if (entry.endsAt > Date.now()) {
          armTimer(entry);
          return;
        }
        store.data.timers = store.data.timers.filter((t) => t.id !== entry.id);
        store.save();
        notify("Reminder", entry.title);
        emit("state", snapshot());
      },
      Math.max(0, Math.min(2147483647, remaining)),
    ),
  );
}
async function launchApplication(name, folder = "") {
  await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/open", ["-a", name, ...(folder ? [folder] : [])]);
    child.on("error", reject);
    child.on("exit", (code) =>
      code ? reject(Error("Application could not be opened")) : resolve(),
    );
  });
}
async function runCommand(text, context = "", attachments = {}) {
  const fileCommand = require("./file-command").parseFileCommand(text);
  if (fileCommand) {
    const result = await actions.utility(fileCommand);
    if (!result)
      return { kind: "cancelled", text: "File operation cancelled." };
    return {
      kind: "action",
      text: `Saved ${result.output || result.path || "file output"}.${result.details?.notice ? " " + result.details.notice : ""}`,
      result,
    };
  }
  const routed = await runShortcut(text);
  if (routed) return { kind: "shortcut", text: `Opened ${routed.action}.` };
  let parsed = domain.parseCommand(text);
  // Recognized shortcut families must not bypass disabled preferences or invalid
  // targets through the independent command parser. Explicit "launch" and
  // "search for" syntax remain available when no shortcut trigger matches.
  const shortcutFamily = domain.matchShortcut(text, store.data.shortcuts.map(
    (shortcut) => ({ ...shortcut, enabled: true }),
  ));
  if (shortcutFamily && ["url", "folder", "app"].includes(parsed.type))
    parsed = { type: "unknown", instruction: text };
  if (parsed.type === "timer" || parsed.type === "reminder")
    return scheduleReminder(parsed.seconds, parsed.message || "Timer finished");
  if (parsed.type === "url") {
    await openUrl(parsed.url);
    return { kind: "action", text: "Opened " + parsed.url };
  }
  if (parsed.type === "folder") {
    const directories = {
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
    const destination = directories[parsed.folder],
      error = await shell.openPath(
        destination.startsWith("/")
          ? destination
          : path.join(os.homedir(), destination),
      );
    if (error) throw Error(error);
    return { kind: "action", text: "Opened " + parsed.folder + " folder." };
  }
  if (parsed.type === "app") {
    await launchApplication(parsed.app);
    return { kind: "action", text: "Opened " + parsed.app + "." };
  }
  const target =
    (context + (attachments.text ? "\n\n" + attachments.text : "")).trim() ||
    (await native
      .request("selection")
      .then((x) => x.text)
      .catch(() => "")) ||
    clipboard.readText();
  let result;
  if (parsed.type === "edit") {
    const dispatched = await native.request("edit", {
      action: parsed.action,
      text: parsed.query,
    });
    return {
      kind: "action",
      text:
        "Sent " +
        parsed.action +
        " to " +
        (dispatched.bundleId || "the focused app") +
        ".",
      details: dispatched,
    };
  }
  if (parsed.type === "clipboard") {
    if (parsed.action === "copy") {
      clipboard.writeText(target);
      return { kind: "clipboard", text: "Copied selection." };
    }
    const pasted = await pasteText(clipboard.readText());
    return {
      kind: "clipboard",
      text: pasted.inserted
        ? "Inserted clipboard text."
        : "Clipboard text is ready for manual paste.",
      details: pasted,
    };
  }
  if (parsed.type === "transform") {
    if (parsed.action === "uppercase") result = target.toLocaleUpperCase();
    else if (parsed.action === "lowercase") result = target.toLocaleLowerCase();
    else result = target.split(parsed.find).join(parsed.replacement);
  } else {
    const memory = store.data.settings.memoryEnabled
      ? store.data.memory
          .filter(
            (m) => m.enabled !== false && m.status === "indexed" && m.summary,
          )
          .map((m) => `${m.name}: ${m.summary}`)
          .join("\n")
          .slice(0, 24000) +
        (memoryIndex?.context(text + " " + target, { maxChars: 12000 }).text ||
          "")
      : "";
    result = await chat(
      store.data.settings,
      [
        {
          role: "system",
          content:
            "You are Scribble, a precise writing assistant. Follow the user command using the provided text. Return only the requested final text. Never invent successful system actions. Reference material:\n" +
            memory,
        },
        { role: "user", content: `Command: ${text}\n\nText:\n${target}` },
      ],
      apiKey(),
      {
        signal: activeProcess?.controller.signal,
        images: attachments.images || [],
      },
    );
  }
  return { kind: "text", text: result, original: target };
}
function assertProcessing() {
  if (activeProcess?.controller.signal.aborted)
    throw new DOMException("Processing canceled", "AbortError");
}
async function processFile(file, options = {}) {
  if (activeProcess)
    throw Error("Another transcription is still being processed");
  const job = { controller: new AbortController() };
  activeProcess = job;
  try {
    return await transcribeAndProcess(file, options);
  } catch (error) {
    if (error.name !== "AbortError" && !job.controller.signal.aborted) {
      store.addHistory({
        kind: options.kind || "file",
        title: options.title || path.basename(file),
        text: "",
        original: "",
        error: error.message,
        audioPath: store.data.settings.saveAudio ? file : null,
      });
      emit("state", snapshot());
    }
    throw error;
  } finally {
    if (activeProcess === job) activeProcess = null;
    indicator("idle", "");
    emit("state", snapshot());
  }
}
async function transcribeAndProcess(
  file,
  {
    kind = "file",
    title,
    template,
    personalNotes = "",
    flags = [],
    front = recordTarget,
    speechOptions = {},
    attachments = {},
  } = {},
) {
  const allowedOptions = [
    "modelId",
    "language",
    "speechProvider",
    "speechCloudModel",
  ];
  if (Object.keys(speechOptions).some((k) => !allowedOptions.includes(k)))
    throw Error("Unknown file speech option");
  store.validateSettings(speechOptions);
  const settings = {
    ...applyTone(store.data.settings, front),
    ...speechOptions,
  };
  Object.assign(
    settings,
    require("./speech-preferences").normalizeSpeechPreferences(
      settings,
      speech.listModels(),
    ),
  );
  indicator(
    "processing",
    settings.speechProvider === "local"
      ? "Transcribing locally…"
      : "Transcribing with " + settings.speechProvider + "…",
  );
  let result;
  if (settings.speechProvider === "local")
    result = await speech.transcribe(file, {
      modelId: settings.modelId,
      language: settings.language,
      translate: settings.translate,
      useGpu: settings.resourceMode !== "cpu",
      threads: Math.min(
        settings.resourceMode === "cpu" ? 2 : 8,
        os.availableParallelism(),
      ),
      prompt: store.data.dictionary.map((x) => x.word).join(", "),
    });
  else {
    const key = apiKey(settings.speechProvider);
    if (!key)
      throw Error("Configure an API key for the selected speech provider");
    const prepared = await require("./cloud-input").prepareCloudAudio(file, {
      signal: activeProcess.controller.signal,
    });
    try {
      result = await require("./cloud-speech").transcribe({
        provider: settings.speechProvider,
        filePath: prepared.filePath,
        apiKey: key,
        model: settings.speechCloudModel || undefined,
        language: settings.language === "auto" ? undefined : settings.language,
        apiVersion: settings.speechCloudVersion,
        duration: prepared.duration,
        signal: activeProcess.controller.signal,
        onProgress: (data) => emit("speech-progress", data),
      });
      result.duration ??= prepared.duration;
      if (!result.segments.length && result.words?.length)
        result.segments = result.words.filter((w) => w.end > w.start);
      if (result.cleanup?.some((item) => !item.deleted))
        result.warning =
          "The provider could not confirm deletion of an uploaded resource. Check its account dashboard.";
    } finally {
      await prepared.cleanup();
    }
  }
  assertProcessing();
  if (!result.text.trim()) throw Error("No speech detected");
  const normalized = domain.normalizeRichTranscript(result.text, {
    dictionary: store.data.dictionary,
    threads: store.data.threads,
    removeFillers: settings.removeFillers,
    punctuation: settings.punctuation,
  });
  let text = normalized.text;
  const entry = {
    ...result,
    text,
    html: normalized.html,
    original: result.text,
    kind,
    title: title || path.basename(file),
    audioPath: settings.saveAudio ? file : null,
    modelId:
      settings.speechProvider === "local"
        ? settings.modelId
        : settings.speechProvider +
          ":" +
          (settings.speechCloudModel || "default"),
    speechProvider: settings.speechProvider,
  };
  if (kind === "command") {
    const command = await runCommand(text, "", attachments);
    entry.text = command.text;
    entry.command = text;
    entry.commandResult = command;
  } else if (kind === "dictation" || kind === "shortcut") {
    const shortcut = await runShortcut(text);
    if (shortcut) {
      entry.kind = "shortcut";
      entry.action = shortcut.action;
    } else {
      if (settings.aiEnhance) {
        try {
          entry.text = await enhance(text, settings);
          entry.html = null;
        } catch (e) {
          entry.warning = "AI cleanup failed: " + e.message;
        }
      }
      assertProcessing();
      if (settings.autoPaste) {
        try {
          entry.insertion = await pasteText(entry.text, entry.html);
        } catch (error) {
          entry.warning = [
            entry.warning,
            "Text is ready; insertion failed: " + error.message,
          ]
            .filter(Boolean)
            .join(". ");
        }
      }
    }
  }
  if (kind === "note") {
    const summaryResult = await generateNoteSummary(settings, text, template, {
      signal: activeProcess?.controller.signal,
    });
    assertProcessing();
    if (summaryResult.summaryError) entry.warning = summaryResult.summaryError;
    const note = store.upsert("notes", {
      title: title || "Untitled meeting",
      transcript: text,
      ...summaryResult,
      segments: result.segments,
      audioPath: entry.audioPath,
      template: template || "Meeting",
      duration: result.duration,
      personalNotes,
      flags,
    });
    entry.noteId = note.id;
    emit("navigate", { page: "notes", id: note.id });
  }
  assertProcessing();
  store.recordActivity(result.text, result.duration);
  let saved = entry;
  if (settings.saveHistory || kind === "file" || kind === "note")
    saved = store.addHistory(entry);
  if (kind === "command" && saved.id) {
    saved.commandResult.historyId = saved.id;
    store.save();
    emit("command-result", saved.commandResult);
  }
  if (!settings.saveAudio && file.startsWith(path.join(dataDir, "recordings")))
    await fsp.rm(file, { force: true });
  notify(
    kind === "note" ? "Your notes are ready" : "Transcription ready",
    entry.text.slice(0, 120) || "No speech detected",
  );
  emit("state", snapshot());
  indicator("idle", "");
  return saved;
}
const actions = {
  state: () => snapshot(),
  "capture-hotkey-start": async () => {
    if (recordTarget || activeProcess) throw Error("Finish recording before capturing a shortcut");
    const result = await native.request("hotkeyCaptureStart");
    if (!result.available) { await native.request("hotkeyCaptureStop").catch(() => {}); throw Error("Allow Accessibility access before capturing a shortcut"); }
    return result;
  },
  "capture-hotkey-stop": () => native.request("hotkeyCaptureStop"),
  preferences: async (patch) => {
    const proposed = { ...store.data.settings, ...patch };
    const normalized = require("./speech-preferences").normalizeSpeechPreferences(proposed, speech.listModels());
    store.validateSettings({ ...patch, ...normalized });
    if ("preferIPv4" in patch) require("./network-preferences").applyNetworkPreferences(proposed);
    store.updateSettings({ ...patch, ...normalized });
    if ("locale" in patch) refreshInterfaceMenus();
    if ("launchAtLogin" in patch)
      app.setLoginItemSettings({ openAtLogin: patch.launchAtLogin });
    if ("hideDock" in patch && app.dock)
      patch.hideDock ? app.dock.hide() : app.dock.show();
    updateNative();
    if (!recordTarget && !activeProcess && overlay)
      indicator("idle", "Ready to listen");
    emit("state", snapshot());
    return snapshot();
  },
  "show-tone-menu": () => {
    const selected = store.data.settings.pinnedToneId;
    Menu.buildFromTemplate([
      {
        label: interfaceText("tone.automatic"),
        type: "radio",
        checked: !selected,
        click: () => actions["select-tone"]({ id: "" }),
      },
      ...store.data.tones
        .filter((t) => t.enabled !== false)
        .map((t) => ({
          label: t.name,
          type: "radio",
          checked: t.id === selected,
          click: () => actions["select-tone"]({ id: t.id }),
        })),
    ]).popup({ window: overlay });
    return true;
  },
  "select-tone": ({ id = "" }) => {
    if (id && !store.data.tones.some((t) => t.id === id && t.enabled !== false))
      throw Error("Tone unavailable");
    store.updateSettings({ pinnedToneId: id });
    emit("state", snapshot());
    if (!recordTarget && !activeProcess) indicator("idle", "Ready to listen");
    return true;
  },
  "memory-reindex": async ({ id }) => {
    const value = store.data.memory.find((m) => m.id === id);
    if (!value) throw Error("Memory not found");
    await indexMemory(value);
    return store.data.memory.find((m) => m.id === id);
  },
  "save-item": ({ kind, item }) => {
    if (["threads", "expansions"].includes(kind) && item.html)
      item = { ...item, html: domain.sanitizeRichHTML(item.html) };
    if (kind === "tones")
      require("./tones").validateTone({ ...item, id: item.id || "new" });
    const value = store.upsert(kind, item);
    if (kind === "tones" && item.isDefault) {
      for (const tone of store.data.tones)
        if (tone.id !== value.id) tone.isDefault = false;
      store.save();
    }
    if (kind === "memory" && memoryIndex) {
      if (Object.keys(item).every((k) => ["id", "enabled"].includes(k)))
        memoryIndex.setEnabled(value.id, value.enabled);
      else void indexMemory(value);
    }
    if (kind === "expansions") updateNative();
    emit("state", snapshot());
    return value;
  },
  "delete-item": ({ kind, id }) => {
    if (kind === "memory") {
      memoryTasks.get(id)?.abort();
      memoryIndex?.remove(id);
    }
    store.remove(kind, id);
    if (kind === "expansions") updateNative();
    emit("state", snapshot());
    return true;
  },
  copy: ({ text }) => {
    clipboard.writeText(String(text));
    return true;
  },
  paste: ({ text }) => pasteText(String(text)),
  "paste-last": () =>
    pasteText(
      store.data.history.find((x) => x.kind === "dictation")?.text || "",
    ),
  permissions: async () => {
    const status = await native.request("status").catch(() => ({}));
    const microphoneStatus =
      systemPreferences.getMediaAccessStatus("microphone");
    return {
      ...status,
      microphone: microphoneStatus === "granted" ? 3 : 0,
      microphoneStatus,
    };
  },
  "request-permissions": async ({ kind }) => {
    if (kind === "microphone")
      return {
        microphone: await systemPreferences.askForMediaAccess("microphone"),
      };
    return native.request("permissions", {
      accessibility: kind === "accessibility",
      screenRecording: kind === "screen",
    });
  },
  "open-permissions": ({ kind }) =>
    shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?" +
        ({
          microphone: "Privacy_Microphone",
          accessibility: "Privacy_Accessibility",
          screen: "Privacy_ScreenCapture",
        }[kind] || "Privacy_Accessibility"),
    ),
  "start-recording": ({ mode = "dictation", toneId }) =>
    beginRecording(mode, toneId),
  "recording-level": ({ level }) => {
    if (!recordTarget || !Number.isFinite(level)) return false;
    emit("recording-level", { level: Math.max(0, Math.min(1, level)) });
    return true;
  },
  "recording-paused": ({ paused = false, muted = false }) => {
    if (!recordTarget) return false;
    indicator(
      paused ? "paused" : "recording",
      paused ? "Paused" : muted ? "Microphone muted" : "Listening…",
    );
    emit("audio-level", { rms: 0, muted });
    return true;
  },
  "recording-started": () => {
    indicator(
      "recording",
      activeMode === "note" ? "Taking notes" : "Listening…",
    );
    return true;
  },
  "recording-failed": async ({ message }) => {
    if (systemRecording) {
      await native.request("recordSystemStop").catch(() => {});
      await fsp.rm(systemRecording, { force: true }).catch(() => {});
      systemRecording = null;
    }
    recordTarget = null;
    indicator("idle", "");
    emit("notice", { title: "Recording could not start", body: message });
    return true;
  },
  "stop-recording": () => {
    if (recordTarget?.starting) {
      recordTarget = null;
      indicator("idle", "");
      return true;
    }
    emit("recording-control", { action: "stop" });
    return true;
  },
  "cancel-recording": async () => {
    activeProcess?.controller.abort();
    speech.cancelTranscription();
    emit("recording-control", { action: "cancel" });
    if (systemRecording) {
      await native.request("recordSystemStop").catch(() => {});
      await fsp.rm(systemRecording, { force: true }).catch(() => {});
      systemRecording = null;
    }
    recordTarget = null;
    indicator("idle", "");
    return true;
  },
  "save-recording": async ({
    bytes,
    mime = "audio/webm",
    mode = activeMode,
    title,
    template,
    personalNotes = "",
    flags = [],
    attachments = {},
  }) => {
    if (!bytes || bytes.byteLength > 500e6)
      throw Error("Recording is too large");
    const dir =
      store.data.settings.recordingsDir || path.join(dataDir, "recordings");
    await fsp.mkdir(dir, { recursive: true });
    const file = path.join(
      dir,
      crypto.randomUUID() +
        (mime.includes("wav")
          ? ".wav"
          : mime.includes("mp4")
            ? ".m4a"
            : ".webm"),
    );
    const created = [file];
    let input = file;
    try {
      await fsp.writeFile(file, Buffer.from(bytes), { mode: 0o600 });
      if (systemRecording) {
        const system = systemRecording;
        systemRecording = null;
        created.push(system);
        await native.request("recordSystemStop");
        input = await mixAudio(file, system);
        created.push(input);
      }
      return await processFile(input, {
        kind: mode,
        title,
        template,
        personalNotes,
        flags,
        attachments,
      });
    } finally {
      for (const item of created)
        if (!store.data.settings.saveAudio || item !== input)
          await fsp.rm(item, { force: true }).catch(() => {});
      recordTarget = null;
      indicator("idle", "");
    }
  },
  "pause-system-audio": () => native.request("recordSystemPause"),
  "resume-system-audio": () => native.request("recordSystemResume"),
  "start-system-audio": async () => {
    const file = path.join(dataDir, "recordings", crypto.randomUUID() + ".wav");
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await native.request("recordSystemStart", { path: file });
    systemRecording = file;
    return true;
  },
  "choose-files": async () => {
    const r = await dialog.showOpenDialog(window, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Audio and video",
          extensions: [
            "wav",
            "mp3",
            "m4a",
            "aac",
            "ogg",
            "flac",
            "wma",
            "opus",
            "mp4",
            "mov",
            "mkv",
            "webm",
            "avi",
            "flv",
            "wmv",
            "mpeg",
            "mpg",
          ],
        },
      ],
    });
    r.filePaths.forEach((p) => allowedFiles.add(p));
    return r.filePaths;
  },
  "allow-drop": ({ paths }) => {
    for (const p of paths) {
      if (typeof p !== "string" || !path.isAbsolute(p) || !fs.existsSync(p))
        throw Error("Invalid dropped file");
      allowedFiles.add(p);
    }
    return paths;
  },
  "transcribe-file": async ({
    file,
    kind = "file",
    template,
    speechOptions = {},
  }) => {
    if (!allowedFiles.has(file)) throw Error("Select or drop this file first");
    return processFile(file, {
      kind,
      title: path.basename(file),
      template,
      speechOptions,
    });
  },
  retry: async ({ id }) => {
    const entry = store.data.history.find((e) => e.id === id);
    if (!entry?.audioPath) throw Error("The audio recording was not retained");
    return processFile(entry.audioPath, {
      kind: entry.kind,
      title: entry.title,
    });
  },
  "update-history": ({ id, text, segments }) => {
    const entry = store.data.history.find((e) => e.id === id);
    if (!entry) throw Error("Entry not found");
    if (segments) {
      if (
        !Array.isArray(segments) ||
        segments.length > 10000 ||
        segments.some(
          (segment) =>
            !Number.isFinite(segment.start) ||
            !Number.isFinite(segment.end) ||
            segment.start < 0 ||
            segment.end <= segment.start ||
            typeof segment.text !== "string",
        )
      )
        throw Error("Invalid subtitle segments");
      entry.segments = segments;
      entry.text = segments.map((s) => s.text).join(" ");
      entry.timestampsStale = false;
    } else {
      entry.text = String(text);
      if (entry.segments?.length) entry.timestampsStale = true;
    }
    entry.html = null;
    store.save();
    emit("state", snapshot());
    return entry;
  },
  export: async ({ kind = "history", id, format = "txt" }) => {
    const entry = store.data[kind]?.find((e) => e.id === id);
    if (!entry) throw Error("Entry not found");
    let content =
      kind === "notes"
        ? format === "json"
          ? JSON.stringify(entry, null, 2)
          : `${entry.summary || ""}\n\n## Transcript\n${entry.transcript || ""}`
        : domain.exportTranscript(entry, format);
    const r = await dialog.showSaveDialog(window, {
      defaultPath:
        (entry.title || "Scribble").replace(/[^\p{L}\p{N} ._-]/gu, "") +
        "." +
        format,
    });
    if (r.canceled) return null;
    if (format === "pdf") {
      const directory = await fsp.mkdtemp(
        path.join(os.tmpdir(), "scribble-export-"),
      );
      try {
        const input = path.join(directory, "document.md");
        const output = path.join(directory, "document.pdf");
        await fsp.writeFile(input, content, { mode: 0o600 });
        await require("./utilities").markdownPDF(input, output, {});
        // Save beside the destination before renaming so failure preserves the old file.
        const temporary = r.filePath + ".scribble-" + crypto.randomUUID();
        try {
          await fsp.copyFile(output, temporary);
          await fsp.rename(temporary, r.filePath);
        } finally {
          await fsp.rm(temporary, { force: true });
        }
      } finally {
        await fsp.rm(directory, { recursive: true, force: true });
      }
    } else await fsp.writeFile(r.filePath, content);
    return r.filePath;
  },
  import: async ({ kind }) => {
    const r = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [
        {
          name: "Import",
          extensions:
            kind === "memory"
              ? ["pdf", "json", "csv", "txt", "md", "yaml", "yml", "toml"]
              : ["json", "csv", "txt", "md"],
        },
      ],
    });
    if (r.canceled) return [];
    if (kind === "memory") {
      const value = store.upsert("memory", {
        name: path.basename(r.filePaths[0]),
        filePath: r.filePaths[0],
        enabled: true,
      });
      void indexMemory(value);
      return [value];
    }
    const text = await fsp.readFile(r.filePaths[0], "utf8");
    const items = domain.parseImport(text, kind);
    for (const item of items) store.upsert(kind, item);
    if (kind === "expansions") updateNative();
    emit("state", snapshot());
    return items;
  },
  backup: async () => {
    const r = await dialog.showSaveDialog(window, {
      defaultPath: "scribble-backup.json",
    });
    if (r.canceled) return false;
    await fsp.writeFile(r.filePath, JSON.stringify(store.data, null, 2), {
      mode: 0o600,
    });
    return r.filePath;
  },
  restore: async () => {
    const r = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "Scribble backup", extensions: ["json"] }],
    });
    if (r.canceled) return false;
    const value = JSON.parse(await fsp.readFile(r.filePaths[0], "utf8"));
    if (value.version !== 1 || !value.settings || !Array.isArray(value.history))
      throw Error("Invalid Scribble backup");
    await fsp.copyFile(
      store.file,
      store.file + ".before-restore-" + Date.now(),
    );
    store.restore(value);
    updateNative();
    emit("state", snapshot());
    return true;
  },
  utility: async ({ operation, options = {} }) => {
    const extensions = {
      "image-convert": options.format || "webp",
      "image-compress": options.format || "webp",
      "image-palette": "json",
      "audio-convert": options.format || "mp3",
      "video-convert": options.format || "mp4",
      "pdf-merge": "pdf",
      "archive-create": "zip",
      "archive-extract": "folder",
      "config-convert": options.format || "json",
      "markdown-pdf": "pdf",
      "text-markdown": "md",
    };
    if (!Object.hasOwn(extensions, operation))
      throw Error("Unknown file operation");
    const chosen = await dialog.showOpenDialog(window, {
      properties:
        operation === "archive-create"
          ? ["openFile", "openDirectory", "multiSelections"]
          : ["openFile", "multiSelections"],
    });
    if (chosen.canceled) return null;
    const destination = await dialog.showSaveDialog(window, {
      defaultPath: "Scribble-output." + extensions[operation],
    });
    if (destination.canceled) return null;
    const result = await require("./utilities").performUtility({
      operation,
      files: chosen.filePaths,
      output: destination.filePath,
      options,
    });
    return result;
  },
  models: () => speech.listModels(),
  "download-model": async ({ id }) => {
    const result = await speech.downloadModel(id);
    emit("state", snapshot());
    return result;
  },
  "cancel-download": ({ id }) => speech.cancelDownload(id),
  "delete-model": async ({ id }) => {
    await speech.deleteModel(id);
    emit("state", snapshot());
    return true;
  },
  "save-speech-key": ({ provider, key }) => {
    if (!Object.hasOwn(require("./cloud-speech").CATALOG, provider))
      throw Error("Unknown speech provider");
    if (!safeStorage.isEncryptionAvailable())
      throw Error("Secure key storage unavailable");
    const file = path.join(dataDir, "speech-" + provider + ".key");
    if (key)
      fs.writeFileSync(file, safeStorage.encryptString(String(key)), {
        mode: 0o600,
      });
    else fs.rmSync(file, { force: true });
    return true;
  },
  "save-api-key": ({ key, provider = store.data.settings.aiProvider }) => {
    if (
      provider !== "openai-compatible" &&
      !Object.hasOwn(require("./cloud-ai").PROVIDERS, provider)
    )
      throw Error("Unknown AI provider");
    const file = path.join(dataDir, "ai-" + provider + ".key");
    if (!safeStorage.isEncryptionAvailable())
      throw Error("Secure key storage unavailable");
    if (key)
      fs.writeFileSync(file, safeStorage.encryptString(String(key)), {
        mode: 0o600,
      });
    else fs.rmSync(file, { force: true });
    return true;
  },
  "ai-test": () =>
    chat(
      store.data.settings,
      [{ role: "user", content: "Respond with the word ready." }],
      apiKey(),
    ),
  "ai-models": async () => {
    await ensureAI(store.data.settings);
    return ai.localModels(store.data.settings);
  },
  "ai-download": async () => {
    await ensureAI(store.data.settings);
    return ai.pullModel(store.data.settings, (x) => emit("ai-download", x));
  },
  enhance: ({ text, instructions }) =>
    enhance(text, {
      ...store.data.settings,
      aiInstructions: instructions || store.data.settings.aiInstructions,
    }),
  "summarize-note": async ({ id }) => {
    const note = store.data.notes.find((n) => n.id === id);
    if (!note) throw Error("Note not found");
    const summaryResult = await generateNoteSummary(
      store.data.settings,
      note.transcript,
      note.template,
      { signal: activeProcess?.controller.signal },
    );
    return actions["save-item"]({
      kind: "notes",
      item: { ...note, ...summaryResult },
    });
  },
  "summary-cli-status": () => require("./summary-cli").status(),
  "choose-command-files": async () => {
    const chosen = await dialog.showOpenDialog(window, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Command context",
          extensions: [
            "txt",
            "md",
            "pdf",
            "csv",
            "json",
            "yaml",
            "yml",
            "toml",
            "png",
            "jpg",
            "jpeg",
            "webp",
          ],
        },
      ],
    });
    if (chosen.canceled) return null;
    return require("./command-context").prepareCommandFiles(chosen.filePaths);
  },
  command: async ({ text, context, historyId, attachments = {} }) => {
    if (activeProcess) throw Error("Finish the current transcription first");
    text = String(text || "").trim();
    if (!text || text.length > 12000)
      throw Error("Enter a command of up to 12,000 characters");
    let entry = historyId
      ? store.data.history.find(
          (item) => item.id === historyId && item.kind === "command",
        )
      : null;
    if (historyId && !entry) throw Error("Command history not found");
    if (
      String(context || "").length > 100000 ||
      String(attachments.text || "").length > 60000 ||
      !Array.isArray(attachments.images || [])
    )
      throw Error("Command context is too large or invalid");
    const result = await runCommand(text, String(context || ""), attachments);
    if (!store.data.settings.saveHistory) return result;
    const revision = {
      instruction: text,
      context: String(context || ""),
      text: result.text,
      createdAt: new Date().toISOString(),
    };
    if (entry) {
      entry.revisions = [
        ...(entry.revisions || [
          {
            instruction: entry.command,
            context: entry.commandResult?.original || "",
            text: entry.text,
            createdAt: entry.createdAt,
          },
        ]),
        revision,
      ].slice(-30);
      entry.text = result.text;
      entry.command = text;
      entry.commandResult = result;
      store.save();
    } else
      entry = store.addHistory({
        kind: "command",
        text: result.text,
        original: text,
        command: text,
        commandResult: result,
        title: "Command",
        revisions: [revision],
      });
    result.historyId = entry.id;
    store.save();
    emit("state", snapshot());
    return result;
  },
  "open-url": ({ url }) => openUrl(url),
  "open-data": () => shell.openPath(dataDir),
  "choose-recordings-folder": async () => {
    const r = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled) return null;
    await fsp.access(r.filePaths[0], fs.constants.W_OK);
    return r.filePaths[0];
  },
  "cancel-timer": ({ id }) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    store.data.timers = store.data.timers.filter((t) => t.id !== id);
    store.save();
    emit("state", snapshot());
    return true;
  },
  "crop-screen-context": ({ image, region }) =>
    require("./screen-context").cropScreenContext(image, region),
  "screen-context": async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1280, height: 720 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      image: s.thumbnail.toDataURL(),
    }));
  },
  show: () => show(),
  quit: () => {
    quitting = true;
    app.quit();
  },
};
async function mixAudio(mic, system) {
  const bin = require("./speech").resolveExecutablePath(
    require("./ffmpeg").ffmpegExecutable(),
  );
  const out = path.join(path.dirname(mic), crypto.randomUUID() + ".wav");
  await new Promise((resolve, reject) => {
    const p = spawn(bin, [
      "-y",
      "-i",
      mic,
      "-i",
      system,
      "-filter_complex",
      "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0",
      "-ac",
      "1",
      "-ar",
      "16000",
      out,
    ]);
    let err = "";
    p.stderr.on("data", (b) => (err = (err + b).slice(-3000)));
    p.on("error", reject);
    p.on("exit", (c) => (c ? reject(Error(err)) : resolve()));
  });
  return out;
}
async function dispatch(action, args) {
  if (!Object.hasOwn(actions, action)) throw Error("Unknown action");
  try {
    return await actions[action](args || {});
  } catch (e) {
    if (["transcribe-file", "retry", "save-recording"].includes(action))
      indicator("idle", "");
    throw e;
  }
}
app
  .whenReady()
  .then(async () => {
    dataDir =
      process.env.SCRIBBLE_DATA_DIR ||
      path.join(app.getPath("appData"), "Scribble");
    store = new Store(dataDir);
    require("./network-preferences").applyNetworkPreferences(store.data.settings);
    speech = new SpeechEngine({ dataDir });
    const speechPreferenceRepair = require("./speech-preferences").normalizeSpeechPreferences(store.data.settings, speech.listModels());
    if (Object.keys(speechPreferenceRepair).length) store.updateSettings(speechPreferenceRepair);
    native = new NativeBridge(
      app.isPackaged
        ? path.join(process.resourcesPath, "native/scribble-bridge")
        : path.join(__dirname, "../../release/native/scribble-bridge"),
    );
    memoryIndex = new (require("./memory-index").MemoryIndex)();
    for (const item of store.data.memory)
      void indexMemory(item, { summarize: false });
    speech.on("progress", (x) => emit("speech-progress", x));
    speech.on("download-progress", (x) => emit("model-download", x));
    speech.on("models-changed", () => emit("state", snapshot()));
    native.on("hotkey", async (x) => {
      if (x.phase === "cancel") {
        await actions["cancel-recording"]({});
        return;
      }
      if (x.mode === "paste-last" && x.phase === "start") {
        await actions["paste-last"]();
        return;
      }
      if (x.phase === "start") await beginRecording(x.mode, x.toneId);
      else await actions["stop-recording"]();
    });
    for (const event of ["hotkey-captured", "hotkey-capture-cancelled", "hotkey-capture-ended"]) native.on(event, (data) => emit(event, data));
    native.on("clipboard", (x) => {
      if (!store.data.settings.clipboardHistory) return;
      store.data.clipboard.unshift({
        id: crypto.randomUUID(),
        text: x.text.slice(0, 100000),
        createdAt: new Date().toISOString(),
      });
      store.data.clipboard = store.data.clipboard.slice(0, 100);
      store.save();
      emit("state", snapshot());
    });
    ipcMain.handle("scribble:request", async (event, { action, args }) => {
      if (
        ![window?.webContents.id, overlay?.webContents.id].includes(
          event.sender.id,
        )
      )
        throw Error("Untrusted window");
      try {
        return { ok: true, value: await dispatch(action, args) };
      } catch (e) {
        indicator("idle", "");
        return { ok: false, error: e.message };
      }
    });
    protocol.handle("scribble-audio", (request) => {
      const id = new URL(request.url).pathname.slice(1);
      const entry = [...store.data.history, ...store.data.notes].find(
        (e) => e.id === id,
      );
      if (!entry?.audioPath)
        return new Response("Recording not found", { status: 404 });
      return net.fetch(
        require("node:url").pathToFileURL(entry.audioPath).toString(),
      );
    });

    require("electron").session.defaultSession.setPermissionRequestHandler(
      (contents, permission, callback) =>
        callback(
          contents === window?.webContents &&
            ["media", "audioCapture"].includes(permission),
        ),
    );
    for (const t of store.data.timers) armTimer(t);
    require("electron").powerMonitor.on("resume", () => {
      for (const timeout of timers.values()) clearTimeout(timeout);
      for (const item of store.data.timers) armTimer(item);
    });
    createWindow();
    createOverlay();
    updateNative();
    if (store.data.settings.startMinimized) window.hide();
    if (store.data.settings.hideDock) app.dock?.hide();
    const icon = nativeImage.createFromPath(
      path.join(__dirname, "../../assets/tray.png"),
    );
    if (!icon.isEmpty() && process.platform === "darwin")
      icon.setTemplateImage(true);
    tray = new Tray(
      icon.isEmpty()
        ? nativeImage.createFromDataURL(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          )
        : icon,
    );
    tray.setToolTip("Scribble · Speak your mind");
    refreshInterfaceMenus();
    tray.on("click", show);
    const socket = path.join(dataDir, "scribble.sock");
    try {
      fs.unlinkSync(socket);
    } catch {}
    server = http.createServer(async (req, res) => {
      let body = "";
      req.on("data", (b) => {
        body += b;
        if (body.length > 1e6) req.destroy();
      });
      req.on("end", async () => {
        try {
          const value = JSON.parse(body || "{}");
          const permitted = [
            "state",
            "transcribe-file",
            "models",
            "preferences",
            "command",
            "start-recording",
            "cancel-recording",
            "stop-recording",
            "paste-last",
            "retry",
            "download-model",
            "cancel-download",
            "delete-model",
            "memory-reindex",
            "select-tone",
            "save-item",
            "copy",
          ];
          if (!permitted.includes(value.action))
            throw Error("CLI action unavailable");
          if (value.action === "transcribe-file")
            allowedFiles.add(value.args.file);
          const result = await dispatch(value.action, value.args);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true, value: result }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
    });
    server.listen(socket, () => fs.chmodSync(socket, 0o600));
  })
  .catch((e) => {
    dialog.showErrorBox("Scribble could not start", e.stack || e.message);
    app.quit();
  });
app.on("activate", show);
function acceptOpenFiles(files) {
  const extensions = new Set([
    "mp3",
    "wav",
    "m4a",
    "aac",
    "ogg",
    "flac",
    "wma",
    "opus",
    "mp4",
    "mov",
    "avi",
    "mkv",
    "flv",
    "wmv",
    "webm",
    "mpeg",
    "mpg",
  ]);
  const accepted = files.filter(
    (file) =>
      typeof file === "string" &&
      path.isAbsolute(file) &&
      extensions.has(path.extname(file).slice(1).toLowerCase()) &&
      (() => {
        try {
          return fs.statSync(file).isFile();
        } catch {
          return false;
        }
      })(),
  );
  for (const file of accepted) allowedFiles.add(file);
  if (window && !window.isDestroyed() && !window.webContents.isLoading()) {
    show();
    emit("open-files", accepted);
  } else pendingOpenFiles.push(...accepted);
}
app.on("open-file", (event, file) => {
  event.preventDefault();
  acceptOpenFiles([file]);
});
app.on("second-instance", (_event, argv) => {
  show();
  acceptOpenFiles(argv || []);
});
let shutdownInProgress = false,
  quitAllowed = false;
app.on("before-quit", (event) => {
  if (quitAllowed) return;
  event.preventDefault();
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  quitting = true;
  native?.close();
  server?.close();
  for (const timer of timers.values()) clearTimeout(timer);
  require("./ai-runtime")
    .closeLocalAI()
    .finally(() => {
      quitAllowed = true;
      app.exit(0);
    });
});
app.on("window-all-closed", () => {});
