// Generates PWA icons from assets-src/logo-1024.png. Run: npm run icons
import sharp from "sharp";

const src = "assets-src/logo-1024.png";
const bg = { r: 0, g: 0, b: 0, alpha: 1 };

await sharp(src).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(src).resize(512, 512).png().toFile("public/icon-512.png");
await sharp(src).resize(180, 180).png().toFile("public/apple-touch-icon.png");
await sharp(src).resize(64, 64).png().toFile("public/favicon.png");
await sharp(src).resize(512, 512).png({ quality: 80 }).toFile("public/logo.png");

// Maskable: shrink artwork into the 80% safe zone on a solid background.
const inner = await sharp(src).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: bg } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icon-maskable-512.png");

console.log("Icons written to public/");
