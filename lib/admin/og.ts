import "server-only";
import sharp from "sharp";

/**
 * A brand's 1200×630 link preview (WhatsApp, Slack, social): its logo centred in a 60% × 40% box
 * on the logo's own background. The same design as the seed's (scripts/build-assets.ts), drawn
 * with sharp so it needs no fonts: a brand without logos uses the site-wide preview instead.
 */
export const OG = { width: 1200, height: 630 };

export async function brandOgPng(logo: { bytes: Buffer; svg: boolean }, background: string): Promise<Buffer> {
  const box = { width: Math.round(OG.width * 0.6), height: Math.round(OG.height * 0.4) };
  // SVGs are rasterized at about twice the box size, then scaled down, so edges stay crisp.
  let source = sharp(logo.bytes);
  if (logo.svg) {
    const { width = box.width, height = box.height } = await source.metadata();
    const scale = Math.max((2 * box.width) / width, (2 * box.height) / height);
    source = sharp(logo.bytes, { density: Math.min(2400, Math.max(72, 72 * scale)) });
  }
  const fitted = await source.resize({ ...box, fit: "inside" }).png().toBuffer();
  const { width = 0, height = 0 } = await sharp(fitted).metadata();
  return sharp({ create: { width: OG.width, height: OG.height, channels: 4, background } })
    .composite([{ input: fitted, left: Math.round((OG.width - width) / 2), top: Math.round((OG.height - height) / 2) }])
    .png()
    .toBuffer();
}
