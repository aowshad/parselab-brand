import "server-only";
import { db } from "../db";
import { deleteFiles, renameFile } from "./files";
import type { OpResult } from "./logo-ops";
import { scheduleRebuild } from "./rebuild";
import { expirePublic } from "./revalidate";

/*
 * Brand kit tab operations, run by /api/admin/kit (session + same origin checked there).
 * Auto: the kit is built from the logos and colors (lib/admin/rebuild.ts). Manual: an uploaded zip.
 */

export async function setKitMode(brandId: string, mode: string): Promise<OpResult> {
  if (mode !== "AUTO" && mode !== "MANUAL") return { error: "Unknown mode." };
  const b = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true, kitMode: true } });
  if (!b) return { error: "This brand no longer exists." };
  if (b.kitMode === mode) return { ok: "No change" };
  await db.$executeRaw`UPDATE "Brand" SET "kitMode" = ${mode}::"KitMode" WHERE "id" = ${brandId}`;
  // Back to Auto: build the kit from the logos again (it replaces the uploaded one).
  if (mode === "AUTO") await scheduleRebuild(brandId);
  expirePublic(b.slug);
  return { ok: mode === "AUTO" ? "Auto: rebuilding the kit from the logos" : "Manual: upload your own kit" };
}

/** Makes an uploaded zip (purpose "kit-zip") the brand's kit, saved as <slug>-brand-kit.zip. */
export async function useUploadedKit(brandId: string, fileId: string): Promise<OpResult> {
  const b = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true, kitFileId: true } });
  const f = await db.fileObject.findUnique({ where: { id: fileId } });
  if (!b || !f || f.mime !== "application/zip" || !f.key.startsWith(`brands/${brandId}/zips/`)) return { error: "That upload can't be used here." };
  await renameFile(f.id, `${b.slug}-brand-kit.zip`);
  await db.$executeRaw`UPDATE "Brand" SET "kitMode" = 'MANUAL'::"KitMode", "kitFileId" = ${f.id}, "kitBuiltAt" = ${new Date()} WHERE "id" = ${brandId}`;
  if (b.kitFileId && b.kitFileId !== f.id) await deleteFiles([b.kitFileId]);
  expirePublic(b.slug);
  return { ok: "Kit uploaded" };
}

export async function rebuildKitNow(brandId: string): Promise<OpResult> {
  const b = await db.brand.findUnique({ where: { id: brandId }, select: { kitMode: true } });
  if (!b) return { error: "This brand no longer exists." };
  if (b.kitMode !== "AUTO") return { error: "Switch to Auto to rebuild the kit from the logos." };
  await scheduleRebuild(brandId);
  return { ok: "Rebuilding the kit…" };
}
