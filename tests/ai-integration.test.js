"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { chat } = require("../src/main/ai");
async function fixture(t, handler) {
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    handler(req, JSON.parse(body), res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  return `http://127.0.0.1:${server.address().port}`;
}
function reply(res, data, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}
test("Ollama remains keyless with original message shape and thinking cleanup", async (t) => {
  const aiEndpoint = await fixture(t, (req, body, res) => {
    assert.equal(req.url, "/api/chat");
    assert.equal(req.headers.authorization, undefined);
    assert.equal(body.stream, false);
    assert.equal(body.model, "qwen2.5:7b");
    reply(res, { message: { content: "<think>hidden</think> ready" } });
  });
  assert.equal(
    await chat({ aiProvider: "ollama", aiEndpoint, aiModel: "qwen2.5:7b" }, [
      { role: "user", content: "hello" },
    ]),
    "ready",
  );
});
test("legacy compatible alias retains endpoint prefix and now requires key", async (t) => {
  const aiEndpoint = await fixture(t, (req, body, res) => {
    assert.equal(req.url, "/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer fixture");
    reply(res, { choices: [{ message: { content: "answer" } }] });
  });
  const settings = {
    aiProvider: "openai-compatible",
    aiEndpoint: aiEndpoint + "/v1",
    aiModel: "fixture-model",
  };
  await assert.rejects(
    chat(settings, [{ role: "user", content: "hello" }]),
    /API key required/,
  );
  assert.equal(
    await chat(settings, [{ role: "user", content: "hello" }], "fixture"),
    "answer",
  );
});
test("native Anthropic dispatch does not send compatible messages API", async (t) => {
  const aiEndpoint = await fixture(t, (req, body, res) => {
    assert.equal(req.url, "/v1/messages");
    assert.equal(req.headers["x-api-key"], "fixture");
    assert.equal(body.system, "instructions");
    assert.equal(body.messages[0].content[1].source.type, "base64");
    reply(res, { content: [{ type: "text", text: "answer" }] });
  });
  assert.equal(
    await chat(
      { aiProvider: "anthropic", aiEndpoint, aiModel: "fixture" },
      [
        { role: "system", content: "instructions" },
        { role: "user", content: "hello" },
      ],
      "fixture",
      { images: [{ mimeType: "image/png", data: "YQ==" }] },
    ),
    "answer",
  );
});
test("Azure settings map deployment and version exactly", async (t) => {
  const aiEndpoint = await fixture(t, (req, body, res) => {
    assert.equal(
      req.url,
      "/openai/deployments/test-deployment/chat/completions?api-version=2024-10-21",
    );
    assert.equal(req.headers["api-key"], "fixture");
    reply(res, { choices: [{ message: { content: "azure" } }] });
  });
  assert.equal(
    await chat(
      {
        aiProvider: "azure",
        aiEndpoint,
        aiModel: "model-label",
        aiDeployment: "test-deployment",
        aiVersion: "2024-10-21",
      },
      [{ role: "user", content: "hello" }],
      "fixture",
    ),
    "azure",
  );
});
test("cloud key rejection precedes endpoint parsing/network and cancellation propagates", async (t) => {
  await assert.rejects(
    chat({ aiProvider: "anthropic", aiEndpoint: "malformed" }, []),
    /API key required/,
  );
  const aiEndpoint = await fixture(t, () =>
    assert.fail("should not call server"),
  );
  const controller = new AbortController();
  controller.abort(new Error("integration cancel"));
  await assert.rejects(
    chat(
      { aiProvider: "openai", aiEndpoint, aiModel: "fixture" },
      [{ role: "user", content: "hello" }],
      "fixture",
      { signal: controller.signal },
    ),
    /integration cancel/,
  );
});
test("Ollama vision context is attached only to the last user message", async (t) => {
  const aiEndpoint = await fixture(t, (_req, body, res) => {
    assert.equal(body.messages[0].images, undefined);
    assert.deepEqual(body.messages[2].images, ["YQ=="]);
    reply(res, { message: { content: "visual answer" } });
  });
  assert.equal(
    await chat(
      { aiProvider: "ollama", aiEndpoint, aiModel: "vision-fixture" },
      [
        { role: "user", content: "old" },
        { role: "assistant", content: "previous answer" },
        { role: "user", content: "describe" },
      ],
      "",
      { images: [{ mimeType: "image/png", data: "YQ==" }] },
    ),
    "visual answer",
  );
});
