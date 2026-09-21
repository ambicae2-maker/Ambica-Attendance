import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const uid = () => crypto.randomUUID();

/** Whole-rupee Indian formatting: 125000 → ₹1,25,000 */
export const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// No 0/O/1/I to avoid confusion when reading an ID aloud.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Random, hard-to-guess driver ID like AMB-K7Q2X9. */
export function newDriverCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "AMB-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
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

/** Resize + compress a photo to a small JPEG data URL (keeps uploads fast on mobile data). */
export async function compressImage(file: File, max = 640, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
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
