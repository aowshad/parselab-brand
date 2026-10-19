/** Color input rules shared by the Colors tab (live hints) and the server (the rules). */

/** "6ca9f3", "#6CA9F3", "#6af", "6AF" → "#66AAFF"-style uppercase 6-digit hex, or null. */
export function normalizeHex(input: string): string | null {
  const h = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) return `#${[...h].map((c) => c + c).join("")}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(h)) return `#${h}`.toUpperCase();
  return null;
}

export type ColorInput =
  | { kind: "SOLID"; role: string; name: string; hex: string; cmyk?: string; pantone?: string }
  | { kind: "GRADIENT"; role: string; name: string; angle: number; stops: { hex: string; at: number }[] };

export const MIN_STOPS = 2;
export const MAX_STOPS = 5;

/** Validates and normalizes a color from the editor; returns it, or a message. */
export function checkColor(raw: unknown): { color: ColorInput } | { error: string } {
  const c = (raw ?? {}) as Record<string, unknown>;
  const role = String(c.role ?? "").trim();
  const name = String(c.name ?? "").trim();
  if (!name) return { error: "Name the color." };
  if (!role) return { error: "Give it a role, like Primary or Accent." };
  if (name.length > 40 || role.length > 40) return { error: "Keep the name and role under 40 characters." };
  if (c.kind === "GRADIENT") {
    const angle = Number(c.angle);
    if (!Number.isFinite(angle) || angle < 0 || angle > 360) return { error: "The angle must be between 0 and 360." };
    const stops = Array.isArray(c.stops) ? c.stops : [];
    if (stops.length < MIN_STOPS || stops.length > MAX_STOPS) return { error: `A gradient needs ${MIN_STOPS} to ${MAX_STOPS} stops.` };
    const out = [];
    for (const s of stops as Record<string, unknown>[]) {
      const hex = normalizeHex(String(s.hex ?? ""));
      const at = Number(s.at);
      if (!hex) return { error: `"${s.hex}" isn't a hex color.` };
      if (!Number.isFinite(at) || at < 0 || at > 100) return { error: "Stop positions are 0 to 100%." };
      out.push({ hex, at: Math.round(at) });
    }
    return { color: { kind: "GRADIENT", role, name, angle: Math.round(angle), stops: out.sort((a, b) => a.at - b.at) } };
  }
  const hex = normalizeHex(String(c.hex ?? ""));
  if (!hex) return { error: "Enter a hex color like #6CA9F3 (3 or 6 digits, # optional)." };
  const cmyk = String(c.cmyk ?? "").trim().slice(0, 40) || undefined;
  const pantone = String(c.pantone ?? "").trim().slice(0, 40) || undefined;
  return { color: { kind: "SOLID", role, name, hex, cmyk, pantone } };
}
