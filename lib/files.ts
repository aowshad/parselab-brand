/** Output widths for every PNG, in px. */
export const PNG_WIDTHS = [512, 1024, 2048, 4096] as const;
export type PngWidth = (typeof PNG_WIDTHS)[number];

/**
 * A downloadable file. `path` is where it's shown or linked (an absolute storage URL, or a
 * site path before the move to storage); `downloadUrl`, when set, makes the browser save it as
 * `filename` (cross-origin links ignore the `download` attribute).
 */
export type FileRef = { path: string; filename: string; sizeKb: number; downloadUrl?: string };
export type ImageRef = FileRef & { width: number; height: number };

/** `svg` is null for PNG-only logos (the page then offers PNGs only). */
export type VariantAssets = { svg: ImageRef | null; png: (ImageRef & { size: PngWidth })[] };

/** What to show for a variant: its SVG, else its largest PNG. */
export const displayImage = (a: VariantAssets): ImageRef => a.svg ?? a.png.at(-1)!;
