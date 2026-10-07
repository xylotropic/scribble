"use strict";
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const REQUIRED_FLAGS = [
  "--safe-mode",
  "--restricted",
  "--tools",
  "--disallowedTools",
  "--strict-mcp-config",
  "--mcp-config",
  "--disable-slash-commands",
  "--no-chrome",
  "--setting-sources",
  "--settings",
  "--no-session-persistence",
  "--permission-prompts",
  "--max-turns",
  "--system-prompt",
  "--output-format",
];
const MAX_INPUT = 500000,
  MAX_OUTPUT = 1024 * 1024;
function cleanEnv(env = process.env) {
  const result = { ...env };
  for (const key of Object.keys(result))
    if (
      /^(ANTHROPIC_|CLAUDE_CODE_USE_|CLAUDE_CODE_OAUTH_TOKEN$|CLAUDE_CODE_SIMPLE$|CLAUDE_CODE_SAFE_MODE$|CLAUDE_CODE_API_KEY_HELPER|AWS_|GOOGLE_|AZURE_|OPENAI_|CODEX_API_KEY$)/.test(
        key,
      )
    )
      delete result[key];
  return result;
}
function run(
  binary,
  args,
  {
    input = "",
    cwd,
    env,
    signal,
    timeoutMs = 10000,
    maxOutput = MAX_OUTPUT,
  } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(
        signal.reason || new DOMException("Cancelled", "AbortError"),
      );
    const child = spawn(binary, args, {
      shell: false,
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out = [],
      err = [];
    let bytes = 0,
      pendingError,
      timer,
      killTimer;
    function fail(error) {
      if (pendingError) return;
      pendingError = error;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 1000);
    }
    function cancel() {
      fail(signal.reason || new DOMException("Cancelled", "AbortError"));
    }
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(
      () => fail(new Error("Summary CLI timed out")),
      timeoutMs,
    );
    child.on("error", (error) => {
      pendingError = error;
    });
    for (const [stream, list] of [
      [child.stdout, out],
      [child.stderr, err],
    ])
      stream.on("data", (data) => {
        bytes += data.length;
        if (bytes > maxOutput)
          return fail(new Error("Summary CLI output exceeded limit"));
        list.push(data);
      });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", cancel);
      if (pendingError) reject(pendingError);
      else
        resolve({
          code,
          stdout: Buffer.concat(out).toString("utf8"),
          stderr: Buffer.concat(err).toString("utf8"),
        });
    });
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") fail(error);
    });
    child.stdin.end(input);
  });
}
async function policyCheck({ managedPaths, access = fs.access } = {}) {
  const paths = managedPaths || [
    "/Library/Application Support/ClaudeCode/managed-settings.json",
    "/Library/Application Support/ClaudeCode/managed-settings.d",
    path.join(
      os.homedir(),
      "Library/Preferences/com.anthropic.claudecode.plist",
    ),
    "/Library/Application Support/ClaudeCode/managed-mcp.json",
    "/Library/Managed Preferences/com.anthropic.claudecode.plist",
    "/Library/Managed Preferences/com.anthropic.claude-code.plist",
  ];
  for (const file of paths) {
    try {
      await access(file);
      return `Managed Claude policy exists: ${file}`;
    } catch (error) {
      if (error.code !== "ENOENT")
        return `Cannot verify absence of managed Claude policy: ${file}`;
    }
  }
  if (process.platform !== "darwin")
    return "Managed-policy discovery is currently verified only for macOS";
  return null;
}
async function status({
  binary = "claude",
  runner = run,
  env = process.env,
  managedPaths,
  access,
} = {}) {
  const policy = await policyCheck({ managedPaths, access });
  if (policy) return { available: false, reason: policy };
  let dir;
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "scribble-cli-check-"));
    const help = await runner(binary, ["--help"], {
      cwd: dir,
      env: cleanEnv(env),
      timeoutMs: 10000,
      maxOutput: 256000,
    });
    if (help.code !== 0) throw new Error("Claude CLI help failed");
    const missing = REQUIRED_FLAGS.filter(
      (flag) =>
        !new RegExp(`(^|[\\s,])${flag}(?=[\\s,=]|$)`, "m").test(help.stdout),
    );
    if (missing.length)
      return {
        available: false,
        reason: `Claude CLI lacks required isolation flags: ${missing.join(", ")}`,
      };
    const version = await runner(binary, ["--version"], {
      cwd: dir,
      env: cleanEnv(env),
      timeoutMs: 10000,
      maxOutput: 10000,
    });
    if (version.code !== 0 || !version.stdout.trim())
      throw new Error("Claude CLI version check failed");
    const auth = await runner(binary, ["auth", "status"], {
      cwd: dir,
      env: cleanEnv(env),
      timeoutMs: 10000,
      maxOutput: 64000,
    });
    let metadata;
    try {
      metadata = JSON.parse(auth.stdout);
    } catch {
      return {
        available: false,
        reason: "Claude auth status JSON is unavailable or unsupported",
      };
    }
    if (auth.code !== 0 || metadata?.authMethod !== "claude.ai")
      return {
        available: false,
        reason:
          "Claude subscription sign-in is not established; Console/API, third-party and ambiguous authentication are refused",
      };
    return {
      available: true,
      binary,
      version: version.stdout.trim().slice(0, 200),
      authentication: "claude.ai",
      inferenceVerified: false,
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error.code === "ENOENT" ? "Claude CLI is not installed" : error.message,
    };
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
}
async function summarize({
  transcript,
  prompt,
  model,
  signal,
  timeoutMs = 180000,
  binary = "claude",
  runner = run,
  env = process.env,
  managedPaths,
  access,
} = {}) {
  if (
    typeof transcript !== "string" ||
    !transcript.trim() ||
    transcript.length > MAX_INPUT
  )
    throw new Error("Transcript must contain 1–500,000 characters");
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20000)
    throw new Error("Summary prompt must contain 1–20,000 characters");
  if (
    model !== undefined &&
    (typeof model !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(model))
  )
    throw new Error("Invalid Claude model");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000)
    throw new Error("Invalid summary timeout");
  if (signal?.aborted)
    throw signal.reason || new DOMException("Cancelled", "AbortError");
  const capabilities = await status({
    binary,
    runner,
    env,
    managedPaths,
    access,
  });
  if (!capabilities.available) throw new Error(capabilities.reason);
  if (signal?.aborted)
    throw signal.reason || new DOMException("Cancelled", "AbortError");
  const args = [
    "--safe-mode",
    "--restricted",
    "-p",
    "--output-format",
    "json",
    "--tools",
    "",
    "--disallowedTools",
    "*",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--disable-slash-commands",
    "--no-chrome",
    "--setting-sources",
    "",
    "--settings",
    '{"disableAllHooks":true}',
    "--no-session-persistence",
    "--permission-prompts",
    "none",
    "--max-turns",
    "1",
    "--system-prompt",
    prompt,
  ];
  if (model) args.push("--model", model);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scribble-summary-"));
  try {
    const result = await runner(binary, args, {
      input: transcript,
      cwd: dir,
      env: cleanEnv(env),
      signal,
      timeoutMs,
      maxOutput: MAX_OUTPUT,
    });
    if (signal?.aborted)
      throw signal.reason || new DOMException("Cancelled", "AbortError");
    if (result.code !== 0)
      throw new Error(`Claude summary failed (exit ${result.code})`);
    if (Buffer.byteLength(result.stdout) > MAX_OUTPUT)
      throw new Error("Summary CLI output exceeded limit");
    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch {
      throw new Error("Claude summary returned invalid JSON");
    }
    if (
      data.type !== "result" ||
      data.is_error === true ||
      data.subtype !== "success" ||
      typeof data.result !== "string" ||
      !data.result.trim()
    )
      throw new Error(
        "Claude summary returned an unsuccessful or empty result",
      );
    if (data.result.length > 100000)
      throw new Error("Claude summary text exceeded limit");
    return {
      text: data.result.trim(),
      provider: "claude-cli",
      model: model || null,
      cliVersion: capabilities.version,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
module.exports = { status, summarize, cleanEnv, REQUIRED_FLAGS };
