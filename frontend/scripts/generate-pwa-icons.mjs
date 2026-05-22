// Generates PWA / favicon / apple-touch icons from the BIOSFIX brand image.
// Run: node scripts/generate-pwa-icons.mjs
// Source: public/biosfix-app-icon-source.jpg (or ICON_SOURCE env path)
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public");
mkdirSync(outDir, { recursive: true });

const defaultSource = resolve(outDir, "biosfix-app-icon-source.jpg");
const sourcePath = process.env.ICON_SOURCE || defaultSource;

if (!existsSync(sourcePath)) {
  console.error(`Source image not found: ${sourcePath}`);
  process.exit(1);
}

/** Teal from BIOSFIX circular logo — used for maskable letterboxing */
const BRAND_BG = { r: 13, g: 107, b: 115, alpha: 1 };

async function squareIcon(size, { maskable = false } = {}) {
  const meta = await sharp(sourcePath).metadata();
  const inner = maskable ? Math.round(size * 0.82) : size;
  const resized = await sharp(sourcePath)
    .resize(inner, inner, { fit: "contain", background: BRAND_BG })
    .png()
    .toBuffer();

  if (!maskable) {
    return sharp(resized).resize(size, size, { fit: "cover", position: "centre" }).png({ compressionLevel: 9 });
  }

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png({ compressionLevel: 9 });
}

const targets = [
  { name: "pwa-192x192.png", size: 192, maskable: false },
  { name: "pwa-512x512.png", size: 512, maskable: false },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
  { name: "pwa-maskable-192x192.png", size: 192, maskable: true },
  { name: "pwa-maskable-512x512.png", size: 512, maskable: true },
  { name: "favicon-32x32.png", size: 32, maskable: false },
  { name: "favicon-16x16.png", size: 16, maskable: false },
  { name: "biosfix-logo.png", size: 256, maskable: false },
];

for (const t of targets) {
  const pipeline = await squareIcon(t.size, { maskable: t.maskable });
  await pipeline.toFile(resolve(outDir, t.name));
  console.log("wrote", t.name);
}

// Keep a crisp copy for in-app install banner
await sharp(sourcePath)
  .resize(128, 128, { fit: "contain", background: BRAND_BG })
  .png()
  .toFile(resolve(outDir, "install-app-icon.png"));
console.log("wrote install-app-icon.png");
