import "server-only";
import { db } from "../db";
import { FONT_WEIGHTS } from "../font-catalog";
import { Prisma } from "../generated/prisma/client";
import { typographySchema } from "../schema";
import type { OpResult } from "./logo-ops";
import { expirePublic } from "./revalidate";

export const MAX_TYPEFACES = 4;

/**
 * Saves a brand's typography, or null for "Coming soon". Same rules as the public page reads
 * (lib/schema.ts), plus: every family must be self-hosted (lib/fonts.ts) and ship those weights.
 */
export async function saveTypography(brandId: string, raw: unknown): Promise<OpResult> {
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true } });
  if (!brand) return { error: "This brand no longer exists." };

  let value: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (raw !== null) {
    const parsed = typographySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const field = issue.path.find((p): p is string => typeof p === "string" && p !== "typefaces");
      const messages: Record<string, string> = {
        url: "Each typeface needs a valid link (https://…).",
        weights: "Pick at least one weight for each typeface.",
        role: "Give each typeface a role, like Headings or Body & UI.",
        family: "Pick a family for each typeface.",
      };
      return { error: (field ? messages[field] : undefined) ?? (issue.path.length === 1 ? "Add at least one typeface." : "Check the typefaces and try again.") };
    }
    const faces = parsed.data.typefaces;
    if (faces.length > MAX_TYPEFACES) return { error: `Up to ${MAX_TYPEFACES} typefaces.` };
    for (const use of ["headings", "body"] as const) {
      if (!faces.some((f) => f.use === use || f.use === "both")) return { error: `No typeface sets the ${use === "headings" ? "headings" : "body text"}. Set one to "${use === "headings" ? "Headings" : "Body"}" or "Both".` };
    }
    for (const f of faces) {
      if (!FONT_WEIGHTS[f.family]) return { error: `${f.family} isn't available. Pick one of the listed families.` };
      const missing = f.weights.filter((w) => !FONT_WEIGHTS[f.family]?.includes(w));
      if (missing.length) return { error: `${f.family} doesn't come in weight ${missing.join(", ")}.` };
    }
    value = { typefaces: faces.map((f) => ({ ...f, weights: [...new Set(f.weights)].sort((a, b) => a - b) })) };
  }
  await db.brand.update({ where: { id: brandId }, data: { typography: value } });
  expirePublic(brand.slug);
  return { ok: raw === null ? "Typography shows as Coming soon" : "Typography saved" };
}
