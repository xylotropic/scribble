"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  matchVoiceShortcut: match,
  resolveWebsite,
  resolveCommonFolder,
} = require("../src/main/voice-routing");
test("longest alias and custom equal-trigger precedence survive saved builtin preferences", () => {
  const base = { trigger: "open", builtin: true },
    alias = { trigger: "project", aliases: ["open project"] },
    custom = { trigger: "google", builtin: false },
    google = { trigger: "google", builtin: true };
  assert.equal(match("open project Scribble", [base, alias]).shortcut, alias);
  assert.equal(match("google tea", [google, custom]).shortcut, custom);
  assert.equal(
    match("google tea", [{ ...custom, enabled: false }, google]).shortcut,
    google,
  );
  assert.equal(
    match("ask clawed explain", [{ trigger: "ask claude", builtin: true }])
      .query,
    "explain",
  );
  assert.equal(
    match("you tube cats", [{ trigger: "youtube", builtin: true }]).query,
    "cats",
  );
  assert.equal(
    match("ask clawed x", [
      { trigger: "ask claude", builtin: true, enabled: false },
    ]),
    null,
  );
});
test("ranked exact/filler/fuzzy matching supports near speech errors and rejects far errors or false word prefixes", () => {
  const google = { trigger: "google" };
  assert.equal(
    match("so well please google pizza", [google]).matchTier,
    "filler",
  );
  assert.equal(match("gogle pizza", [google]).matchTier, "fuzzy");
  assert.equal(match("goggle pizza", [google]).query, "pizza");
  assert.equal(match("giraffe pizza", [google]), null);
  assert.equal(match("googleplay pizza", [google]), null);
  assert.equal(match("opener", [{ trigger: "open" }]), null);
  const exact = { trigger: "gogle" };
  assert.equal(match("gogle pizza", [google, exact]).shortcut, exact);
});
test("Unicode aliases, boundaries and bounded malformed shortcut data are handled without regex injection", () => {
  const french = { trigger: "étudier" },
    japanese = { trigger: "開く" };
  assert.equal(match("ÉTUDIER les notes", [french]).query, "les notes");
  assert.equal(match("étudierplus", [french]), null);
  assert.equal(match("開く 資料", [japanese]).query, "資料");
  assert.equal(match("開く資料", [japanese]), null);
  assert.equal(
    match("open x", [
      null,
      { trigger: 7 },
      { trigger: "" },
      { trigger: "x".repeat(121) },
    ]),
    null,
  );
  assert.equal(match("x".repeat(16001), [{ trigger: "xxxx" }]), null);
  assert.equal(match("a+b query", [{ trigger: "a+b" }]).query, "query");
});
test("website resolution accepts spoken dots, safe custom placeholders and only valid web targets", () => {
  assert.equal(resolveWebsite("“example dot com”"), "https://example.com/");
  assert.equal(resolveWebsite("example.com."), "https://example.com/");
  assert.equal(
    resolveWebsite("example.com/?q={{text}}", "a & b"),
    "https://example.com/?q=a%20%26%20b",
  );
  assert.equal(
    resolveWebsite("http://example.com/path"),
    "http://example.com/path",
  );
  for (const value of [
    "",
    "this nonsense",
    "nonsense",
    "mailto:a@example.com",
    "file:///tmp/a",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "example..com",
    "https://[invalid",
  ])
    assert.equal(resolveWebsite(value), null, value);
});
test("common folders normalize singular/plural and optional trailing folder without matching arbitrary paths", () => {
  for (const value of [
    "Downloads",
    "download",
    "the downloads folder",
    "downloads folder.",
  ])
    assert.equal(resolveCommonFolder(value), "Downloads");
  assert.equal(resolveCommonFolder("application folder"), "/Applications");
  assert.equal(resolveCommonFolder("home"), "");
  assert.equal(resolveCommonFolder("the pictures folder"), "Pictures");
  for (const value of ["unknown", "/tmp", "downloads../../", "downloads now"])
    assert.equal(resolveCommonFolder(value), null);
});
