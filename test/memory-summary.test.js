const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeMemory, CHUNK_CHARS } = require("../src/main/memory-summary");
test("actual callback receives bounded reference chunks then combination with facts preserved", async () => {
  const requests = [];
  const result = await summarizeMemory(
    "Project ID ABC-42 deadline 2026-10-21. " + "x".repeat(CHUNK_CHARS),
    async (messages, options) => {
      requests.push({ messages, options });
      return { content: "Project ID ABC-42; deadline 2026-10-21." };
    },
  );
  assert.equal(result.chunkCount, 2);
  assert.equal(result.providerCalls, 3);
  assert.match(result.summary, /ABC-42/);
  assert.match(result.summary, /2026-10-21/);
  assert.ok(
    requests.every(
      (r) =>
        r.messages[0].role === "system" &&
        r.messages[1].content.length <= CHUNK_CHARS,
    ),
  );
});
test("provider errors and invalid schema never become summaries", async () => {
  await assert.rejects(
    summarizeMemory("Facts", async () => ({ text: "wrong schema" })),
    /no text/,
  );
  await assert.rejects(
    summarizeMemory("Facts", async () => {
      throw new Error("provider offline");
    }),
    /provider offline/,
  );
  await assert.rejects(
    summarizeMemory("Facts", async () => "a".repeat(24001)),
    /24,000/,
  );
});
test("cancellation before and after provider prevents publication or more calls", async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  let calls = 0;
  await assert.rejects(
    summarizeMemory(
      "Facts",
      async () => {
        calls++;
        return "summary";
      },
      { signal: cancelled.signal },
    ),
    { name: "AbortError" },
  );
  assert.equal(calls, 0);
  const active = new AbortController();
  await assert.rejects(
    summarizeMemory(
      "x".repeat(24000),
      async (_, options) => {
        assert.equal(options.signal, active.signal);
        calls++;
        active.abort();
        return "summary";
      },
      { signal: active.signal },
    ),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});
test("nonreducing provider is rejected instead of looping indefinitely", async () => {
  await assert.rejects(
    summarizeMemory("x".repeat(24000), async (messages) => messages[1].content),
    /did not reduce/,
  );
});
