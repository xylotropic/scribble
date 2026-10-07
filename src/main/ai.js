"use strict";
const cloudAI = require("./cloud-ai");
function endpoint(value) {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Invalid AI endpoint");
  if (
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw Error("Remote AI servers must use HTTPS");
  return url.toString().replace(/\/$/, "");
}
async function chat(
  settings,
  messages,
  key,
  { signal, images = [], documents = [], timeoutMs } = {},
) {
  if (settings.aiProvider === "ollama") {
    if (!Array.isArray(documents) || documents.length)
      throw Error("Ollama does not support PDF documents");
    if (
      !Array.isArray(images) ||
      images.length > 5 ||
      images.some(
        (image) =>
          !image ||
          typeof image.data !== "string" ||
          image.data.length > 4 * 1024 * 1024 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data),
      )
    )
      throw Error("Invalid image context");
    const userIndex = messages.findLastIndex(
      (message) => message.role === "user",
    );
    if (images.length && userIndex < 0)
      throw Error("Images require a user message");
    const localMessages = messages.map((message, index) =>
      index === userIndex && images.length
        ? { ...message, images: images.map((image) => image.data) }
        : message,
    );
    const base = endpoint(settings.aiEndpoint);
    const controller = signal || AbortSignal.timeout(180000);
    const r = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: settings.aiModel,
        messages: localMessages,
        stream: false,
      }),
      signal: controller,
    });
    if (!r.ok) throw Error("Local AI: " + (await r.text()).slice(0, 400));
    const x = await r.json();
    return String(x.message?.content || "")
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim();
  }
  if (typeof key !== "string" || !key.trim())
    throw Error("Cloud AI API key required");
  const provider =
    settings.aiProvider === "openai-compatible"
      ? "custom"
      : settings.aiProvider;
  const result = await cloudAI.chat({
    provider,
    apiKey: key,
    model: settings.aiModel,
    baseURL: settings.aiEndpoint || undefined,
    deployment: settings.aiDeployment,
    apiVersion: settings.aiVersion,
    messages,
    images,
    documents,
    signal,
    timeoutMs: timeoutMs || 180000,
    // Loopback is useful for an explicitly configured compatible local server.
    allowLoopback: true,
  });
  return result.text;
}
async function localModels(settings) {
  const r = await fetch(endpoint(settings.aiEndpoint) + "/api/tags", {
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw Error("Ollama is unavailable");
  return (await r.json()).models || [];
}
async function pullModel(settings, onProgress) {
  const r = await fetch(endpoint(settings.aiEndpoint) + "/api/pull", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: settings.aiModel, stream: true }),
  });
  if (!r.ok) throw Error("Ollama model download failed");
  let buffer = "";
  for await (const b of r.body) {
    buffer += Buffer.from(b).toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const l of lines)
      if (l) {
        const x = JSON.parse(l);
        if (x.error) throw Error(x.error);
        onProgress(x);
      }
  }
  return localModels(settings);
}
function extractiveSummary(text, template = "Meeting") {
  const sentences = text.match(/[^.!?\n]+[.!?]?/g) || [text];
  const actions = sentences.filter((s) =>
    /\b(will|need to|todo|action|follow up|by (monday|tuesday|wednesday|thursday|friday)|should)\b/i.test(
      s,
    ),
  );
  const decisions = sentences.filter((s) =>
    /\b(decided|agreed|decision|choose|chosen|approved)\b/i.test(s),
  );
  return `# ${template} notes\n\n## Overview\n${sentences
    .slice(0, Math.min(5, sentences.length))
    .map((s) => s.trim())
    .join(
      " ",
    )}\n\n## Action items\n${actions.length ? actions.map((s) => "- [ ] " + s.trim()).join("\n") : "No explicit action items detected."}\n\n## Decisions\n${decisions.length ? decisions.map((s) => "- " + s.trim()).join("\n") : "No explicit decisions detected."}\n\n*Generated locally using extractive summarization. Configure a language model for synthesis.*`;
}
module.exports = { endpoint, chat, localModels, pullModel, extractiveSummary };
