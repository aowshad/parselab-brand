import { bestTextOn, describeColor, gradientCss, isDark, type TextRecommendation } from "./color";
import { getAllBrands, getBrand } from "./content";
import { getBrandAssets, getManifest, type FileRef, type VariantAssets } from "./manifest";
import type { Brand, BrandColor, LogoGroup, LogoVariant } from "./schema";

export type VariantView = LogoVariant & { dot: string; assets: VariantAssets; darkStage: boolean };
export type LogoGroupView = Omit<LogoGroup, "variants"> & { zip: FileRef; variants: VariantView[] };

export type ColorRow = {
  label: string;
  value: string;
  /** Screen-reader name for the row's copy button, e.g. "Copy RGB rgb(108, 169, 243)". */
  action: string;
  /** Toast reads "Copied <toastLabel>"; defaults to the value. */
  toastLabel?: string;
  /** Small swatch before the value, for gradient stops. */
  dot?: string;
};

export type ColorView = {
  name: string;
  role: string;
  /** CSS background for the swatch: a hex or a gradient. No text is ever drawn on it. */
  swatch: string;
  /** What clicking the swatch copies. */
  copy: { value: string; action: string; chip: "Copy hex" | "Copy CSS"; toastLabel: string };
  rows: ColorRow[];
  /** Recommended text color on this color, computed from its hex (worst case across gradient stops). */
  text: TextRecommendation & { sample: string; worstCase: boolean };
};
export type PaletteView = { name: string; colors: ColorView[] };

export type BrandView = Omit<Brand, "logoGroups" | "palettes"> & {
  logoGroups: LogoGroupView[];
  palettes: PaletteView[];
  /** Null until the brand has logos: hide every "Download kit" button. */
  kit: FileRef | null;
  colorFiles: { css: FileRef; json: FileRef } | null;
  /** Small brand icon for the hero and navbar; null shows the brand's initial instead. */
  icon: { src: string; isTile: boolean } | null;
  counts: { variants: number; colors: number };
};

function colorView(c: BrandColor): ColorView {
  if ("gradient" in c) {
    const { angle, stops } = c.gradient;
    const css = gradientCss(angle, stops);
    return {
      name: c.name,
      role: c.role,
      swatch: css,
      copy: { value: css, action: `Copy CSS for ${c.name}`, chip: "Copy CSS", toastLabel: `CSS for ${c.name}` },
      rows: [
        ...stops.map((s) => {
          const hex = s.hex.toUpperCase();
          return { label: `${s.at}%`, value: hex, dot: hex, action: `Copy ${s.at}% stop ${hex}` };
        }),
        { label: "CSS", value: css, action: `Copy CSS for ${c.name}`, toastLabel: `CSS for ${c.name}` },
      ],
      text: { ...bestTextOn(stops.map((s) => s.hex)), sample: css, worstCase: true },
    };
  }
  const d = describeColor(c.hex);
  const rows: ColorRow[] = [
    { label: "HEX", value: d.hex, action: `Copy hex ${d.hex}` },
    { label: "RGB", value: d.rgb, action: `Copy RGB ${d.rgb}` },
    { label: "HSL", value: d.hsl, action: `Copy HSL ${d.hsl}` },
  ];
  if (c.cmyk) rows.push({ label: "CMYK", value: c.cmyk, action: `Copy CMYK ${c.cmyk}` });
  if (c.pantone) rows.push({ label: "Pantone", value: c.pantone, action: `Copy Pantone ${c.pantone}` });
  return {
    name: c.name,
    role: c.role,
    swatch: d.hex,
    copy: { value: d.hex, action: `Copy hex ${d.hex}`, chip: "Copy hex", toastLabel: d.hex },
    rows,
    text: { ...bestTextOn([d.hex]), sample: d.hex, worstCase: false },
  };
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

/** Home page cards, in brand order. */
export function getBrandCards(): BrandCardView[] {
  return getAllBrands().map((b) => {
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
