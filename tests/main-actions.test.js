"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createRequire } = require("node:module");
const mainPath = path.resolve(__dirname, "../src/main/index.js"),
  localRequire = createRequire(mainPath);
function harness(t, { chat, transcribe, summaryCLI, shell, models = [] } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scribble-actions-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { Store } = localRequire("./store"),
    store = new Store(directory),
    events = [],
    nativeCalls = [], menus = [], trayState = {}, appEvents = {}, exits = [];
  const electron = {
    Menu: { buildFromTemplate(template) { return template; }, setApplicationMenu(menu) { menus.push(menu); } },
    app: {
      setName() {},
      requestSingleInstanceLock: () => true,
      whenReady: () => new Promise(() => {}),
      on(event, listener) { appEvents[event] = listener; },
      exit(code) { exits.push(code); },
      getVersion: () => "test",
    },
    protocol: { registerSchemesAsPrivileged() {} },
    Notification: { isSupported: () => false },
    clipboard: { readText: () => "clipboard", writeText() {} },
    shell: shell || { openPath: async () => "", openExternal: async () => {} },
    safeStorage: { isEncryptionAvailable: () => false },
  };
  const speech = {
    status: () => ({ busy: false, ready: true }),
    listModels: () => models,
    cancelTranscription() {},
    transcribe:
      transcribe ||
      (async () => ({ text: "a test sentence", segments: [], duration: 2 })),
  };
  const native = {
    available: true,
    close() { nativeCalls.push({ command:"close" }); },
    request: async (command, args) => {
      nativeCalls.push({ command, args });
      return command === "selection"
        ? { text: "selected text" }
        : { inserted: true };
    },
  };
  const context = {
    require: (name) =>
      name === "./summary-cli"
        ? (summaryCLI || localRequire(name))
        : name === "./ai-runtime"
        ? { ensureLocalAI: async () => ({}), closeLocalAI: async () => ({}) }
        : name === "electron"
          ? electron
          : name === "./ai"
            ? {
                ...localRequire("./ai"),
                chat: chat || (async () => "cleaned text"),
              }
            : localRequire(name),
    __dirname: path.dirname(mainPath),
    process,
    Buffer,
    URL,
    Response,
    DOMException,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(mainPath, "utf8") +
      "\nglobalThis.exposed={actions,processFile,runShortcut,runCommand,snapshot,initializeTray(t){tray=t;},initialize(s,sp,n,d){store=s;speech=sp;native=n;dataDir=d;memoryIndex=new (require('./memory-index').MemoryIndex)();}};",
    context,
  );
  context.exposed.initialize(store, speech, native, directory);
  return { ...context.exposed, store, nativeCalls, directory, events, menus, trayState, appEvents, exits };
}
test("cancel during AI cleanup never inserts or saves a late result", async (t) => {
  let started;
  const ready = new Promise((r) => (started = r));
  const h = harness(t, {
    chat: async (_settings, _messages, _key, { signal }) => {
      started();
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () =>
          reject(new DOMException("Canceled", "AbortError")),
        ),
      );
    },
  });
  h.store.updateSettings({ aiEnhance: true });
  const work = h.processFile("/fixture.wav", { kind: "dictation" });
  await ready;
  assert.equal(h.snapshot().speechStatus.busy, true);
  await h.actions["cancel-recording"]();
  await assert.rejects(work, /canceled/i);
  assert.equal(h.nativeCalls.filter((c) => c.command === "paste").length, 0);
  assert.equal(h.store.data.history.length, 0);
  assert.equal(h.snapshot().speechStatus.busy, false);
});
test("speech failures preserve a retryable history error instead of claiming success", async (t) => {
  const h = harness(t, {
    transcribe: async () => {
      throw Error("decoder rejected input");
    },
  });
  await assert.rejects(h.processFile("/fixture.wav"), /decoder rejected/);
  assert.equal(h.store.data.history[0].error, "decoder rejected input");
  assert.equal(h.store.data.history[0].audioPath, "/fixture.wav");
  assert.equal(h.store.data.activity.recordings, 0);
});
test("successful transcription contributes lifetime activity with history disabled", async (t) => {
  const h = harness(t);
  h.store.updateSettings({ saveHistory: false, autoPaste: false });
  await h.processFile("/fixture.wav", { kind: "dictation" });
  assert.equal(h.store.data.history.length, 0);
  assert.equal(h.snapshot().stats.recordings, 1);
  assert.equal(h.snapshot().stats.words, 3);
  const reopened = new (localRequire("./store").Store)(h.directory);
  assert.equal(reopened.data.activity.recordings, 1);
});
test("reminder side effect is persisted and cancellation removes it", async (t) => {
  const h = harness(t);
  const result = await h.actions.command({
    text: "remind me to stretch in 20 minutes",
  });
  assert.equal(result.kind, "timer");
  assert.equal(h.store.data.timers[0].title, "stretch");
  const id = h.store.data.timers[0].id;
  await h.actions["cancel-timer"]({ id });
  assert.equal(h.store.data.timers.length, 0);
});

