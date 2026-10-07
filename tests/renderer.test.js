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
  { notes = [], shortcuts = [], requestFailure, pasteCommandPromise, browserPromise, browserCatalogue = [{id:"chrome",name:"Google Chrome",family:"chromium",profiles:[{id:"Default",name:"Personal"},{id:"Profile 12",name:"Research"},{id:"Profile 7",name:"Work"}]}], mediaPromise, commandFiles, screens = [], setupPermissions = {microphoneStatus:"not-determined",accessibility:false} } = {},
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
    shortcuts: clone(shortcuts),
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
      if (requestFailure?.action === action) throw new Error(requestFailure.message);
      if (action === "paste-command-result" && pasteCommandPromise) return await pasteCommandPromise;
      if (action === "state") return clone(data);
      if (action === "browser-catalog") return browserPromise ? await browserPromise : clone(browserCatalogue);
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


test('Japanese File tools translate cards while preserving operation and format identifiers', options, async t => {
  const h=await fixture(t);h.data.settings.locale='ja';h.emit('state',h.data);
  await h.click('[data-page="utilities"]');
  const forms=h.w.ScribbleFormTranslations;
  assert.ok([...h.w.document.querySelectorAll('.card h3')].some(el=>el.textContent===forms.translate('ja','Convert an image')));
  const select=h.w.document.querySelector('[data-format-for="image-convert"]');
  assert.deepEqual([...select.options].map(o=>o.value),['webp','jpg','png']);
  assert.ok(select.parentElement.textContent.includes(forms.translate('ja','Output format')));
  assert.ok(h.w.document.querySelector('[data-action="utility"][data-operation="image-convert"]'));
});
test('shortcut numbered blocks add, reorder and remove without losing entered values',options,async t=>{
  const h=await fixture(t);await h.click('[data-page="shortcuts"]');await h.click('[data-action="add-item"][data-kind="shortcuts"]');
  h.input('#modal [name="name"]','Research & notes');h.input('#modal [name="trigger"]','start research');h.input('#modal [name="aliases"]','research now, begin research');
  await h.click('[data-action="shortcut-action-add"][data-action-type="websites"]');
  const urls=' https://docs.example.com/{{text}}?sort=a&b=1\n\nhttps://example.org/path ';
  h.input('[data-shortcut-action="0"] [data-shortcut-field="urlsText"]',urls);h.input('[data-shortcut-action="0"] [data-shortcut-field="profile"]','Profile 12');
  await h.click('[data-action="shortcut-action-add"][data-action-type="application"]');
  h.input('[data-shortcut-action="1"] [data-shortcut-field="name"]','Visual Studio Code');h.input('[data-shortcut-action="1"] [data-shortcut-field="folder"]','/Users/floyd/My Project');
  await h.click('[data-action="shortcut-action-add"][data-action-type="folders"]');h.input('[data-shortcut-action="2"] [data-shortcut-field="pathsText"]','~/Documents\n/Users/floyd/Research & Notes');
  assert.equal(h.w.document.querySelector('[data-shortcut-action="0"] textarea').value,urls);
  await h.click('[data-action="shortcut-action-up"][data-index="2"]');await h.click('[data-action="shortcut-action-down"][data-index="0"]');
  assert.deepEqual([...h.w.document.querySelectorAll('[data-shortcut-action]')].map(el=>el.dataset.shortcutType),['folders','websites','application']);
  assert.equal(h.w.document.querySelector('[data-shortcut-action="1"] textarea').value,urls);
  assert.equal(h.w.document.querySelector('[data-shortcut-action="2"] [data-shortcut-field="folder"]').value,'/Users/floyd/My Project');
  await h.click('[data-action="shortcut-action-remove"][data-index="2"]');
  assert.deepEqual([...h.w.document.querySelectorAll('[data-shortcut-action] h3')].map(el=>el.textContent.trim()),['1. Open folders','2. Open websites']);
  assert.equal(h.w.document.querySelector('#modal [name="name"]').value,'Research & notes');await h.submit();
  const saved=clone(h.calls.find(call=>call.action==='save-item').args.item);
  assert.deepEqual(saved.actions,[{type:'folders',paths:['~/Documents','/Users/floyd/Research & Notes']},{type:'websites',urls:['https://docs.example.com/{{text}}?sort=a&b=1','https://example.org/path'],browser:'chrome',profile:'Profile 12'}]);
  assert.deepEqual(saved.aliases,['research now','begin research']);assert.equal(saved.trigger,'start research');assert.equal(saved.name,'Research & notes');assert.equal(h.w.document.querySelector('#modal').open,false);
});
test('editing each legacy shortcut derives an action while preserving legacy fields and identity',options,async t=>{
  for(const [type,target,expected]of [['url','https://example.org',{type:'websites',urls:['https://example.org'],browser:'chrome',profile:'Default'}],['app','TextEdit',{type:'application',name:'TextEdit',folder:''}],['folder','~/Documents',{type:'folders',paths:['~/Documents']}]] ){
    const shortcut={id:'legacy',name:'Legacy',trigger:'legacy task',type,target,profile:'Default',enabled:false,aliases:['old alias'],extra:'keep'};
    const h=await fixture(t,{shortcuts:[shortcut]});await h.click('[data-page="shortcuts"]');await h.click('[data-action="edit-item"][data-kind="shortcuts"][data-id="legacy"]');
    assert.equal(h.w.document.querySelectorAll('[data-shortcut-action]').length,1);await h.submit();
    const item=clone(h.calls.find(call=>call.action==='save-item').args.item);assert.deepEqual(item.actions,[expected]);for(const key of ['id','type','target','extra','enabled'])assert.equal(item[key],shortcut[key]);assert.deepEqual(item.aliases,['old alias']);
  }
});
test('editing grouped actions keeps websites, Chrome profile, application folder and path order',options,async t=>{
  const actions=[{type:'websites',urls:['https://one.example','https://two.example'],browser:'chrome',profile:'Profile 7'},{type:'application',name:'TextEdit',folder:'~/Documents/Work'},{type:'folders',paths:['/tmp/one','~/Pictures']}];
  const h=await fixture(t,{shortcuts:[{id:'multi',name:'My actions',trigger:'my actions',actions,type:'url',target:'https://legacy.example'}]});await h.click('[data-page="shortcuts"]');await h.click('[data-action="edit-item"][data-id="multi"]');
  assert.equal(h.w.document.querySelectorAll('[data-shortcut-action]').length,3);await h.submit();const item=clone(h.calls.find(call=>call.action==='save-item').args.item);assert.deepEqual(item.actions,actions);assert.equal(item.target,'https://legacy.example');
});
test('shortcut editor refuses empty and oversized website lists before saving',options,async t=>{
  const h=await fixture(t);await h.click('[data-page="shortcuts"]');await h.click('[data-action="add-item"][data-kind="shortcuts"]');h.input('#modal [name="trigger"]','test');await h.submit();assert.equal(h.calls.filter(x=>x.action==='save-item').length,0);assert.match(h.w.document.querySelector('#toast').textContent,/1 and 32/);
  await h.click('[data-action="shortcut-action-add"][data-action-type="websites"]');h.input('[data-shortcut-field="urlsText"]','https://example.org');assert.equal(h.w.document.querySelector('[data-shortcut-field="profile"]').tagName,'SELECT');
  h.input('[data-shortcut-field="profile"]','Default');h.input('[data-shortcut-field="urlsText"]',Array.from({length:17},(_,i)=>`https://example.org/${i}`).join('\n'));await h.submit();assert.match(h.w.document.querySelector('#toast').textContent,/1 and 16/);assert.equal(h.calls.filter(x=>x.action==='save-item').length,0);assert.equal(h.w.document.querySelector('#modal').open,true);
});
test('shortcut editor caps action blocks at 32 and cancel leaves the source unchanged',options,async t=>{
  const actions=Array.from({length:32},(_,i)=>({type:'application',name:`App ${i}`,folder:''}));const original={id:'full',trigger:'full',actions};const h=await fixture(t,{shortcuts:[original]});await h.click('[data-page="shortcuts"]');await h.click('[data-action="edit-item"][data-id="full"]');assert.equal(h.w.document.querySelectorAll('[data-shortcut-action]').length,32);for(const button of h.w.document.querySelectorAll('[data-action="shortcut-action-add"]'))assert.equal(button.disabled,true);
  await h.click('[data-action="shortcut-action-remove"][data-index="3"]');assert.equal(h.w.document.querySelectorAll('[data-shortcut-action]').length,31);assert.equal(h.w.document.querySelector('[data-action="shortcut-action-add"]').disabled,false);await h.click('#modal [data-action="close-modal"]');assert.equal(h.calls.filter(x=>x.action==='save-item').length,0);assert.deepEqual(h.data.shortcuts,[original]);
});
test('browser discovery occurs only when editing shortcuts and browser changes reset only that profile',options,async t=>{
  const catalogue=[{id:'chrome',name:'Google Chrome',family:'chromium',profiles:[{id:'Profile 7',name:'Work'}]},{id:'firefox',name:'Firefox',family:'gecko',profiles:[{id:'Profile0',name:'Personal Firefox'}]},{id:'safari',name:'Safari',family:'webkit',profiles:[]}];
  const actions=[{type:'websites',urls:['https://one.example'],browser:'chrome',profile:'Profile 7'},{type:'websites',urls:['https://two.example'],browser:'chrome',profile:'Profile 7'}];const h=await fixture(t,{browserCatalogue:catalogue,shortcuts:[{id:'browsers',trigger:'open things',actions}]});
  assert.equal(h.calls.filter(x=>x.action==='browser-catalog').length,0);await h.click('[data-page="shortcuts"]');assert.equal(h.calls.filter(x=>x.action==='browser-catalog').length,0);await h.click('[data-action="edit-item"][data-id="browsers"]');assert.equal(h.calls.filter(x=>x.action==='browser-catalog').length,1);
  const browser=h.w.document.querySelector('[data-shortcut-action="0"] [data-shortcut-field="browser"]');assert.deepEqual([...browser.options].map(x=>x.value),['default','chrome','firefox','safari']);browser.value='firefox';browser.dispatchEvent(new h.w.Event('change',{bubbles:true}));await flush();
  const profile=h.w.document.querySelector('[data-shortcut-action="0"] [data-shortcut-field="profile"]');assert.equal(profile.value,'');assert.deepEqual([...profile.options].map(x=>[x.value,x.textContent]),[['','Browser default profile'],['Profile0','Personal Firefox']]);assert.equal(h.w.document.querySelector('[data-shortcut-action="1"] [data-shortcut-field="profile"]').value,'Profile 7');profile.value='Profile0';await h.submit();assert.deepEqual(clone(h.calls.find(x=>x.action==='save-item').args.item.actions),[{type:'websites',urls:['https://one.example'],browser:'firefox',profile:'Profile0'},actions[1]]);
});
test('unavailable saved browser and profile selections remain visible and unchanged on save',options,async t=>{
  const actions=[{type:'websites',urls:['https://one.example'],browser:'brave',profile:'Profile 99'},{type:'websites',urls:['https://two.example'],browser:'chrome',profile:'Profile 42'}];const h=await fixture(t,{shortcuts:[{id:'missing',trigger:'missing',actions}]});await h.click('[data-page="shortcuts"]');await h.click('[data-action="edit-item"][data-id="missing"]');
  const browser=h.w.document.querySelector('[data-shortcut-action="0"] [data-shortcut-field="browser"]');assert.equal(browser.value,'brave');assert.match(browser.selectedOptions[0].textContent,/unavailable/);for(const index of [0,1]){const profile=h.w.document.querySelector(`[data-shortcut-action="${index}"] [data-shortcut-field="profile"]`);assert.equal(profile.value,actions[index].profile);assert.match(profile.selectedOptions[0].textContent,/unavailable/);}
  await h.click('[data-action="shortcut-action-up"][data-index="1"]');await h.submit();assert.deepEqual(clone(h.calls.find(x=>x.action==='save-item').args.item.actions),[actions[1],actions[0]]);
});
test('late browser discovery preserves draft text, focus and explicit system-browser selection',options,async t=>{
  let resolve;const promise=new Promise(done=>{resolve=done;});const h=await fixture(t,{browserPromise:promise});await h.click('[data-page="shortcuts"]');await h.click('[data-action="add-item"][data-kind="shortcuts"]');h.input('#modal [name="trigger"]','late browser');await h.click('[data-action="shortcut-action-add"][data-action-type="websites"]');const text='https://example.org/{{text}}?a=1&b=2\n\nhttps://two.example';h.input('[data-shortcut-field="urlsText"]',text);
  const browser=h.w.document.querySelector('[data-shortcut-field="browser"]');browser.value='default';browser.dispatchEvent(new h.w.Event('change',{bubbles:true}));await flush();const textarea=h.w.document.querySelector('[data-shortcut-field="urlsText"]');textarea.focus();textarea.setSelectionRange(5,12);
  resolve([{id:'chrome',name:'Google Chrome',family:'chromium',profiles:[{id:'Default',name:'Personal'}]}]);await flush();assert.equal(textarea.value,text);assert.equal(h.w.document.activeElement,textarea);assert.equal(textarea.selectionStart,5);assert.equal(textarea.selectionEnd,12);assert.equal(browser.value,'default');assert.equal(h.w.document.querySelector('[data-shortcut-field="profile"]').disabled,true);await h.submit();assert.deepEqual(clone(h.calls.find(x=>x.action==='save-item').args.item.actions),[{type:'websites',urls:['https://example.org/{{text}}?a=1&b=2','https://two.example'],browser:'default',profile:''}]);
});
test('browser discovery finishing after close never changes a later modal or persists a shortcut',options,async t=>{
  let resolve;const promise=new Promise(done=>{resolve=done;});const h=await fixture(t,{browserPromise:promise});await h.click('[data-page="shortcuts"]');await h.click('[data-action="add-item"][data-kind="shortcuts"]');await h.click('#modal [data-action="close-modal"]');await h.click('[data-page="dictionary"]');await h.click('[data-action="add-item"][data-kind="dictionary"]');h.input('#modal [name="word"]','Keep this draft');const before=h.w.document.querySelector('#modal').innerHTML;resolve([{id:'chrome',name:'Google Chrome',family:'chromium',profiles:[]}]);await flush();assert.equal(h.w.document.querySelector('#modal').innerHTML,before);assert.equal(h.w.document.querySelector('#modal [name="word"]').value,'Keep this draft');assert.equal(h.calls.filter(x=>x.action==='save-item').length,0);
});
test('browser discovery failure is explicit and retains unavailable existing choices',options,async t=>{
  let reject;const promise=new Promise((resolve,fail)=>{reject=fail;});const action={type:'websites',urls:['https://example.org'],browser:'chrome',profile:'Profile 7'};const h=await fixture(t,{browserPromise:promise,shortcuts:[{id:'failure',trigger:'failure',actions:[action]}]});await h.click('[data-page="shortcuts"]');await h.click('[data-action="edit-item"][data-id="failure"]');reject(Error('Discovery unavailable'));await flush();assert.match(h.w.document.querySelector('#shortcut-browser-status').textContent,/Discovery unavailable/);assert.equal(h.w.document.querySelector('[data-shortcut-field="profile"]').value,'Profile 7');assert.match(h.w.document.querySelector('[data-shortcut-field="profile"]').selectedOptions[0].textContent,/unavailable/);await h.submit();assert.deepEqual(clone(h.calls.find(x=>x.action==='save-item').args.item.actions),[action]);
});

