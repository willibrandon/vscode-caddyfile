import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { renderIcon } from "./generate-icon.mjs";

const root = resolve(import.meta.dirname, "..");
const iconPath = resolve(root, "media/icon.png");
const committed = await readFile(iconPath);
const generated = await renderIcon();
if (!committed.equals(generated)) {
  throw new Error("media/icon.png does not match media/icon.svg. Run npm run generate:icon.");
}

const { data, info } = await sharp(committed)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const background = [0x17, 0x20, 0x33];
let left = info.width;
let right = -1;
let top = info.height;
let bottom = -1;
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const offset = (y * info.width + x) * info.channels;
    const foreground =
      data[offset + 3] !== 0 &&
      background.some((channel, index) => data[offset + index] !== channel);
    if (!foreground) continue;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
}
if (left + right !== info.width - 1 || top + bottom !== info.height - 1) {
  throw new Error(`Icon artwork is not centered: ${JSON.stringify({ left, right, top, bottom })}.`);
}
console.log("Icon PNG matches its SVG source and the artwork is centered.");
