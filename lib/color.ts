/**
 * Color math shared by the UI and the asset pipeline. RGB and HSL (written to colors.json)
 * are always derived from hex, never stored.
 */

export type Rgb = [r: number, g: number, b: number];
export type Hsl = [h: number, s: number, l: number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, Math.round(l * 100)];

  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [Math.round(h * 60) % 360, Math.round(s * 100), Math.round(l * 100)];
}

export const formatRgb = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;
export const formatHsl = ([h, s, l]: Hsl) => `hsl(${h}, ${s}%, ${l}%)`;

/** WCAG 2.x relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG contrast ratio, (L1 + 0.05) / (L2 + 0.05) with L1 the lighter color. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whether white text reads better than black on `bg`: used to style UI drawn over a stage or dot. */
export function isDark(bg: string): boolean {
  return contrast(bg, "#FFFFFF") > contrast(bg, "#000000");
}

/** All derived values for one color, as shown in the UI and written to colors.json. */
export function describeColor(hex: string) {
  const rgb = hexToRgb(hex);
  return { hex: hex.toUpperCase(), rgb: formatRgb(rgb), hsl: formatHsl(rgbToHsl(...rgb)) };
}

export type GradientStop = { hex: string; at: number };

/** `linear-gradient(135deg, #F197FE 0%, …)`, the value shown, copied and written to colors.css. */
export function gradientCss(angle: number, stops: GradientStop[]): string {
  return `linear-gradient(${angle}deg, ${stops.map((s) => `${s.hex.toUpperCase()} ${s.at}%`).join(", ")})`;
}
