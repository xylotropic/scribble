"use strict";
const { spawn } = require("node:child_process"),
  { EventEmitter } = require("node:events"),
  readline = require("node:readline"),
  fs = require("node:fs");
class NativeBridge extends EventEmitter {
  constructor(
    binary,
    { spawnProcess = spawn, exists = fs.existsSync, timeoutMs = 30000 } = {},
  ) {
    super();
    this.binary = binary;
    this.pending = new Map();
    this.counter = 0;
    this.timeoutMs = timeoutMs;
    this.available = exists(binary);
    this.closed = false;
    if (!this.available) return;
    this.child = spawnProcess(binary, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on("line", (line) => {
      let x;
      try {
        x = JSON.parse(line);
      } catch {
        return;
      }
      if (x.id !== undefined && this.pending.has(String(x.id))) {
        const id = String(x.id),
          p = this.pending.get(id);
        clearTimeout(p.timeout);
        this.pending.delete(id);
        x.ok
          ? p.resolve(x.result)
          : p.reject(Error(x.error || "Native operation failed"));
      } else if (x.event) this.emit(x.event, x);
    });
    this.child.on("error", (e) => this.fail(e));
    this.child.on("exit", () => {
      clearTimeout(this.killTimer);
      this.lines.close();
      this.fail(Error("Native bridge stopped"));
    });
    this.child.stdin.on("error", (e) => this.fail(e));
    this.child.stderr.on("data", (b) => this.emit("diagnostic", b.toString()));
  }
  fail(e) {
    this.available = false;
    for (const p of this.pending.values()) {
      clearTimeout(p.timeout);
      p.reject(e);
    }
    this.pending.clear();
  }
  request(command, args = {}) {
    if (!this.available || this.closed)
      return Promise.reject(
        Error(
          "Native helper is unavailable. Run npm run build:native or restart Scribble.",
        ),
      );
    const id = String(++this.counter);
    let payload;
    try {
      payload = JSON.stringify({ ...args, id, command }) + "\n";
    } catch (e) {
      return Promise.reject(e);
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(Error("Native operation timed out"));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.child.stdin.write(payload, (e) => {
          if (e) this.fail(e);
        });
      } catch (e) {
        this.fail(e);
      }
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(Error("Native bridge closed"));
    if (!this.child) return;
    // EOF lets the Swift helper flush and stop ScreenCaptureKit before exiting.
    this.child.stdin.end();
    this.killTimer = setTimeout(() => this.child.kill(), 2000);
    this.killTimer.unref();
  }
}
module.exports = { NativeBridge };
