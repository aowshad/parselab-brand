import fs from "node:fs";
import path from "node:path";
import type { FileRef, VariantAssets } from "./files";

export { PNG_WIDTHS, type FileRef, type ImageRef, type PngWidth, type VariantAssets } from "./files";

export const MANIFEST_PATH = path.join(process.cwd(), ".generated", "manifest.json");

/**
 * The asset pipeline's output (scripts/build-assets.ts). Only the seed reads it now, to import
 * the generated files into storage; the site itself reads the database (lib/brands.ts).
 */
export type BrandAssets = {
  /** Null until the brand has at least one logo. */
  kit: FileRef | null;
  /** Null until the brand has at least one palette. */
  colors: { css: FileRef; json: FileRef } | null;
  /** 1200×630 link-preview image. */
  og: FileRef;
  /** Per logo group zip, keyed by group key. */
  groups: Record<string, FileRef>;
  /** Keyed by variant id. */
  variants: Record<string, VariantAssets>;
};

export type Manifest = {
  /** Every brand kit in one zip, for "Download all". Null when no brand has a kit. */
  all: FileRef | null;
  /** Link-preview image for the home page. */
  og: FileRef;
  brands: Record<string, BrandAssets>;
};

let cache: Manifest | null = null;

export function getManifest(): Manifest {
  // Re-read in development: the dev script regenerates it whenever content changes.
  if (!cache || process.env.NODE_ENV !== "production") {
    if (!fs.existsSync(MANIFEST_PATH)) {
      throw new Error(`Missing ${path.relative(process.cwd(), MANIFEST_PATH)}. Run \`pnpm assets\` first.`);
    }
    cache = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  }
  return cache;
}

export function getBrandAssets(slug: string): BrandAssets {
  const assets = getManifest().brands[slug];
  if (!assets) throw new Error(`No generated assets for "${slug}". Run \`pnpm assets\`.`);
  return assets;
}
