import "server-only";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { CACHE_TAGS } from "../cache-tags";
import { db } from "../db";
import type { FileObject } from "../generated/prisma/client";
import { deleteFiles, storeFile } from "./files";
import { bucket } from "./storage";
import { zipBuffer } from "./zip";

/*
 * Background rebuilds of the zips: each logo type's, the brand kit (Auto mode) and the site-wide
 * "Download all". A change marks the brand stale and schedules a rebuild with after(), so the
 * admin's save returns at once; the editor shows "Rebuilding…" until the flag clears.
 *
 * Safe to run concurrently: a rebuild clears the flag only if nothing changed while it ran, and
 * the change that moved it on schedules its own rebuild.
 */

const PNG_COLS = ["png512Id", "png1024Id", "png2048Id", "png4096Id"] as const;
const SIZE: Record<(typeof PNG_COLS)[number], number> = { png512Id: 512, png1024Id: 1024, png2048Id: 2048, png4096Id: 4096 };

/** Public pages read files through cached data; expire it now (not stale-while-revalidate). */
function expirePublic(...slugs: string[]) {
  revalidateTag(CACHE_TAGS.brands, { expire: 0 });
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });
  for (const s of slugs) revalidateTag(CACHE_TAGS.brand(s), { expire: 0 });
}

