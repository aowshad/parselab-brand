import type { Typeface } from "./schema";

/** One step of the type scale, set in the brand's headings or body typeface. */
export type ScaleStep = {
  name: string;
  size: number;
  lineHeight: number;
  weight: number;
  /** em */
  tracking: number;
  use: "headings" | "body";
  sample: string;
};

/** The same proportions for every brand; only the typefaces change. `{name}` is the brand's name. */
const SCALE: ScaleStep[] = [
  { name: "Display", size: 48, lineHeight: 56, weight: 700, tracking: -0.02, use: "headings", sample: "{name}" },
  { name: "Heading 1", size: 36, lineHeight: 44, weight: 700, tracking: -0.015, use: "headings", sample: "Clear, confident headlines" },
  { name: "Heading 2", size: 24, lineHeight: 32, weight: 600, tracking: -0.01, use: "headings", sample: "Section headings stay short" },
  { name: "Body", size: 16, lineHeight: 24, weight: 400, tracking: 0, use: "body", sample: "The quick brown fox jumps over the lazy dog. Body text carries the detail, so it stays easy to read at any length." },
  { name: "Small", size: 14, lineHeight: 20, weight: 400, tracking: 0, use: "body", sample: "Labels, helper text and secondary details." },
  { name: "Caption", size: 12, lineHeight: 16, weight: 500, tracking: 0, use: "body", sample: "Captions, metadata and timestamps · 12:30 PM" },
];

export const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium",
  600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black",
};

/** Closest weight the typeface ships (the lighter one on a tie). */
const snap = (want: number, weights: number[]) =>
  [...weights].sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b)[0]!;

/** The brand's type scale: each step in its typeface, at the nearest weight it has. */
export function typeScale(brandName: string, typefaces: Typeface[]): (ScaleStep & { face: Typeface })[] {
  return SCALE.map((step) => {
    const face = typefaces.find((f) => f.use === step.use) ?? typefaces.find((f) => f.use === "both") ?? typefaces[0]!;
    return { ...step, face, weight: snap(step.weight, face.weights), sample: step.sample.replace("{name}", brandName) };
  });
}
