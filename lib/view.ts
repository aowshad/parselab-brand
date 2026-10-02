import { contrastRatio, describeColor, gradientCss, isDark } from "./color";
import { getAllBrands, getBrand } from "./content";
import { getBrandAssets, getManifest, type FileRef, type VariantAssets } from "./manifest";
import type { Brand, BrandColor, LogoGroup, LogoVariant } from "./schema";

export type VariantView = LogoVariant & { dot: string; assets: VariantAssets; darkStage: boolean };
export type LogoGroupView = Omit<LogoGroup, "variants"> & { zip: FileRef; variants: VariantView[] };

export type ColorView = {
  name: string;
  role: string;
  /** CSS background for the swatch: a hex or a gradient. */
  swatch: string;
  /** What clicking the swatch copies, and how the toast names it. */
  copy: { value: string; label: string };
  /** Label/value rows shown on the card, in order. Each row copies its value. */
  values: { label: string; value: string }[];
  darkSwatch: boolean;
  /** Needs a hairline so it doesn't disappear against the white card. */
  faint: boolean;
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

/** Pick black or white text by the worst contrast across every color it sits on. */
function darkText(colors: string[]): boolean {
  const worst = (text: string) => Math.min(...colors.map((c) => contrastRatio(c, text)));
  return worst("#FFFFFF") > worst("#000000");
}

function colorView(c: BrandColor): ColorView {
  if ("gradient" in c) {
    const { angle, stops } = c.gradient;
    const css = gradientCss(angle, stops);
    return {
      name: c.name,
      role: c.role,
      swatch: css,
      copy: { value: css, label: `${c.name} gradient CSS` },
      values: [...stops.map((s) => ({ label: `${s.at}%`, value: s.hex.toUpperCase() })), { label: "CSS", value: css }],
      darkSwatch: darkText(stops.map((s) => s.hex)),
      faint: false,
    };
  }
  const d = describeColor(c.hex);
  const values = [
    { label: "HEX", value: d.hex },
    { label: "RGB", value: d.rgb },
    { label: "HSL", value: d.hsl },
  ];
  if (c.cmyk) values.push({ label: "CMYK", value: c.cmyk });
  if (c.pantone) values.push({ label: "Pantone", value: c.pantone });
  return {
    name: c.name,
    role: c.role,
    swatch: d.hex,
    copy: { value: d.hex, label: d.hex },
    values,
    darkSwatch: isDark(c.hex),
    faint: contrastRatio(c.hex, "#FFFFFF") < 1.15,
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
