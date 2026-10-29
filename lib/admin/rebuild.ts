import "server-only";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { CACHE_TAGS } from "../cache-tags";
import { db } from "../db";
import type { FileObject } from "../generated/prisma/client";
import { cardVariant, variantPublicId } from "../variants";
import { deleteFiles, storeFile } from "./files";
import { OG, brandOgPng } from "./og";
import { bucket } from "./storage";
import { readZip, zipBuffer } from "./zip";

/*
 * Background rebuilds of the zips: each logo type's, the brand kit (Auto mode) and the site-wide
 * "Download all", plus the brand's link-preview image. A change marks the brand stale and
 * schedules a rebuild with after(), so the admin's save returns at once; the editor shows
 * "Rebuilding…" until the flag clears.
 *
 * Safe to run concurrently: a rebuild commits its zips only if nothing changed while it ran (the
 * stale stamp is the one it started from). Otherwise it deletes what it built: the change that
 * moved the stamp on has its own rebuild queued, and that one wins.
 */

const PNG_COLS = ["png512Id", "png1024Id", "png2048Id", "png4096Id"] as const;
const SIZE: Record<(typeof PNG_COLS)[number], number> = { png512Id: 512, png1024Id: 1024, png2048Id: 2048, png4096Id: 4096 };

/** Public pages read files through cached data; expire it now (not stale-while-revalidate). */
export function expirePublic(...slugs: string[]) {
  revalidateTag(CACHE_TAGS.brands, { expire: 0 });
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });
  revalidateTag(CACHE_TAGS.events, { expire: 0 });
  for (const s of slugs) revalidateTag(CACHE_TAGS.brand(s), { expire: 0 });
}

