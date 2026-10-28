import "server-only";
import { db } from "../db";
import type { MediaKind } from "../generated/prisma/client";
import { slugify } from "../slug";
import { deleteFiles, renameFile } from "./files";
import type { OpResult } from "./logo-ops";
import { pngFromSvg, rebuildAnimationsZip } from "./media";
import { runInBackground } from "./rebuild";
import { expirePublic } from "./revalidate";

/*
 * Animations and event items, run by /api/admin/media (session + same origin checked there).
 * An item without an event is one of the brand's animations (videos only); an event item can be
 * an image or a video.
 */

export const MEDIA_LIMITS = { name: 60, description: 160, perList: 24 };

const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const fileIdsOf = (i: { imageFileId: string | null; pngFileId: string | null; sourceFileId: string | null; mp4FileId: string | null; silentFileId: string | null; webmFileId: string | null; gifFileId: string | null; posterFileId: string | null }) => [
  i.imageFileId, i.pngFileId, i.sourceFileId, i.mp4FileId, i.silentFileId, i.webmFileId, i.gifFileId, i.posterFileId,
];

async function brandOf(itemId: string) {
  return db.mediaItem.findUnique({ where: { id: itemId }, include: { brand: { select: { slug: true } }, event: { select: { key: true } } } });
}

/** A key that names the downloads: "logo-reveal", or "halloween-2026-icon" inside an event. */
async function freeKey(brandId: string, base: string): Promise<string> {
  const taken = new Set((await db.mediaItem.findMany({ where: { brandId, key: { startsWith: base } }, select: { key: true } })).map((r) => r.key));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function addItem(brandId: string, args: { eventId?: unknown; kind?: unknown; name?: unknown }): Promise<OpResult> {
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true } });
  if (!brand) return { error: "This brand no longer exists." };
  const eventId = typeof args.eventId === "string" && args.eventId ? args.eventId : null;
  const event = eventId ? await db.event.findUnique({ where: { id: eventId }, select: { key: true } }) : null;
  if (eventId && !event) return { error: "That event no longer exists." };
  const kind: MediaKind = args.kind === "IMAGE" ? "IMAGE" : "VIDEO";
  if (!event && kind !== "VIDEO") return { error: "Animations are videos. Add images to an event." };
  const name = clean(args.name);
  if (!name) return { error: "Give it a name, like Logo reveal." };
  if (name.length > MEDIA_LIMITS.name) return { error: `Keep the name under ${MEDIA_LIMITS.name} characters.` };
  const count = await db.mediaItem.count({ where: { brandId, eventId } });
  if (count >= MEDIA_LIMITS.perList) return { error: `That's the limit of ${MEDIA_LIMITS.perList} here.` };
  const key = await freeKey(brandId, [event?.key, slugify(name)].filter(Boolean).join("-") || "item");
  const item = await db.mediaItem.create({ data: { brandId, eventId, kind, key, name, sortOrder: count } });
  expirePublic(brand.slug);
  return { ok: `${name} added`, id: item.id };
}

export async function updateItem(itemId: string, args: { name?: unknown; description?: unknown }): Promise<OpResult> {
  const item = await brandOf(itemId);
  if (!item) return { error: "This item no longer exists." };
  const data: { name?: string; description?: string } = {};
  if (args.name !== undefined) {
    const name = clean(args.name);
    if (!name) return { error: "The name can't be empty." };
    if (name.length > MEDIA_LIMITS.name) return { error: `Keep the name under ${MEDIA_LIMITS.name} characters.` };
    data.name = name;
  }
  if (args.description !== undefined) {
    const description = clean(args.description);
    if (description.length > MEDIA_LIMITS.description) return { error: `Keep the description under ${MEDIA_LIMITS.description} characters.` };
    data.description = description;
  }
  await db.mediaItem.update({ where: { id: itemId }, data });
  expirePublic(item.brand.slug);
  return { ok: "Saved" };
}

/** Moves an item one place up or down within its list. */
export async function moveItem(itemId: string, direction: unknown): Promise<OpResult> {
  const item = await brandOf(itemId);
  if (!item) return { error: "This item no longer exists." };
  const list = await db.mediaItem.findMany({ where: { brandId: item.brandId, eventId: item.eventId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = list.findIndex((x) => x.id === itemId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: "No change" };
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.$transaction(list.map((x, n) => db.mediaItem.update({ where: { id: x.id }, data: { sortOrder: n } })));
  expirePublic(item.brand.slug);
  return { ok: "Order saved" };
}

/**
 * Attaches an upload (purpose media-video or media-image). A video is kept as the source and its
 * formats are made in the background; an image is offered as it is (an SVG also gets a PNG).
 */
export async function attachUpload(itemId: string, fileId: unknown): Promise<OpResult> {
  const item = await brandOf(itemId);
  if (!item) return { error: "This item no longer exists." };
  const file = typeof fileId === "string" ? await db.fileObject.findUnique({ where: { id: fileId } }) : null;
  if (!file || !file.key.startsWith(`brands/${item.brandId}/media/`)) return { error: "That upload can't be used here." };
  const base = `${item.brand.slug}-${item.key}`;

  if (item.kind === "VIDEO") {
    if (!file.mime.startsWith("video/")) return { error: "Upload a video (MP4 or MOV)." };
    const previousSource = item.sourceFileId;
    await db.mediaItem.update({ where: { id: itemId }, data: { sourceFileId: file.id, processingAt: new Date(), error: null } });
    await deleteFiles([previousSource]);
    await runInBackground({ mediaItemId: itemId });
    return { ok: "Video uploaded · making MP4, WebM and GIF…" };
  }

  if (!file.mime.startsWith("image/")) return { error: "Upload an image (SVG, PNG, JPEG or WebP)." };
  const ext = file.name.split(".").pop()!.toLowerCase();
  const named = await renameFile(file.id, `${base}.${ext}`);
  const png = named.mime === "image/svg+xml" ? await pngFromSvg(named, item.brandId) : null;
  await db.mediaItem.update({ where: { id: itemId }, data: { imageFileId: named.id, pngFileId: png?.id ?? null, width: named.width, height: named.height, error: null } });
  await deleteFiles([item.imageFileId, item.pngFileId]);
  expirePublic(item.brand.slug);
  return { ok: png ? "Image added · SVG + PNG" : "Image added" };
}

export async function deleteItem(itemId: string): Promise<OpResult> {
  const item = await brandOf(itemId);
  if (!item) return { error: "This item no longer exists." };
  await db.mediaItem.delete({ where: { id: itemId } });
  const removed = await deleteFiles(fileIdsOf(item));
  if (!item.eventId && item.kind === "VIDEO") await rebuildAnimationsZip(item.brandId);
  expirePublic(item.brand.slug);
  return { ok: `${item.name} deleted · ${removed} file${removed === 1 ? "" : "s"} removed` };
}

/** What the admin polls while videos are being processed. */
export async function itemStatus(brandId: string) {
  const items = await db.mediaItem.findMany({ where: { brandId }, select: { id: true, processingAt: true, error: true } });
  return { processing: items.filter((i) => i.processingAt).map((i) => i.id), errors: Object.fromEntries(items.filter((i) => i.error).map((i) => [i.id, i.error])) };
}

export { fileIdsOf };
