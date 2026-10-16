import "server-only";
import sharp from "sharp";
import { PNG_WIDTHS } from "../files";

export type RenderedPng = { size: (typeof PNG_WIDTHS)[number]; bytes: Buffer; width: number; height: number };

/** Transparent PNGs at 512, 1024, 2048 and 4096 px wide from an SVG (vector, so any size is sharp). */
export async function pngsFromSvg(svg: Buffer, svgWidth: number): Promise<RenderedPng[]> {
  const out: RenderedPng[] = [];
  for (const size of PNG_WIDTHS) {
    // Rasterize at the density that gives this width, then snap to it exactly.
    const density = Math.min(100_000, Math.max(1, (72 * size) / svgWidth));
    const { data, info } = await sharp(svg, { density, limitInputPixels: false })
      .resize({ width: size })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer({ resolveWithObject: true });
    out.push({ size, bytes: data, width: info.width, height: info.height });
  }
  return out;
}

/** For PNG-only uploads: the standard widths up to the original's (never upscaled), plus the original. */
export async function pngsFromPng(png: Buffer, width: number): Promise<RenderedPng[]> {
  const out: RenderedPng[] = [];
  for (const size of PNG_WIDTHS.filter((w) => w < width)) {
    const { data, info } = await sharp(png).resize({ width: size }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    out.push({ size, bytes: data, width: info.width, height: info.height });
  }
  // The original goes in the next slot up, so the largest download is the full-resolution file.
  const meta = await sharp(png).metadata();
  const slot = PNG_WIDTHS.find((w) => w >= width) ?? PNG_WIDTHS.at(-1)!;
  if (!out.some((p) => p.size === slot)) out.push({ size: slot, bytes: png, width: meta.width ?? width, height: meta.height ?? 0 });
  return out;
}