test('AI utility saves its preset and captured keyboard binding atomically, then edits and removes it', {skip:!JSDOM}, async t => {
  const h=await fixture(t); await h.click('[data-page="ai"]'); await h.click('[data-action="add-ai-utility"]');
  h.input('#modal [name="name"]','Polish selection'); h.input('#modal [name="preset"]','polish');
  await h.click('[data-action="capture-hotkey"]'); h.emit('hotkey-captured',{keyCode:5,modifiers:['command','option'],label:'G'}); await flush();
  await h.submit(); const saved=h.calls.filter(x=>x.action==='preferences').at(-1).args;
  assert.equal(saved.aiUtilities.at(-1).name,'Polish selection'); const id=saved.aiUtilities.at(-1).id;
  assert.deepEqual(clone(saved.hotkeys.at(-1)),{mode:'utility',utilityId:id,keyCode:5,modifiers:['command','option'],toggle:true});
  await h.click(`[data-action="edit-ai-utility"][data-id="${id}"]`); assert.equal(h.w.document.querySelector('[name="preset"]').value,'polish'); h.input('[name="source"]','clipboard'); await h.submit();
  assert.equal(h.data.settings.aiUtilities.find(u=>u.id===id).source,'clipboard');
  await h.click(`[data-action="delete-ai-utility"][data-id="${id}"]`); assert.equal(h.data.settings.aiUtilities.some(u=>u.id===id),false); assert.equal(h.data.settings.hotkeys.some(k=>k.utilityId===id),false);
});
test('AI utility conflicts and invalid capture stay reviewable; closing stops capture without saving', {skip:!JSDOM}, async t => {
 const h=await fixture(t); await h.click('[data-page="ai"]'); await h.click('[data-action="add-ai-utility"]'); h.input('[name="name"]','Test');
 const existing=h.data.settings.hotkeys[0]; await h.click('[data-action="capture-hotkey"]'); h.emit('hotkey-captured',existing); await h.submit(); assert.match(h.w.document.querySelector('#toast').textContent,/already assigned/); assert.equal(h.w.document.querySelector('#modal').open,true);
 await h.click('[data-action="capture-hotkey"]'); h.emit('hotkey-captured',{keyCode:130,modifiers:['option']}); await h.submit(); assert.match(h.w.document.querySelector('#toast').textContent,/regular keyboard/);
 await h.click('[data-action="capture-hotkey"]'); await h.click('#modal [data-action="close-modal"]'); assert.ok(h.calls.some(x=>x.action==='capture-hotkey-stop')); assert.equal(h.calls.filter(x=>x.action==='preferences').length,0);
});
test('AI utility results are plain text, require insertion permission and dismiss backend cache; busy supports cancel', {skip:!JSDOM}, async t => {
 const h=await fixture(t); h.data.settings.aiUtilities=[{id:'u',name:'Review',preset:'grammar',source:'selection',enabled:true}]; h.emit('state',h.data); await h.click('[data-page="ai"]'); await h.click('[data-action="run-ai-utility"]'); assert.deepEqual(clone(h.calls.find(x=>x.action==='run-ai-utility').args),{id:'u'});
 h.emit('utility-state',{id:'u',busy:true}); await h.click('[data-action="cancel-ai-utility"]'); assert.ok(h.calls.some(x=>x.action==='cancel-ai-utility'));
 h.emit('utility-result',{id:'u',name:'Review',text:'<img src=x onerror=bad()>',canInsert:false}); assert.equal(h.w.document.querySelector('#utility-result img'),null); assert.equal(h.w.document.querySelector('[data-action="paste-ai-utility"]'),null); await h.click('[data-action="copy-ai-utility"]'); assert.equal(h.calls.at(-1).args.text,'<img src=x onerror=bad()>');
 h.emit('utility-result',{id:'u',name:'Review',text:'Approved',canInsert:true}); await h.click('[data-action="paste-ai-utility"]'); assert.deepEqual(clone(h.calls.at(-1).args),{id:'u'}); assert.equal(h.w.document.querySelector('#utility-result'),null); h.emit('utility-result',{id:'next',name:'Review',text:'Next',canInsert:false}); await h.click('[data-action="dismiss-ai-utility"]'); assert.equal(h.w.document.querySelector('#utility-result'),null); assert.equal(h.calls.at(-1).action,'dismiss-ai-utility');
});

