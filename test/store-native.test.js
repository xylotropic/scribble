"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { EventEmitter } = require("node:events"),
  { PassThrough } = require("node:stream");
const { Store } = require("../src/main/store"),
  { NativeBridge } = require("../src/main/native");
function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scribble-store-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return new Store(dir);
}
function helper(options = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => child.emit("exit", 0);
  const bridge = new NativeBridge("/fake", {
    exists: () => true,
    spawnProcess: () => child,
    ...options,
  });
  return { child, bridge };
}
test("workspaces have isolated defaults and preserve persisted edits", (t) => {
  const one = workspace(t),
    two = workspace(t);
  one.data.settings.hotkeys[0].mode = "command";
  assert.equal(two.data.settings.hotkeys[0].mode, "dictation");
  one.upsert("dictionary", { word: "Scribble", replacement: "Scribble" });
  const reopened = new Store(one.dir);
  assert.equal(reopened.data.dictionary[0].word, "Scribble");
  assert.equal(fs.statSync(one.file).mode & 0o777, 0o600);
});
test("invalid preference patches are atomic, including malformed hotkeys and inherited keys", (t) => {
  const store = workspace(t),
    before = fs.readFileSync(store.file, "utf8");
  assert.throws(
    () =>
      store.updateSettings({
        theme: "dark",
        hotkeys: [{ keyCode: 500, modifiers: [], mode: "dictation" }],
      }),
    /hotkey/,
  );
  assert.equal(store.data.settings.theme, "light");
  assert.equal(fs.readFileSync(store.file, "utf8"), before);
  assert.throws(
    () => store.updateSettings(JSON.parse('{"__proto__": {"x":1}}')),
    /Unknown preference/,
  );
  assert.throws(
    () => store.updateSettings({ dailyGoal: NaN }),
    /Invalid preference/,
  );
});
test("malformed restore leaves authoritative workspace unchanged", (t) => {
  const store = workspace(t);
  store.addHistory({ text: "retained" });
  assert.throws(
    () => store.restore({ ...store.data, notes: "invalid" }),
    /collection/,
  );
  assert.equal(store.data.history[0].text, "retained");
  assert.equal(new Store(store.dir).data.history[0].text, "retained");
});
test("restore merges defaults and ignores unrecognized top-level data", (t) => {
  const store = workspace(t);
  store.restore({
    version: 1,
    settings: { theme: "dark" },
    history: [],
    unexpected: "ignored",
  });
  assert.equal(store.data.settings.theme, "dark");
  assert.equal(store.data.settings.modelId, "base.en");
  assert.equal(store.data.unexpected, undefined);
});
test("native replies match requests and release pending resources", async () => {
  const { child, bridge } = helper();
  let wire = "";
  child.stdin.on("data", (b) => (wire += b));
  const pending = bridge.request("status", { id: "forged", command: "paste" });
  const request = JSON.parse(wire);
  assert.equal(request.command, "status");
  assert.equal(request.id, "1");
  child.stdout.write(
    JSON.stringify({
      id: request.id,
      ok: true,
      result: { accessibility: false },
    }) + "\n",
  );
  assert.deepEqual(await pending, { accessibility: false });
  assert.equal(bridge.pending.size, 0);
  bridge.close();
  child.emit("exit", 0);
});
test("native process and pipe errors reject requests without unhandled stream errors", async () => {
  const { child, bridge } = helper();
  const pending = bridge.request("status");
  const reject = assert.rejects(pending, /broken pipe/);
  child.stdin.emit("error", Error("broken pipe"));
  await reject;
  assert.equal(bridge.available, false);
  assert.equal(bridge.pending.size, 0);
  bridge.close();
  child.emit("exit", 0);
});
test("native close rejects outstanding requests and closes stdin for recording cleanup", async () => {
  const { child, bridge } = helper();
  const pending = bridge.request("recordSystemStop");
  const rejection = assert.rejects(pending, /closed/);
  bridge.close();
  await rejection;
  assert.equal(child.stdin.writableEnded, true);
  assert.equal(bridge.pending.size, 0);
  await assert.rejects(bridge.request("status"), /unavailable/);
  child.emit("exit", 0);
});
test("native request timeout releases pending map", async () => {
  const { child, bridge } = helper({ timeoutMs: 5 });
  await assert.rejects(bridge.request("status"), /timed out/);
  assert.equal(bridge.pending.size, 0);
  bridge.close();
  child.emit("exit", 0);
});

