"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { chat } = require("../src/main/ai");
const enabled = process.env.SCRIBBLE_LIVE_AI === "1";
const settings = {
  aiProvider: "ollama",
  aiEndpoint: "http://127.0.0.1:11434",
  aiModel: "qwen2.5:7b",
};
const summaryPrompt = require("../src/main/summary").prompt();
test(
  "LIVE local 7B cleanup preserves technical names, deadline and uncertainty",
  { skip: !enabled, timeout: 180000 },
  async () => {
    const output = await chat(
      settings,
      [
        {
          role: "system",
          content:
            "Clean up the dictated text. Fix capitalization, punctuation and grammar; remove filler words. Preserve names, dates, uncertainty and meaning. Return only the cleaned text. Do not add facts.",
        },
        {
          role: "user",
          content:
            "um hi Priya can you send the Kubernetes migration plan by Friday i think the staging deployment is blocked on the Supabase key but please confirm",
        },
      ],
      "",
    );
    for (const word of [
      "Priya",
      "Kubernetes",
      "Friday",
      "Supabase",
      "I think",
      "confirm",
    ])
      assert.ok(output.includes(word), `Lost ${word}: ${output}`);
    assert.doesNotMatch(output, /<think>|We are given|Steps:|^um\b/i);
    assert.ok(output.length < 400, "Cleanup must return only edited text");
  },
);
test(
  "LIVE local 7B grounded summary retains decisions, actual owners and unresolved facts",
  { skip: !enabled, timeout: 180000 },
  async () => {
    const input =
      "Ana: We agreed to move the Atlas launch from October 7 to October 14. Priya: I will run the billing dry run on October 10. Sam: I will update the release checklist by October 9. Ana: We have not decided whether to increase the price. Priya: The database migration might be blocked by the API key; I need to check. Sam: No owner has been assigned to the pricing decision.";
    const response = await chat(
      settings,
      [
        { role: "system", content: summaryPrompt },
        { role: "user", content: input },
      ],
      "",
    );
    const output = require("../src/main/summary").formatGrounded(
      input,
      response,
    );
    for (const date of ["October 7", "October 14", "October 10", "October 9"])
      assert.ok(output.includes(date), `Lost ${date}: ${output}`);
    assert.match(output, /Priya[^\n]*billing|billing[^\n]*Priya/i);
    assert.match(
      output,
      /Sam[^\n]*release checklist|release checklist[^\n]*Sam/i,
    );
    assert.match(output, /might/);
    assert.match(output, /not decided|undecided/i);
    assert.match(output, /[Nn]o owner|unassigned|not been assigned/);
    assert.doesNotMatch(
      output,
      /Ana[^\n]*(?:determine|resolve|decide whether)/i,
    );
    assert.doesNotMatch(output, /upcoming week|next week|<think>/i);
  },
);
module.exports = { summaryPrompt };
