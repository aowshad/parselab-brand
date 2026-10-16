"use server";

import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { deleteFiles, readFile, renameFile, storeFile } from "@/lib/admin/files";
import { scheduleRebuild } from "@/lib/admin/rebuild";
import { pngsFromPng, pngsFromSvg } from "@/lib/admin/render";
import { refreshPublic } from "@/lib/admin/revalidate";
import { defaultFileName, fileNameProblem, isSlot, SLOTS, TYPE_PRESETS } from "@/lib/admin/slots";
import { svgSize } from "@/lib/admin/uploads";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import type { ActionResult } from "./actions";

/*
 * Logos tab mutations. Each re-checks the session, refreshes the brand's public page, and queues
 * a background rebuild of the zips and kit (the editor shows "Rebuilding…" until it finishes).
 */

const PNG_COL = { 512: "png512Id", 1024: "png1024Id", 2048: "png2048Id", 4096: "png4096Id" } as const;

async function admin() {
  if (!(await getCurrentAdmin())) redirect("/admin/login");
}

async function typeWithBrand(typeId: string) {
  return db.logoType.findUnique({ where: { id: typeId }, include: { brand: { select: { id: true, slug: true } }, variants: true } });
}

const variantFiles = (v: { svgFileId: string | null; png512Id: string | null; png1024Id: string | null; png2048Id: string | null; png4096Id: string | null }) => [
  v.svgFileId, v.png512Id, v.png1024Id, v.png2048Id, v.png4096Id,
];

async function changed(brandId: string, slug: string) {
  await scheduleRebuild(brandId);
  refreshPublic(slug);
}

// ── Logo types ──────────────────────────────────────────────────────────────────────────

export async function addLogoType(brandId: string, preset: string | null, customLabel?: string): Promise<ActionResult> {
  await admin();
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true, logoTypes: { select: { key: true, sortOrder: true } } } });
  if (!brand) return { error: "This brand no longer exists." };
  const p = TYPE_PRESETS.find((t) => t.key === preset);
  const label = (p?.label ?? customLabel ?? "").trim();
  if (!label) return { error: "Name the logo type." };
  if (label.length > 40) return { error: "Keep the name under 40 characters." };
  const taken = (k: string) => brand.logoTypes.some((t) => t.key === k);
  const base = p?.key ?? (slugify(label) || "logo");
  if (p && taken(base)) return { error: `${label} already exists.` };
  let key = base;
  for (let n = 2; taken(key); n++) key = `${base}-${n}`;
  const type = await db.logoType.create({
    data: {
      brandId,
      key,
      label,
      description: p?.description ?? "",
      sortOrder: Math.max(-1, ...brand.logoTypes.map((t) => t.sortOrder)) + 1,
    },
  });
  return { ok: `${label} added`, id: type.id };
}

export async function updateLogoType(typeId: string, label: string, description: string): Promise<ActionResult> {
  await admin();
  const t = await typeWithBrand(typeId);
  if (!t) return { error: "This logo type no longer exists." };
  label = label.trim();
  description = description.trim();
  if (!label) return { error: "The label can't be empty." };
  if (label.length > 40 || description.length > 140) return { error: "Keep the label under 40 and the description under 140 characters." };
  await db.logoType.update({ where: { id: typeId }, data: { label, description } });
  refreshPublic(t.brand.slug);
  return { ok: "Saved" };
}

export async function reorderLogoTypes(brandId: string, ids: string[]): Promise<ActionResult> {
  await admin();
  const types = await db.logoType.findMany({ where: { brandId }, select: { id: true } });
  if (ids.length !== types.length || !types.every((t) => ids.includes(t.id))) return { error: "The list changed. Reload and try again." };
  const brand = await db.brand.findUniqueOrThrow({ where: { id: brandId }, select: { slug: true } });
  await db.$transaction(ids.map((id, i) => db.logoType.update({ where: { id }, data: { sortOrder: i } })));
  await changed(brandId, brand.slug);
  return { ok: "Order saved" };
}

export async function deleteLogoType(typeId: string): Promise<ActionResult> {
  await admin();
  const t = await typeWithBrand(typeId);
  if (!t) return { error: "This logo type no longer exists." };
  await db.logoType.delete({ where: { id: typeId } });
  const removed = await deleteFiles([t.zipFileId, ...t.variants.flatMap(variantFiles)]);
  await changed(t.brand.id, t.brand.slug);
  return { ok: `${t.label} deleted · ${removed} file${removed === 1 ? "" : "s"} removed` };
}

// ── Variants ────────────────────────────────────────────────────────────────────────────

/**
 * Puts a freshly uploaded file (from /api/admin/uploads, purpose "logo-variant") into a slot:
 * stores it under the variant's download name, renders PNGs at 512–4096 px (an SVG) or the
 * standard widths up to its own (a PNG), and replaces whatever the slot held.
 */