test("lifetime activity survives deleted history and legacy workspace migration", (t) => {
  const store = workspace(t);
  store.recordActivity("one two three", 4, "2026-10-07T12:00:00");
  const row = store.addHistory({ text: "one two three" });
  store.remove("history", row.id);
  assert.equal(new Store(store.dir).data.activity.recordings, 1);
  assert.equal(store.data.activity.days["2026-10-07"].words, 3);
  store.restore({
    version: 1,
    settings: {},
    history: [
      { text: "legacy words", duration: 2, createdAt: "2026-10-06T12:00:00" },
    ],
  });
  assert.equal(store.data.activity.recordings, 1);
  assert.equal(store.data.activity.days["2026-10-06"].words, 2);
  assert.throws(
    () =>
      store.restore({
        ...store.data,
        activity: { recordings: 1, days: { bad: { words: 2, duration: 0 } } },
      }),
    /activity/,
  );
});
test("equivalent duplicate shortcut chords cannot be saved", (t) => {
  const store = workspace(t);
  const previous = JSON.stringify(store.data.settings);
  assert.throws(
    () =>
      store.updateSettings({
        hotkeys: [
          { keyCode: 49, modifiers: ["alt", "ctrl"], mode: "command" },
          { keyCode: 49, modifiers: ["control", "option"], mode: "dictation" },
        ],
      }),
    /Duplicate/,
  );
  assert.equal(JSON.stringify(store.data.settings), previous);
});

test("auxiliary bindings persist while primary mouse sentinel codes are rejected", (t) => {
  const store = workspace(t);
  const binding = { keyCode: 130, modifiers: [], mode: 'dictation', toggle: true };
  store.updateSettings({ hotkeys: [binding] });
  assert.deepEqual(new Store(path.dirname(store.file)).data.settings.hotkeys, [binding]);
  for (const keyCode of [128, 129, 160, 130.5]) {
    assert.throws(() => store.updateSettings({ hotkeys: [{ ...binding, keyCode }] }), /hotkey/);
    assert.deepEqual(store.data.settings.hotkeys, [binding]);
  }
});

test('left and right modifier bindings remain distinct and survive persistence', t => {
 const store=workspace(t), bindings=['left-option','right-option'].map(modifier=>({keyCode:49,modifiers:[modifier],mode:'dictation'}));
 store.updateSettings({hotkeys:bindings});
 assert.deepEqual(new Store(path.dirname(store.file)).data.settings.hotkeys,bindings);
 assert.throws(()=>store.updateSettings({hotkeys:[{...bindings[0],modifiers:['left-fn']}]}),/hotkey/);
});

test("summary provider settings persist independently and reject invalid routes atomically", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scribble-summary-store-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  assert.equal(store.data.settings.summaryProvider, "configured-ai");
  store.updateSettings({
    summaryProvider: "claude-cli",
    summaryModel: "sonnet",
  });
  assert.equal(new Store(dir).data.settings.summaryProvider, "claude-cli");
  const original = structuredClone(store.data.settings);
  assert.throws(
    () =>
      store.updateSettings({
        summaryProvider: "codex-cli",
        aiProvider: "openai",
      }),
    /summary provider/,
  );
  assert.deepEqual(store.data.settings, original);
  assert.throws(
    () => store.updateSettings({ summaryModel: "bad model;" }),
    /summary model/,
  );
});

