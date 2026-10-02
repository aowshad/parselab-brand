import { gradientCss, isDark } from "./color";
import { getAllBrands, getBrand } from "./content";
import { getBrandAssets, getManifest, type FileRef, type VariantAssets } from "./manifest";
import type { Brand, BrandColor, LogoGroup, LogoVariant } from "./schema";

export type VariantView = LogoVariant & { dot: string; assets: VariantAssets; darkStage: boolean };
export type LogoGroupView = Omit<LogoGroup, "variants"> & { zip: FileRef; variants: VariantView[] };

/** A palette card: a solid color with its hex, or a gradient with one hex per stop. */
export type ColorView = { name: string; role: string } & (
  | { kind: "solid"; hex: string }
  | { kind: "gradient"; css: string; stops: string[] }
);

export type PaletteView = { name: string; colors: ColorView[] };

export type BrandView = Omit<Brand, "logoGroups" | "palettes"> & {
  logoGroups: LogoGroupView[];
  palettes: PaletteView[];
  /** Null until the brand has logos: hide every "Download kit" button. */
  kit: FileRef | null;
  colorFiles: { css: FileRef; json: FileRef } | null;
  /** 1200×630 link-preview image. */
  og: FileRef;
  /** Small brand icon for the hero and navbar; null shows the brand's initial instead. */
  icon: { src: string; isTile: boolean } | null;
  counts: { variants: number; colors: number };
};

function colorView(c: BrandColor): ColorView {
  if ("gradient" in c) {
    const { angle, stops } = c.gradient;
    return { name: c.name, role: c.role, kind: "gradient", css: gradientCss(angle, stops), stops: stops.map((s) => s.hex.toUpperCase()) };
  }
  return { name: c.name, role: c.role, kind: "solid", hex: c.hex.toUpperCase() };
}

const countColors = (brand: Brand) => brand.palettes.reduce((n, p) => n + p.colors.length, 0);
const countVariants = (brand: Brand) => brand.logoGroups.reduce((n, g) => n + g.variants.length, 0);

/** Everything one brand page renders: that brand's content merged with its generated files. */
export function getBrandView(slug: string): BrandView | undefined {
  const brand = getBrand(slug);
  if (!brand) return undefined;
  const assets = getBrandAssets(slug);

  const logoGroups: LogoGroupView[] = brand.logoGroups.map((group) => {
    const zip = assets.groups[group.key];
    if (!zip) throw new Error(`Manifest has no zip for ${slug}/${group.key}. Run \`pnpm assets\`.`);
    return {
      ...group,
      zip,
      variants: group.variants.map((v) => {
        const variantAssets = assets.variants[v.id];
        if (!variantAssets) throw new Error(`Manifest has no files for ${slug}/${v.id}. Run \`pnpm assets\`.`);
        return { ...v, dot: v.dot ?? v.previewBg, assets: variantAssets, darkStage: isDark(v.previewBg) };
      }),
    };
  });

  const allVariants = logoGroups.flatMap((g) => g.variants);
  const tile = allVariants.find((v) => v.id === "icon-brand");
  const iconVariant = tile ?? allVariants[0];

  return {
    ...brand,
    logoGroups,
    palettes: brand.palettes.map((p) => ({ name: p.name, colors: p.colors.map(colorView) })),
    kit: assets.kit,
    colorFiles: assets.colors,
    og: assets.og,
    icon: iconVariant ? { src: iconVariant.assets.svg.path, isTile: Boolean(tile) } : null,
    counts: { variants: countVariants(brand), colors: countColors(brand) },
  };
}

export type BrandCardView = {
  slug: string;
  name: string;
  description: string;
  status: Brand["status"];
  /** CSS background and logo for the preview; null logo shows the initial on a neutral tile. */
  preview: { background: string; logo: string | null };
  counts: { variants: number; colors: number };
};

/** Home page cards: live brands first, then soon, each group in its saved order. */
export function getBrandCards(): BrandCardView[] {
  const rank = (b: Brand) => (b.status === "live" ? 0 : 1);
  return [...getAllBrands()].sort((a, b) => rank(a) - rank(b)).map((b) => {
    const logo = b.theme ? getBrandAssets(b.slug).variants[b.theme.cardLogo]?.svg.path ?? null : null;
    return {
      slug: b.slug,
      name: b.name,
      description: b.description,
      status: b.status,
      preview: { background: b.theme?.previewBg ?? "var(--color-track)", logo },
      counts: { variants: countVariants(b), colors: countColors(b) },
    };
  });
}

/** Combined zip of every brand kit, or null when none exist yet. */
export const getAllKits = (): FileRef | null => getManifest().all;