export async function attachVariant(typeId: string, slot: string, uploadedFileId: string): Promise<ActionResult> {
  await admin();
  if (!isSlot(slot)) return { error: "Unknown variant." };
  const t = await typeWithBrand(typeId);
  if (!t) return { error: "This logo type no longer exists." };
  const up = await db.fileObject.findUnique({ where: { id: uploadedFileId } });
  if (!up || !up.key.startsWith(`brands/${t.brand.id}/logos/`)) return { error: "That upload can't be used here." };

  const isSvg = up.mime === "image/svg+xml";
  const ext = isSvg ? "svg" : "png";
  const existing = t.variants.find((v) => v.key === slot);
  // Keep a name the admin chose; switch its extension if the file type changed.
  const fileName = existing ? existing.fileName.replace(/\.(svg|png)$/, `.${ext}`) : defaultFileName(t.brand.slug, t.key, slot, ext);
  const stem = fileName.replace(/\.(svg|png)$/, "");

  const bytes = await readFile(up);
  const pngs = isSvg ? await pngsFromSvg(bytes, svgSize(bytes.toString("utf8"))?.width ?? up.width ?? 512) : await pngsFromPng(bytes, up.width ?? 512);
  const svg = isSvg ? await renameFile(up.id, fileName) : null;
  const stored = [];
  for (const p of pngs) {
    stored.push({ size: p.size, file: await storeFile({ brandId: t.brand.id, kind: "png", name: `${stem}@${p.size}.png`, bytes: p.bytes, mime: "image/png", width: p.width, height: p.height }) });
  }
  if (!isSvg) await deleteFiles([up.id]); // the PNG sizes above include the original

  const files = {
    svgFileId: svg?.id ?? null,
    png512Id: null as string | null, png1024Id: null as string | null, png2048Id: null as string | null, png4096Id: null as string | null,
  };
  for (const s of stored) files[PNG_COL[s.size]] = s.file.id;

  const defaults = SLOTS[slot];
  if (existing) {
    await db.logoVariant.update({ where: { id: existing.id }, data: { ...files, fileName } });
    await deleteFiles(variantFiles(existing).filter((id) => id !== svg?.id));
  } else {
    await db.logoVariant.create({
      data: {
        logoTypeId: typeId,
        key: slot,
        name: defaults.name,
        hint: defaults.hint,
        previewBg: defaults.previewBg,
        dot: defaults.dot,
        fileName,
        sortOrder: Math.max(-1, ...t.variants.map((v) => v.sortOrder)) + 1,
        ...files,
      },
    });
  }
  await changed(t.brand.id, t.brand.slug);
  return { ok: `${defaults.name} ${existing ? "replaced" : "added"} · ${isSvg ? "SVG + " : ""}${stored.length} PNG${stored.length === 1 ? "" : "s"}` };
}

export async function updateVariant(variantId: string, fields: { fileName?: string; hint?: string }): Promise<ActionResult> {
  await admin();
  const v = await db.logoVariant.findUnique({ where: { id: variantId }, include: { logoType: { include: { brand: { select: { id: true, slug: true } } } } } });
  if (!v) return { error: "This variant no longer exists." };
  const brand = v.logoType.brand;
  const data: { fileName?: string; hint?: string } = {};

  if (fields.hint !== undefined) {
    const hint = fields.hint.trim();
    if (!hint) return { error: "The hint can't be empty." };
    if (hint.length > 200) return { error: "Keep the hint under 200 characters." };
    data.hint = hint;
  }
  if (fields.fileName !== undefined && fields.fileName !== v.fileName) {
    const fileName = fields.fileName.trim().toLowerCase();
    const ext = v.svgFileId ? "svg" : "png";
    const problem = fileNameProblem(fileName, ext);
    if (problem) return { error: problem };
    const clash = await db.logoVariant.findFirst({ where: { fileName, id: { not: v.id }, logoType: { brandId: brand.id } }, select: { id: true } });
    if (clash) return { error: "Another logo of this brand already uses that file name." };
    const stem = fileName.replace(/\.(svg|png)$/, "");
    if (v.svgFileId) await renameFile(v.svgFileId, fileName);
    for (const [size, col] of Object.entries(PNG_COL)) {
      const id = v[col as keyof typeof v] as string | null;
      if (id) await renameFile(id, `${stem}@${size}.png`);
    }
    data.fileName = fileName;
  }
  if (!Object.keys(data).length) return { ok: "No changes" };
  await db.logoVariant.update({ where: { id: variantId }, data });
  if (data.fileName) await scheduleRebuild(brand.id); // file names inside the zips change
  refreshPublic(brand.slug);
  return { ok: data.fileName ? `Renamed to ${data.fileName}` : "Hint saved" };
}

export async function removeVariant(variantId: string): Promise<ActionResult> {
  await admin();
  const v = await db.logoVariant.findUnique({ where: { id: variantId }, include: { logoType: { include: { brand: { select: { id: true, slug: true } } } } } });
  if (!v) return { error: "This variant no longer exists." };
  await db.logoVariant.delete({ where: { id: variantId } });
  const removed = await deleteFiles(variantFiles(v));
  await changed(v.logoType.brand.id, v.logoType.brand.slug);
  return { ok: `${v.name} removed · ${removed} file${removed === 1 ? "" : "s"}` };
}