test("fresh onboarding stays incomplete across restarts until explicitly completed", (t) => {
  const store = workspace(t);
  assert.equal(store.data.settings.onboardingCompleted, false);
  assert.equal(new Store(store.dir).data.settings.onboardingCompleted, false);
  store.updateSettings({ onboardingCompleted: true });
  assert.equal(new Store(store.dir).data.settings.onboardingCompleted, true);
  store.updateSettings({ onboardingCompleted: false });
  assert.equal(new Store(store.dir).data.settings.onboardingCompleted, false);
});
test("legacy saved workspace skips onboarding without changing existing preferences", (t) => {
  const store = workspace(t);
  store.updateSettings({ name: "Existing user", language: "ja" });
  const legacy = JSON.parse(fs.readFileSync(store.file, "utf8"));
  delete legacy.settings.onboardingCompleted;
  fs.writeFileSync(store.file, JSON.stringify(legacy));
  const migrated = new Store(store.dir);
  assert.equal(migrated.data.settings.onboardingCompleted, true);
  assert.equal(migrated.data.settings.name, "Existing user");
  assert.equal(migrated.data.settings.language, "ja");
  assert.equal(JSON.parse(fs.readFileSync(store.file, "utf8")).settings.onboardingCompleted, true);
});
test("legacy backup migration preserves explicit completion flags and rejects invalid values atomically", (t) => {
  const store = workspace(t);
  const legacy = structuredClone(store.data);
  delete legacy.settings.onboardingCompleted;
  store.restore(legacy);
  assert.equal(store.data.settings.onboardingCompleted, true);
  legacy.settings.onboardingCompleted = false;
  store.restore(legacy);
  assert.equal(store.data.settings.onboardingCompleted, false);
  for (const value of ["true", 1, null, {}]) {
    const before = structuredClone(store.data);
    assert.throws(() => store.updateSettings({ onboardingCompleted: value }), /Invalid preference/);
    assert.deepEqual(store.data, before);
    assert.throws(() => store.restore({ ...legacy, settings: { ...legacy.settings, onboardingCompleted: value } }), /Invalid preference/);
    assert.deepEqual(store.data, before);
  }
});
test('custom voice shortcuts may override a built-in canonical phrase but reject another custom duplicate',t=>{const store=workspace(t);const builtin=store.data.shortcuts.find(x=>x.trigger==='google');assert.ok(builtin.builtin);const custom=store.upsert('shortcuts',{trigger:'google',name:'Custom Google',target:'https://example.com',type:'url'});assert.equal(custom.builtin,undefined);assert.throws(()=>store.upsert('shortcuts',{trigger:'  GOOGLE  ',target:'https://example.org',type:'url'}),/already exists/);store.upsert('shortcuts',{id:builtin.id,enabled:false});assert.equal(store.data.shortcuts.find(x=>x.id===builtin.id).enabled,false);assert.ok(store.data.shortcuts.some(x=>x.id===custom.id));});


test('multi-action shortcut validation persists ordered actions and rejects invalid save or backup atomically',t=>{
 const store=workspace(t);const actions=[{type:'websites',urls:['example.com?q={{text}}','https://example.org'],profile:'Profile 2'},{type:'application',name:'TextEdit',folder:'/tmp/project'},{type:'folders',paths:['~/Downloads','/Applications']}];
 const saved=store.upsert('shortcuts',{trigger:'standup',aliases:['stand up'],actions});
 assert.deepEqual(new Store(store.dir).data.shortcuts.find(x=>x.id===saved.id).actions,actions);
 const before=structuredClone(store.data);
 assert.throws(()=>store.upsert('shortcuts',{id:saved.id,actions:[{type:'websites',urls:['javascript:alert(1)']}]}),/valid/);assert.deepEqual(store.data,before);
 const invalid=structuredClone(store.data);invalid.shortcuts.find(x=>x.id===saved.id).actions=[{type:'folders',paths:['relative']}];assert.throws(()=>store.restore(invalid),/valid/);assert.deepEqual(store.data,before);
});