test("refining a command preserves one history entry and both revisions", async (t) => {
  const h = harness(t);
  const first = await h.actions.command({
    text: "uppercase",
    context: "Mixed Case",
  });
  const second = await h.actions.command({
    text: "lowercase",
    context: first.text,
    historyId: first.historyId,
  });
  assert.equal(second.text, "mixed case");
  assert.equal(h.store.data.history.length, 1);
  assert.equal(h.store.data.history[0].revisions.length, 2);
  assert.equal(h.store.data.history[0].revisions[0].text, "MIXED CASE");
  assert.equal(second.historyId, first.historyId);
});
test("Removing memory during provider indexing aborts it and never recreates the item", async (t) => {
  let started, complete;
  const ready = new Promise((resolve) => (started = resolve));
  const h = harness(t, {
    chat: async () => {
      started();
      return new Promise((resolve) => (complete = resolve));
    },
  });
  const memory = h.actions["save-item"]({
    kind: "memory",
    item: { name: "Fixture", content: "Cedar owner is Ana.", enabled: true },
  });
  await ready;
  assert.equal(h.store.data.memory[0].status, "indexing");
  h.actions["delete-item"]({ kind: "memory", id: memory.id });
  complete("Cedar owner is Ana.");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.store.data.memory.length, 0);
});
test("File local override selects that engine without rewriting cloud preferences", async (t) => {
  let received;
  const h = harness(t, {
    transcribe: async (_file, options) => {
      received = options;
      return { text: "fixture words", segments: [], duration: 1 };
    },
  });
  h.store.updateSettings({ speechProvider: "openai" });
  await h.processFile("/fixture.wav", {
    speechOptions: {
      speechProvider: "local",
      modelId: "tiny.en",
      language: "en",
    },
  });
  assert.equal(received.modelId, "tiny.en");
  assert.equal(h.store.data.settings.speechProvider, "openai");
  assert.equal(h.store.data.history[0].speechProvider, "local");
});
test("Transcript edits require caption correction before subtitle export", async (t) => {
  const h = harness(t);
  const entry = h.store.addHistory({
    kind: "file",
    text: "Old words",
    segments: [{ start: 0, end: 1, text: "Old words" }],
  });
  h.actions["update-history"]({ id: entry.id, text: "New words" });
  assert.throws(
    () => localRequire("./domain").exportTranscript(entry, "srt"),
    /Correct the subtitle/,
  );
  h.actions["update-history"]({
    id: entry.id,
    segments: [{ start: 0, end: 1, text: "New words" }],
  });
  const output = localRequire("./domain").exportTranscript(entry, "srt");
  assert.match(output, /New words/);
  assert.doesNotMatch(output, /Old words/);
});

test("file commands route to a saved utility result and report cancellation honestly", async (t) => {
  const h = harness(t, {
    chat: async () => {
      throw Error("File commands must not ask AI to simulate an operation");
    },
  });
  let request;
  h.actions.utility = async (value) => {
    request = value;
    return {
      output: "/tmp/palette.json",
      details: { operation: "image-palette" },
    };
  };
  const saved = await h.actions.command({
    text: "extract a color palette from this image",
  });
  assert.equal(request.operation, "image-palette");
  assert.match(saved.text, /Saved \/tmp\/palette.json/);
  h.actions.utility = async () => null;
  const cancelled = await h.actions.command({ text: "compress this image" });
  assert.equal(cancelled.kind, "cancelled");
  assert.equal(cancelled.text, "File operation cancelled.");
});

