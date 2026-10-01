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
  kit: FileRef;
  colors: { css: FileRef; json: FileRef };
  /** Per logo group zip, keyed by group key. */
  groups: Record<string, FileRef>;
  /** Keyed by variant id. */
  variants: Record<string, VariantAssets>;
};

export type Manifest = { brands: Record<string, BrandAssets> };

let cache: Manifest | null = null;

export function getBrandAssets(slug: string): BrandAssets {
  if (!cache) {
    if (!fs.existsSync(MANIFEST_PATH)) {
      throw new Error(`Missing ${path.relative(process.cwd(), MANIFEST_PATH)}. Run \`pnpm assets\` first.`);
    }
    cache = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  }
  const assets = cache.brands[slug];
  if (!assets) throw new Error(`No generated assets for "${slug}". Run \`pnpm assets\`.`);
  return assets;
}
