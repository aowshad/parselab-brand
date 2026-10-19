import "server-only";
import { db } from "../db";
import { Prisma } from "../generated/prisma/client";
import { checkColor, type ColorInput } from "./color-input";
import { regenerateColorFiles } from "./colors";
import type { OpResult } from "./logo-ops";
import { scheduleRebuild } from "./rebuild";
import { expirePublic } from "./revalidate";

/*
 * Colors tab operations, run by /api/admin/colors (session + same-origin checked there). After
 * each: colors.css / colors.json are regenerated, the brand's "Updated" date moves, the public
 * page is expired, and the kit (which includes the color files) is rebuilt in the background.
 */

const fields = (c: ColorInput): Omit<Prisma.ColorUncheckedCreateInput, "brandId" | "sortOrder"> =>
  c.kind === "GRADIENT"
    ? { kind: "GRADIENT", role: c.role, name: c.name, hex: null, gradient: { angle: c.angle, stops: c.stops }, cmyk: null, pantone: null }
    : { kind: "SOLID", role: c.role, name: c.name, hex: c.hex, gradient: Prisma.DbNull, cmyk: c.cmyk ?? null, pantone: c.pantone ?? null };

async function changed(brandId: string) {
  const b = await db.brand.update({ where: { id: brandId }, data: { updatedAt: new Date() }, select: { slug: true } });
  await regenerateColorFiles(brandId);
  await scheduleRebuild(brandId);
  expirePublic(b.slug);
}

export async function addColor(brandId: string, raw: unknown): Promise<OpResult> {
  const checked = checkColor(raw);
  if ("error" in checked) return checked;
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!brand) return { error: "This brand no longer exists." };
  const last = await db.color.aggregate({ where: { brandId }, _max: { sortOrder: true } });
  const c = await db.color.create({ data: { brandId, sortOrder: (last._max.sortOrder ?? -1) + 1, ...fields(checked.color) } });
  await changed(brandId);
  return { ok: `${c.name} added`, id: c.id };
}

export async function updateColor(colorId: string, raw: unknown): Promise<OpResult> {
  const checked = checkColor(raw);
  if ("error" in checked) return checked;
  const existing = await db.color.findUnique({ where: { id: colorId }, select: { brandId: true } });
  if (!existing) return { error: "This color no longer exists." };
  await db.color.update({ where: { id: colorId }, data: fields(checked.color) });
  await changed(existing.brandId);
  return { ok: `${checked.color.name} saved` };
}

export async function removeColor(colorId: string): Promise<OpResult> {
  const c = await db.color.findUnique({ where: { id: colorId }, select: { brandId: true, name: true } });
  if (!c) return { error: "This color no longer exists." };
  await db.color.delete({ where: { id: colorId } });
  await changed(c.brandId);
  return { ok: `${c.name} deleted` };
}

export async function reorderColors(brandId: string, ids: string[]): Promise<OpResult> {
  const colors = await db.color.findMany({ where: { brandId }, select: { id: true } });
  if (ids.length !== colors.length || !colors.every((c) => ids.includes(c.id))) return { error: "The list changed. Reload and try again." };
  await db.$transaction(ids.map((id, i) => db.color.update({ where: { id }, data: { sortOrder: i } })));
  await changed(brandId);
  return { ok: "Order saved" };
}
