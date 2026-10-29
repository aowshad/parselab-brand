import "server-only";
import sharp from "sharp";

/** Longest side of an event image's preview: cards show it at about 300 px, 2× for sharp screens. */
export const PREVIEW_MAX = 512;

/** The WebP an event card shows (about 20–40 KB). Pure: bytes in, bytes out. */
export async function previewWebp(src: Buffer, mime: string): Promise<{ bytes: Buffer; width: number; height: number }> {
  const svg = mime === "image/svg+xml";
  const bytes = await sharp(src, svg ? { density: 300 } : {})
    .resize({ width: PREVIEW_MAX, height: PREVIEW_MAX, fit: "inside", withoutEnlargement: !svg })
    .webp({ quality: 82 })
    .toBuffer();
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  return { bytes, width, height };
}
