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

export type VariantAssets = { svg: ImageRef; png: (ImageRef & { size: PngWidth })[] };
