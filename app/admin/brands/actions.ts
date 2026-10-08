"use server";

import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { copyFile, deleteBrandFolder, deleteFiles } from "@/lib/admin/files";
import { refreshPublic } from "@/lib/admin/revalidate";
import { db } from "@/lib/db";
import type { BrandStatus } from "@/lib/generated/prisma/client";
import { MAX_SLUG, slugify, slugProblem } from "@/lib/slug";

/*
 * Brand mutations. Each one re-checks the session, validates on the server (the forms only hint),
 * and expires the public pages it changed so the site shows the edit on the next visit.
 */

export type ActionResult = { ok?: string; error?: string; fieldErrors?: Record<string, string>; id?: string };

const STATUSES: BrandStatus[] = ["DRAFT", "SOON", "LIVE"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

async function admin() {
  if (!(await getCurrentAdmin())) redirect("/admin/login");
}

/** Slug rules plus uniqueness (other brands; a redirect pointing elsewhere is overridden on save). */
async function slugError(slug: string, brandId?: string): Promise<string | null> {
  const problem = slugProblem(slug);
  if (problem) return problem;
  const taken = await db.brand.findFirst({ where: { slug, NOT: brandId ? { id: brandId } : undefined }, select: { name: true } });
  return taken ? `${taken.name} already uses /${slug}/.` : null;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

// ── Create ──────────────────────────────────────────────────────────────────────────────

export async function createBrand(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  await admin();
  const name = text(form, "name");
  const slug = text(form, "slug") || slugify(name);
  const tagline = text(form, "tagline");
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Enter the brand name.";
  const se = await slugError(slug);
  if (se) fieldErrors.slug = se;
  if (tagline.length > 140) fieldErrors.tagline = "Keep the tagline under 140 characters.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const last = await db.brand.aggregate({ _max: { sortOrder: true } });
  const brand = await db.brand.create({
    // New brands start hidden: Draft is never on the public site.
    data: { name, slug, tagline, status: "DRAFT", sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  await db.brandRedirect.deleteMany({ where: { fromSlug: slug } });
  refreshPublic(slug);
  redirect(`/admin/brands/${brand.id}/?created=1`);
}

// ── General tab ─────────────────────────────────────────────────────────────────────────

export async function saveGeneral(id: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  await admin();
  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) return { error: "This brand no longer exists." };

  const name = text(form, "name");
  const slug = text(form, "slug");
  const tagline = text(form, "tagline");
  const status = text(form, "status") as BrandStatus;
  const accent = text(form, "accent").toUpperCase();
  const keepRedirect = form.get("keepRedirect") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Enter the brand name.";
  const se = await slugError(slug, id);
  if (se) fieldErrors.slug = se;
  if (tagline.length > 140) fieldErrors.tagline = "Keep the tagline under 140 characters.";
  if (!STATUSES.includes(status)) fieldErrors.status = "Pick a status.";
  if (accent && !HEX.test(accent)) fieldErrors.accent = "Use a 6-digit hex color like #6CA9F3.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const renamed = slug !== brand.slug;
  await db.$transaction([
    db.brand.update({ where: { id }, data: { name, slug, tagline, status, accent: accent || null } }),
    // The new slug can't also be someone's old address.
    db.brandRedirect.deleteMany({ where: { fromSlug: slug } }),
    ...(renamed && keepRedirect ? [db.brandRedirect.create({ data: { fromSlug: brand.slug, brandId: id } })] : []),
  ]);
  refreshPublic(brand.slug, slug);
  return { ok: renamed && keepRedirect ? `Saved · /${brand.slug}/ now redirects to /${slug}/` : "Saved" };
}

export async function removeRedirect(brandId: string, fromSlug: string): Promise<ActionResult> {
  await admin();
  await db.brandRedirect.deleteMany({ where: { brandId, fromSlug } });
  refreshPublic(fromSlug);
  return { ok: `/${fromSlug}/ no longer redirects` };
}

// ── Brands list ─────────────────────────────────────────────────────────────────────────

export async function setStatus(id: string, status: BrandStatus): Promise<ActionResult> {
  await admin();
  if (!STATUSES.includes(status)) return { error: "Unknown status." };
  const brand = await db.brand.update({ where: { id }, data: { status }, select: { slug: true, name: true } });
  refreshPublic(brand.slug);
  const label = { DRAFT: "Draft · hidden from the site", SOON: "Soon", LIVE: "Live" }[status];
  return { ok: `${brand.name}: ${label}` };
}

/** Saves the whole home-page order at once. Doesn't touch "Updated" dates (raw SQL skips @updatedAt). */
export async function reorderBrands(ids: string[]): Promise<ActionResult> {
  await admin();
  const known = await db.brand.findMany({ select: { id: true } });
  if (ids.length !== known.length || new Set(ids).size !== ids.length || !known.every((b) => ids.includes(b.id))) {
    return { error: "The list changed in another tab. Reload and try again." };
  }
  await db.$transaction(ids.map((id, i) => db.$executeRaw`UPDATE "Brand" SET "sortOrder" = ${i} WHERE "id" = ${id}`));
  refreshPublic();
  return { ok: "Order saved" };
}

/** A full copy as a Draft: logos (files copied in storage), colors, typography and usage. */
export async function duplicateBrand(id: string): Promise<ActionResult> {
  await admin();
  const src = await db.brand.findUnique({ where: { id }, include: { logoTypes: { include: { variants: true } }, colors: true } });
  if (!src) return { error: "This brand no longer exists." };

  let slug = `${src.slug}-copy`.slice(0, MAX_SLUG);
  for (let n = 2; await db.brand.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${src.slug}-copy-${n}`.slice(0, MAX_SLUG);
  const newId = crypto.randomUUID();
  const copy = async (fid: string | null) => (fid ? (await copyFile(fid, newId)).id : null);
  const last = await db.brand.aggregate({ _max: { sortOrder: true } });

  const logoTypes = [];
  for (const t of src.logoTypes) {
    const variants = [];
    for (const v of t.variants) {
      variants.push({
        key: v.key, name: v.name, hint: v.hint, fileName: v.fileName, previewBg: v.previewBg, dot: v.dot, sortOrder: v.sortOrder,
        svgFileId: await copy(v.svgFileId), png512Id: await copy(v.png512Id), png1024Id: await copy(v.png1024Id),
        png2048Id: await copy(v.png2048Id), png4096Id: await copy(v.png4096Id),
      });
    }
    logoTypes.push({ key: t.key, label: t.label, description: t.description, sortOrder: t.sortOrder, zipFileId: await copy(t.zipFileId), variants: { create: variants } });
  }
  await db.brand.create({
    data: {
      id: newId,
      slug,
      name: `${src.name} copy`,
      tagline: src.tagline,
      status: "DRAFT",
      sortOrder: (last._max.sortOrder ?? 0) + 1,
      accent: src.accent,
      kitMode: src.kitMode,
      iconFileId: await copy(src.iconFileId),
      kitFileId: await copy(src.kitFileId),
      colorsCssFileId: await copy(src.colorsCssFileId),
      colorsJsonFileId: await copy(src.colorsJsonFileId),
      ogFileId: await copy(src.ogFileId),
      typography: src.typography ?? undefined,
      usage: src.usage ?? undefined,
      logoTypes: { create: logoTypes },
      colors: { create: src.colors.map(({ id: _i, brandId: _b, gradient, ...c }) => ({ ...c, gradient: gradient ?? undefined })) },
    },
  });
  return { ok: `Duplicated as ${src.name} copy (Draft)`, id: newId };
}

/** Deletes the brand, its logos, colors and redirects, and every file it alone used. Needs the exact name. */
export async function deleteBrand(id: string, confirmName: string): Promise<ActionResult> {
  await admin();
  const b = await db.brand.findUnique({ where: { id }, include: { logoTypes: { include: { variants: true } } } });
  if (!b) return { error: "This brand no longer exists." };
  if (confirmName.trim() !== b.name) return { error: `Type "${b.name}" exactly to delete it.` };

  const files = [
    b.iconFileId, b.kitFileId, b.colorsCssFileId, b.colorsJsonFileId, b.ogFileId,
    ...b.logoTypes.flatMap((t) => [t.zipFileId, ...t.variants.flatMap((v) => [v.svgFileId, v.png512Id, v.png1024Id, v.png2048Id, v.png4096Id])]),
  ];
  await db.brand.delete({ where: { id } }); // cascades to logo types, variants, colors, redirects
  // Files it pointed at outside its own folder (seeded ones, say), then everything in its folder.
  const removed = (await deleteFiles(files)) + (await deleteBrandFolder(id));
  refreshPublic(b.slug);
  return { ok: `${b.name} deleted · ${removed} file${removed === 1 ? "" : "s"} removed` };
}

// ── Icon ────────────────────────────────────────────────────────────────────────────────

export async function setIcon(brandId: string, fileId: string): Promise<ActionResult> {
  await admin();
  const [brand, file] = await Promise.all([
    db.brand.findUnique({ where: { id: brandId }, select: { slug: true, iconFileId: true } }),
    db.fileObject.findUnique({ where: { id: fileId }, select: { key: true } }),
  ]);
  // Only a file just uploaded for this brand's icon can become its icon.
  if (!brand || !file || !file.key.startsWith(`brands/${brandId}/icon/`)) return { error: "That upload can't be used here." };
  await db.brand.update({ where: { id: brandId }, data: { iconFileId: fileId } });
  if (brand.iconFileId && brand.iconFileId !== fileId) await deleteFiles([brand.iconFileId]);
  refreshPublic(brand.slug);
  return { ok: "Icon updated" };
}

export async function removeIcon(brandId: string): Promise<ActionResult> {
  await admin();
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true, iconFileId: true } });
  if (!brand) return { error: "This brand no longer exists." };
  await db.brand.update({ where: { id: brandId }, data: { iconFileId: null } });
  await deleteFiles([brand.iconFileId]);
  refreshPublic(brand.slug);
  return { ok: "Icon removed" };
}