async function bytesOf(f: FileObject): Promise<Buffer> {
  const { data, error } = await bucket().download(f.key);
  if (error || !data) throw new Error(`Couldn't read ${f.name} from storage: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

type Get = (f: FileObject) => Promise<Buffer>;
/**
 * Deletes replaced zips once this request has finished. Next applies revalidateTag at the end of
 * the request, so deleting sooner would leave public pages linking to a missing file meanwhile.
 */
export function deleteAfterResponse(ids: (string | null | undefined)[]) {
  after(() => deleteFiles(ids).catch((e) => console.error("Deleting replaced zips failed:", e)));
}

/** One rebuild's file reader: each file is downloaded once, at most 8 at a time. */
function downloader(parallel = 8): Get {
  const cache = new Map<string, Promise<Buffer>>();
  const queue: (() => void)[] = [];
  let running = 0;
  const slot = () => (running < parallel ? (running++, Promise.resolve()) : new Promise<void>((r) => queue.push(r)));
  const release = () => (queue.length ? queue.shift()!() : running--);
  return (f) => {
    let p = cache.get(f.id);
    if (!p) {
      p = slot().then(() => bytesOf(f).finally(release));
      cache.set(f.id, p);
    }
    return p;
  };
}

type BrandForZips = NonNullable<Awaited<ReturnType<typeof loadBrand>>>;
function loadBrand(id: string) {
  return db.brand.findUnique({
    where: { id },
    include: { logoTypes: { orderBy: { sortOrder: "asc" }, include: { variants: { orderBy: { sortOrder: "asc" } } } } },
  });
}

/** `svg/<name>` and `png/<width>/<name>` entries (the layout the kits have always had). */
async function variantEntries(b: BrandForZips, files: Map<string, FileObject>, get: Get, prefix = "") {
  const wanted: { name: string; file: FileObject }[] = [];
  for (const t of b.logoTypes) {
    for (const v of t.variants) {
      const svg = v.svgFileId ? files.get(v.svgFileId) : undefined;
      if (svg) wanted.push({ name: `${prefix}svg/${svg.name}`, file: svg });
      for (const col of PNG_COLS) {
        const p = v[col] ? files.get(v[col]!) : undefined;
        if (p) wanted.push({ name: `${prefix}png/${SIZE[col]}/${p.name}`, file: p });
      }
    }
  }
  return Promise.all(wanted.map(async (w) => ({ name: w.name, bytes: await get(w.file) })));
}

async function filesFor(b: BrandForZips): Promise<Map<string, FileObject>> {
  const ids = [b.colorsCssFileId, b.colorsJsonFileId, ...b.logoTypes.flatMap((t) => t.variants.flatMap((v) => [v.svgFileId, ...PNG_COLS.map((c) => v[c])]))];
  const rows = await db.fileObject.findMany({ where: { id: { in: ids.filter((x): x is string => Boolean(x)) } } });
  return new Map(rows.map((f) => [f.id, f]));
}

async function colorEntries(b: BrandForZips, files: Map<string, FileObject>, get: Get, prefix = "") {
  const wanted = [b.colorsJsonFileId, b.colorsCssFileId].map((id) => (id ? files.get(id) : undefined)).filter((f): f is FileObject => Boolean(f));
  return Promise.all(wanted.map(async (f) => ({ name: `${prefix}${f.name}`, bytes: await get(f) })));
}

/**
 * The link preview, from the logo the home card shows in light mode (Full logo, else Icon) on its
 * own background. Null without logos: the brand page then uses the site-wide preview.
 */
async function buildOg(b: BrandForZips, files: Map<string, FileObject>, get: Get): Promise<FileObject | null> {
  const source = (v: BrandForZips["logoTypes"][number]["variants"][number]) => {
    const svg = v.svgFileId ? files.get(v.svgFileId) : undefined;
    if (svg) return { file: svg, svg: true };
    const png = [v.png4096Id, v.png2048Id, v.png1024Id, v.png512Id].map((id) => (id ? files.get(id) : undefined)).find(Boolean);
    return png ? { file: png, svg: false } : null;
  };
  const groups = b.logoTypes
    .map((t) => ({ key: t.key, variants: t.variants.filter((v) => source(v)).map((v) => ({ id: variantPublicId(t.key, v.key), previewBg: v.previewBg, row: v })) }))
    .filter((g) => g.variants.length);
  const pick = cardVariant(groups, "light");
  if (!pick) return null;
  const src = source(pick.variant.row)!;
  const bytes = await brandOgPng({ bytes: await get(src.file), svg: src.svg }, pick.variant.previewBg);
  return storeFile({ brandId: b.id, kind: "og", name: `${b.slug}-og.png`, bytes, mime: "image/png", width: OG.width, height: OG.height });
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

/** Rebuilds one brand's type zips and (in Auto mode) its kit, then queues the site-wide zip. */
export async function rebuildBrand(brandId: string): Promise<void> {
  const start = await db.brand.findUnique({ where: { id: brandId }, select: { assetsStaleAt: true } });
  if (!start?.assetsStaleAt) return;
  const stamp = start.assetsStaleAt;
  const b = await loadBrand(brandId);
  if (!b) return;
  const files = await filesFor(b);
  const get = downloader();

  const typeZips: { id: string; zip: FileObject | null }[] = [];
  for (const t of b.logoTypes) {
    const entries = t.variants.length ? await variantEntries({ ...b, logoTypes: [t] }, files, get) : [];
    const zip = entries.length
      ? await storeFile({ brandId, kind: "zips", name: `${b.slug}-${t.key}-logos.zip`, bytes: await zipBuffer(entries), mime: "application/zip" })
      : null;
    typeZips.push({ id: t.id, zip });
  }

  // undefined: Manual mode, the kit isn't ours to touch.
  let kit: FileObject | null | undefined;
  if (b.kitMode === "AUTO") {
    const [entries, colors] = await Promise.all([variantEntries(b, files, get), colorEntries(b, files, get)]);
    kit = entries.length
      ? await storeFile({
          brandId,
          kind: "zips",
          name: `${b.slug}-brand-kit.zip`,
          bytes: await zipBuffer([{ name: "README.txt", bytes: Buffer.from(kitReadme(b, entries.length, colors.length > 0)) }, ...entries, ...colors]),
          mime: "application/zip",
        })
      : null;
  }
  const og = await buildOg(b, files, get);
  const built = [...typeZips.map((t) => t.zip?.id), kit?.id, og?.id];

  // Commit, unless something changed meanwhile (that change has its own rebuild queued).
  const committed = await db.$transaction(async (tx) => {
    const current = await tx.$executeRaw`UPDATE "Brand" SET "assetsStaleAt" = NULL WHERE "id" = ${brandId} AND "assetsStaleAt" = ${stamp}`;
    if (!current) return null;
    const before = await tx.brand.findUnique({ where: { id: brandId }, select: { kitFileId: true, kitMode: true, ogFileId: true, logoTypes: { select: { id: true, zipFileId: true } } } });
    if (!before) return null;
    const replaced: (string | null)[] = [];
    for (const t of typeZips) {
      const was = before.logoTypes.find((x) => x.id === t.id);
      if (!was) continue;
      await tx.logoType.update({ where: { id: t.id }, data: { zipFileId: t.zip?.id ?? null } });
      replaced.push(was.zipFileId);
    }
    // Raw SQL: the kit rebuilding isn't an edit, so "Updated" doesn't move.
    if (kit !== undefined && before.kitMode === "AUTO") {
      await tx.$executeRaw`UPDATE "Brand" SET "kitFileId" = ${kit?.id ?? null}, "kitBuiltAt" = ${kit ? new Date() : null} WHERE "id" = ${brandId}`;
      replaced.push(before.kitFileId);
    }
    await tx.$executeRaw`UPDATE "Brand" SET "ogFileId" = ${og?.id ?? null} WHERE "id" = ${brandId}`;
    replaced.push(before.ogFileId);
    return replaced;
  });

  if (!committed) {
    await deleteFiles(built);
    return;
  }
  expirePublic(b.slug);
  if (b.status !== "DRAFT") await scheduleAllKitRebuild();
  deleteAfterResponse([...committed, ...built]);
}

export async function markAllKitStale() {
  await db.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, allKitStaleAt: new Date() }, update: { allKitStaleAt: new Date() } });
}

/** "Download all": every public brand's kit (logos, colors, README), one folder per brand. */
export async function rebuildAllKit(): Promise<void> {
  const s = await db.siteSettings.findUnique({ where: { id: 1 } });
  if (!s?.allKitStaleAt || s.allKitMode !== "AUTO") return;
  const stamp = s.allKitStaleAt;
  // Built from each public brand's kit: one download per brand (about half the bytes of reading
  // every logo file again), each kit unpacked into a folder named after the brand.
  const brands = await db.brand.findMany({ where: { status: { in: ["SOON", "LIVE"] }, kitFileId: { not: null } }, orderBy: { sortOrder: "asc" }, select: { slug: true, kitFileId: true } });
  const kits = new Map((await db.fileObject.findMany({ where: { id: { in: brands.map((b) => b.kitFileId!) } } })).map((f) => [f.id, f]));
  const get = downloader();
  const perBrand = await Promise.all(
    brands.map(async (b) => {
      const kit = kits.get(b.kitFileId!);
      if (!kit) return [];
      const bytes = await get(kit);
      try {
        return readZip(bytes).map((e) => ({ name: `${b.slug}/${e.name}`, bytes: e.bytes }));
      } catch {
        // A hand-made kit this reader can't unpack goes in as it is.
        return [{ name: `${b.slug}/${kit.name}`, bytes }];
      }
    }),
  );
  const entries = perBrand.flat();
  const zip = entries.length ? await storeFile({ brandId: null, kind: "zips", name: "parselab-brand-kits.zip", bytes: await zipBuffer(entries), mime: "application/zip" }) : null;

  // Commit only if still current and still Auto (an upload in Manual mode wins).
  const replaced = await db.$transaction(async (tx) => {
    const current = await tx.$executeRaw`UPDATE "SiteSettings" SET "allKitStaleAt" = NULL WHERE "id" = 1 AND "allKitStaleAt" = ${stamp} AND "allKitMode" = 'AUTO'`;
    if (!current) return undefined;
    const before = await tx.siteSettings.findUnique({ where: { id: 1 }, select: { allKitFileId: true } });
    await tx.siteSettings.update({ where: { id: 1 }, data: { allKitFileId: zip?.id ?? null } });
    return before?.allKitFileId ?? null;
  });
  if (replaced === undefined) {
    await deleteFiles([zip?.id]);
    return;
  }
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });
  deleteAfterResponse([replaced]);
}

/**
 * After the response is sent, ask our own /api/internal/rebuild route to do the work: a route
 * handler may expire the public cache (revalidateTag), code running after a server action may
 * not. after() keeps the function alive until that request finishes.
 */
export async function runInBackground(body: { brandId?: string; mediaItemId?: string }) {
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
