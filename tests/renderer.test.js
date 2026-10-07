"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch {
  if (process.env.SCRIBBLE_JSDOM_PATH)
    ({ JSDOM } = require(process.env.SCRIBBLE_JSDOM_PATH));
}
const { SETTINGS } = require("../src/main/store");
const wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  flush = () => wait(15),
  clone = (x) => JSON.parse(JSON.stringify(x));
async function fixture(
  t,
  { notes = [], mediaPromise, commandFiles, screens = [], setupPermissions = {microphoneStatus:"not-determined",accessibility:false} } = {},
) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "../src/renderer/index.html"), "utf8"),
    {
      url: "http://localhost/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  t.after(() => dom.window.close());
  let now = 10000;
  dom.window.Date.now = () => now;
  const w = dom.window,
    calls = [],
    tracks = [
      {
        enabled: true,
        stops: 0,
        stop() {
          this.stops++;
        },
      },
    ],
    recorders = [];
  const data = {
    settings: { ...clone(SETTINGS), sounds: false },
    history: [],
    notes: clone(notes),
    dictionary: [],
    threads: [],
    expansions: [],
    shortcuts: [],
    tones: [],
    memory: [],
    timers: [],
    clipboard: [],
    models: [
      {
        id: "base.en",
        name: "Base English",
        bytes: 148000000,
        englishOnly: true,
        installed: false,
      },
    ],
    speechStatus: { ready: true, runtime: "/fake" },
    stats: {},
    version: "0.1.0",
    platform: "darwin",
    dataDir: "/tmp/scribble",
  };
  let callback, downloadResolve;
  const emit = (event, value) => callback({ event, data: clone(value) });
  w.scribble = {
    on(fn) {
      callback = fn;
    },
    filePath: (f) => f.path,
    async request(action, args = {}) {
      calls.push({ action, args });
      if (action === "state") return clone(data);
      if (action === "permissions") return clone(setupPermissions);
      if (action === "preferences") {
        Object.assign(data.settings, args);
        emit("state", data);
        return clone(data);
      }
      if (action === "save-item") {
        const list = data[args.kind],
          item = { ...args.item },
          i = list.findIndex((x) => x.id === item.id);
        if (i < 0) {
          item.id = "saved-" + calls.length;
          list.push(item);
        } else list[i] = item;
        emit("state", data);
        return clone(item);
      }
      if (action === "delete-item") {
        data[args.kind] = data[args.kind].filter((x) => x.id !== args.id);
        emit("state", data);
        return true;
      }
      if (action === "screen-context") return clone(screens);
      if (action === "crop-screen-context")
        return {
          mimeType: "image/png",
          data: "Y3JvcA==",
          width: 50,
          height: 50,
        };
      if (action === "choose-command-files")
        return clone(commandFiles || { text: "", images: [], sources: [] });
      if (action === "command") return { kind: "text", text: "fixture answer" };
      if (action === "models") return clone(data.models);
      if (action === "summary-cli-status") return { available:false, reason:"Claude CLI is not installed" };
      if (action === "download-model")
        return new Promise((resolve) => {
          downloadResolve = () => {
            data.models[0].installed = true;
            resolve(data.models[0]);
          };
        });
      if (action === "start-recording") {
        emit("recording-control", { action: "start", mode: args.mode });
        return true;
      }
      if (action === "cancel-recording") {
        emit("recording-control", { action: "cancel" });
        return true;
      }
      if (action === "save-recording")
        return { id: "recorded", text: "captured" };
      return true;
    },
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.Blob = global.Blob;
  Object.defineProperty(w.navigator, "mediaDevices", {
    value: {
      getUserMedia: async () =>
        mediaPromise
          ? await mediaPromise
          : { getTracks: () => tracks, getAudioTracks: () => tracks },
      enumerateDevices: async () => [],
    },
  });
  w.MediaRecorder = class {
    static isTypeSupported() {
      return true;
    }
    constructor() {
      this.state = "inactive";
      recorders.push(this);
    }
    start() {
      this.state = "recording";
    }
    pause() {
      this.state = "paused";
    }
    resume() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["voice"]) });
      this.onstop?.();
    }
  };
  w.eval(fs.readFileSync(path.join(__dirname, "../src/shared/i18n.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(__dirname, "../src/shared/form-translations.js"), "utf8"));
  w.eval(
    fs.readFileSync(path.join(__dirname, "../src/renderer/app.js"), "utf8"),
  );
  await flush();
  const click = async (selector) => {
    const element = w.document.querySelector(selector);
    assert.ok(element, `Missing ${selector}`);
    element.click();
    await flush();
  };
  const input = (selector, value) => {
    const element = w.document.querySelector(selector);
    assert.ok(element, `Missing ${selector}`);
    element.value = value;
    element.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  const submit = async () => {
    w.document
      .querySelector("#modal form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await flush();
  };
  return {
    dom,
    w,
    data,
    calls,
    tracks,
    recorders,
    emit,
    click,
    input,
    submit,
    advance: (ms) => {
      now += ms;
    },
    finishDownload: () => downloadResolve(),
  };
}
const options = { skip: !JSDOM };
test(
  "Dictionary add form converts aliases and persists the word",
  options,
  async (t) => {
    const h = await fixture(t);
    await h.click('[data-page="dictionary"]');
    await h.click('[data-action="add-item"][data-kind="dictionary"]');
    h.input('[name="word"]', "Scribble");
    h.input('[name="aliases"]', "scribal, scrabble");
    await h.submit();
    const call = h.calls.find((x) => x.action === "save-item");
    assert.equal(call.args.kind, "dictionary");
    assert.deepEqual(clone(call.args.item.aliases), ["scribal", "scrabble"]);
    assert.equal(call.args.item.word, "Scribble");
    assert.equal(h.w.document.querySelector("#modal").open, false);
    assert.match(
      h.w.document.querySelector("#content").textContent,
      /Scribble/,
    );
  },
);
test("Canceling a modal performs no save", options, async (t) => {
  const h = await fixture(t);
  await h.click('[data-page="dictionary"]');
  await h.click('[data-action="add-item"][data-kind="dictionary"]');
  h.input('[name="word"]', "Must not save");
  await h.click('#modal [data-action="close-modal"]');
  assert.equal(h.calls.filter((x) => x.action === "save-item").length, 0);
  assert.equal(h.w.document.querySelector("#modal").open, false);
});
test(
  "Settings checkbox persists false without string coercion",
  options,
  async (t) => {
    const h = await fixture(t);
    await h.click('[data-page="settings"]');
    const element = h.w.document.querySelector('[data-setting="autoEnter"]');
    element.checked = true;
    element.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await flush();
    assert.equal(h.data.settings.autoEnter, true);
    const again = h.w.document.querySelector('[data-setting="autoEnter"]');
    again.checked = false;
    again.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await flush();
    assert.equal(h.data.settings.autoEnter, false);
    assert.equal(
      h.calls.filter((x) => x.action === "preferences").at(-1).args.autoEnter,
      false,
    );
  },
);
test(
  "Model download displays progress and refreshes installed state",
  options,
  async (t) => {
    const h = await fixture(t);
    await h.click('[data-page="models"]');
    await h.click('[data-action="download-model"]');
    h.emit("model-download", { id: "base.en", progress: 0.62 });
    await flush();
    assert.equal(
      h.w.document.querySelector('[data-progress="base.en"]').style.width,
      "62%",
    );
    h.finishDownload();
    await flush();
    assert.ok(h.w.document.querySelector('[data-action="use-model"]'));
    assert.equal(
      h.w.document.querySelector('[data-action="download-model"]'),
      null,
    );
  },
);
test(
  "Note edits debounce the latest text into the corresponding note field",
  options,
  async (t) => {
    const h = await fixture(t, {
      notes: [
        {
          id: "n1",
          title: "Planning",
          summary: "Old",
          transcript: "Original",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    await h.click('[data-page="notes"]');
    h.input("#note-editor", "First");
    h.input("#note-editor", "Final decisions");
    await wait(550);
    assert.equal(h.data.notes[0].summary, "Final decisions");
    assert.equal(h.calls.filter((x) => x.action === "save-item").length, 1);
  },
);
test(
  "Recording start/pause/resume/stop saves bytes and stops tracks",
  options,
  async (t) => {
    const h = await fixture(t);
    await h.click('[data-action="record"]');
    assert.equal(h.recorders[0].state, "recording");
    await h.click('[data-action="pause-record"]');
    assert.equal(h.recorders[0].state, "paused");
    await h.click('[data-action="pause-record"]');
    assert.equal(h.recorders[0].state, "recording");
    await h.click('[data-action="stop-record"]');
    await flush();
    const call = h.calls.find((x) => x.action === "save-recording");
    assert.ok(call.args.bytes.byteLength > 0);
    assert.equal(call.args.mode, "dictation");
    assert.equal(h.tracks[0].stops, 1);
    assert.equal(h.w.document.querySelector("#record-bar").hidden, true);
  },
);
test(
  "Recording cancel stops tracks without saving audio",
  options,
  async (t) => {
    const h = await fixture(t);
    await h.click('[data-action="record"]');
    await h.click('[data-action="cancel-record"]');
    assert.equal(h.recorders[0].state, "inactive");
    assert.equal(h.tracks[0].stops, 1);
    assert.equal(
      h.calls.filter((x) => x.action === "save-recording").length,
      0,
    );
  },
);
test(
  "Edits on two notes within one debounce interval both persist",
  options,
  async (t) => {
    const h = await fixture(t, {
      notes: [
        {
          id: "n1",
          title: "First",
          summary: "Old first",
          createdAt: new Date().toISOString(),
        },
        {
          id: "n2",
          title: "Second",
          summary: "Old second",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    await h.click('[data-page="notes"]');
    h.input("#note-editor", "New first");
    await h.click('[data-action="select-note"][data-id="n2"]');
    h.input("#note-editor", "New second");
    await wait(550);
    assert.equal(h.data.notes.find((x) => x.id === "n1").summary, "New first");
    assert.equal(h.data.notes.find((x) => x.id === "n2").summary, "New second");
  },
);
test(
  "Cancel during microphone permission wait never starts recording afterward",
  options,
  async (t) => {
    let resolve;
    const promise = new Promise((r) => (resolve = r)),
      track = {
        enabled: true,
        stops: 0,
        stop() {
          this.stops++;
        },
      };
    const h = await fixture(t, { mediaPromise: promise });
    await h.click('[data-action="record"]');
    h.emit("recording-control", { action: "cancel" });
    resolve({ getTracks: () => [track], getAudioTracks: () => [track] });
    await flush();
    assert.equal(h.recorders.length, 0);
    assert.equal(track.stops, 1);
    assert.equal(
      h.calls.filter((x) => x.action === "recording-started").length,
      0,
    );
  },
);
test(
  "Rapid edits across summary and transcript keep both pending fields",
  options,
  async (t) => {
    const h = await fixture(t, {
      notes: [
        {
          id: "n1",
          title: "Planning",
          summary: "Old summary",
          transcript: "Old transcript",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    await h.click('[data-page="notes"]');
    h.input("#note-editor", "New summary");
    await h.click('[data-action="note-tab"][data-tab="transcript"]');
    h.input("#note-editor", "New transcript");
    await wait(550);
    assert.equal(h.data.notes[0].summary, "New summary");
    assert.equal(h.data.notes[0].transcript, "New transcript");
  },
);
test(
  "Meeting pause freezes media time, excludes gaps from flags, and resets next recording",
  options,
  async (t) => {
    const h = await fixture(t);
    await h.click('[data-page="notes"]');
    await h.click('[data-action="new-note"]');
    h.w.document.querySelector('[name="systemAudio"]').checked = true;
    await h.submit();
    h.advance(5000);
    await h.click('[data-action="pause-record"]');
    assert.equal(
      h.w.document.querySelector(".record-time").textContent,
      "0:05",
    );
    h.advance(10000);
    await h.click('[data-action="flag-record"]');
    await h.click('[data-action="pause-record"]');
    assert.equal(
      h.w.document.querySelector(".record-time").textContent,
      "0:05",
    );
    h.advance(2000);
    await h.click('[data-action="flag-record"]');
    await h.click('[data-action="stop-record"]');
    await flush();
    const saved = h.calls.find((x) => x.action === "save-recording");
    assert.deepEqual(clone(saved.args.flags.map((x) => x.time)), [5, 7]);
    assert.equal(
      h.calls.filter((x) => x.action === "pause-system-audio").length,
      1,
    );
    assert.equal(
      h.calls.filter((x) => x.action === "resume-system-audio").length,
      1,
    );
    await h.click('[data-action="record"]');
    assert.equal(
      h.w.document.querySelector(".record-time").textContent,
      "0:00",
    );
  },
);
test(
  "Deleting a note before its debounce fires never resurrects it",
  options,
  async (t) => {
    const h = await fixture(t, {
      notes: [
        {
          id: "n1",
          title: "Temporary",
          summary: "Old",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    await h.click('[data-page="notes"]');
    h.input("#note-editor", "Unsaved edit");
    await h.click('[data-action="delete"][data-kind="notes"]');
    await h.submit();
    await wait(550);
    assert.equal(h.data.notes.length, 0);
    assert.equal(h.calls.filter((x) => x.action === "save-item").length, 0);
  },
);
test(
  "Chosen command files preserve the draft and reach the model request",
  options,
  async (t) => {
    const files = {
      text: "Project Cedar due October 14.",
      images: [{ mimeType: "image/png", data: "YQ==" }],
      sources: [{ name: "cedar.txt" }],
    };
    const h = await fixture(t, { commandFiles: files });
    await h.click('[data-page="command"]');
    h.input("#command-text", "Summarize the selected files");
    h.input('[name="command-context"]', "Keep the owner explicit.");
    await h.click('[data-action="command-files"]');
    assert.equal(
      h.w.document.querySelector("#command-text").value,
      "Summarize the selected files",
    );
    assert.equal(
      h.w.document.querySelector('[name="command-context"]').value,
      "Keep the owner explicit.",
    );
    await h.click('[data-action="run-command"]');
    const call = h.calls.find((c) => c.action === "command");
    assert.deepEqual(clone(call.args.attachments), files);
    assert.equal(call.args.context, "Keep the owner explicit.");
  },
);

test(
  "Screen context attaches only the explicitly selected preview",
  options,
  async (t) => {
    const h = await fixture(t, {
      screens: [
        {
          id: "screen:0",
          name: "First display",
          image: "data:image/png;base64,YQ==",
        },
        {
          id: "screen:1",
          name: "Second display",
          image: "data:image/png;base64,Yg==",
        },
      ],
    });
    await h.click('[data-page="command"]');
    h.input("#command-text", "Describe this screen");
    await h.click('[data-action="command-screen"]');
    assert.equal(h.calls.filter((c) => c.action === "command").length, 0);
    h.w.document.querySelector('[name="screenIndex"]').value = "1";
    await h.submit();
    assert.equal(
      h.w.document.querySelector("#command-text").value,
      "Describe this screen",
    );
    await h.click('[data-action="run-command"]');
    const call = h.calls.find((c) => c.action === "command");
    assert.deepEqual(clone(call.args.attachments.images), [
      { mimeType: "image/png", data: "Yg==" },
    ]);
    assert.equal(
      call.args.attachments.sources[0].name,
      "Second display (screen preview)",
    );
  },
);

test(
  "Typed expansions preserve rich formatting and variables through editing",
  options,
  async (t) => {
    const h = await fixture(t);
    await h.click('[data-page="dictionary"]');
    await h.click('[data-action="dictionary-tab"][data-tab="expansions"]');
    await h.click('[data-action="add-item"][data-kind="expansions"]');
    h.input('[name="trigger"]', ":intro");
    const editor = h.w.document.querySelector("#rich-editor");
    editor.innerHTML = "<p><strong>Hello</strong> {date}</p>";
    await h.submit();
    const saved = h.calls.find((c) => c.action === "save-item");
    assert.equal(saved.args.kind, "expansions");
    assert.match(saved.args.item.html, /<strong>Hello<\/strong>/);
    assert.match(saved.args.item.replacement, /Hello.*\{date\}/);
    await h.click('[data-action="edit-item"][data-kind="expansions"]');
    assert.match(
      h.w.document.querySelector("#rich-editor").innerHTML,
      /<strong>Hello<\/strong>/,
    );
  },
);

test(
  "Memory can be edited and disabled without losing its reference text",
  options,
  async (t) => {
    const h = await fixture(t);
    h.data.memory.push({
      id: "memo1",
      name: "Project",
      content: "Old deadline",
      enabled: true,
    });
    h.emit("state", h.data);
    await h.click('[data-page="memory"]');
    await h.click('[data-action="edit-item"][data-kind="memory"]');
    h.input('[name="content"]', "New deadline October 20");
    h.w.document.querySelector('[name="enabled"]').checked = false;
    await h.submit();
    const saved = h.calls.find((c) => c.action === "save-item");
    assert.equal(saved.args.item.content, "New deadline October 20");
    assert.equal(saved.args.item.enabled, false);
    assert.equal(h.data.memory[0].id, "memo1");
  },
);

test(
  "All history exposes entries beyond the first hundred",
  options,
  async (t) => {
    const h = await fixture(t);
    h.data.history = Array.from({ length: 205 }, (_, index) => ({
      id: `history-${index}`,
      text: `Recording number ${index}`,
      kind: "dictation",
      createdAt: "2026-10-07T12:00:00Z",
    }));
    h.emit("state", h.data);
    await h.click('[data-action="home-tab"][data-tab="history"]');
    assert.equal(
      h.w.document.querySelector(
        '[data-action="copy-history"][data-id="history-204"]',
      ),
      null,
    );
    await h.click('[data-action="history-more"]');
    await h.click('[data-action="history-more"]');
    assert.match(h.w.document.body.textContent, /Recording number 204/);
    assert.equal(
      h.w.document.querySelector('[data-action="history-more"]'),
      null,
    );
  },
);

test(
  "Microphone priorities fall through missing devices and stop at the first usable input",
  options,
  async (t) => {
    const h = await fixture(t);
    h.data.settings.microphonePriority = ["missing-input", "working-input"];
    h.emit("state", h.data);
    const requests = [];
    h.w.navigator.mediaDevices.getUserMedia = async (options) => {
      requests.push(options.audio.deviceId?.exact || "default");
      if (requests.length === 1) {
        const error = Error("Disconnected");
        error.name = "NotFoundError";
        throw error;
      }
      return { getTracks: () => h.tracks };
    };
    await h.click('[data-action="record"]');
    assert.deepEqual(requests, ["missing-input", "working-input"]);
    assert.equal(h.recorders.length, 1);
  },
);

test(
  "Cancelling a rejected microphone request prevents fallback acquisition",
  options,
  async (t) => {
    const h = await fixture(t);
    h.data.settings.microphonePriority = ["missing-input", "second-input"];
    h.emit("state", h.data);
    let rejectRequest;
    let requests = 0;
    h.w.navigator.mediaDevices.getUserMedia = async () => {
      requests++;
      return new Promise((_resolve, reject) => {
        rejectRequest = reject;
      });
    };
    await h.click('[data-action="record"]');
    h.emit("recording-control", { action: "cancel" });
    const error = Error("Disconnected");
    error.name = "NotFoundError";
    rejectRequest(error);
    await flush();
    assert.equal(requests, 1);
    assert.equal(h.recorders.length, 0);
  },
);

test(
  "Screen crop result replaces the full image in a command attachment",
  options,
  async (t) => {
    const h = await fixture(t, {
      screens: [{ name: "Fixture", image: "data:image/png;base64,YQ==" }],
    });
    await h.click('[data-page="command"]');
    await h.click('[data-action="command-screen"]');
    h.input('[name="cropLeft"]', "50");
    h.input('[name="cropWidth"]', "50");
    await h.submit();
    const crop = h.calls.find((c) => c.action === "crop-screen-context");
    assert.deepEqual(clone(crop.args.region), {
      left: 50,
      top: 0,
      width: 50,
      height: 100,
    });
    h.input("#command-text", "Describe the selected region");
    await h.click('[data-action="run-command"]');
    const command = h.calls.find((c) => c.action === "command");
    assert.deepEqual(clone(command.args.attachments.images), [
      { mimeType: "image/png", data: "Y3JvcA==" },
    ]);
  },
);

test(
  "Workspace palette filters destinations and navigates with Enter",
  options,
  async (t) => {
    const h = await fixture(t);
    h.w.document.dispatchEvent(
      new h.w.KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
      }),
    );
    h.input("#workspace-search", "file tools");
    assert.equal(
      h.w.document.querySelectorAll("#workspace-results button").length,
      1,
    );
    h.w.document
      .querySelector("#workspace-search")
      .dispatchEvent(
        new h.w.KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    await flush();
    assert.match(
      h.w.document.querySelector("#content").textContent,
      /Make your files work/,
    );
    assert.equal(h.w.document.querySelector("#modal").open, false);
  },
);

test("auxiliary mouse shortcut selection persists and displays its button", options, async (t) => {
  const h = await fixture(t);
  await h.click('[data-page="settings"]');
  await h.click('[data-tab="hotkeys"]');
  await h.click('[data-action="add-hotkey"]');
  h.input('[name="mouseButton"]', '130');
  await h.submit();
  const saved = h.calls.findLast((x) => x.action === 'preferences');
  assert.equal(saved.args.hotkeys.at(-1).keyCode, 130);
});

test('fixed-language models show an accurate disabled dictation selector', options, async (t) => {
  const h = await fixture(t);
  await h.click('[data-page="settings"]');
  await h.click('[data-tab="language"]');
  const control = h.w.document.querySelector('[data-setting="language"]');
  assert.equal(control.disabled, true);
  assert.equal(control.value, 'en');
  h.data.settings.modelId = 'multilingual';
  h.data.models.push({ id:'multilingual', name:'Multilingual' });
  h.emit('state', h.data);
  assert.equal(h.w.document.querySelector('[data-setting="language"]').disabled, false);
});

test('interface language changes navigation and common actions without changing speech or command draft', options, async (t) => {
  const h = await fixture(t);
  await h.click('[data-page="command"]');
  h.input('#command-text', 'Keep this unsent request');
  await h.click('[data-page="settings"]');
  const language = h.w.document.querySelector('[data-setting="locale"]');
  language.value = 'ja';
  language.dispatchEvent(new h.w.Event('change', { bubbles:true }));
  await flush();
  assert.equal(h.data.settings.locale, 'ja');
  assert.equal(h.data.settings.language, 'auto');
  assert.equal(h.w.document.documentElement.lang, 'ja');
  assert.equal(h.w.document.querySelector('[data-page="home"]').textContent.trim(), 'ホーム');
  await h.click('[data-page="command"]');
  assert.equal(h.w.document.querySelector('#command-text').value, 'Keep this unsent request');
});

test('physical binding capture fills side modifiers and mouse button, then persists the result', options, async t => {
 const h=await fixture(t);
 await h.click('[data-page="settings"]'); await h.click('[data-tab="hotkeys"]'); await h.click('[data-action="add-hotkey"]'); await h.click('[data-action="capture-hotkey"]');
 h.emit('hotkey-captured',{keyCode:131,modifiers:['right-option'],label:'M4',inputKind:'mouse'});
 assert.equal(h.w.document.querySelector('[name="mouseButton"]').value,'131');
 await h.submit();
 const saved=h.calls.findLast(x=>x.action==='preferences');
 assert.equal(saved.args.hotkeys.at(-1).keyCode,131);
 assert.deepEqual(Array.from(saved.args.hotkeys.at(-1).modifiers),['right-option']);
});
test('closing shortcut editor stops native capture before leaving the dialog', options, async t => {
 const h=await fixture(t);
 await h.click('[data-page="settings"]'); await h.click('[data-tab="hotkeys"]'); await h.click('[data-action="add-hotkey"]'); await h.click('[data-action="capture-hotkey"]'); await h.click('[data-action="close-modal"]');
 assert.ok(h.calls.some(x=>x.action==='capture-hotkey-stop'));
 assert.equal(h.w.document.querySelector('#modal').open,false);
});

test('Japanese shortcut dialog localizes literal labels while leaving entered values unchanged', options, async t=> {
 const h=await fixture(t);h.data.settings.locale='ja';h.emit('state',h.data);
 await h.click('[data-page="settings"]');await h.click('[data-tab="hotkeys"]');await h.click('[data-action="add-hotkey"]');
 const forms=h.w.ScribbleFormTranslations;
 assert.equal(h.w.document.querySelector('#modal h2').textContent,forms.translate('ja','Shortcut'));
 const input=h.w.document.querySelector('[name="modifiers"]');h.input('[name="modifiers"]','right-option');
 assert.ok(input.parentElement.textContent.includes(forms.translate('ja','Modifiers (comma-separated)')));
 assert.equal(input.value,'right-option');
 assert.equal(h.w.document.querySelector('#modal button[type="submit"]').textContent,h.w.ScribbleI18n.t('ja','action.save'));
});

test('local model language pickers use verified coverage and exact locale codes', options, async (t) => {
  const h = await fixture(t);
  h.data.models.push({ id:'nemotron-multilingual', name:'Nemotron', installed:true, engine:'catalog', language:'auto', supportedLanguages:['en-US','fr-CA','vi-VN'] });
  h.data.settings.modelId = 'nemotron-multilingual';
  h.emit('state', h.data);
  await h.click('[data-page="settings"]');
  await h.click('[data-tab="language"]');
  const values = (select) => [...select.options].map(o => o.value);
  assert.deepEqual(values(h.w.document.querySelector('[data-setting="language"]')), ['auto','en-US','fr-CA','vi-VN']);
  await h.click('[data-page="transcribe"]');
  assert.deepEqual(values(h.w.document.querySelector('[name="fileLanguage"]')), ['','auto','en-US','fr-CA','vi-VN']);
  await h.click('[data-page="tones"]');
  await h.click('[data-action="add-item"]');
  const form = h.w.document.querySelector('#modal form');
  assert.deepEqual(values(form.querySelector('[name="language"]')), ['','auto','en-US','fr-CA','vi-VN']);
  const model = form.querySelector('[name="modelId"]');
  model.value = 'base.en';
  model.dispatchEvent(new h.w.Event('change', { bubbles:true }));
  assert.deepEqual(values(form.querySelector('[name="language"]')), ['','en']);
});

test('translated settings explanations and field hints keep values intact', options, async (t) => {
  const h = await fixture(t);
  h.data.settings.locale = 'ja';
  h.emit('state', h.data);
  await h.click('[data-page="settings"]');
  assert.ok(!h.w.document.querySelector('#content').textContent.includes('Used only for your dashboard greeting.'));
  await h.click('[data-tab="language"]');
  assert.equal(h.w.document.querySelector('[data-setting="language"]').value, 'en');
});


test('note summary provider is independent and unavailable CLI status is explicit', options, async (t) => {
  const h = await fixture(t);
  await h.click('[data-page="settings"]');
  await h.click('[data-tab="language"]');
  const provider = h.w.document.querySelector('[data-setting="summaryProvider"]');
  assert.equal(provider.value, 'configured-ai');
  provider.value = 'claude-cli';
  provider.dispatchEvent(new h.w.Event('change', { bubbles:true }));
  await flush();
  assert.equal(h.data.settings.aiProvider, 'ollama');
  assert.ok(h.w.document.querySelector('[data-setting="summaryModel"]'));
  await h.click('[data-action="summary-cli-status"]');
  assert.equal(h.w.document.querySelector('#summary-cli-status').textContent, 'Claude CLI is not installed');
});

test('note summary fallback is visible with the provider failure', options, async (t) => {
  const h = await fixture(t, { notes:[{id:'fallback', title:'Fixture', transcript:'Maya owns the demo.', summary:'Maya owns the demo.', summaryProvider:'local-extractive', summaryFallback:true, summaryError:'Claude CLI is not installed'}] });
  await h.click('[data-page="notes"]');
  assert.match(h.w.document.querySelector('#content').textContent, /Local extractive notes used.*Claude CLI is not installed/);
});


test('fresh setup waits for verified model and permissions before explicit completion', options, async (t) => {
  const permission = {microphone:0, accessibility:false};
  const h = await fixture(t, {setupPermissions:permission});
  assert.ok(h.w.document.querySelector('#setup-title'));
  assert.equal(h.w.document.querySelector('[data-action="complete-setup"]:not([data-skip])').disabled, true);
  await h.click('[data-action="download-model"]');
  assert.equal(h.calls.find(c=>c.action==='download-model').args.id, 'base.en');
  assert.ok(h.w.document.querySelector('[data-action="cancel-download"]'));
  h.emit('model-download', {id:'base.en', progress:0.6});
  assert.equal(h.w.document.querySelector('[data-progress-label="base.en"]').textContent, '60%');
  h.finishDownload(); await flush();
  assert.equal(h.data.models[0].installed, true);
  assert.equal(h.w.document.querySelector('[data-action="complete-setup"]:not([data-skip])').disabled, true);
  Object.assign(permission, {microphone:3, accessibility:true, hotkeys:true});
  await h.click('[data-action="refresh-setup"]');
  assert.equal(h.data.settings.onboardingCompleted, false);
  assert.equal(h.w.document.querySelector('[data-action="complete-setup"]:not([data-skip])').disabled, false);
  await h.click('[data-action="complete-setup"]:not([data-skip])');
  assert.equal(h.data.settings.onboardingCompleted, true);
  assert.equal(h.w.document.querySelector('#setup-title'), null);
  assert.equal(h.calls.some(c=>c.action==='request-permissions'), false);
});

test('returning users can replay setup and defer it without permission or download side effects', options, async (t) => {
  const h = await fixture(t);
  h.data.settings.onboardingCompleted = true; h.emit('state', h.data);
  assert.equal(h.w.document.querySelector('#setup-title'), null);
  await h.click('[data-page="help"]');
  await h.click('[data-action="restart-setup"]');
  assert.ok(h.w.document.querySelector('#setup-title'));
  assert.equal(h.data.settings.onboardingCompleted, false);
  await h.click('[data-action="complete-setup"][data-skip="true"]');
  assert.equal(h.data.settings.onboardingCompleted, true);
  assert.equal(h.calls.some(c=>['request-permissions','download-model'].includes(c.action)), false);
});

test('denied setup permissions expose recovery and cannot finish setup', options, async (t) => {
  const h = await fixture(t, {setupPermissions:{microphone:0,microphoneStatus:'denied',accessibility:false}});
  h.data.models[0].installed = true; h.emit('state', h.data);
  await h.click('[data-action="request-permission"][data-kind="microphone"]');
  assert.equal(h.calls.find(c=>c.action==='request-permissions').args.kind, 'microphone');
  assert.equal(h.w.document.querySelector('[data-action="complete-setup"]:not([data-skip])').disabled, true);
  await h.click('[data-action="permission-settings"][data-kind="microphone"]');
  assert.equal(h.calls.find(c=>c.action==='open-permissions').args.kind, 'microphone');
  assert.equal(h.data.settings.onboardingCompleted, false);
});


test('setup distinguishes Accessibility permission from unavailable native shortcut service', options, async (t) => {
  const permission = {microphone:3, accessibility:true, hotkeys:false};
  const h = await fixture(t, {setupPermissions:permission});
  h.data.models[0].installed = true; h.emit('state', h.data);
  assert.match(h.w.document.querySelector('#content').textContent, /Restart Scribble to enable global shortcuts/);
  assert.equal(h.w.document.querySelector('[data-action="complete-setup"]:not([data-skip])').disabled, true);
  permission.hotkeys = true;
  await h.click('[data-action="refresh-setup"]');
  assert.equal(h.w.document.querySelector('[data-action="complete-setup"]:not([data-skip])').disabled, false);
});

test('setup selects a local model only on explicit choice and does not trigger inference', options, async (t) => {
  const h = await fixture(t, {setupPermissions:{microphone:3,accessibility:true,hotkeys:true}});
  h.data.settings.speechProvider = 'deepgram';
  h.data.models.push({id:'tiny',name:'Tiny',bytes:75000000,installed:true,supported:true});
  h.emit('state', h.data);
  assert.equal(h.data.settings.speechProvider, 'deepgram');
  const select = h.w.document.querySelector('[name="onboardingModel"]');
  select.value = 'tiny'; select.dispatchEvent(new h.w.Event('change', {bubbles:true}));
  await flush();
  assert.equal(h.data.settings.modelId, 'tiny');
  assert.equal(h.data.settings.speechProvider, 'local');
  assert.equal(h.w.document.querySelector('[data-action="complete-setup"]:not([data-skip])').disabled, false);
  assert.equal(h.calls.some(c=>['download-model','start-recording','transcribe-file','ai-test'].includes(c.action)), false);
});
