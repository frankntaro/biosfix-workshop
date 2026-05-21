// Generates PWA icons from the source SVG.
// Run with: node scripts/generate-pwa-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public");
mkdirSync(outDir, { recursive: true });

const baseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0891b2"/>
      <stop offset="55%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="DM Sans, Segoe UI, Arial, sans-serif" font-size="260"
        font-weight="800" fill="#ffffff" letter-spacing="-8">B</text>
  <circle cx="386" cy="160" r="22" fill="#a7f3d0"/>
</svg>`.trim();

// Maskable icon: extra safe-zone padding inside the square so OS masks don't crop.
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0891b2"/>
      <stop offset="55%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(96 96)">
    <rect width="320" height="320" rx="60" fill="rgba(255,255,255,0.06)"/>
    <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle"
          font-family="DM Sans, Segoe UI, Arial, sans-serif" font-size="170"
          font-weight="800" fill="#ffffff" letter-spacing="-6">B</text>
  </g>
</svg>`.trim();

writeFileSync(resolve(outDir, "icon.svg"), baseSvg);
writeFileSync(resolve(outDir, "icon-maskable.svg"), maskableSvg);

const targets = [
  { src: baseSvg, name: "pwa-192x192.png", size: 192 },
  { src: baseSvg, name: "pwa-512x512.png", size: 512 },
  { src: baseSvg, name: "apple-touch-icon.png", size: 180 },
  { src: maskableSvg, name: "pwa-maskable-192x192.png", size: 192 },
  { src: maskableSvg, name: "pwa-maskable-512x512.png", size: 512 },
  { src: baseSvg, name: "favicon-32x32.png", size: 32 },
  { src: baseSvg, name: "favicon-16x16.png", size: 16 },
];

for (const t of targets) {
  await sharp(Buffer.from(t.src))
    .resize(t.size, t.size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, t.name));
  console.log("wrote", t.name);
}