test("AI utility presets and disabled bindings persist without altering global AI", (t) => {
  const store = workspace(t);
  const utility = { id: "grammar-test", name: "Fix grammar", preset: "grammar", source: "selection", enabled: false };
  const binding = { keyCode: 2, modifiers: ["command", "shift"], mode: "utility", utilityId: utility.id };
  store.updateSettings({ aiUtilities: [utility], hotkeys: [...store.data.settings.hotkeys, binding] });
  const saved = new Store(store.dir);
  assert.deepEqual(saved.data.settings.aiUtilities, [utility]);
  assert.equal(saved.data.settings.hotkeys.at(-1).utilityId, utility.id);
  assert.equal(saved.data.settings.aiProvider, "ollama");
  assert.throws(() => store.updateSettings({ aiUtilities: [] }), /existing utility/);
  store.updateSettings({ aiUtilities: [], hotkeys: store.data.settings.hotkeys.filter(item => item.mode !== "utility") });
  assert.deepEqual(store.data.settings.aiUtilities, []);
});
test("AI utility invalid presets, source, IDs and executable fields fail atomically", (t) => {
  const store = workspace(t);
  const utility = { id: "one", name: "Polish", preset: "polish", source: "clipboard", enabled: true };
  for (const patch of [{ preset: "script" }, { source: "screen" }, { id: "bad id" }, { enabled: 1 }, { name: " " }, { prompt: "arbitrary" }, { script: "execute" }]) {
    const before = structuredClone(store.data);
    assert.throws(() => store.updateSettings({ aiUtilities: [{ ...utility, ...patch }] }), /Invalid AI utility/);
    assert.deepEqual(store.data, before);
  }
  assert.throws(() => store.updateSettings({ aiUtilities: [utility, utility] }), /Invalid AI utility/);
  assert.throws(() => store.updateSettings({ aiUtilities: Array.from({ length: 33 }, (_, i) => ({ ...utility, id: "u" + i })) }), /at most 32/);
});
test("utility bindings enforce references, physical chords and global conflicts", (t) => {
  const store = workspace(t);
  const utility = { id: "one", name: "Summarize", preset: "summary", source: "selection", enabled: true };
  store.updateSettings({ aiUtilities: [utility] });
  const binding = { keyCode: 2, modifiers: ["command"], mode: "utility", utilityId: "one" };
  for (const patch of [{ utilityId: "missing" }, { keyCode: -1 }, { keyCode: 130 }, { keyCode: 55 }, { modifiers: [] }, { prompt: "run" }])
    assert.throws(() => store.updateSettings({ hotkeys: [binding, { ...binding, keyCode: 3, ...patch }] }));
  const existing = store.data.settings.hotkeys[0];
  assert.throws(() => store.updateSettings({ hotkeys: [...store.data.settings.hotkeys, { ...binding, keyCode: existing.keyCode, modifiers: ["alt"] }] }), /Duplicate hotkey/);
  const invalidBackup = structuredClone(store.data);
  invalidBackup.settings.hotkeys = [binding];
  invalidBackup.settings.aiUtilities = [];
  const before = structuredClone(store.data);
  assert.throws(() => store.restore(invalidBackup), /existing utility/);
  assert.deepEqual(store.data, before);
  const validBackup = structuredClone(before);
  validBackup.settings.hotkeys = [binding];
  store.restore(validBackup);
  assert.equal(new Store(store.dir).data.settings.hotkeys[0].utilityId, "one");
});

test("cloud silence preferences are opt-in, bounded, atomic, and persisted", (t) => {
  const store = workspace(t);
  assert.equal(store.data.settings.enhancedSilenceDetection, false);
  assert.equal(store.data.settings.silenceSensitivity, 2);
  store.updateSettings({ enhancedSilenceDetection: true, silenceSensitivity: 3.7 });
  assert.equal(new Store(store.dir).data.settings.silenceSensitivity, 3.7);
  for (const value of [0, 5.1, NaN, Infinity, "2"])
    assert.throws(() => store.updateSettings({ enhancedSilenceDetection: false, silenceSensitivity: value }));
  assert.equal(store.data.settings.enhancedSilenceDetection, true);
  assert.equal(store.data.settings.silenceSensitivity, 3.7);
  store.updateSettings({ enhancedSilenceDetection: false });
  assert.equal(new Store(store.dir).data.settings.silenceSensitivity, 3.7);
});

test("existing local clipboard opt-in does not enable external dictation history", (t) => {
  const store = workspace(t);
  store.updateSettings({ clipboardHistory: true });
  const existing = JSON.parse(fs.readFileSync(store.file, "utf8"));
  delete existing.settings.allowDictationsInClipboardHistory;
  fs.writeFileSync(store.file, JSON.stringify(existing));
  const reopened = new Store(store.dir);
  assert.equal(reopened.data.settings.clipboardHistory, true);
  assert.equal(reopened.data.settings.allowDictationsInClipboardHistory, false);
  assert.throws(() => reopened.updateSettings({ allowDictationsInClipboardHistory: "true" }));
});