test("AI cleanup observes English spelling and protects dictionary terms", async (t) => {
  let messages;
  const h = harness(t, {
    chat: async (_settings, value) => {
      messages = value;
      return "The colour is blue.";
    },
  });
  h.store.updateSettings({ aiEnhance: true, spelling: "uk", autoPaste: false });
  h.store.upsert("dictionary", { word: "ColorSync", aliases: [] });
  await h.processFile("/fixture.wav", { kind: "dictation" });
  assert.match(messages[0].content, /British English spelling/);
  assert.match(
    messages[0].content,
    /Preserve proper names, exact quotations, URLs, code/,
  );
  assert.match(messages[0].content, /ColorSync/);
});

test("CPU resource mode disables Whisper GPU and caps worker threads", async (t) => {
  let options;
  const h = harness(t, {
    transcribe: async (_file, value) => {
      options = value;
      return { text: "CPU fixture", segments: [], duration: 1 };
    },
  });
  h.store.updateSettings({
    resourceMode: "cpu",
    aiEnhance: false,
    autoPaste: false,
  });
  await h.processFile("/fixture.wav", { kind: "dictation" });
  assert.equal(options.useGpu, false);
  assert.ok(options.threads >= 1 && options.threads <= 2);
  assert.throws(
    () => h.store.updateSettings({ resourceMode: "pretend" }),
    /Invalid resource mode/,
  );
});

test('interface language preferences rebuild tray and application Settings labels immediately', async t => {
  const h=harness(t), tray={setContextMenu(menu){h.trayState.menu=menu;},setToolTip(text){h.trayState.tooltip=text;}};
  h.initializeTray(tray);
  await h.actions.preferences({locale:'ja'});
  const {t:translate}=require('../src/shared/i18n');
  assert.equal(h.trayState.menu[0].label,translate('ja','tray.open'));
  assert.equal(typeof h.trayState.menu[1].click,'function');
  assert.equal(h.menus.at(-1)[0].submenu[1].label,translate('ja','nav.settings'));
  assert.equal(h.trayState.tooltip,'Scribble · '+translate('ja','tray.tagline'));
  await h.actions.preferences({locale:'en'});
  assert.equal(h.trayState.menu[0].label,'Open Scribble');
});

test('unavailable Accessibility capture is stopped and reports the required permission', async t=> {
 const h=harness(t);
 await assert.rejects(h.actions['capture-hotkey-start'](),/Accessibility/);
 assert.deepEqual(h.nativeCalls.slice(-2).map(x=>x.command),['hotkeyCaptureStart','hotkeyCaptureStop']);
});

