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