test('meeting microphone priority preserves inherited null and explicit empty/own overrides across persistence',t=>{
 const store=workspace(t);assert.equal(store.data.settings.meetingMicrophonePriority,null);
 for(const priority of [[],['usb','default'],null]){store.updateSettings({meetingMicrophonePriority:priority});const restored=new Store(store.dir);assert.deepEqual(restored.data.settings.meetingMicrophonePriority,priority);}
 for(const priority of [undefined,'usb',{},[''],['usb','usb'],['a'.repeat(513)]])assert.throws(()=>store.updateSettings({meetingMicrophonePriority:priority}),/microphone priority/);
 assert.equal(store.data.settings.meetingMicrophonePriority,null);
});

test('legacy workspace missing meeting priority restores inherited default rather than copying global',t=>{
 const store=workspace(t);const legacy=JSON.parse(JSON.stringify(store.data));delete legacy.settings.meetingMicrophonePriority;legacy.settings.microphonePriority=['usb'];
 store.restore(legacy);assert.equal(store.data.settings.meetingMicrophonePriority,null);
 store.updateSettings({microphonePriority:['headset']});assert.equal(store.data.settings.meetingMicrophonePriority,null);
 const invalid=JSON.parse(JSON.stringify(store.data));invalid.settings.meetingMicrophonePriority=['usb','usb'];assert.throws(()=>store.restore(invalid),/microphone priority/);assert.deepEqual(store.data.settings.microphonePriority,['headset']);
});

test('native close awaits confirmed exit, is idempotent, and rejects pending requests', async () => {
 const {child,bridge}=helper({closeTimeoutMs:100});const request=assert.rejects(bridge.request('recordSystemStart'),/closed/);
 const closing=bridge.close();assert.equal(bridge.close(),closing);let done=false;closing.then(()=>done=true);await request;assert.equal(done,false);assert.equal(child.stdin.writableEnded,true);
 child.emit('exit',0,null);assert.deepEqual(await closing,{exited:true,forced:false,code:0,signal:null});assert.equal(bridge.pending.size,0);
});
test('native shutdown escalates to SIGKILL and reports unconfirmed exit honestly', async () => {
 const {child,bridge}=helper({closeTimeoutMs:5,killGraceMs:5});let signal;child.kill=s=>{signal=s;return true;};const result=await bridge.close();assert.equal(signal,'SIGKILL');assert.equal(result.exited,false);assert.equal(result.reason,'exit-not-confirmed');child.emit('exit',null,'SIGKILL');
});
test('native close waits for real child EOF cleanup and confirms forced real child exit', async () => {
 const {spawn}=require('node:child_process');
 const graceful=new NativeBridge('/fake',{exists:()=>true,spawnProcess:()=>spawn(process.execPath,['-e',"process.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>process.exit(0),30))"]),closeTimeoutMs:1000});
 const result=await graceful.close();assert.equal(result.exited,true);assert.equal(result.forced,false);assert.equal(result.code,0);
 const stubborn=new NativeBridge('/fake',{exists:()=>true,spawnProcess:()=>spawn(process.execPath,['-e',"process.stdin.resume();setInterval(()=>{},1000)"]),closeTimeoutMs:50,killGraceMs:1000});
 const forced=await stubborn.close();assert.equal(forced.exited,true);assert.equal(forced.forced,true);assert.equal(forced.signal,'SIGKILL');
});

