// Generates the app icons from the MadGrow mark (the sprout on the indigo
// gradient used in the navbar). Run from apps/web:  node scripts/build-icons.mjs
//
// The Android package is built from these files as served by the live site, so
// a change here only reaches the app after a web deploy and a Bubblewrap update.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

// lucide "sprout", 24×24 viewBox — the same glyph the navbar renders.
const SPROUT = `
  <path d="M7 20h10"/>
  <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
  <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/>
  <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>`;

/**
 * @param size   output edge in px
 * @param radius corner radius as a fraction of the edge (0 = full bleed)
 * @param glyph  sprout size as a fraction of the edge
 */
function mark(size, radius, glyph) {
  const g = size * glyph;
  const offset = (size - g) / 2;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6553f5"/><stop offset="1" stop-color="#4f3ee0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${g / 24})" fill="none" stroke="#ffffff"
     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SPROUT}</g>
</svg>`);
}

const out = [
  // "any" icons: rounded tile, as shown in browsers and the Play listing.
  ["public/icons/icon-192.png", 192, 0.22, 0.6],
  ["public/icons/icon-512.png", 512, 0.22, 0.6],
  // Maskable: full bleed, glyph inside the 80% safe zone so launchers can crop.
  ["public/icons/maskable-192.png", 192, 0, 0.46],
  ["public/icons/maskable-512.png", 512, 0, 0.46],
  ["public/icons/shortcut-96.png", 96, 0.22, 0.6],
  // Next.js file conventions: favicon and the iOS home-screen icon.
  ["app/icon.png", 192, 0.22, 0.6],
  ["app/apple-icon.png", 180, 0, 0.56],
];

await mkdir("public/icons", { recursive: true });
for (const [file, size, radius, glyph] of out) {
  await sharp(mark(size, radius, glyph)).png().toFile(file);
  console.log("wrote", file);
}