test('AI utility provider failures remain visible and Escape/Tab use opaque result identities', {skip:!JSDOM}, async t => {
 const h=await fixture(t,{requestFailure:{action:'run-ai-utility',message:'No selected text'}}); h.data.settings.aiUtilities=[{id:'configured',name:'Fix',preset:'grammar',source:'selection',enabled:true}]; h.emit('state',h.data); await h.click('[data-page="ai"]'); await h.click('[data-action="run-ai-utility"]'); assert.match(h.w.document.querySelector('#toast').textContent,/No selected text/); assert.equal(h.w.document.querySelector('[data-action="run-ai-utility"]').disabled,false); assert.equal(h.calls.filter(x=>x.action==='paste-ai-utility').length,0);
 h.emit('utility-result',{id:'opaque-result',utilityId:'configured',name:'Fix',text:'Text',canInsert:true}); const result=h.w.document.querySelector('#utility-result'); result.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})); await flush(); assert.deepEqual(clone(h.calls.at(-1).args),{id:'opaque-result'});
 assert.equal(h.w.document.querySelector('#utility-result'),null); h.emit('utility-result',{id:'opaque-result',name:'Fix',text:'Text',canInsert:false}); h.w.document.querySelector('#utility-result').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); await flush(); assert.equal(h.calls.at(-1).action,'dismiss-ai-utility'); assert.deepEqual(clone(h.calls.at(-1).args),{id:'opaque-result'}); assert.equal(h.w.document.querySelector('#utility-result'),null);
});

