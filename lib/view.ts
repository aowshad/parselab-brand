import { contrastRatio, describeColor, isDark } from "./color";
import { getBrand } from "./content";
import { getBrandAssets, type FileRef, type VariantAssets } from "./manifest";
import type { Brand, LogoGroup, LogoVariant } from "./schema";

export type VariantView = LogoVariant & { assets: VariantAssets; darkStage: boolean };
export type LogoGroupView = Omit<LogoGroup, "variants"> & { zip: FileRef; variants: VariantView[] };

export type ColorView = {
  name: string;
  role: string;
  hex: string;
  /** Label/value rows shown on the card, in order. */
  values: { label: string; value: string }[];
  darkSwatch: boolean;
  /** Needs a hairline so it doesn't disappear against the white card. */
  faint: boolean;
};
export type PaletteView = { name: string; colors: ColorView[] };

export type BrandView = Omit<Brand, "logoGroups" | "palettes"> & {
  logoGroups: LogoGroupView[];
  palettes: PaletteView[];
  kit: FileRef;
  colorFiles: { css: FileRef; json: FileRef };
  heroIcon: VariantView;
  /** False when falling back to a non-tile variant, which then needs a tile behind it. */
  heroIconIsTile: boolean;
  counts: { variants: number; colors: number };
};

/** Everything the brand page renders: content merged with generated asset paths and sizes. */
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
        return { ...v, assets: variantAssets, darkStage: isDark(v.previewBg) };
      }),
    };
  });

  const palettes: PaletteView[] = brand.palettes.map((p) => ({
    name: p.name,
    colors: p.colors.map((c) => {
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
        hex: d.hex,
        values,
        darkSwatch: isDark(c.hex),
        faint: contrastRatio(c.hex, "#FFFFFF") < 1.15,
      };
    }),
  }));

  const allVariants = logoGroups.flatMap((g) => g.variants);
  return {
    ...brand,
    logoGroups,
    palettes,
    kit: assets.kit,
    colorFiles: assets.colors,
    heroIcon: allVariants.find((v) => v.id === "icon-brand") ?? allVariants[0]!,
    heroIconIsTile: allVariants.some((v) => v.id === "icon-brand"),
    counts: { variants: allVariants.length, colors: brand.palettes.reduce((n, p) => n + p.colors.length, 0) },
  };
}

