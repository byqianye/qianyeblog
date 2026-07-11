import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = join(root, "public", "images");
const outputRoot = join(root, "public", "generated", "media");
const manifestPath = join(root, "src", "generated", "media-manifest.json");
const widths = [480, 960, 1440];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}

const files = (await walk(sourceRoot)).filter((file) => /\.(png|jpe?g|webp)$/i.test(file) && !/-\d+\.webp$/i.test(file));
const manifest = {};
await rm(outputRoot, { recursive: true, force: true });
for (const file of files) {
  const relativePath = relative(sourceRoot, file).split(sep).join("/");
  const sourcePath = `/images/${relativePath}`;
  const stem = relativePath.slice(0, -extname(relativePath).length);
  const image = sharp(file).trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width) continue;
  const targetWidths = widths.filter((width) => width <= metadata.width);
  const variants = [];
  for (const width of targetWidths) {
    const output = join(outputRoot, `${stem}-${width}.webp`);
    await mkdir(dirname(output), { recursive: true });
    const info = await image.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(output);
    variants.push({ width: info.width, height: info.height, url: `/generated/media/${stem}-${width}.webp` });
  }
  const largest = variants.at(-1);
  if (!largest) continue;
  manifest[sourcePath] = { width: largest.width, height: largest.height, fallback: largest.url, srcset: variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ") };
}
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${Object.keys(manifest).length} media entries.`);
