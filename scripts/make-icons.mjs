// Generates the app icons and the white logo from assets-src/logo-1024.png.
// Run: npm run icons
import sharp from "sharp";

const SRC = "assets-src/logo-1024.png";

// Brand colors — keep in sync with src/theme/tokens.css
const INK = "#101218"; // near-black
const RED = "#b3121f"; // brand red

/** Solid white logo: soft glow removed, every shape filled white, empty space trimmed. */
async function whiteLogo() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = a >= 200 ? 255 : a >= 140 ? Math.round(((a - 140) / 60) * 255) : 0;
  }
  return sharp(data, { raw: info }).trim({ threshold: 1 }).png().toBuffer();
}

/** Black → red diagonal gradient with a soft red glow in the top-right corner. */
const background = (size, radius) =>
  Buffer.from(`
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${INK}"/>
        <stop offset="55%" stop-color="${INK}"/>
        <stop offset="100%" stop-color="${RED}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.8" cy="0.2" r="0.62">
        <stop offset="0%" stop-color="${RED}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${RED}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#glow)"/>
  </svg>`);

/** Just the "AE + truck" crest (top part of the logo) — stays readable at tiny sizes. */
async function crest() {
  const img = sharp(await whiteLogo());
  const { width, height } = await img.metadata();
  return img
    .extract({ left: 0, top: 0, width, height: Math.round(height * 0.55) })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/** One icon: gradient background + white logo sized to `coverage` of the width. */
async function icon(size, { radius = Math.round(size * 0.22), coverage = 0.74, mark = false, out }) {
  const logo = await sharp(mark ? await crest() : await whiteLogo())
    .resize({ width: Math.round(size * coverage), fit: "inside" })
    .toBuffer();
  await sharp(background(size, radius))
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
}

// White logo for dark headers inside the app
await sharp(await whiteLogo()).resize({ height: 240, withoutEnlargement: true }).png().toFile("public/logo-white.png");

// Original colored logo — used on printed documents (white paper)
await sharp(SRC).resize(512, 512, { fit: "inside" }).png().toFile("public/logo.png");

// App icons
await icon(192, { out: "public/icon-192.png" });
await icon(512, { out: "public/icon-512.png" });
await icon(180, { out: "public/apple-touch-icon.png" });
await icon(64, { radius: 12, coverage: 0.82, mark: true, out: "public/favicon.png" });
// Maskable: square, artwork kept inside the safe circle (Android crops the corners)
await icon(512, { radius: 0, coverage: 0.58, out: "public/icon-maskable-512.png" });

console.log("Icons written to public/");
