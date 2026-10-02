/**
 * What background a logo variant is made for, read from its id (`full-light-bg`, `mark-dark-bg`,
 * `icon-black`, `full-white`…). Anything else (`icon-brand`, `square-dark`…) is a self-contained
 * tile that works on any background. Pure, so server and client code can share it.
 */
export type Tone = "on-light" | "on-dark" | "black" | "white" | "any";
export type Theme = "light" | "dark";

export function variantTone(id: string): Tone {
  if (/-light-bg$/.test(id)) return "on-light";
  if (/-dark-bg$/.test(id)) return "on-dark";
  if (/-black$/.test(id)) return "black";
  if (/-white$/.test(id)) return "white";
  return "any";
}

type Variant = { id: string; previewBg: string };
type Group<V extends Variant> = { key: string; variants: V[] };

/** The logo preview's default for a theme: "On dark" in dark mode, "On light" in light mode. */
export function defaultVariant<V extends Variant>(variants: V[], theme: Theme): V {
  const want: Tone = theme === "dark" ? "on-dark" : "on-light";
  return variants.find((v) => variantTone(v.id) === want) ?? variants[0]!;
}

/** Made for this theme's background, best first; then a last resort that needs a plate. */
const ORDER: Record<Theme, { direct: Tone[]; plated: Tone[] }> = {
  light: { direct: ["on-light", "black", "any"], plated: ["on-dark", "white"] },
  dark: { direct: ["on-dark", "white", "any"], plated: ["on-light", "black"] },
};

/**
 * Home-card logo for a theme, from the Full logo (else the Icon, else the first group).
 * `plate` is set only for the last resort: the variant's own background, drawn as a small
 * rounded plate so a light logo never sits on a dark card (or the reverse).
 */
export function cardVariant<V extends Variant>(groups: Group<V>[], theme: Theme): { variant: V; plate: string | null } | null {
  const group = groups.find((g) => g.key === "full") ?? groups.find((g) => g.key === "icon") ?? groups[0];
  if (!group) return null;
  const find = (tones: Tone[]) => {
    for (const tone of tones) {
      const v = group.variants.find((x) => variantTone(x.id) === tone);
      if (v) return v;
    }
    return undefined;
  };
  const direct = find(ORDER[theme].direct);
  if (direct) return { variant: direct, plate: null };
  const plated = find(ORDER[theme].plated);
  return plated ? { variant: plated, plate: plated.previewBg } : null;
}
