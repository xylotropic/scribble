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
async function fixture(t, { notes = [], mediaPromise, commandFiles } = {}) {
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
      if (action === "choose-command-files")
        return clone(commandFiles || { text: "", images: [], sources: [] });
      if (action === "command") return { kind: "text", text: "fixture answer" };
      if (action === "models") return clone(data.models);
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
