"use strict";
const fs = require("node:fs"),
  fsp = fs.promises,
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  { spawn } = require("node:child_process");
const RELEASE = {
  version: "0.40.0",
  sha256: "b490b4925a95c5f3dfcd889e566cf3dcd727848d59057fb00b03f1d6630326dc",
};
function localEndpoint(value) {
  const u = new URL(value);
  if (
    u.origin !== "http://127.0.0.1:11434" ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw Error("Managed local AI starts only at http://127.0.0.1:11434");
  return u.origin;
}
async function verifyRuntime(dir) {
  const manifest = JSON.parse(
    await fsp.readFile(path.join(dir, "scribble-runtime.json"), "utf8"),
  );
  if (
    manifest.version !== RELEASE.version ||
    manifest.archiveSHA256 !== RELEASE.sha256 ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length
  )
    throw Error("Unverified Ollama runtime package");
  for (const item of manifest.files) {
    const file = path.resolve(dir, item.path);
    if (!file.startsWith(path.resolve(dir) + path.sep))
      throw Error("Invalid runtime manifest path");
    const stat = await fsp.lstat(file);
    if (item.link) {
      if (
        !stat.isSymbolicLink() ||
        (await fsp.readlink(file)) !== item.link ||
        !path
          .resolve(path.dirname(file), item.link)
          .startsWith(path.resolve(dir) + path.sep)
      )
        throw Error("Invalid runtime link");
    } else {
      const hash = crypto.createHash("sha256");
      for await (const b of fs.createReadStream(file)) hash.update(b);
      if (hash.digest("hex") !== item.sha256)
        throw Error("Ollama runtime file verification failed: " + item.path);
    }
  }
  const binary = path.join(dir, "ollama");
  await fsp.access(binary, fs.constants.X_OK);
  return binary;
}
class LocalAIRuntime {
  constructor({
    fetcher = fetch,
    spawnProcess = spawn,
    verify = verifyRuntime,
    wait = (ms) => new Promise((r) => setTimeout(r, ms)),
    startupTimeout = 30000,
  } = {}) {
    Object.assign(this, {
      fetcher,
      spawnProcess,
      verify,
      wait,
      startupTimeout,
    });
    this.child = null;
    this.inflight = null;
    this.closed = false;
  }
  async probe(endpoint) {
    try {
      const r = await this.fetcher(endpoint + "/api/version", {
        signal: AbortSignal.timeout(1200),
      });
      if (!r.ok) return null;
      const value = await r.json();
      return typeof value.version === "string" ? value : null;
    } catch {
      return null;
    }
  }
  ensure(options) {
    if (this.closed) return Promise.reject(Error("Local AI runtime is closed"));
    const endpoint = localEndpoint(options.endpoint);
    if (this.inflight) return this.inflight;
    this.inflight = this.start({ ...options, endpoint }).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }
  async start({ endpoint, dataDir, resourcesPath }) {
    const healthy = await this.probe(endpoint);
    if (healthy)
      return {
        endpoint,
        version: healthy.version,
        owned: !!this.child,
        reused: true,
      };
    let binary, last;
    for (const dir of [
      resourcesPath && path.join(resourcesPath, "runtime/ollama"),
      path.join(
        os.homedir(),
        ".local/share/scribble-tools/ollama",
        RELEASE.version,
      ),
    ].filter(Boolean)) {
      try {
        binary = await this.verify(dir);
        break;
      } catch (e) {
        last = e;
      }
    }
    if (!binary)
      throw Error(
        "Verified local Ollama runtime is unavailable. " +
          (last?.message || ""),
      );
    if (this.closed) throw Error("Local AI runtime is closed");
    const root = path.join(dataDir, "local-ai"),
      models = path.join(root, "models");
    await fsp.mkdir(models, { recursive: true, mode: 0o700 });
    if (this.closed) throw Error("Local AI startup canceled");
    const fd = fs.openSync(path.join(root, "server.log"), "a", 0o600);
    let child;
    try {
      child = this.spawnProcess(binary, ["serve"], {
        cwd: path.dirname(binary),
        detached: false,
        stdio: ["ignore", fd, fd],
        env: {
          ...process.env,
          OLLAMA_HOST: "127.0.0.1:11434",
          OLLAMA_NO_CLOUD: "1",
          OLLAMA_MODELS: models,
        },
      });
    } finally {
      fs.closeSync(fd);
    }
    this.child = child;
    let failure;
    child.once("error", (e) => {
      failure = e;
    });
    child.once("exit", (code, signal) => {
      failure ||= Error(`Local AI exited (${code ?? signal})`);
      if (this.child === child) this.child = null;
    });
    const deadline = Date.now() + this.startupTimeout;
    while (Date.now() < deadline) {
      if (this.closed || failure) {
        if (this.child === child) {
          child.kill();
          this.child = null;
        }
        throw failure || Error("Local AI startup canceled");
      }
      const ready = await this.probe(endpoint);
      if (ready && !failure)
        return { endpoint, version: ready.version, owned: true, reused: false };
      await this.wait(250);
    }
    if (this.child === child) {
      child.kill();
      this.child = null;
    }
    throw Error(
      "Local Ollama did not become ready; inspect " +
        path.join(root, "server.log"),
    );
  }
  close() {
    this.closed = true;
    const child = this.child;
    this.child = null;
    if (!child) return Promise.resolve({ owned: false, stopped: true });
    if (child.exitCode !== null)
      return Promise.resolve({ owned: true, stopped: true });
    return new Promise((resolve) => {
      let force,
        fallback,
        finished = false;
      const finish = (stopped) => {
        if (finished) return;
        finished = true;
        clearTimeout(force);
        clearTimeout(fallback);
        resolve({ owned: true, stopped });
      };
      child.once("exit", () => finish(true));
      force = setTimeout(() => {
        child.kill("SIGKILL");
        if (!finished) fallback = setTimeout(() => finish(false), 500);
      }, 2000);
      child.kill("SIGTERM");
    });
  }
}
const runtime = new LocalAIRuntime();
module.exports = {
  LocalAIRuntime,
  ensureLocalAI: (options) => runtime.ensure(options),
  closeLocalAI: () => runtime.close(),
  verifyRuntime,
  localEndpoint,
  RELEASE,
};
