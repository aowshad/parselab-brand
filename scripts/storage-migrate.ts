/**
 * `pnpm storage:migrate`: one-off storage housekeeping after the egress fixes. A dry run by
 * default: it reads headers only and prints what it would do. `pnpm storage:migrate -- --apply`
 * does it.
 *
 *   1. Previews: event images uploaded before previews existed get their ≤512 px WebP.
 *   2. Cache lifetime: files stored with a 1-hour Cache-Control are re-uploaded at the same path
 *      with a 1-year one (paths never change content, so that's safe).
 *
 * It never deletes anything, and skips files nothing references (leftovers for storage:sweep).
 * Applying downloads each file it rewrites once (that's egress: the dry run prints the total).
 * Afterwards, redeploy (or save anything in the admin) so cached pages pick up the previews.
 */
import fs from "node:fs";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const { db } = await import("../lib/db");
const { bucket } = await import("../lib/admin/storage");
const { CACHE_SECONDS, referencedFileIds, storeFile } = await import("../lib/admin/files");
const { previewWebp } = await import("../lib/admin/preview");

const apply = process.argv.includes("--apply");
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const KEEP = Number(CACHE_SECONDS);

async function download(key: string): Promise<Buffer> {
  const { data, error } = await bucket().download(key);
  if (error || !data) throw new Error(`Couldn't read ${key}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * The stored Cache-Control's max-age, from the object's info (no body is downloaded). Not from
 * a HEAD on the private endpoint: that always answers "private, no-cache".
 */
async function maxAge(key: string): Promise<number | null> {
  const { data, error } = await bucket().info(key);
  if (error || !data) return null;
  const m = String(data.cacheControl ?? "").match(/max-age=(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** Runs `fn` over `items`, `n` at a time. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

console.log(apply ? "APPLYING\n" : "Dry run: nothing is changed. Add `-- --apply` to do it.\n");

// ── 1. Previews ─────────────────────────────────────────────────────────────────────────────
const images = await db.mediaItem.findMany({ where: { kind: "IMAGE", imageFileId: { not: null }, previewFileId: null }, include: { brand: { select: { slug: true } } } });
const originals = new Map((await db.fileObject.findMany({ where: { id: { in: images.map((i) => i.imageFileId!) } } })).map((f) => [f.id, f]));
const previewBytes = images.reduce((n, i) => n + (originals.get(i.imageFileId!)?.size ?? 0), 0);
console.log(`1. Previews: ${images.length} event image${images.length === 1 ? "" : "s"} without one (originals ${mb(previewBytes)} to read).`);
let made = 0;
if (apply) {
  await pool(images, 4, async (item) => {
    const original = originals.get(item.imageFileId!);
    if (!original) return;
    const p = await previewWebp(await download(original.key), original.mime);
    const file = await storeFile({ brandId: item.brandId, kind: "media", name: original.name.replace(/\.[a-z0-9]+$/i, "-preview.webp"), bytes: p.bytes, mime: "image/webp", width: p.width, height: p.height });
    await db.mediaItem.update({ where: { id: item.id }, data: { previewFileId: file.id } });
    made++;
    console.log(`   ${item.brand.slug}/${item.key}: ${Math.round(original.size / 1024)} KB → ${Math.round(file.size / 1024)} KB`);
  });
  console.log(`   made ${made}.`);
}

// ── 2. Cache lifetime ───────────────────────────────────────────────────────────────────────
const used = await referencedFileIds();
const files = (await db.fileObject.findMany({ select: { id: true, key: true, size: true, mime: true } })).filter((f) => used.has(f.id));
const short: typeof files = [];
let missing = 0;
await pool(files, 8, async (f) => {
  const age = await maxAge(f.key);
  if (age === null) missing++;
  else if (age < KEEP) short.push(f);
});
const shortBytes = short.reduce((n, f) => n + f.size, 0);
console.log(`\n2. Cache lifetime: ${files.length} files in use; ${short.length} still under a year (${mb(shortBytes)} to re-upload)${missing ? `; ${missing} not found in storage` : ""}.`);
if (apply) {
  let done = 0;
  await pool(short, 4, async (f) => {
    const bytes = await download(f.key);
    const { error } = await bucket().update(f.key, bytes, { contentType: f.mime, cacheControl: CACHE_SECONDS, upsert: true });
    if (error) return console.log(`   ✗ ${f.key}: ${error.message}`);
    done++;
  });
  console.log(`   re-uploaded ${done} of ${short.length}.`);
}

console.log(`\nEgress ${apply ? "used" : "if applied"}: about ${mb(previewBytes + shortBytes)} (each file read once).`);
if (apply && made) console.log("Redeploy (or save anything in the admin) so the cached pages switch to the previews.");
process.exit(0);
