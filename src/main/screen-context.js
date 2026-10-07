"use strict";
const sharp = require("sharp");
async function cropScreenContext(image, region = {}) {
  if (typeof image !== "string" || image.length > 24 * 1024 * 1024)
    throw Error("Invalid screen image");
  const match = image.match(
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) throw Error("Invalid screen image");
  const { left = 0, top = 0, width = 100, height = 100 } = region;
  if (
    ![left, top, width, height].every(Number.isFinite) ||
    left < 0 ||
    top < 0 ||
    width <= 0 ||
    height <= 0 ||
    left + width > 100 ||
    top + height > 100
  )
    throw Error(
      "Region must fit within the screen preview (percentages 0–100)",
    );
  const input = Buffer.from(match[2], "base64");
  const pipeline = sharp(input, { limitInputPixels: 40000000 });
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height)
    throw Error("Screen image has no dimensions");
  const x = Math.floor((metadata.width * left) / 100),
    y = Math.floor((metadata.height * top) / 100);
  const cropWidth = Math.min(
    metadata.width - x,
    Math.max(1, Math.floor((metadata.width * width) / 100)),
  );
  const cropHeight = Math.min(
    metadata.height - y,
    Math.max(1, Math.floor((metadata.height * height) / 100)),
  );
  const output = await pipeline
    .extract({ left: x, top: y, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();
  return {
    mimeType: "image/png",
    data: output.toString("base64"),
    width: cropWidth,
    height: cropHeight,
  };
}
module.exports = { cropScreenContext };