test('AI utility changed-target insertion errors retain review and report failure for click and Tab', {skip:!JSDOM}, async t => {
 const h=await fixture(t,{requestFailure:{action:'paste-ai-utility',message:'The selected application changed'}});
 h.emit('utility-result',{id:'result',utilityId:'u',name:'Fix',text:'Keep for copying',canInsert:true}); await h.click('[data-action="paste-ai-utility"]'); assert.match(h.w.document.querySelector('#toast').textContent,/application changed/); assert.equal(h.w.document.querySelector('#utility-result').textContent,'Keep for copying');
 h.w.document.querySelector('#utility-result').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})); await flush(); assert.match(h.w.document.querySelector('#toast').textContent,/application changed/); assert.equal(h.w.document.querySelector('#utility-result').textContent,'Keep for copying');
 h.emit('utility-result',{id:'copy',name:'Fix',text:'Copy only',canInsert:false}); const panel=h.w.document.querySelector('#utility-result').parentElement; assert.match(panel.textContent,/Copy the result or dismiss/); assert.doesNotMatch(panel.textContent,/Tab to insert/);
});

test('Japanese shortcut/browser and utility forms translate display while preserving IDs, tokens and entered values', {skip:!JSDOM}, async t => {
 const h=await fixture(t);h.data.settings.locale='ja';h.emit('state',h.data);await h.click('[data-page="shortcuts"]');await h.click('[data-action="add-item"][data-kind="shortcuts"]');
 assert.match(h.w.document.querySelector('#modal').textContent,/ウェブサイトを追加/);await h.click('[data-action="shortcut-action-add"][data-action-type="websites"]');
 assert.match(h.w.document.querySelector('#modal').textContent,/ブラウザーのプロファイル/);assert.equal(h.w.document.querySelector('#shortcut-action-count').textContent,'1 / 32 操作');assert.equal(h.w.document.querySelector('[data-shortcut-action]').getAttribute('aria-label'),'操作 1');
 const browser=h.w.document.querySelector('[data-shortcut-field="browser"]');assert.equal(browser.querySelector('[value="default"]').textContent,'システムの既定ブラウザー');assert.equal(browser.value,'chrome');assert.equal(browser.querySelector('[value="chrome"]').textContent,'Google Chrome');
 h.input('[name="name"]','My original name');h.input('[name="trigger"]','search words');h.input('[data-shortcut-field="urlsText"]','https://example.org/{{text}}');h.input('[data-shortcut-field="profile"]','Profile 7');await h.submit();const item=clone(h.calls.find(c=>c.action==='save-item').args.item);assert.equal(item.name,'My original name');assert.equal(item.actions[0].urls[0],'https://example.org/{{text}}');assert.equal(item.actions[0].profile,'Profile 7');assert.equal(item.actions[0].browser,'chrome');
 await h.click('[data-page="ai"]');assert.match(h.w.document.querySelector('main').textContent,/AIツール/);await h.click('[data-action="add-ai-utility"]');assert.match(h.w.document.querySelector('#modal').textContent,/テキストの取得元/);const presets=h.w.document.querySelector('[name="preset"]');assert.equal(presets.querySelector('[value="grammar"]').textContent,'文法を修正');assert.equal(presets.value,'grammar');assert.equal(h.w.document.querySelector('[name="source"]').value,'selection');h.input('[name="name"]','Original utility');await h.submit();assert.equal(h.data.settings.aiUtilities.at(-1).name,'Original utility');assert.equal(h.data.settings.aiUtilities.at(-1).preset,'grammar');
 h.emit('utility-result',{id:'opaque',name:'Original utility',text:'Original result {{text}}',canInsert:false});assert.equal(h.w.document.querySelector('#utility-result').textContent,'Original result {{text}}');assert.match(h.w.document.querySelector('#utility-result').parentElement.textContent,/結果をコピーするか閉じて/);assert.equal(h.w.document.querySelector('[data-action="dismiss-ai-utility"]').textContent,'閉じる');
});

