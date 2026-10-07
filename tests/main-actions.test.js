"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createRequire } = require("node:module");
async function waitUntil(predicate) { for(let i=0;i<100;i++){ if(predicate()) return; await new Promise(r=>setTimeout(r,5)); } assert.fail('Expected asynchronous shutdown to finish'); }
const mainPath = path.resolve(__dirname, "../src/main/index.js"),
  localRequire = createRequire(mainPath);
function harness(t, { cloudSilence, chat, transcribe, summaryCLI, shell, chromeLauncher, spawn, nativeRequest, nativeClose, closeAI, clipboardText = "clipboard", models = [] } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scribble-actions-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { Store } = localRequire("./store"),
    store = new Store(directory),
    events = [],
    nativeCalls = [], menus = [], trayState = {}, appEvents = {}, exits = [];
  const electron = {
    Menu: { buildFromTemplate(template) { template.popup = () => menus.push(template); return template; }, setApplicationMenu(menu) { menus.push(menu); } },
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
    clipboard: { readText: () => clipboardText, writeText() {} },
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
    close() { nativeCalls.push({ command:"close" }); return nativeClose ? nativeClose() : Promise.resolve({exited:true}); },
    request: async (command, args) => {
      nativeCalls.push({ command, args });
      if (nativeRequest) return nativeRequest(command, args);
      return command === "selection"
        ? { text: "selected text" }
        : { inserted: true };
    },
  };
  const context = {
    require: (name) =>
      name === "./cloud-silence" && cloudSilence
        ? { analyzeCloudSilence: cloudSilence }
        : name === "./browser-launch" && chromeLauncher
        ? { launchWebsites: chromeLauncher }
        : name === "node:child_process" && spawn
        ? { ...localRequire(name), spawn }
        : name === "./summary-cli"
        ? (summaryCLI || localRequire(name))
        : name === "./ai-runtime"
        ? { ensureLocalAI: async () => ({}), closeLocalAI: closeAI || (async () => ({})) }
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
      "\nglobalThis.exposed={actions,processFile,runShortcut,runCommand,snapshot,initializeTray(t){tray=t;},initializeUtilityWindow(w){window=w;},initialize(s,sp,n,d){store=s;speech=sp;native=n;dataDir=d;memoryIndex=new (require('./memory-index').MemoryIndex)();}};",
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
 assert.equal(prevented,1);
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(h.nativeCalls.some(x=>x.command==='close'));assert.deepEqual(h.exits,[0]);
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
 assert.equal(await h.runShortcut('navigate to invalid'),null);
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


test('saved multi-action shortcut executes the new action list instead of stale legacy fields',async t=>{
 const seen=[];const {EventEmitter}=require('node:events');
 const h=harness(t,{chromeLauncher:async(urls,profile)=>seen.push(['websites',...urls,profile]),shell:{openPath:async p=>{seen.push(['folder',p]);return '';}},spawn:(exe,args)=>{seen.push(['application',exe,...args]);const child=new EventEmitter();queueMicrotask(()=>child.emit('exit',0));return child;}});
 h.store.upsert('shortcuts',{trigger:'standup',name:'Standup',type:'app',target:'Old app',actions:[{type:'websites',urls:['example.com?q={{text}}','example.org'],profile:'Profile 2'},{type:'application',name:'TextEdit',folder:'/tmp/project'},{type:'folders',paths:['/Applications']}]});
 const result=await h.runCommand('standup notes & agenda');assert.equal(result.kind,'shortcut');
 assert.deepEqual(seen,[['websites','https://example.com/?q=notes%20%26%20agenda','https://example.org/','Profile 2'],['application','/usr/bin/open','-a','TextEdit','/tmp/project'],['folder','/Applications']]);
});


function utilityHarness(t,options={}){
 const h=harness(t,options);h.initializeUtilityWindow({isDestroyed:()=>false,show(){},focus(){},webContents:{send(_channel,payload){h.events.push(payload);}}});
 h.store.updateSettings({aiUtilities:[{id:'grammar',name:'Fix grammar',preset:'grammar',source:'selection',enabled:true},{id:'summary',name:'Summarize clipboard',preset:'summary',source:'clipboard',enabled:true}]});return h;
}
test('AI utility keeps selected input distinct and inserts only cached reviewed result into captured target',async t=>{
 const seen=[];const h=utilityHarness(t,{chat:async(_s,m)=>{seen.push(m);return 'Revised text.';},nativeRequest:async(command,args)=>command==='captureInsertionTarget'?{token:'target-token',bundleId:'com.apple.TextEdit',pid:123}:command==='selection'?{text:'Original text.'}:command==='paste'?{inserted:true,verified:true}:{}});
 const result=await h.actions['run-ai-utility']({id:'grammar'});assert.equal(result.canInsert,true);assert.equal(seen[0][1].content,'Original text.');assert.equal(h.nativeCalls.filter(c=>c.command==='paste').length,0);
 await h.actions['paste-ai-utility']({id:result.id,text:'untrusted replacement'});const paste=h.nativeCalls.find(c=>c.command==='paste');assert.equal(paste.args.text,'Revised text.');assert.equal(paste.args.targetToken,'target-token');assert.equal(paste.args.activateTarget,true);
 await assert.rejects(h.actions['paste-ai-utility']({id:result.id}),/expired/);
});
test('empty selected text never falls back to clipboard or sends a provider request',async t=>{
 let calls=0;const h=utilityHarness(t,{clipboardText:'Private clipboard',chat:async()=>{calls++;return 'result';},nativeRequest:async()=>({})});
 await assert.rejects(h.actions['run-ai-utility']({id:'grammar'}),/Select some text/);assert.equal(calls,0);
 const result=await h.actions['run-ai-utility']({id:'summary'});assert.equal(calls,1);assert.equal(result.canInsert,false);await assert.rejects(h.actions['paste-ai-utility']({id:result.id}),/copy/);
});
test('utility cancellation suppresses a late provider result and clears busy state',async t=>{
 let resolve,started;const ready=new Promise(r=>started=r);const h=utilityHarness(t,{chat:async()=>{started();return new Promise(r=>resolve=r);}});
 const work=h.actions['run-ai-utility']({id:'grammar'});await ready;assert.equal(h.snapshot().speechStatus.busy,true);await h.actions['cancel-ai-utility']({id:'grammar'});resolve('Late text');await assert.rejects(work,/canceled/);assert.equal(h.snapshot().speechStatus.busy,false);assert.equal(h.events.filter(e=>e.event==='utility-result').length,0);assert.equal(h.nativeCalls.filter(c=>c.command==='paste').length,0);
});


test('disabled AI utility bindings are omitted from native interception and restored on enable',async t=>{
 const h=harness(t);const utility={id:'utility-one',name:'Polish',preset:'polish',source:'selection',enabled:false};const binding={keyCode:5,modifiers:['option','command'],mode:'utility',utilityId:utility.id,toggle:true};
 await h.actions.preferences({aiUtilities:[utility],hotkeys:[...h.store.data.settings.hotkeys,binding]});assert.equal(h.nativeCalls.findLast(c=>c.command==='setHotkeys').args.hotkeys.some(b=>b.mode==='utility'),false);
 await h.actions.preferences({aiUtilities:[{...utility,enabled:true}]});assert.equal(h.nativeCalls.findLast(c=>c.command==='setHotkeys').args.hotkeys.find(b=>b.mode==='utility').utilityId,utility.id);
});


test('refused utility insertion retains review text and removes the consumed insertion option',async t=>{
 const h=utilityHarness(t,{nativeRequest:async command=>command==='captureInsertionTarget'?{token:'single-use',bundleId:'com.apple.TextEdit'}:command==='selection'?{text:'Original.'}:command==='paste'?{inserted:false,dispatched:false,reason:'The original field changed'}:{}});
 const result=await h.actions['run-ai-utility']({id:'grammar'});await assert.rejects(h.actions['paste-ai-utility']({id:result.id}),/field changed/);const review=h.events.findLast(e=>e.event==='utility-result').data;assert.equal(review.text,result.text);assert.equal(review.canInsert,false);await assert.rejects(h.actions['paste-ai-utility']({id:result.id}),/copy/);assert.equal(h.nativeCalls.filter(c=>c.command==='paste').length,1);
});

 test('overlay tone menu opens localized tone management and preserves enabled choices',async t=>{const h=harness(t),sent=[];let shown=0,focused=0;h.store.data.settings.locale='ja';h.store.data.tones=[{id:'on',name:'Enabled',enabled:true},{id:'off',name:'Disabled',enabled:false}];h.initializeUtilityWindow({isDestroyed:()=>false,show(){shown++;},focus(){focused++;},webContents:{isLoading:()=>false,send(_channel,payload){sent.push(payload);}}});assert.equal(h.actions['show-tone-menu'](),true);const menu=h.menus.at(-1);assert.equal(menu.some(item=>item.label==='Disabled'),false);assert.equal(menu[1].label,'Enabled');const manage=menu.at(-1);assert.equal(manage.label,localRequire('../shared/i18n').t('ja','nav.tones'));await manage.click();assert.equal(shown,1);assert.equal(focused,1);assert.equal(sent.at(-1).event,'navigate');assert.equal(sent.at(-1).data.page,'tones');assert.equal(h.store.data.settings.pinnedToneId,'');});

test('command review inserts only cached output at its captured target and cannot be replayed', async t => {
 const h=harness(t,{chat:async()=> 'Reviewed fixture',nativeRequest:async(command,args)=>command==='captureInsertionTarget'?{token:'target-1',bundleId:'com.apple.TextEdit'}:command==='paste'?{dispatched:true}: {text:'input'}});
 const result=await h.actions.command({text:'rewrite this',context:'input'});
 assert.equal(result.canInsert,true);assert.ok(result.reviewId);assert.equal(JSON.stringify(result).includes('target-1'),false);
 await h.actions['paste-command-result']({id:result.reviewId,text:'tampered'});
 const paste=h.nativeCalls.find(x=>x.command==='paste');assert.equal(paste.args.text,'Reviewed fixture');assert.equal(paste.args.targetToken,'target-1');assert.equal(paste.args.activateTarget,true);assert.equal(paste.args.autoEnter,false);assert.equal(paste.args.allowClipboardHistory,false);
 await assert.rejects(h.actions['paste-command-result']({id:result.reviewId}),/expired/);
});
test('refinement retains the original external target and revokes the superseded result', async t => {
 let captures=0;
 const h=harness(t,{chat:async()=> 'Refined fixture',nativeRequest:async(command)=>command==='captureInsertionTarget'?{token:'target-'+(++captures),bundleId:'external.app'}:command==='paste'?{inserted:true}:{text:'input'}});
 const first=await h.actions.command({text:'rewrite this',context:'input'});
 const second=await h.actions.command({text:'make it shorter',context:first.text,reviewId:first.reviewId,historyId:first.historyId});
 assert.equal(captures,1);await assert.rejects(h.actions['paste-command-result']({id:first.reviewId}),/expired/);
 await h.actions['paste-command-result']({id:second.reviewId});assert.equal(h.nativeCalls.find(x=>x.command==='paste').args.targetToken,'target-1');
});
test('own-app capture and native target refusal leave copy-only command review', async t => {
 const own=harness(t,{nativeRequest:async command=>command==='captureInsertionTarget'?{token:'own',bundleId:'org.scribble.voice'}:{text:'input'}});
 const result=await own.actions.command({text:'rewrite this',context:'input'});assert.equal(result.canInsert,false);await assert.rejects(own.actions['paste-command-result']({id:result.reviewId}),/No insertion target/);assert.equal(own.nativeCalls.some(x=>x.command==='paste'),false);
 const failed=harness(t,{nativeRequest:async command=>command==='captureInsertionTarget'?{token:'external',bundleId:'external.app'}:command==='paste'?{inserted:false,reason:'Field changed'}:{text:'input'}});
 failed.initializeUtilityWindow({isDestroyed:()=>false,webContents:{send(_channel,payload){failed.events.push(payload);}}});
 const review=await failed.actions.command({text:'rewrite this',context:'input'});await assert.rejects(failed.actions['paste-command-result']({id:review.reviewId}),/Field changed/);assert.equal(failed.events.at(-1).event,'command-result');assert.equal(failed.events.at(-1).data.canInsert,false);
 await assert.rejects(failed.actions['paste-command-result']({id:review.reviewId}),/No insertion target/);assert.equal(failed.nativeCalls.filter(x=>x.command==='paste').length,1);
});

test("enabled cloud silence rejection saves an explicit failure before credentials or upload", async (t) => {
  let analyzed = 0;
  const h = harness(t, { cloudSilence: async (_file, options) => {
    analyzed++;
    assert.equal(options.enabled, true);
    assert.equal(options.sensitivity, 3.7);
    return { complete: true, decision: "skip" };
  }});
  h.store.updateSettings({ speechProvider: "openai", enhancedSilenceDetection: true, silenceSensitivity: 3.7 });
  await assert.rejects(h.processFile("/fixture.wav"), /Cloud upload skipped/);
  assert.equal(analyzed, 1);
  assert.match(h.store.data.history[0].error, /quiet speech/);
});
test("local transcription never invokes the cloud silence gate", async (t) => {
  const h = harness(t, { cloudSilence: async () => { throw Error("unexpected cloud gate"); } });
  h.store.updateSettings({ enhancedSilenceDetection: true });
  await h.processFile("/fixture.wav");
  assert.equal(h.store.data.history[0].error, undefined);
});
test("disabled or inconclusive cloud gate proceeds to normal credential validation", async (t) => {
  let analyzed = 0;
  const h = harness(t, { cloudSilence: async () => { analyzed++; return { complete:false, decision:"upload" }; } });
  h.store.updateSettings({ speechProvider: "openai" });
  await assert.rejects(h.processFile("/fixture.wav"), /Configure an API key/);
  assert.equal(analyzed, 0);
  h.store.updateSettings({ enhancedSilenceDetection:true });
  await assert.rejects(h.processFile("/fixture.wav"), /Configure an API key/);
  assert.equal(analyzed, 1);
});

test("clipboard manager insertion permission is independent of local clipboard monitoring", async (t) => {
  const h = harness(t);
  await h.actions.preferences({ clipboardHistory: true });
  assert.equal(h.nativeCalls.findLast(call => call.command === "clipboardMonitoring").args.enabled, true);
  assert.equal(h.nativeCalls.findLast(call => call.command === "setExpansions").args.allowClipboardHistory, false);
  await h.actions.paste({ text: "private fixture" });
  assert.equal(h.nativeCalls.findLast(call => call.command === "paste").args.allowClipboardHistory, false);
  await h.actions.preferences({ clipboardHistory: false, allowDictationsInClipboardHistory: true });
  assert.equal(h.nativeCalls.findLast(call => call.command === "clipboardMonitoring").args.enabled, false);
  assert.equal(h.nativeCalls.findLast(call => call.command === "setExpansions").args.allowClipboardHistory, true);
  await h.actions.paste({ text: "public fixture" });
  assert.equal(h.nativeCalls.findLast(call => call.command === "paste").args.allowClipboardHistory, true);
});

test("cancelled pending system start is stopped and deleted before a new session can start", async t => {
 let startResolve,startedResolve;const started=new Promise(resolve=>{startedResolve=resolve;});let starts=0;
 const h=harness(t,{nativeRequest:async(command,args)=>{if(command==='recordSystemStart'){starts++;fs.writeFileSync(args.path,'partial system audio');if(starts===1){startedResolve();await new Promise(resolve=>{startResolve=resolve;});}}return {};}});
 h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;const first=h.actions['start-system-audio']({recordingToken:h.token}).catch(error=>error);await started;
 const file=h.nativeCalls.find(c=>c.command==='recordSystemStart').args.path;const cancellation=h.actions['cancel-recording']();
 await assert.rejects(h.actions['start-system-audio']({recordingToken:h.token}),/already starting/);const before=h.nativeCalls.filter(c=>c.command==='frontmost').length;h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;assert.equal(h.nativeCalls.filter(c=>c.command==='frontmost').length,before);
 startResolve();assert.equal((await first).name,'AbortError');await cancellation;assert.equal(fs.existsSync(file),false);assert.equal(h.nativeCalls.filter(c=>c.command==='recordSystemStop').length,1);assert.equal(h.store.data.history.length,0);
 h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;await h.actions['start-system-audio']({recordingToken:h.token});const secondFile=h.nativeCalls.filter(c=>c.command==='recordSystemStart').at(-1).args.path;assert.ok(fs.existsSync(secondFile));assert.equal(h.nativeCalls.filter(c=>c.command==='recordSystemStop').length,1);await h.actions['cancel-recording']();assert.equal(fs.existsSync(secondFile),false);
});
test("cancellation while stopping system audio retains ownership until cleanup and never clears a newer session",async t=>{
 let stopResolve,stopStartedResolve;const stopStarted=new Promise(resolve=>{stopStartedResolve=resolve;});let stops=0;
 const h=harness(t,{nativeRequest:async(command,args)=>{if(command==='recordSystemStart')fs.writeFileSync(args.path,'system audio');if(command==='recordSystemStop'&&++stops===1){stopStartedResolve();await new Promise(resolve=>{stopResolve=resolve;});}return {};}});
 h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;await h.actions['start-system-audio']({recordingToken:h.token});const cancellation=h.actions['cancel-recording']();await stopStarted;await assert.rejects(h.actions['start-system-audio']({recordingToken:h.token}),/already starting/);stopResolve();await cancellation;
 h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;await h.actions['start-system-audio']({recordingToken:h.token});assert.equal(h.nativeCalls.filter(c=>c.command==='recordSystemStop').length,1);await h.actions['cancel-recording']();assert.equal(h.nativeCalls.filter(c=>c.command==='recordSystemStop').length,2);
});
test("native start failure cleans partial audio; failed stop blocks replacement and can be retried",async t=>{
 let failStart=true,failStop=false;const h=harness(t,{nativeRequest:async(command,args)=>{if(command==='recordSystemStart'){fs.writeFileSync(args.path,'partial');if(failStart)throw Error('Native start failed');}if(command==='recordSystemStop'&&failStop)throw Error('Native stop failed');return {};}});
 h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;await assert.rejects(h.actions['start-system-audio']({recordingToken:h.token}),/Native start failed/);const firstFile=h.nativeCalls.find(c=>c.command==='recordSystemStart').args.path;assert.equal(fs.existsSync(firstFile),false);await h.actions['recording-failed']({message:'start failed'});
 failStart=false;h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;await h.actions['start-system-audio']({recordingToken:h.token});failStop=true;await assert.rejects(h.actions['cancel-recording'](),/Native stop failed/);await assert.rejects(h.actions['start-system-audio']({recordingToken:h.token}),/already starting/);failStop=false;await h.actions['cancel-recording']();h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;await h.actions['start-system-audio']({recordingToken:h.token});await h.actions['cancel-recording']();assert.equal(h.store.data.history.length,0);
});
test("cancel during system-audio finalization discards both files and prevents transcription/history",async t=>{
 let stopResolve,readyResolve;const ready=new Promise(resolve=>{readyResolve=resolve;});let transcriptions=0;
 const h=harness(t,{transcribe:async()=>{transcriptions++;return {text:'must not save',segments:[],duration:1};},nativeRequest:async(command,args)=>{if(command==='recordSystemStart')fs.writeFileSync(args.path,'system audio');if(command==='recordSystemStop'){readyResolve();await new Promise(resolve=>{stopResolve=resolve;});}return {};}});
 h.store.updateSettings({saveAudio:true});h.token=(await h.actions['start-recording']({mode:'note'}))?.recordingToken;await h.actions['start-system-audio']({recordingToken:h.token});const save=h.actions['save-recording']({bytes:Buffer.from('microphone audio'),mode:'note'}).catch(error=>error);await ready;const cancellation=h.actions['cancel-recording']();stopResolve();assert.equal((await save).name,'AbortError');await cancellation;assert.equal(transcriptions,0);assert.equal(h.store.data.history.length,0);assert.equal(h.store.data.notes.length,0);assert.deepEqual(fs.readdirSync(path.join(h.directory,'recordings')),[]);assert.equal(h.nativeCalls.filter(c=>c.command==='recordSystemStop').length,1);
});

test('system audio requires the exact live note token and rejects old delayed IPC', async t=>{
 const h=harness(t);const old=await h.actions['start-recording']({mode:'note'});await h.actions['cancel-recording']();const current=await h.actions['start-recording']({mode:'note'});
 assert.notEqual(old.recordingToken,current.recordingToken);await assert.rejects(h.actions['start-system-audio']({recordingToken:old.recordingToken}),/matching note/);await assert.rejects(h.actions['start-system-audio'](),/matching note/);assert.equal(h.nativeCalls.filter(c=>c.command==='recordSystemStart').length,0);
 await h.actions['start-system-audio'](current);await h.actions['cancel-recording']();const dictation=await h.actions['start-recording']({mode:'dictation'});await assert.rejects(h.actions['start-system-audio'](dictation),/matching note/);await h.actions['cancel-recording']();
});
test('quit cancels late capture startup, cleans capture before closing, and awaits native plus owned AI', async t=>{
 let startResolve,startSeen,nativeResolve,aiResolve;const started=new Promise(r=>startSeen=r);const nativeDone=new Promise(r=>nativeResolve=r),aiDone=new Promise(r=>aiResolve=r);
 const h=harness(t,{nativeRequest:async(command,args)=>{if(command==='recordSystemStart'){fs.writeFileSync(args.path,'partial');startSeen();return new Promise(r=>startResolve=r);}return {};},nativeClose:()=>nativeDone,closeAI:()=>aiDone});
 const token=await h.actions['start-recording']({mode:'note'});const start=h.actions['start-system-audio'](token).catch(e=>e);await started;const file=h.nativeCalls.find(c=>c.command==='recordSystemStart').args.path;
 h.appEvents['before-quit']({preventDefault(){}});await assert.rejects(h.actions['start-system-audio'](token),/already starting|matching note/);startResolve({});assert.equal((await start).name,'AbortError');await new Promise(r=>setImmediate(r));assert.equal(fs.existsSync(file),false);assert.deepEqual(h.nativeCalls.filter(c=>['recordSystemStop','close'].includes(c.command)).map(c=>c.command),['recordSystemStop','close']);assert.deepEqual(h.exits,[]);
 nativeResolve({exited:true});await new Promise(r=>setImmediate(r));assert.deepEqual(h.exits,[]);aiResolve({});await waitUntil(()=>h.exits.length);assert.deepEqual(h.exits,[0]);
});
test('quit bounds hung native startup and removes partial capture only after confirmed helper exit', async t=>{
 let rejectStart,startSeen,closeResolve;const started=new Promise(r=>startSeen=r),closed=new Promise(r=>closeResolve=r);
 const h=harness(t,{nativeRequest:async(command,args)=>{if(command==='recordSystemStart'){fs.writeFileSync(args.path,'partial');startSeen();return new Promise((_r,j)=>rejectStart=j);}return {};},nativeClose:()=>{rejectStart(Error('Native bridge closed'));return closed;}});
 const token=await h.actions['start-recording']({mode:'note'});const start=h.actions['start-system-audio'](token).catch(e=>e);await started;const file=h.nativeCalls.find(c=>c.command==='recordSystemStart').args.path;h.appEvents['before-quit']({preventDefault(){}});
 await new Promise(r=>setTimeout(r,2050));assert.equal(fs.existsSync(file),true);assert.equal(h.nativeCalls.filter(c=>c.command==='recordSystemStop').length,0);assert.deepEqual(h.exits,[]);closeResolve({exited:true});await start;await waitUntil(()=>h.exits.length);assert.equal(fs.existsSync(file),false);assert.deepEqual(h.exits,[0]);
});

test('quit retains partial audio if helper exit cannot be confirmed', async t=>{
 let closes=0;const notices=[];const h=harness(t,{nativeRequest:async(command,args)=>{if(command==='recordSystemStart')fs.writeFileSync(args.path,'partial');if(command==='recordSystemStop')throw Error('Cannot confirm stop');return {};},nativeClose:async()=>({exited:++closes>1,forced:true})});h.initializeUtilityWindow({isDestroyed:()=>false,show(){},webContents:{send(_channel,payload){notices.push(payload);}}});
 const token=await h.actions['start-recording']({mode:'note'});await h.actions['start-system-audio'](token);const file=h.nativeCalls.find(c=>c.command==='recordSystemStart').args.path;h.appEvents['before-quit']({preventDefault(){}});await waitUntil(()=>notices.some(n=>n.event==='notice'));assert.equal(fs.existsSync(file),true);assert.deepEqual(h.exits,[]);assert.match(notices.find(n=>n.event==='notice').data.body,/could not confirm/);h.appEvents['before-quit']({preventDefault(){}});await waitUntil(()=>h.exits.length);assert.equal(fs.existsSync(file),false);assert.deepEqual(h.exits,[0]);assert.equal(closes,2);assert.equal(h.store.data.history.length,0);
});

test('unconfirmed app-owned AI shutdown refuses exit and retries confirmed shutdown', async t=>{
 let attempts=0;const notices=[];const h=harness(t,{closeAI:async()=>++attempts===1?{owned:true,stopped:false}:{owned:false,stopped:true}});h.initializeUtilityWindow({isDestroyed:()=>false,show(){},webContents:{send(_channel,payload){notices.push(payload);}}});
 h.appEvents['before-quit']({preventDefault(){}});await waitUntil(()=>notices.some(n=>n.event==='notice'));assert.deepEqual(h.exits,[]);h.appEvents['before-quit']({preventDefault(){}});await waitUntil(()=>h.exits.length);assert.deepEqual(h.exits,[0]);assert.match(notices.find(n=>n.event==='notice').data.body,/local AI/);
});

test("quit immediately tells renderer to release microphone even when helper exit is unconfirmed", async (t) => {
  const messages = [];
  const h = harness(t, { nativeClose: async () => ({ exited: false }) });
  h.initializeUtilityWindow({ isDestroyed: () => false, show() {}, webContents: { send(_channel, payload) { messages.push(payload); } } });
  h.appEvents["before-quit"]({ preventDefault() {} });
  assert.ok(messages.some(message => message.event === "recording-control" && message.data.action === "shutdown"));
  await waitUntil(() => messages.some(message => message.event === "notice"));
  assert.deepEqual(h.exits, []);
});