test('graceful quit closes native services then exits rather than restarting quit negotiation', async t=> {
 const h=harness(t);let prevented=0;
 h.appEvents['before-quit']({preventDefault(){prevented++;}});
 assert.equal(prevented,1);assert.ok(h.nativeCalls.some(x=>x.command==='close'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.exits,[0]);
});

test("note summary CLI routes separately from global chat and records provenance", async (t) => {
  let cliCalls = 0,
    chatCalls = 0;
  const h = harness(t, {
    chat: async () => {
      chatCalls++;
      return "global AI";
    },
    summaryCLI: {
      status: async () => ({ available: false }),
      summarize: async ({ transcript }) => {
        cliCalls++;
        assert.equal(transcript, "Project ABC-42 launches Friday.");
        return { text: "Project ABC-42 launches Friday." };
      },
    },
  });
  h.store.updateSettings({ summaryProvider: "claude-cli" });
  const note = h.store.upsert("notes", {
    title: "Reference",
    transcript: "Project ABC-42 launches Friday.",
  });
  const result = await h.actions["summarize-note"]({ id: note.id });
  assert.equal(result.summaryProvider, "claude-cli");
  assert.equal(result.summaryFallback, false);
  assert.equal(cliCalls, 1);
  assert.equal(chatCalls, 0);
  await h.actions.enhance({ text: "hello" });
  assert.equal(chatCalls, 1);
  assert.equal(cliCalls, 1);
  assert.equal((await h.actions["summary-cli-status"]()).available, false);
});
test("default summary keeps configured AI route and CLI errors record extractive fallback", async (t) => {
  let chatCalls = 0,
    cliCalls = 0;
  const h = harness(t, {
    chat: async () => {
      chatCalls++;
      return "Fact retained.";
    },
    summaryCLI: {
      summarize: async () => {
        cliCalls++;
        throw Error("Claude unavailable");
      },
    },
  });
  const note = h.store.upsert("notes", { transcript: "Fact retained." });
  let result = await h.actions["summarize-note"]({ id: note.id });
  assert.equal(result.summaryRequestedProvider, "configured-ai");
  assert.equal(result.summaryProvider, "ollama");
  assert.equal(chatCalls, 1);
  h.store.updateSettings({ summaryProvider: "claude-cli" });
  result = await h.actions["summarize-note"]({ id: note.id });
  assert.equal(result.summaryProvider, "local-extractive");
  assert.equal(result.summaryFallback, true);
  assert.equal(result.summaryError, "Claude unavailable");
  assert.equal(cliCalls, 1);
  assert.equal(chatCalls, 1);
});

test("file note uses the same CLI dispatcher and cancellation saves no late note", async (t) => {
  let started;
  const began = new Promise((resolve) => (started = resolve));
  let finish;
  const output = new Promise((resolve) => (finish = resolve));
  const h = harness(t, {
    summaryCLI: {
      summarize: async ({ signal }) => {
        assert.ok(signal);
        started();
        await output;
        return { text: "Late summary" };
      },
    },
  });
  h.store.updateSettings({ summaryProvider: "claude-cli", aiEnhance: false });
  const task = h.processFile(path.join(h.directory, "fixture.wav"), {
    kind: "note",
  });
  await began;
  await h.actions["cancel-recording"]();
  finish();
  await assert.rejects(task, { name: "AbortError" });
  assert.equal(h.store.data.notes.length, 0);
});
test("derived file overrides normalize unsupported language and translation without mutating settings", async (t) => {
  let selected;
  const h = harness(t, {
    models: [
      {
        id: "parakeet-ja",
        engine: "catalog",
        language: "ja",
        supportedLanguages: ["ja"],
      },
    ],
    transcribe: async (_, options) => {
      selected = options;
      return { text: "Japanese test", segments: [], duration: 1 };
    },
  });
  h.store.updateSettings({ language: "fr", translate: true });
  await h.processFile(path.join(h.directory, "fixture.wav"), {
    speechOptions: { modelId: "parakeet-ja" },
  });
  assert.equal(selected.language, "auto");
  assert.equal(selected.translate, false);
  assert.equal(h.store.data.settings.language, "fr");
  assert.equal(h.store.data.settings.translate, true);
});


test('folder shortcut resolves Applications and surfaces OS opening errors', async t=>{
 const calls=[];const h=harness(t,{shell:{openPath:async p=>{calls.push(p);return 'Folder unavailable';}}});
 await assert.rejects(h.runShortcut('open the Applications folder'),/Folder unavailable/);
 assert.deepEqual(calls,['/Applications']);
 assert.equal(await h.runShortcut('navigate to mailto:user@example.com'),null);
});
test('command routing respects disabled builtin families and custom invalid targets', async t=>{
 const calls=[];const h=harness(t,{shell:{openPath:async p=>{calls.push(p);return '';}}});
 h.store.data.shortcuts.find(s=>s.trigger==='open').enabled=false;
 const result=await h.runCommand('open Downloads');
 assert.notEqual(result.kind,'action');assert.equal(calls.length,0);
 h.store.data.shortcuts.push({id:'custom-invalid',trigger:'navigate to',type:'url',target:'mailto:user@example.com',enabled:true});
 assert.equal(await h.runShortcut('navigate to example.com'),null);
 const invalid=await h.runCommand('navigate to example.com');assert.notEqual(invalid.kind,'action');
});