test('recording styles localize labels and preserve exact settings values', options, async t => {
  const h = await fixture(t); h.data.settings.locale = 'ja'; h.data.settings.indicatorStyle = 'notch'; h.emit('state', h.data);
  await h.click('[data-page="settings"]'); await h.click('[data-tab="recording"]');
  const select = h.w.document.querySelector('[data-setting="indicatorStyle"]');
  assert.equal(select.value, 'notch'); assert.deepEqual([...select.options].map(o => o.value), ['pill','notch','hidden']);
  assert.equal(select.options[1].textContent, 'ネイティブノッチ');
  select.value = 'hidden'; select.dispatchEvent(new h.w.Event('change', {bubbles:true})); await flush();
  assert.equal(h.calls.filter(c => c.action === 'preferences').at(-1).args.indicatorStyle, 'hidden');
  assert.equal(h.data.settings.indicatorStyle, 'hidden');
});

test('utility settings labels preserve and escape the user name and ID', options, async t => {
  const h = await fixture(t); h.data.settings.locale='es'; h.data.settings.aiUtilities=[{id:'utility_safe',name:'<img src=x onerror=alert(1)> {name}'}];
  h.data.settings.hotkeys=[{mode:'utility',utilityId:'utility_safe',keyCode:5,modifiers:['option'],toggle:true}]; h.emit('state',h.data);
  await h.click('[data-page="settings"]'); await h.click('[data-tab="hotkeys"]');
  assert.match(h.w.document.querySelector('.list-row strong').textContent,/Utilidad de IA · <img src=x onerror=alert\(1\)> \{name\}/);
  assert.equal(h.w.document.querySelector('.list-row img'),null); assert.match(h.w.document.querySelector('.list-row p').textContent,/Pulsa para transformar texto/);
  assert.equal(h.data.settings.hotkeys[0].utilityId,'utility_safe');
});

