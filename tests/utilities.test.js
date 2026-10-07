const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");
const AdmZip = require("adm-zip");
const { performUtility } = require("../src/main/utilities");
const { run, resolveExecutablePath } = require("../src/main/speech");
async function fixture(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scribble-utility-"));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
test("real image conversion resizes PNG into JPEG and WebP", () =>
  fixture(async (dir) => {
    const input = path.join(dir, "input.png");
    await sharp({
      create: { width: 200, height: 100, channels: 4, background: "#ff880080" },
    })
      .png()
      .toFile(input);
    for (const format of ["jpg", "webp", "png"]) {
      const output = path.join(dir, "converted." + format);
      const result = await performUtility({
        operation: "image-convert",
        files: [input],
        output,
        options: { width: 80, quality: 70 },
      });
      const meta = await sharp(output).metadata();
      assert.equal(meta.width, 80);
      assert.equal(meta.height, 40);
      assert.ok(result.details.bytes > 0);
    }
  }));
function wav() {
  const count = 8000;
  const data = Buffer.alloc(44 + count * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(16000, 24);
  data.writeUInt32LE(32000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    data.writeInt16LE(
      Math.round(Math.sin((i * 440 * 2 * Math.PI) / 16000) * 16000),
      44 + i * 2,
    );
  return data;
}
test("real WAV converts to MP3, M4A, Opus and PCM WAV", () =>
  fixture(async (dir) => {
    const input = path.join(dir, "tone.wav");
    await fs.writeFile(input, wav());
    for (const format of ["mp3", "m4a", "opus", "wav"]) {
      const output = path.join(dir, "converted." + format);
      const r = await performUtility({
        operation: "audio-convert",
        files: [input],
        output,
        options: { mono: true, normalize: true },
      });
      assert.ok(r.details.bytes > 100);
      const decoded = path.join(dir, format + ".pcm");
      await run(
        resolveExecutablePath(require("../src/main/ffmpeg").ffmpegExecutable()),
        [
          "-nostdin",
          "-y",
          "-i",
          output,
          "-f",
          "s16le",
          "-ar",
          "16000",
          "-ac",
          "1",
          decoded,
        ],
      );
      assert.ok((await fs.stat(decoded)).size >= 15000);
    }
  }));
test("real MP4 converts to WebM and MP4 with resize", () =>
  fixture(async (dir) => {
    const input = path.join(dir, "source.mp4");
    await run(
      resolveExecutablePath(require("../src/main/ffmpeg").ffmpegExecutable()),
      [
        "-nostdin",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=64x64:r=10",
        "-t",
        "0.3",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        input,
      ],
    );
    for (const format of ["mp4", "webm"]) {
      const result = await performUtility({
        operation: "video-convert",
        files: [input],
        output: path.join(dir, "converted." + format),
        options: { width: 32, removeAudio: true },
      });
      assert.ok(result.details.bytes > 100);
    }
  }));
test("PDF merge preserves page order and content", () =>
  fixture(async (dir) => {
    const files = [];
    for (const dimensions of [
      [200, 300],
      [400, 500],
    ]) {
      const doc = await PDFDocument.create();
      doc.addPage(dimensions);
      const file = path.join(dir, dimensions[0] + ".pdf");
      await fs.writeFile(file, await doc.save());
      files.push(file);
    }
    const output = path.join(dir, "merged.pdf");
    const result = await performUtility({
      operation: "pdf-merge",
      files,
      output,
    });
    assert.equal(result.details.pages, 2);
    const merged = await PDFDocument.load(await fs.readFile(output));
    assert.equal(merged.getPage(0).getWidth(), 200);
    assert.equal(merged.getPage(1).getHeight(), 500);
  }));
test("ZIP creation and safe extraction preserve nested bytes", () =>
  fixture(async (dir) => {
    const folder = path.join(dir, "project");
    await fs.mkdir(path.join(folder, "nested"), { recursive: true });
    await fs.writeFile(
      path.join(folder, "nested", "file.txt"),
      "hello archive",
    );
    const archive = path.join(dir, "project.zip");
    await performUtility({
      operation: "archive-create",
      files: [folder],
      output: archive,
    });
    const output = path.join(dir, "extracted");
    const result = await performUtility({
      operation: "archive-extract",
      files: [archive],
      output,
    });
    assert.equal(
      await fs.readFile(path.join(output, "project/nested/file.txt"), "utf8"),
      "hello archive",
    );
    assert.equal(result.details.entries, 3);
  }));
test("archive rejects traversal, symlinks and expansion bombs without writing output", () =>
  fixture(async (dir) => {
    const cases = [];
    const traversal = new AdmZip();
    traversal.addFile("outside.txt", Buffer.from("evil"));
    traversal.getEntries()[0].entryName = "../outside.txt";
    cases.push(traversal);
    const symlink = new AdmZip();
    symlink.addFile("link", Buffer.from("/outside"));
    symlink.getEntries()[0].attr = (0xa1ff << 16) >>> 0;
    cases.push(symlink);
    const bomb = new AdmZip();
    bomb.addFile("huge.txt", Buffer.alloc(2 * 1024 * 1024));
    cases.push(bomb);
    for (let i = 0; i < cases.length; i++) {
      const archive = path.join(dir, i + ".zip");
      await fs.writeFile(archive, cases[i].toBuffer());
      const output = path.join(dir, "output" + i);
      await assert.rejects(
        performUtility({
          operation: "archive-extract",
          files: [archive],
          output,
        }),
        /unsafe|traversal|symbolic|resource/i,
      );
      await assert.rejects(fs.access(output));
    }
    await assert.rejects(fs.access(path.join(dir, "outside.txt")));
  }));
test("configuration conversion round trips JSON YAML TOML", () =>
  fixture(async (dir) => {
    const value = {
      title: "Scribble",
      enabled: true,
      settings: { threads: 4 },
      tags: ["voice", "local"],
    };
    const input = path.join(dir, "input.json");
    await fs.writeFile(input, JSON.stringify(value));
    let previous = input;
    for (const format of ["yaml", "toml", "json"]) {
      const output = path.join(dir, "converted." + format);
      await performUtility({
        operation: "config-convert",
        files: [previous],
        output,
      });
      previous = output;
    }
    assert.deepEqual(JSON.parse(await fs.readFile(previous, "utf8")), value);
  }));
test("Markdown PDF supports headings, wrapping and Unicode with a real font", () =>
  fixture(async (dir) => {
    const input = path.join(dir, "document.md");
    await fs.writeFile(
      input,
      "# Scribble\n\nLocal voice notes: café 中文.\n\n" +
        "A long paragraph wraps onto lines. ".repeat(80),
    );
    const output = path.join(dir, "document.pdf");
    const result = await performUtility({
      operation: "markdown-pdf",
      files: [input],
      output,
    });
    const doc = await PDFDocument.load(await fs.readFile(output));
    assert.ok(doc.getPageCount() >= 1);
    assert.ok(result.details.font.includes("Unicode"));
    const md = path.join(dir, "copy.md");
    await performUtility({
      operation: "text-markdown",
      files: [input],
      output: md,
      options: { firstLineHeading: false },
    });
    assert.equal(
      await fs.readFile(md, "utf8"),
      await fs.readFile(input, "utf8"),
    );
  }));
test("text to Markdown turns only the first line into a heading and preserves remaining bytes", () =>
  fixture(async dir => {
    const input=path.join(dir,"notes.txt");
    for (const [index,text] of ["Project notes\r\nKeep this **exact**\r\n", "日本語\nSecond line\n", "Single line", "", "\nBlank first line", "  \r\nWhitespace first line"].entries()) {
      await fs.writeFile(input,text);
      const output=path.join(dir,`default-${index}.md`);
      const result=await performUtility({operation:"text-markdown",files:[input],output});
      const heading=!!text.split(/\r\n|\n|\r/,1)[0].trim();
      assert.equal(await fs.readFile(output,"utf8"),heading ? "# "+text : text);
      assert.equal(result.details.firstLineHeading,heading);
      const plain=path.join(dir,`plain-${index}.md`);
      await performUtility({operation:"text-markdown",files:[input],output:plain,options:{firstLineHeading:false}});
      assert.equal(await fs.readFile(plain,"utf8"),text);
    }
    const invalid=path.join(dir,"invalid.md");
    await assert.rejects(performUtility({operation:"text-markdown",files:[input],output:invalid,options:{firstLineHeading:"false"}}),/heading must/);
    await assert.rejects(fs.access(invalid));
  }));
test("outputs never replace inputs and overwriting requires an explicit option", () =>
  fixture(async (dir) => {
    const input = path.join(dir, "input.txt");
    const output = path.join(dir, "output.md");
    await fs.writeFile(input, "new");
    await fs.writeFile(output, "existing");
    await assert.rejects(
      performUtility({
        operation: "text-markdown",
        files: [input],
        output: input,
        options: { overwrite: true },
      }),
      /input/,
    );
    await assert.rejects(
      performUtility({ operation: "text-markdown", files: [input], output }),
      /already exists/,
    );
    assert.equal(await fs.readFile(output, "utf8"), "existing");
    await performUtility({
      operation: "text-markdown",
      files: [input],
      output,
      options: { overwrite: true },
    });
    assert.equal(await fs.readFile(output, "utf8"), "# new");
    const link = path.join(dir, "hardlink.md");
    await fs.link(input, link);
    await assert.rejects(
      performUtility({
        operation: "text-markdown",
        files: [input],
        output: link,
        options: { overwrite: true },
      }),
      /hard link/,
    );
  }));
test("linked output directories cannot sneak an archive into its own input tree", () =>
  fixture(async (dir) => {
    if (process.platform === "win32") return;
    const source = path.join(dir, "source");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "input.txt"), "source");
    const linked = path.join(dir, "alias");
    await fs.symlink(source, linked, "dir");
    await assert.rejects(
      performUtility({
        operation: "archive-create",
        files: [source],
        output: path.join(linked, "inside.zip"),
      }),
      /linked directory/,
    );
    await assert.rejects(fs.access(path.join(source, "inside.zip")));
  }));
test("text conversion rejects invalid UTF-8 without publishing a corrupted file", () =>
  fixture(async (dir) => {
    const input = path.join(dir, "binary.txt");
    const output = path.join(dir, "output.md");
    await fs.writeFile(input, Buffer.from([0xff, 0xfe, 0xfd]));
    await assert.rejects(
      performUtility({ operation: "text-markdown", files: [input], output }),
      /UTF-8/,
    );
    await assert.rejects(fs.access(output));
  }));

test("dominant palette measures a real red and blue generated image", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "palette-"));
  try {
    const raw = Buffer.alloc(40 * 20 * 3);
    for (let i = 0; i < 40 * 20; i++) {
      raw[i * 3 + (i % 40 < 30 ? 0 : 2)] = 255;
    }
    const input = path.join(dir, "colors.png");
    await require("sharp")(raw, { raw: { width: 40, height: 20, channels: 3 } })
      .png()
      .toFile(input);
    const output = path.join(dir, "palette.json");
    const result = await performUtility({
      operation: "image-palette",
      files: [input],
      output,
      options: { colors: 2 },
    });
    const palette = JSON.parse(await fs.readFile(output, "utf8"));
    assert.equal(palette.colors[0].hex, "#ff0000");
    assert.equal(palette.colors[1].hex, "#0000ff");
    assert.equal(palette.colors[0].proportion, 0.75);
    assert.equal(result.details.sampledPixels, 800);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("image compression reports actual byte reduction even when output grows", async () => {
  await fixture(async (dir) => {
    const input = path.join(dir, "tiny.png");
    await sharp({
      create: { width: 1, height: 1, channels: 3, background: "#ff0000" },
    })
      .png({ compressionLevel: 9 })
      .toFile(input);
    const output = path.join(dir, "compressed.png");
    const result = await performUtility({
      operation: "image-compress",
      files: [input],
      output,
    });
    const original = (await fs.stat(input)).size,
      actual = (await fs.stat(output)).size;
    assert.ok(actual >= original);
    assert.equal(result.details.reduced, false);
    assert.equal(result.details.savedBytes, 0);
    assert.match(result.details.notice, /not smaller/);
    assert.equal(result.details.inputBytes, original);
    assert.equal(result.details.bytes, actual);
  });
});
test('configuration XML roundtrips typed values and ordinary mixed trees through actual JSON/YAML/TOML files',()=>fixture(async dir=>{
  const {parseXML}=require('../src/main/config-xml');
  const values={title:'日本語 & <text>',enabled:true,count:42,nested:{key:'value'},list:['a','b']};
  const json=path.join(dir,'data.json');await fs.writeFile(json,JSON.stringify(values));
  for(const format of ['json','yaml','toml']){
    const xml=path.join(dir,format+'.xml');const input=format==='json'?json:path.join(dir,'data.'+format);
    if(format!=='json')await performUtility({operation:'config-convert',files:[json],output:input});
    await performUtility({operation:'config-convert',files:[input],output:xml});
    assert.deepEqual(parseXML(await fs.readFile(xml,'utf8')),values);
    const back=path.join(dir,'back.'+format);await performUtility({operation:'config-convert',files:[xml],output:back});
    const round=path.join(dir,'round-'+format+'.xml');await performUtility({operation:'config-convert',files:[back],output:round});assert.deepEqual(parseXML(await fs.readFile(round,'utf8')),values);
  }
  const original='<root lang="ja">\n  before<item id="1">日本語</item>after<item id="2">two</item>\n</root>';
  const input=path.join(dir,'ordinary.xml');await fs.writeFile(input,original);
  for(const format of ['json','yaml','toml']){const intermediate=path.join(dir,'ordinary.'+format),output=path.join(dir,'ordinary-'+format+'.xml');await performUtility({operation:'config-convert',files:[input],output:intermediate});await performUtility({operation:'config-convert',files:[intermediate],output});assert.deepEqual(parseXML(await fs.readFile(output,'utf8')),parseXML(original));}
  const reserved=path.join(dir,'reserved.json'),typed=path.join(dir,'reserved.xml');const collision={$xml:{name:'example',attributes:{},children:['data']}};await fs.writeFile(reserved,JSON.stringify(collision));await performUtility({operation:'config-convert',files:[reserved],output:typed,options:{xmlTyped:true}});assert.deepEqual(parseXML(await fs.readFile(typed,'utf8')),collision);
}));
