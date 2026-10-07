"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { planShortcutActions: plan } = require("../src/main/shortcut-actions");
const opts = { homeDir: "/Users/fixture" };
test("multiple action groups preserve ordering, grouped websites, app folder and tilde expansion", () => {
  const value = plan(
    {
      actions: [
        {
          type: "websites",
          urls: ["example.com/?q={{text}}", "https://example.org/"],
          profile: "Profile 2",
        },
        {
          type: "application",
          name: "Visual Studio Code",
          folder: "~/Projects/One",
        },
        { type: "folders", paths: ["~/Downloads", "/Applications"] },
      ],
    },
    "a & b",
    opts,
  );
  assert.deepEqual(value, {
    query: "a & b",
    actions: [
      {
        type: "websites",
        browser: "chrome",
        urls: ["https://example.com/?q=a%20%26%20b", "https://example.org/"],
        profile: "Profile 2",
      },
      {
        type: "application",
        name: "Visual Studio Code",
        folder: "/Users/fixture/Projects/One",
      },
      { type: "folders", paths: ["/Users/fixture/Downloads", "/Applications"] },
    ],
  });
});
test("legacy simple shortcuts derive a plan without modifying stored values", () => {
  const simple = { type: "url", target: "example.com", profile: "Default" };
  assert.equal(plan(simple, "", opts).actions[0].profile, "Default");
  assert.deepEqual(simple, {
    type: "url",
    target: "example.com",
    profile: "Default",
  });
  assert.deepEqual(plan({ type: "app", target: "Safari" }, "", opts).actions, [
    { type: "application", name: "Safari", folder: "" },
  ]);
  assert.equal(
    plan({ type: "folder", target: "~/Documents" }, "", opts).actions[0]
      .paths[0],
    "/Users/fixture/Documents",
  );
  assert.equal(
    plan({ target: "folder" }, "application folder", opts).actions[0].paths[0],
    "/Applications",
  );
});
test("navigation explicitly supports valid mailto, while ordinary custom website actions remain web-only", () => {
  assert.equal(
    plan({ target: "navigate" }, "mailto:one@example.com?subject=Hello", opts)
      .actions[0].urls[0],
    "mailto:one@example.com?subject=Hello",
  );
  assert.equal(plan({ target: "navigate" }, "mailto:broken", opts), null);
  assert.equal(
    plan({ type: "url", target: "mailto:one@example.com" }, "", opts),
    null,
  );
  assert.equal(
    plan(
      { target: "navigate" },
      "mailto:one@example.com?subject=%0AInjected",
      opts,
    ),
    null,
  );
});
test("invalid action or target rejects the entire plan atomically and profiles cannot provide arbitrary paths", () => {
  const valid = { type: "folders", paths: ["/Applications"] };
  for (const bad of [
    { type: "websites", urls: ["javascript:alert(1)"] },
    { type: "folders", paths: ["relative/path"] },
    { type: "application", name: "", folder: "" },
    { type: "application", name: "App", folder: "relative" },
    { type: "script", command: "do stuff" },
    { type: "websites", urls: ["example.com"], profile: "../../private" },
    { type: "websites", urls: ["example.com"], profile: "Profile 2 --args" },
  ])
    assert.equal(plan({ actions: [valid, bad] }, "", opts), null);
  for (const actions of [
    [],
    new Array(33).fill(valid),
    [{ type: "websites", urls: new Array(17).fill("example.com") }],
    [{ type: "folders", paths: ["/tmp/\u0000bad"] }],
    [{ type: "application", name: "App\nInjected" }],
  ])
    assert.equal(plan({ actions }, "", opts), null);
});

test("custom Website action keeps exact substituted query punctuation", () => {
  const result = plan(
    {
      actions: [
        {
          type: "websites",
          urls: ["example.com/?q={{text}}", "example.org/?q=wow!"],
        },
      ],
    },
    "hi! ?",
    opts,
  );
  assert.deepEqual(result.actions[0].urls, [
    "https://example.com/?q=hi!%20%3F",
    "https://example.org/?q=wow!",
  ]);
});

test("browser ids and family-specific profile tokens validate without requiring installed browser reads", () => {
  for (const [browser, profile] of [
    ["chrome", "Default"],
    ["firefox", "Profile0"],
    ["safari", ""],
    ["default", ""],
    ["arc", "Profile 2"],
  ]) {
    const result = plan(
      {
        actions: [
          { type: "websites", urls: ["example.com"], browser, profile },
        ],
      },
      "",
      opts,
    );
    assert.equal(result.actions[0].browser, browser);
    assert.equal(result.actions[0].profile, profile);
  }
  for (const [browser, profile] of [
    ["ego", ""],
    ["firefox", "Profile 1"],
    ["default", "Default"],
    ["safari", "Profile0"],
    ["chrome", "../bad"],
  ])
    assert.equal(
      plan(
        {
          actions: [
            { type: "websites", urls: ["example.com"], browser, profile },
          ],
        },
        "",
        opts,
      ),
      null,
    );
});
