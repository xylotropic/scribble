const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const {
  status,
  summarize,
  REQUIRED_FLAGS,
} = require("../src/main/summary-cli");
const absent = async () => {
  const e = new Error("missing");
  e.code = "ENOENT";
  throw e;
};
function fakeRunner(overrides = {}) {
  const calls = [];
  const runner = async (binary, args, options) => {
    calls.push({ binary, args, options });
    if (args[0] === "--help")
      return { code: 0, stdout: REQUIRED_FLAGS.join("\n") };
    if (args[0] === "auth")
      return { code: 0, stdout: JSON.stringify({ authMethod: "claude.ai" }) };
    if (args[0] === "--version")
      return { code: 0, stdout: "Claude mock-version" };
    assert.equal((await fs.readdir(options.cwd)).length, 0);
    return {
      code: 0,
      stdout: JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "Summary with ID ABC-42.",
      }),
      ...overrides,
    };
  };
  return { runner, calls };
}
test("installed help capabilities required; version alone cannot claim availability", async () => {
  assert.equal(
    (
      await status({
        runner: async () => ({ code: 0, stdout: "Claude 999" }),
        access: absent,
      })
    ).available,
    false,
  );
  const { runner } = fakeRunner();
  const s = await status({ runner, access: absent });
  assert.equal(s.available, true);
  assert.equal(s.authentication, "claude.ai");
  assert.equal(s.inferenceVerified, false);
});
test("managed policy and unreadable policy refuse provider before running CLI", async () => {
  let calls = 0;
  const runner = async () => {
    calls++;
  };
  assert.equal(
    (await status({ runner, access: async () => {} })).available,
    false,
  );
  assert.equal(
    (
      await status({
        runner,
        access: async () => {
          const e = new Error("denied");
          e.code = "EACCES";
          throw e;
        },
      })
    ).available,
    false,
  );
  assert.equal(calls, 0);
});
test("subscription invocation uses only transcript stdin with tools disabled and API environment stripped", async () => {
  const { runner, calls } = fakeRunner();
  const result = await summarize({
    transcript: "Meeting ABC-42",
    prompt: "Summarize facts",
    model: "sonnet",
    runner,
    access: absent,
    env: {
      PATH: "/usr/bin",
      HOME: "/existing",
      ANTHROPIC_API_KEY: "do-not-use",
      ANTHROPIC_AUTH_TOKEN: "do-not-use",
      CLAUDE_CODE_USE_BEDROCK: "1",
    },
  });
  assert.match(result.text, /ABC-42/);
  const call = calls.at(-1);
  assert.equal(call.options.input, "Meeting ABC-42");
  assert.ok(!call.args.includes("Meeting ABC-42"));
  assert.ok(!call.args.includes("--bare"));
  assert.equal(call.args[call.args.indexOf("--tools") + 1], "");
  assert.equal(call.args[call.args.indexOf("--disallowedTools") + 1], "*");
  assert.equal(call.options.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(call.options.env.HOME, "/existing");
  for (const c of calls)
    await assert.rejects(fs.access(c.options.cwd), { code: "ENOENT" });
});
test("invalid provider results and cancellation never publish a summary", async () => {
  for (const overrides of [
    { code: 1 },
    { stdout: "not json" },
    {
      stdout: JSON.stringify({
        type: "result",
        subtype: "error",
        is_error: true,
        result: "not successful",
      }),
    },
  ]) {
    const { runner } = fakeRunner(overrides);
    await assert.rejects(
      summarize({
        transcript: "facts",
        prompt: "summary",
        runner,
        access: absent,
      }),
    );
  }
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    summarize({
      transcript: "facts",
      prompt: "summary",
      signal: controller.signal,
      runner: async () => {
        calls++;
      },
      access: absent,
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 0);
});
test("bounds and invalid model are rejected before CLI invocation", async () => {
  let calls = 0;
  for (const options of [
    { transcript: "x".repeat(500001), prompt: "summarize" },
    { transcript: "facts", prompt: "summarize", model: "--do-something" },
  ]) {
    if (options.model) options.model = "bad model;";
    await assert.rejects(
      summarize({
        ...options,
        runner: async () => {
          calls++;
        },
        access: absent,
      }),
    );
  }
  assert.equal(calls, 0);
});

test("Console/API and ambiguous status cannot become a subscription provider", async () => {
  for (const method of ["api_key", "oauth_token", "third_party", undefined]) {
    const { runner } = fakeRunner();
    const checked = async (binary, args, options) =>
      args[0] === "auth"
        ? { code: 0, stdout: JSON.stringify({ authMethod: method }) }
        : runner(binary, args, options);
    assert.equal(
      (await status({ runner: checked, access: absent })).available,
      false,
    );
    await assert.rejects(
      summarize({
        transcript: "facts",
        prompt: "summary",
        runner: checked,
        access: absent,
      }),
      /subscription sign-in/,
    );
  }
});
test("default spawn runner enforces timeout and cleans isolated cwd using a synthetic CLI", async () => {
  const os = require("node:os"),
    path = require("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "summary-cli-fixture-"));
  try {
    const binary = path.join(dir, "fake-cli");
    await fs.writeFile(
      binary,
      `#!${process.execPath}\nif(process.argv.includes('--help')) console.log(${JSON.stringify(REQUIRED_FLAGS.join("\n"))});else if(process.argv.includes('--version'))console.log('synthetic fixture');else if(process.argv.includes('auth'))console.log(JSON.stringify({authMethod:'claude.ai'}));else {process.stdin.resume();setInterval(()=>{},1000);}\n`,
      { mode: 0o700 },
    );
    await assert.rejects(
      summarize({
        transcript: "facts",
        prompt: "summary",
        binary,
        access: absent,
        timeoutMs: 1000,
      }),
      /timed out/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
