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
function harness(t, { chat, transcribe } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scribble-actions-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { Store } = localRequire("./store"),
    store = new Store(directory),
    events = [],
    nativeCalls = [];
  const electron = {
    app: {
      setName() {},
      requestSingleInstanceLock: () => true,
      whenReady: () => new Promise(() => {}),
      on() {},
      getVersion: () => "test",
    },
    protocol: { registerSchemesAsPrivileged() {} },
    Notification: { isSupported: () => false },
    clipboard: { readText: () => "clipboard", writeText() {} },
    shell: { openPath: async () => "", openExternal: async () => {} },
    safeStorage: { isEncryptionAvailable: () => false },
  };
  const speech = {
    status: () => ({ busy: false, ready: true }),
    listModels: () => [],
    cancelTranscription() {},
    transcribe:
      transcribe ||
      (async () => ({ text: "a test sentence", segments: [], duration: 2 })),
  };
  const native = {
    available: true,
    request: async (command, args) => {
      nativeCalls.push({ command, args });
      return command === "selection"
        ? { text: "selected text" }
        : { inserted: true };
    },
  };
  const context = {
    require: (name) =>
      name === "./ai-runtime"
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
      "\nglobalThis.exposed={actions,processFile,snapshot,initialize(s,sp,n,d){store=s;speech=sp;native=n;dataDir=d;memoryIndex=new (require('./memory-index').MemoryIndex)();}};",
    context,
  );
  context.exposed.initialize(store, speech, native, directory);
  return { ...context.exposed, store, nativeCalls, directory, events };
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
