import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "media/icon.svg");
const output = resolve(root, "media/icon.png");

export async function renderIcon() {
  return sharp(await readFile(source), { density: 96 })
    .resize(256, 256, { fit: "fill" })
    .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
    .toBuffer();
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await writeFile(output, await renderIcon());
  console.log("Generated media/icon.png from media/icon.svg.");
}
