import fs from "node:fs";
import path from "node:path";

/** Output widths for every PNG, in px. */
export const PNG_WIDTHS = [512, 1024, 2048, 4096] as const;
export type PngWidth = (typeof PNG_WIDTHS)[number];

export const MANIFEST_PATH = path.join(process.cwd(), ".generated", "manifest.json");

/** A generated file. `path` is the public URL path, without any base path. */
export type FileRef = { path: string; filename: string; sizeKb: number };
export type ImageRef = FileRef & { width: number; height: number };

export type VariantAssets = { svg: ImageRef; png: (ImageRef & { size: PngWidth })[] };

export type BrandAssets = {
  /** Null until the brand has at least one logo. */
  kit: FileRef | null;
  /** Null until the brand has at least one palette. */
  colors: { css: FileRef; json: FileRef } | null;
  /** Per logo group zip, keyed by group key. */
  groups: Record<string, FileRef>;
  /** Keyed by variant id. */
  variants: Record<string, VariantAssets>;
};

export type Manifest = {
  /** Every brand kit in one zip, for "Download all". Null when no brand has a kit. */
  all: FileRef | null;
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
