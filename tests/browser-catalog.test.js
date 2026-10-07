"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const { listBrowsers } = require("../src/main/browser-catalog");
function fixture() {
  const entries = new Map(),
    reads = [];
  const dir = (value) => {
    let target = value;
    while (target !== "/") {
      if (!entries.has(target)) entries.set(target, { kind: "directory" });
      target = path.dirname(target);
    }
    entries.set("/", { kind: "directory" });
    if (value.endsWith(".app")) {
      const base = path.basename(value, ".app"),
        binary = base === "Firefox" ? "firefox" : base;
      const target = path.join(value, "Contents/MacOS", binary);
      dir(path.dirname(target));
      entries.set(target, { kind: "file", text: "" });
    }
  };
  const file = (value, text, size) => {
    dir(path.dirname(value));
    entries.set(value, {
      kind: "file",
      text,
      size: size ?? Buffer.byteLength(text),
    });
  };
  const link = (value) => {
    dir(path.dirname(value));
    entries.set(value, { kind: "symlink" });
  };
  const fs = {
    async lstat(value) {
      const x = entries.get(value);
      if (!x) throw Error("ENOENT");
      return {
        size: x.size || 0,
        isSymbolicLink: () => x.kind === "symlink",
        isDirectory: () => x.kind === "directory",
        isFile: () => x.kind === "file",
      };
    },
    async readFile(value) {
      reads.push(value);
      const x = entries.get(value);
      if (!x || x.kind !== "file") throw Error("ENOENT");
      return x.text;
    },
  };
  return { dir, file, link, fs, reads };
}
const homeDir = "/Users/fixture";
test("allowlisted apps and only sanitized Chromium profile metadata are returned", async () => {
  const f = fixture();
  f.dir("/Applications/Google Chrome.app");
  f.dir(homeDir + "/Applications/Safari.app");
  const root = homeDir + "/Library/Application Support/Google/Chrome";
  f.dir(root + "/Default");
  f.dir(root + "/Profile 2");
  f.file(
    root + "/Local State",
    JSON.stringify({
      profile: {
        info_cache: {
          Default: {
            name: "Personal",
            user_name: "secret@example.com",
            gaia_id: "secret",
          },
          "Profile 2": { name: "Work" },
          "../private": { name: "Bad" },
          Missing: { name: "Missing" },
        },
      },
      token: "secret",
    }),
  );
  const result = await listBrowsers({ fs: f.fs, homeDir });
  assert.deepEqual(result, [
    {
      id: "chrome",
      name: "Google Chrome",
      family: "chromium",
      bundlePath: "/Applications/Google Chrome.app",
      executable:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      profiles: [
        { id: "Default", name: "Personal" },
        { id: "Profile 2", name: "Work" },
      ],
    },
    {
      id: "safari",
      name: "Safari",
      family: "webkit",
      bundlePath: homeDir + "/Applications/Safari.app",
      executable: homeDir + "/Applications/Safari.app/Contents/MacOS/Safari",
      profiles: [],
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /secret|token|gaia/);
  assert.deepEqual(f.reads, [root + "/Local State"]);
});
test("Gecko relative profiles require safe existing directories and expose section ids with names", async () => {
  const f = fixture();
  f.dir("/Applications/Firefox.app");
  const root = homeDir + "/Library/Application Support/Firefox";
  f.dir(root + "/Profiles/abcd.default");
  f.dir(root + "/Profiles/linked");
  f.link(root + "/Profiles/linked");
  f.file(
    root + "/profiles.ini",
    "[Profile0]\nName=Work\nIsRelative=1\nPath=Profiles/abcd.default\n[Profile1]\nName=Traversal\nIsRelative=1\nPath=../private\n[Profile2]\nName=Absolute\nIsRelative=0\nPath=/tmp/private\n[Profile3]\nName=Linked\nIsRelative=1\nPath=Profiles/linked",
  );
  assert.deepEqual((await listBrowsers({ fs: f.fs, homeDir }))[0].profiles, [
    { id: "Profile0", name: "Work" },
  ]);
});
test("symlinked app or metadata ancestor is skipped and oversized or malformed files are not read", async () => {
  const f = fixture();
  f.link("/Applications/Google Chrome.app");
  f.dir("/Applications/Microsoft Edge.app");
  const root = homeDir + "/Library/Application Support/Microsoft Edge";
  f.file(root + "/Local State", "{}", 2 * 1024 * 1024 + 1);
  assert.deepEqual(
    (await listBrowsers({ fs: f.fs, homeDir })).map((x) => x.id),
    ["edge"],
  );
  assert.equal(f.reads.length, 0);
  const g = fixture();
  g.dir("/Applications/Google Chrome.app");
  g.file(
    homeDir + "/Library/Application Support/Google/Chrome/Local State",
    "{invalid",
  );
  g.link(homeDir + "/Library/Application Support/Google");
  assert.deepEqual((await listBrowsers({ fs: g.fs, homeDir }))[0].profiles, []);
  assert.equal(g.reads.length, 0);
});
test("profile output is capped and discovery never probes authentication or unlisted browser locations", async () => {
  const f = fixture();
  f.dir("/Applications/Google Chrome.app");
  f.dir("/Applications/Ego Lite.app");
  const root = homeDir + "/Library/Application Support/Google/Chrome",
    cache = {};
  for (let i = 0; i < 80; i++) {
    cache["Profile " + i] = { name: "Profile " + i };
    f.dir(root + "/Profile " + i);
  }
  f.file(
    root + "/Local State",
    JSON.stringify({ profile: { info_cache: cache } }),
  );
  const result = await listBrowsers({ fs: f.fs, homeDir });
  assert.equal(result.length, 1);
  assert.equal(result[0].profiles.length, 64);
  assert.ok(f.reads.every((x) => x.endsWith("/Local State")));
  await assert.rejects(
    listBrowsers({ fs: f.fs, homeDir: "relative" }),
    /Invalid home/,
  );
});
test("malformed metadata does not hide installed apps and symlinked native executable is not trusted", async () => {
  const f = fixture();
  f.dir("/Applications/Google Chrome.app");
  f.file(
    homeDir + "/Library/Application Support/Google/Chrome/Local State",
    "{bad",
  );
  assert.deepEqual((await listBrowsers({ fs: f.fs, homeDir }))[0].profiles, []);
  f.link("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  assert.deepEqual(await listBrowsers({ fs: f.fs, homeDir }), []);
});


test('Safari can be discovered at the exact Apple Cryptex path without following an Applications symlink',async()=>{
 const f=fixture();f.link('/Applications/Safari.app');f.dir('/System/Cryptexes/App/System/Applications/Safari.app');
 const result=await listBrowsers({fs:f.fs,homeDir});assert.equal(result[0].id,'safari');assert.equal(result[0].bundlePath,'/System/Cryptexes/App/System/Applications/Safari.app');assert.deepEqual(result[0].profiles,[]);assert.deepEqual(f.reads,[]);
});