test('unconfirmed native close can retry while pending close stays idempotent', async()=>{
 const {child,bridge}=helper({closeTimeoutMs:5,killGraceMs:5});let attempts=0;child.kill=signal=>{attempts++;if(attempts===2)child.emit('exit',null,signal);return true;};
 const first=bridge.close();assert.equal(first,bridge.close());assert.equal((await first).exited,false);const second=bridge.close();assert.notEqual(first,second);assert.equal(second,bridge.close());assert.equal((await second).exited,true);assert.equal(attempts,2);
});
test('meeting priority persists all33 copied global-plus-legacy candidates while global limit stays32',t=>{
 const store=workspace(t),global=Array.from({length:32},(_,i)=>'device-'+i),chain=[...global,'legacy'];
 store.updateSettings({microphonePriority:global,microphoneId:'legacy',meetingMicrophonePriority:chain});
 const restored=new Store(store.dir);assert.deepEqual(restored.data.settings.meetingMicrophonePriority,chain);
 const {captureCandidates}=require('../src/shared/microphone-preferences');assert.deepEqual(captureCandidates(restored.data.settings,'meeting'),captureCandidates(restored.data.settings));
 assert.throws(()=>store.updateSettings({microphonePriority:chain}),/priority/);assert.throws(()=>store.updateSettings({meetingMicrophonePriority:[...chain,'extra']}),/priority/);
 assert.deepEqual(store.data.settings.meetingMicrophonePriority,chain);
});

test('ranked microphone labels survive relaunch and legacy stores migrate without inventing names',t=>{
 const store=workspace(t);store.updateSettings({microphonePriority:['usb'],meetingMicrophonePriority:['headset'],microphoneLabels:[{id:'usb',name:'Studio microphone'},{id:'headset',name:'AirPods'},{id:'default',name:'Old automatic name'},{id:'unranked',name:'Discard'}]});
 assert.deepEqual(new Store(store.dir).data.settings.microphoneLabels,[{id:'usb',name:'Studio microphone'},{id:'headset',name:'AirPods'}]);
 const legacy=JSON.parse(fs.readFileSync(store.file,'utf8'));delete legacy.settings.microphoneLabels;fs.writeFileSync(store.file,JSON.stringify(legacy));assert.deepEqual(new Store(store.dir).data.settings.microphoneLabels,[]);
});
test('microphone labels validate atomically and remain only while referenced by either ranking',t=>{
 const store=workspace(t);store.updateSettings({microphonePriority:['usb'],meetingMicrophonePriority:['usb'],microphoneLabels:[{id:'usb',name:' USB <Mic> '}]});assert.equal(store.data.settings.microphoneLabels[0].name,'USB <Mic>');
 for(const labels of [null,{},[{id:'usb',name:''}],[{id:'usb',name:'a\nb'}],[{id:'usb',name:'a'.repeat(201)}],[{id:'x'.repeat(513),name:'Mic'}],[{id:'usb',name:'a'},{id:'usb',name:'b'}],[{id:'usb',name:'a',groupId:'private'}],Array.from({length:129},(_,i)=>({id:String(i),name:'Mic'}))]) {
 const before=fs.readFileSync(store.file,'utf8');assert.throws(()=>store.updateSettings({microphoneLabels:labels}),/microphone labels/);assert.equal(fs.readFileSync(store.file,'utf8'),before);
 const backup=structuredClone(store.data);backup.settings.microphoneLabels=labels;assert.throws(()=>store.restore(backup),/microphone labels/);assert.equal(fs.readFileSync(store.file,'utf8'),before);
 }
 store.updateSettings({microphonePriority:[]});assert.equal(store.data.settings.microphoneLabels.length,1);store.updateSettings({meetingMicrophonePriority:null});assert.deepEqual(store.data.settings.microphoneLabels,[]);
});
test('Command Mode preferences default privately, require booleans and persist independent opt-ins',t=>{const store=workspace(t);assert.equal(store.data.settings.commandEnabled,true);assert.equal(store.data.settings.commandScreenContext,false);assert.equal(store.data.settings.commandDragRegions,false);store.updateSettings({commandScreenContext:true,commandDragRegions:true,commandEnabled:false});const reopened=new Store(store.dir);assert.equal(reopened.data.settings.commandEnabled,false);assert.equal(reopened.data.settings.commandScreenContext,true);assert.equal(reopened.data.settings.commandDragRegions,true);assert.equal(store.data.settings.commandScreenContext,true);assert.equal(store.data.settings.commandDragRegions,true);for(const key of ['commandEnabled','commandScreenContext','commandDragRegions'])for(const value of [1,0,'true','false',null,[],{}])assert.throws(()=>store.updateSettings({[key]:value}),/Invalid preference/);assert.equal(store.data.settings.commandEnabled,false);});
