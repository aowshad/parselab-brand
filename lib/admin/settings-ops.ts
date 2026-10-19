import "server-only";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "../cache-tags";
import { db } from "../db";
import { deleteFiles, renameFile } from "./files";
import type { OpResult } from "./logo-ops";
import { scheduleAllKitRebuild } from "./rebuild";

/*
 * Site settings operations, run by /api/admin/settings (session + same origin checked there):
 * the home page and footer texts, and how the "Download all" zip is made.
 */

export const ALL_KIT_NAME = "parselab-brand-kits.zip";
export const SETTINGS_LIMITS = { homeTitle: 80, homeSubtitle: 240, footerText: 200, contactEmail: 120 };

const LABELS: Record<keyof typeof SETTINGS_LIMITS, string> = {
  homeTitle: "Home title",
  homeSubtitle: "Home subtitle",
  footerText: "Footer text",
  contactEmail: "Contact email",
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every public page shows the footer, and the home page the title: expire them all. */
const expireSettings = () => revalidateTag(CACHE_TAGS.settings, { expire: 0 });

export async function saveSettings(raw: Record<string, unknown>): Promise<OpResult> {
  const data = {} as Record<keyof typeof SETTINGS_LIMITS, string>;
  for (const field of Object.keys(SETTINGS_LIMITS) as (keyof typeof SETTINGS_LIMITS)[]) {
    const v = typeof raw[field] === "string" ? (raw[field] as string).trim().replace(/\s+/g, " ") : "";
    if (!v) return { error: `${LABELS[field]} can't be empty.` };
    if (v.length > SETTINGS_LIMITS[field]) return { error: `${LABELS[field]} is too long (${SETTINGS_LIMITS[field]} characters at most).` };
    data[field] = v;
  }
  if (!EMAIL.test(data.contactEmail)) return { error: "Contact email doesn't look like an email address." };
  await db.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  expireSettings();
  return { ok: "Settings saved" };
}

export async function setAllKitMode(mode: string): Promise<OpResult> {
  if (mode !== "AUTO" && mode !== "MANUAL") return { error: "Unknown mode." };
  const s = await db.siteSettings.findUnique({ where: { id: 1 }, select: { allKitMode: true } });
  if ((s?.allKitMode ?? "AUTO") === mode) return { ok: "No change" };
  await db.$executeRaw`INSERT INTO "SiteSettings" ("id", "allKitMode") VALUES (1, ${mode}::"KitMode") ON CONFLICT ("id") DO UPDATE SET "allKitMode" = EXCLUDED."allKitMode"`;
  // Back to Auto: build the zip from the public brands again (it replaces the uploaded one).
  if (mode === "AUTO") await scheduleAllKitRebuild();
  return { ok: mode === "AUTO" ? "Auto: rebuilding from the public brands" : "Manual: upload your own ZIP" };
}

/** Makes an uploaded zip (purpose "site-kit-zip") the "Download all" file. */
export async function useUploadedAllKit(fileId: string): Promise<OpResult> {
  const f = await db.fileObject.findUnique({ where: { id: fileId } });
  if (!f || f.mime !== "application/zip" || !f.key.startsWith("site/zips/")) return { error: "That upload can't be used here." };
  await renameFile(f.id, ALL_KIT_NAME);
  const s = await db.siteSettings.findUnique({ where: { id: 1 }, select: { allKitFileId: true } });
  await db.$executeRaw`INSERT INTO "SiteSettings" ("id", "allKitMode", "allKitFileId") VALUES (1, 'MANUAL'::"KitMode", ${f.id}) ON CONFLICT ("id") DO UPDATE SET "allKitMode" = 'MANUAL'::"KitMode", "allKitFileId" = EXCLUDED."allKitFileId"`;
  if (s?.allKitFileId && s.allKitFileId !== f.id) await deleteFiles([s.allKitFileId]);
  expireSettings();
  return { ok: "Kit uploaded" };
}

export async function rebuildAllKitNow(): Promise<OpResult> {
  const s = await db.siteSettings.findUnique({ where: { id: 1 }, select: { allKitMode: true } });
  if ((s?.allKitMode ?? "AUTO") !== "AUTO") return { error: "Switch to Auto to rebuild the zip from the brands." };
  await scheduleAllKitRebuild();
  return { ok: "Rebuilding the kit…" };
}

/** True while an automatic "Download all" rebuild is pending. */
export async function allKitRebuilding(): Promise<boolean> {
  const s = await db.siteSettings.findUnique({ where: { id: 1 }, select: { allKitMode: true, allKitStaleAt: true } });
  return !!s && s.allKitMode === "AUTO" && s.allKitStaleAt !== null;
}
