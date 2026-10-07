"use strict";
const { spawn } = require("node:child_process"),
  { EventEmitter } = require("node:events"),
  readline = require("node:readline"),
  fs = require("node:fs");
class NativeBridge extends EventEmitter {
  constructor(
    binary,
    { spawnProcess = spawn, exists = fs.existsSync, timeoutMs = 30000, closeTimeoutMs = 2000, killGraceMs = 1000 } = {},
  ) {
    super();
    this.binary = binary;
    this.pending = new Map();
    this.counter = 0;
    this.timeoutMs = timeoutMs;
    this.closeTimeoutMs = closeTimeoutMs;
    this.killGraceMs = killGraceMs;
    this.forcedExit = false;
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
    const finished = (code, signal) => {
      if (this.exitResult) return;
      clearTimeout(this.killTimer);
      clearTimeout(this.exitDeadline);
      this.lines.close();
      this.fail(Error("Native bridge stopped"));
      this.exitResult = { exited: true, forced: this.forcedExit, code, signal };
      this.resolveClose?.(this.exitResult);
    };
    this.child.on("exit", finished);
    this.child.on("close", finished);
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
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.fail(Error("Native bridge closed"));
    if (!this.child || this.exitResult) {
      this.closePromise = Promise.resolve(this.exitResult || { exited: true, forced: false, notStarted: true });
      return this.closePromise;
    }
    this.closePromise = new Promise(resolve => { this.resolveClose = resolve; });
    // EOF allows the native helper to flush ScreenCaptureKit. Await its exit, not the write.
    try { this.child.stdin.end(); } catch (error) { this.fail(error); }
    if (!this.exitResult) this.killTimer = setTimeout(() => {
      if (this.exitResult) return;
      this.forcedExit = true;
      this.exitDeadline = setTimeout(() => {
        if (!this.exitResult) {
          const resolve = this.resolveClose;
          this.closePromise = null;
          this.resolveClose = null;
          resolve({ exited: false, forced: true, reason: "exit-not-confirmed" });
        }
      }, this.killGraceMs);
      try { this.child.kill("SIGKILL"); } catch (error) { this.emit("diagnostic", error.message); }
    }, this.closeTimeoutMs);
    return this.closePromise;
  }

}
module.exports = { NativeBridge };
