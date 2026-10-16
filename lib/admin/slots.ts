/*
 * Logo variant slots and logo type presets, shared by the admin UI and the server (no
 * "use client" on purpose). The four standard slots come from the brief; the two tile slots
 * are what self-contained icons, squares and circles use.
 */

export type SlotKey = "on-dark" | "on-light" | "black" | "white" | "brand" | "dark";

export type Slot = { key: SlotKey; name: string; previewBg: string; dot: string; hint: string; suffix: string };

export const SLOTS: Record<SlotKey, Slot> = {
  "on-dark": { key: "on-dark", name: "On dark", previewBg: "#0B0D12", dot: "#0B0D12", hint: "For dark surfaces, dark UI, video and photography.", suffix: "dark-bg" },
  "on-light": { key: "on-light", name: "On light", previewBg: "#FFFFFF", dot: "#FFFFFF", hint: "For white and light backgrounds.", suffix: "light-bg" },
  black: { key: "black", name: "Black", previewBg: "#F3F4F6", dot: "#000000", hint: "One-color black, for print and single-color use.", suffix: "black" },
  white: { key: "white", name: "White", previewBg: "#16181F", dot: "#FFFFFF", hint: "One-color white, for dark photos and embossing.", suffix: "white" },
  brand: { key: "brand", name: "Brand color", previewBg: "#F3F4F6", dot: "#8A8F98", hint: "A self-contained tile in the brand colors, for app listings and favicons.", suffix: "brand" },
  dark: { key: "dark", name: "Dark", previewBg: "#F3F4F6", dot: "#1A1A1A", hint: "A dark tile, for light interfaces.", suffix: "dark" },
};

/** Always shown as a 2×2 grid; the tile slots are added per logo type when needed. */
export const STANDARD_SLOTS: SlotKey[] = ["on-dark", "on-light", "black", "white"];
export const TILE_SLOTS: SlotKey[] = ["brand", "dark"];
export const isSlot = (k: string): k is SlotKey => k in SLOTS;

export const TYPE_PRESETS = [
  { key: "full", label: "Full logo", description: "Mark + wordmark. The default logo." },
  { key: "mark", label: "Mark", description: "Symbol only, for tight spaces." },
  { key: "icon", label: "Icon", description: "App icon and favicon tile." },
  { key: "square", label: "Square", description: "Social avatars and square slots." },
  { key: "circle", label: "Circle", description: "Circular profile crops." },
] as const;

/** `parselab-full-dark-bg.svg`: the default download name for a variant. */
export const defaultFileName = (brandSlug: string, typeKey: string, slot: string, ext: "svg" | "png") =>
  `${brandSlug}-${typeKey}-${(SLOTS as Record<string, Slot>)[slot]?.suffix ?? slot}.${ext}`;

/** Lowercase letters, digits, dots, dashes; ends in .svg or .png. */
export function fileNameProblem(name: string, ext: "svg" | "png"): string | null {
  if (!new RegExp(`^[a-z0-9][a-z0-9._-]{0,90}\\.${ext}$`).test(name)) return `Use lowercase letters, numbers, dots and dashes, ending in .${ext}.`;
  return null;
}
