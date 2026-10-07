const test = require("node:test"),
  assert = require("node:assert/strict"),
  sharp = require("sharp");
const { cropScreenContext } = require("../src/main/screen-context");
test("Screen region removes pixels outside the chosen crop", async () => {
  const input = await sharp({
    create: { width: 100, height: 50, channels: 3, background: "red" },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 50, height: 50, channels: 3, background: "blue" },
        })
          .png()
          .toBuffer(),
        left: 50,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const result = await cropScreenContext(
    "data:image/png;base64," + input.toString("base64"),
    { left: 50, top: 0, width: 50, height: 100 },
  );
  assert.equal(result.width, 50);
  assert.equal(result.height, 50);
  const pixels = await sharp(Buffer.from(result.data, "base64"))
    .removeAlpha()
    .raw()
    .toBuffer();
  for (let i = 0; i < pixels.length; i += 3) {
    assert.equal(pixels[i], 0);
    assert.equal(pixels[i + 1], 0);
    assert.equal(pixels[i + 2], 255);
  }
  await assert.rejects(
    cropScreenContext("data:image/png;base64," + input.toString("base64"), {
      left: 90,
      width: 20,
    }),
    /Region must fit/,
  );
  await assert.rejects(
    cropScreenContext("https://example.com/private.png"),
    /Invalid screen image/,
  );
});