async function bytesOf(f: FileObject): Promise<Buffer> {
  const { data, error } = await bucket().download(f.key);
  if (error || !data) throw new Error(`Couldn't read ${f.name} from storage: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

type BrandForZips = NonNullable<Awaited<ReturnType<typeof loadBrand>>>;
function loadBrand(id: string) {
  return db.brand.findUnique({
    where: { id },
    include: { logoTypes: { orderBy: { sortOrder: "asc" }, include: { variants: { orderBy: { sortOrder: "asc" } } } } },
  });
}

/** `svg/<name>` and `png/<width>/<name>` entries (the layout the kits have always had). */
async function variantEntries(b: BrandForZips, files: Map<string, FileObject>, prefix = "") {
  const out: { name: string; bytes: Buffer }[] = [];
  for (const t of b.logoTypes) {
    for (const v of t.variants) {
      const svg = v.svgFileId ? files.get(v.svgFileId) : undefined;
      if (svg) out.push({ name: `${prefix}svg/${svg.name}`, bytes: await bytesOf(svg) });
      for (const col of PNG_COLS) {
        const p = v[col] ? files.get(v[col]!) : undefined;
        if (p) out.push({ name: `${prefix}png/${SIZE[col]}/${p.name}`, bytes: await bytesOf(p) });
      }
    }
  }
  return out;
}

async function filesFor(b: BrandForZips): Promise<Map<string, FileObject>> {
  const ids = [b.colorsCssFileId, b.colorsJsonFileId, ...b.logoTypes.flatMap((t) => t.variants.flatMap((v) => [v.svgFileId, ...PNG_COLS.map((c) => v[c])]))];
  const rows = await db.fileObject.findMany({ where: { id: { in: ids.filter((x): x is string => Boolean(x)) } } });
  return new Map(rows.map((f) => [f.id, f]));
}

async function colorEntries(b: BrandForZips, files: Map<string, FileObject>, prefix = "") {
  const out: { name: string; bytes: Buffer }[] = [];
  for (const id of [b.colorsJsonFileId, b.colorsCssFileId]) {
    const f = id ? files.get(id) : undefined;
    if (f) out.push({ name: `${prefix}${f.name}`, bytes: await bytesOf(f) });
  }
  return out;
}

/** README.txt at the top of every automatic brand kit. */
function kitReadme(b: BrandForZips, files: number, colors: boolean): string {
  const types = b.logoTypes.filter((t) => t.variants.length).map((t) => `  - ${t.label}: ${t.variants.map((v) => v.name).join(", ")}`);
  return [
    `${b.name} brand kit`,
    "",
    `Built ${new Date().toISOString().slice(0, 10)} by the ParseLab brand portal.`,
    "",
    "Logos",
    ...types,
    "",
    "Folders",
    "  svg/          every logo as SVG (any size)",
    "  png/<width>/  transparent PNGs, 512 to 4096 px wide",
    ...(colors ? ["  colors.css    the palette as CSS custom properties", "  colors.json   the palette with hex, RGB and HSL"] : []),
    "",
    `${files} logo files in total. Use the variant made for your background (On light, On dark, Black, White).`,
    "",
  ].join("\n");
}

/** Rebuilds one brand's type zips and (in Auto mode) its kit, then the site-wide zip. */
export async function rebuildBrand(brandId: string): Promise<void> {
  const start = await db.brand.findUnique({ where: { id: brandId }, select: { assetsStaleAt: true } });
  if (!start?.assetsStaleAt) return;
  const stamp = start.assetsStaleAt;
  const b = await loadBrand(brandId);
  if (!b) return;
  const files = await filesFor(b);
  const old: (string | null)[] = [];

  for (const t of b.logoTypes) {
    const single = { ...b, logoTypes: [t] };
    const entries = t.variants.length ? await variantEntries(single, files) : [];
    const zip = entries.length
      ? await storeFile({ brandId, kind: "zips", name: `${b.slug}-${t.key}-logos.zip`, bytes: await zipBuffer(entries), mime: "application/zip" })
      : null;
    await db.logoType.update({ where: { id: t.id }, data: { zipFileId: zip?.id ?? null } });
    old.push(t.zipFileId);
  }

  if (b.kitMode === "AUTO") {
    const entries = await variantEntries(b, files);
    const colors = await colorEntries(b, files);
    const kit = entries.length
      ? await storeFile({
          brandId,
          kind: "zips",
          name: `${b.slug}-brand-kit.zip`,
          bytes: await zipBuffer([{ name: "README.txt", bytes: Buffer.from(kitReadme(b, entries.length, colors.length > 0)) }, ...entries, ...colors]),
          mime: "application/zip",
        })
      : null;
    // Raw SQL: the kit rebuilding isn't an edit, so "Updated" doesn't move.
    await db.$executeRaw`UPDATE "Brand" SET "kitFileId" = ${kit?.id ?? null}, "kitBuiltAt" = ${kit ? new Date() : null} WHERE "id" = ${brandId}`;
    old.push(b.kitFileId);
  }

  // Done, unless something changed meanwhile (that change has its own rebuild queued).
  await db.$executeRaw`UPDATE "Brand" SET "assetsStaleAt" = NULL WHERE "id" = ${brandId} AND "assetsStaleAt" = ${stamp}`;
  await deleteFiles(old);
  await markAllKitStale();
  await rebuildAllKit();
  expirePublic(b.slug);
}

export async function markAllKitStale() {
  await db.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, allKitStaleAt: new Date() }, update: { allKitStaleAt: new Date() } });
}

/** "Download all": every public brand's logos and colors, one folder per brand. */
export async function rebuildAllKit(): Promise<void> {
  const s = await db.siteSettings.findUnique({ where: { id: 1 } });
  if (!s?.allKitStaleAt || s.allKitMode !== "AUTO") return;
  const stamp = s.allKitStaleAt;
  const brands = await db.brand.findMany({ where: { status: { in: ["SOON", "LIVE"] } }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const entries: { name: string; bytes: Buffer }[] = [];
  for (const { id } of brands) {
    const b = await loadBrand(id);
    if (!b) continue;
    const files = await filesFor(b);
    const logos = await variantEntries(b, files, `${b.slug}/`);
    if (logos.length) entries.push(...logos, ...(await colorEntries(b, files, `${b.slug}/`)));
  }
  const zip = entries.length ? await storeFile({ brandId: null, kind: "zips", name: "parselab-brand-kits.zip", bytes: await zipBuffer(entries), mime: "application/zip" }) : null;
  await db.siteSettings.update({ where: { id: 1 }, data: { allKitFileId: zip?.id ?? null } });
  await db.$executeRaw`UPDATE "SiteSettings" SET "allKitStaleAt" = NULL WHERE "id" = 1 AND "allKitStaleAt" = ${stamp}`;
  await deleteFiles([s.allKitFileId]);
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });
}

/**
 * After the response is sent, ask our own /api/internal/rebuild route to do the work: a route
 * handler may expire the public cache (revalidateTag), code running after a server action may
 * not. after() keeps the function alive until that request finishes.
 */
async function runInBackground(body: { brandId?: string }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  after(async () => {
    try {
      const res = await fetch(`${proto}://${host}/api/internal/rebuild/`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) console.error("Background rebuild failed:", res.status, await res.text());
    } catch (e) {
      console.error("Background rebuild failed:", e);
    }
  });
}

/** Marks a brand's zips stale and rebuilds them after the response is sent. */
export async function scheduleRebuild(brandId: string) {
  await db.$executeRaw`UPDATE "Brand" SET "assetsStaleAt" = ${new Date()} WHERE "id" = ${brandId}`;
  await runInBackground({ brandId });
}

/** For changes that only affect "Download all" (a brand published, hidden or deleted). */
export async function scheduleAllKitRebuild() {
  await markAllKitStale();
  await runInBackground({});
}
