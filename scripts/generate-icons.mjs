#!/usr/bin/env node
/**
 * Derives every Worship Keys icon variant from the single source artwork.
 *
 * The source file is treated as read-only. It is a 1254 x 1254 render with a
 * large black margin around the emblem, which is fine as artwork but wrong as a
 * favicon: at 16 px the emblem would shrink into a few unreadable pixels.
 * This script therefore crops to the emblem, applies a circular alpha mask so
 * the mark sits cleanly on any dark surface, and writes the small variants.
 *
 * Requires ImageMagick (`brew install imagemagick`). Outputs are committed, so
 * this only needs to run when the source artwork changes.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "Worship Keys Icon.png");

if (!existsSync(source)) {
  console.error(`Source artwork not found: ${source}`);
  process.exit(1);
}

const magick = (args) => execFileSync("magick", args, { stdio: ["ignore", "pipe", "inherit"] });

// Trim box of the emblem measured with a 12% fuzz against the black field.
const trim = magick([source, "-fuzz", "12%", "-format", "%@", "info:"]).toString().trim();
const match = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(trim);
if (!match) throw new Error(`Unexpected trim geometry: ${trim}`);
const [, w, h, x, y] = match.map(Number);

// Square crop centred on the emblem, with a small ring of breathing room so the
// outer glow is not sliced off.
const side = Math.round(Math.max(w, h) * 1.06);
const left = Math.round(x + w / 2 - side / 2);
const top = Math.round(y + h / 2 - side / 2);
const crop = `${side}x${side}+${left}+${top}`;
console.log(`Emblem trim ${trim} -> square crop ${crop}`);

mkdirSync(join(root, "public"), { recursive: true });

/** Crop, resize, and punch a circular alpha mask so corners are transparent. */
function writeMasked(outPath, size) {
  magick([
    source,
    "-crop", crop, "+repage",
    "-resize", `${size}x${size}`,
    "(", "+clone", "-alpha", "transparent", "-fill", "white",
    "-draw", `circle ${(size - 1) / 2},${(size - 1) / 2} ${(size - 1) / 2},0`, ")",
    "-alpha", "off", "-compose", "copy_opacity", "-composite",
    "-strip",
    `PNG32:${outPath}`,
  ]);
  console.log(`wrote ${outPath} (${size}px, circular alpha)`);
}

/** Untouched square copy of the source artwork for large/apple contexts. */
function writeSquare(outPath, size) {
  magick([source, "-resize", `${size}x${size}`, "-strip", `PNG32:${outPath}`]);
  console.log(`wrote ${outPath} (${size}px, full artwork)`);
}

// Header / in-app brand mark: transparent corners, sits on the app background.
writeMasked(join(root, "public", "worship-keys-icon.png"), 512);
// Browser tab icon: same crop, tuned small. Next.js App Router picks up app/icon.png.
writeMasked(join(root, "app", "icon.png"), 96);
// Home-screen icon for iPads joining the local session; iOS masks its own corners,
// so this one keeps the full artwork including its black field.
writeSquare(join(root, "app", "apple-icon.png"), 180);
