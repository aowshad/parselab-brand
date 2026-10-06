import type { FileRef, VariantAssets } from "./files";
import type { Typeface } from "./schema";
import type { ScaleStep } from "./typography";
import type { Theme } from "./variants";

/*
 * What the public pages render. lib/brands.ts builds these from the database; components
 * only ever see these shapes, never database rows.
 */

/** `id` is `<type>-<variant>`, e.g. `full-dark-bg`: used in tab ids and `?variant=` deep links. */
export type VariantView = {
  id: string;
  name: string;
  usage: string;
  previewBg: string;
  dot: string;
  assets: VariantAssets;
  darkStage: boolean;
};

export type LogoGroupView = { key: string; label: string; description: string; zip: FileRef; variants: VariantView[] };

/** A palette card: a solid color with its hex, or a gradient with one hex per stop. */
export type ColorView = { name: string; role: string } & (
  | { kind: "solid"; hex: string }
  | { kind: "gradient"; css: string; stops: string[] }
);

export type PaletteView = { name: string; colors: ColorView[] };

/** A typeface with the CSS font-family that renders it (self-hosted, see lib/fonts.ts). */
export type TypefaceView = Typeface & { fontFamily: string };
export type TypographyView = { typefaces: TypefaceView[]; scale: (Omit<ScaleStep, "use"> & { face: TypefaceView })[] };

export type PublicStatus = "live" | "soon";

export type BrandView = {
  slug: string;
  name: string;
  /** The tagline. */
  description: string;
  status: PublicStatus;
  /** `YYYY-MM-DD` */
  updatedAt: string;
  contact: string;
  /** Null until the brand names its typefaces: the section shows "Coming soon". */
  typography: TypographyView | null;
  logoGroups: LogoGroupView[];
  palettes: PaletteView[];
  /** Null until the brand has logos: hide every "Download kit" button. */
  kit: FileRef | null;
  colorFiles: { css: FileRef; json: FileRef } | null;
  /** 1200×630 link-preview image. */
  og: FileRef;
  /**
   * Small brand icon for the hero and favicon; null shows the brand's initial instead.
   * Without an app-icon tile it's the first logo, on that variant's own background (`plate`).
   */
  icon: { src: string; isTile: boolean; plate: string } | null;
  counts: { variants: number; colors: number };
};

export type CardThumb = { src: string; plate: string | null };

export type BrandCardView = {
  slug: string;
  name: string;
  description: string;
  status: PublicStatus;
  /**
   * Thumbnail logo per theme, both rendered and switched by CSS. `plate` is the last-resort
   * background behind a logo made for the other theme. Both null: the name stands in.
   */
  thumbs: Record<Theme, CardThumb | null>;
  counts: { variants: number; colors: number };
};

/** Home page text, footer and the site-wide files. */
export type SiteView = {
  homeTitle: string;
  homeSubtitle: string;
  footerText: string;
  contact: string;
  /** "Download all": every brand kit in one zip. Null hides the button. */
  allKit: FileRef | null;
  og: FileRef | null;
};
