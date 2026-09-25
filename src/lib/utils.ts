import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const uid = () => crypto.randomUUID();

/** Whole-rupee Indian formatting: 125000 → ₹1,25,000 */
export const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// No 0/O/1/I to avoid confusion when reading an ID aloud.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Random, hard-to-guess driver ID like AMB-K7Q2X9HN4P. */
export function newDriverCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return "AMB-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Long, unguessable token for a driver's private link. */
export function newShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const normalizeCode = (s: string) => {
  const c = s.trim().toUpperCase().replace(/\s+/g, "");
  return c.startsWith("AMB-") ? c : c.startsWith("AMB") ? "AMB-" + c.slice(3) : "AMB-" + c;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const supportsWebp = () => document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");

/**
 * Shrinks a photo on the phone before it is ever uploaded.
 *
 * A camera photo is 3–8 MB; this turns it into roughly 20–40 KB by resizing,
 * cropping a driver photo to a square, saving as WebP where supported, and
 * lowering quality step by step until it is under `maxBytes`.
 */
export async function compressImage(
  file: File,
  max = 512,
  { square = false, maxBytes = 45_000, keepTransparency = false }: { square?: boolean; maxBytes?: number; keepTransparency?: boolean } = {},
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (square) {
    // centre-crop to a square: no wasted pixels, and every avatar looks the same
    const side = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(max, side);
    canvas.width = canvas.height = size;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  } else {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close?.();

  const webp = supportsWebp();
  const type = webp ? "image/webp" : keepTransparency ? "image/png" : "image/jpeg";
  const lossless = type === "image/png";

  let out = canvas.toDataURL(type, 0.78);
  // Still too big? Drop quality, then size, until it fits.
  for (let step = 0; !lossless && out.length * 0.75 > maxBytes && step < 4; step++) {
    const quality = 0.7 - step * 0.12;
    out = canvas.toDataURL(type, Math.max(0.35, quality));
    if (out.length * 0.75 > maxBytes && step >= 1) {
      const smaller = document.createElement("canvas");
      smaller.width = Math.round(canvas.width * 0.8);
      smaller.height = Math.round(canvas.height * 0.8);
      smaller.getContext("2d")!.drawImage(canvas, 0, 0, smaller.width, smaller.height);
      canvas.width = smaller.width;
      canvas.height = smaller.height;
      ctx.drawImage(smaller, 0, 0);
    }
  }
  return out;
}

export async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob();
}

export function errorMessage(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const m = (e as { message?: string }).message ?? String(e);
  return m.replace(/^MONTH_LOCKED:\s*/, "");
}