test('command reviews use opaque target IDs, copy-only gating, and backend dismissal', options, async t => {
  const h=await fixture(t); await h.click('[data-page="command"]');
  h.emit('command-result',{kind:'text',text:'Reviewed text',reviewId:'review-a',canInsert:false}); await flush();
  assert.equal(h.w.document.querySelector('[data-action="paste-command"]'),null);
  const result=h.w.document.querySelector('#command-result'); result.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true})); await flush();
  assert.equal(h.calls.filter(c=>c.action==='paste-command-result').length,0);
  h.emit('command-result',{kind:'text',text:'Reviewed text',reviewId:'review-b',canInsert:true}); await flush();
  await h.click('[data-action="paste-command"]'); assert.deepEqual(clone(h.calls.find(c=>c.action==='paste-command-result').args),{id:'review-b'});
  assert.equal(h.w.document.querySelector('#command-result'),null); assert.equal(h.calls.filter(c=>c.action==='paste').length,0);
  h.emit('command-result',{kind:'text',text:'Dismiss',reviewId:'review-c',canInsert:true}); await flush();
  h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await flush();
  assert.deepEqual(clone(h.calls.find(c=>c.action==='dismiss-command-result').args),{id:'review-c'});
});


test('pending command insertion preserves a newer review', options, async t => {
  let resolve; const promise=new Promise(r=>{resolve=r}); const h=await fixture(t,{pasteCommandPromise:promise});
  await h.click('[data-page="command"]'); h.emit('command-result',{kind:'text',text:'Old',reviewId:'old',canInsert:true}); await flush();
  h.w.document.querySelector('[data-action="paste-command"]').click(); await flush();
  h.emit('command-result',{kind:'text',text:'New',reviewId:'new',canInsert:false}); await flush(); resolve(true); await flush();
  assert.equal(h.w.document.querySelector('#command-result').textContent,'New');
});

test('failed command insertion retains backend copy-only review', options, async t => {
  const h=await fixture(t,{requestFailure:{action:'paste-command-result',message:'Target changed'}}); await h.click('[data-page="command"]');
  h.emit('command-result',{kind:'text',text:'Keep me',reviewId:'failed',canInsert:true}); await flush(); await h.click('[data-action="paste-command"]');
  h.emit('command-result',{kind:'text',text:'Keep me',reviewId:'failed',canInsert:false}); await flush();
  assert.equal(h.w.document.querySelector('#command-result').textContent,'Keep me'); assert.equal(h.w.document.querySelector('[data-action="paste-command"]'),null);
  await h.click('[data-action="copy-command"]'); assert.equal(h.calls.find(c=>c.action==='copy').args.text,'Keep me');
});
