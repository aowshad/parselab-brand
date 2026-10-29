import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { db } from "../db";
import type { FileObject } from "../generated/prisma/client";
import { storeFile } from "./files";
import { deleteAfterResponse, expirePublic } from "./rebuild";
import { bucket } from "./storage";
import { previewWebp } from "./preview";
import { convertVideo } from "./video";
import { zipBuffer } from "./zip";

/*
 * Animations and event videos: the admin uploads one video, and this makes everything people
 * download: an MP4 with sound, the same without sound, a WebM, a GIF and a still for the
 * preview. Runs in /api/internal/rebuild after the upload's response, like the zip rebuilds,
 * and commits only if no newer upload arrived meanwhile (the processingAt stamp).
 */

async function bytesOf(f: FileObject): Promise<Buffer> {
  const { data, error } = await bucket().download(f.key);
  if (error || !data) throw new Error(`Couldn't read ${f.name} from storage: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Makes a video item's formats. Called by /api/internal/rebuild with CRON_SECRET. */
export async function processVideo(itemId: string): Promise<void> {
  const item = await db.mediaItem.findUnique({ where: { id: itemId }, include: { brand: { select: { slug: true } } } });
  if (!item?.processingAt || !item.sourceFileId) return;
  const stamp = item.processingAt;
  const source = await db.fileObject.findUnique({ where: { id: item.sourceFileId } });
  if (!source) return;

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "media-"));
  const built: FileObject[] = [];
  try {
    const input = path.join(dir, `in${path.extname(source.name) || ".mp4"}`);
    await fs.writeFile(input, await bytesOf(source));
    const { info, sized, gifSize, files } = await convertVideo(input, dir);
    const base = `${item.brand.slug}-${item.key}`;
    const store = async (file: string, name: string, mime: string, size: { width: number; height: number } = sized) => {
      const f = await storeFile({ brandId: item.brandId, kind: "media", name, bytes: await fs.readFile(file), mime, width: size.width, height: size.height });
      built.push(f);
      return f;
    };
    const mp4 = await store(files.mp4, `${base}.mp4`, "video/mp4");
    const silent = files.silent ? await store(files.silent, `${base}-no-sound.mp4`, "video/mp4") : null;
    const webm = await store(files.webm, `${base}.webm`, "video/webm");
    const gif = await store(files.gif, `${base}.gif`, "image/gif", gifSize);
    const poster = await store(files.poster, `${base}.jpg`, "image/jpeg");

    // Commit, unless a newer video was uploaded meanwhile (its own run is queued).
    const replaced = await db.$transaction(async (tx) => {
      const current = await tx.mediaItem.findUnique({ where: { id: itemId } });
      if (!current || current.processingAt?.getTime() !== stamp.getTime()) return null;
      await tx.mediaItem.update({
        where: { id: itemId },
        data: {
          mp4FileId: mp4.id, silentFileId: silent?.id ?? null, webmFileId: webm.id, gifFileId: gif.id, posterFileId: poster.id,
          width: sized.width, height: sized.height, durationMs: info.durationMs, hasAudio: info.hasAudio,
          sourceFileId: null, processingAt: null, error: null,
        },
      });
      return [current.mp4FileId, current.silentFileId, current.webmFileId, current.gifFileId, current.posterFileId, current.sourceFileId];
    });
    if (!replaced) {
      deleteAfterResponse(built.map((f) => f.id));
      return;
    }
    if (!item.eventId) await rebuildAnimationsZip(item.brandId);
    expirePublic(item.brand.slug);
    deleteAfterResponse(replaced);
  } catch (e) {
    deleteAfterResponse(built.map((f) => f.id));
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Processing ${item.brand.slug}/${item.key} failed:`, message);
    await db.mediaItem.updateMany({ where: { id: itemId, processingAt: stamp }, data: { processingAt: null, error: `Couldn't make the formats: ${message.slice(0, 200)}` } });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** "Download all animations": every finished animation of the brand, a folder per format. */
export async function rebuildAnimationsZip(brandId: string): Promise<void> {
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true, animationsZipFileId: true } });
  if (!brand) return;
  const items = await db.mediaItem.findMany({ where: { brandId, eventId: null, kind: "VIDEO", mp4FileId: { not: null } }, orderBy: { sortOrder: "asc" } });
  const ids = items.flatMap((i) => [i.mp4FileId, i.silentFileId, i.webmFileId, i.gifFileId]).filter((x): x is string => Boolean(x));
  const files = await db.fileObject.findMany({ where: { id: { in: ids } } });
  const folder = (f: FileObject) => (f.name.endsWith("-no-sound.mp4") ? "mp4-no-sound" : f.name.split(".").pop()!);
  const entries = await Promise.all(files.map(async (f) => ({ name: `${folder(f)}/${f.name}`, bytes: await bytesOf(f) })));
  const zip = entries.length ? await storeFile({ brandId, kind: "zips", name: `${brand.slug}-animations.zip`, bytes: await zipBuffer(entries), mime: "application/zip" }) : null;
  await db.$executeRaw`UPDATE "Brand" SET "animationsZipFileId" = ${zip?.id ?? null} WHERE "id" = ${brandId}`;
  deleteAfterResponse([brand.animationsZipFileId]);
}

/** An SVG event image also gets a 1024 px PNG, for places that don't take SVG. */
export async function pngFromSvg(svg: FileObject, brandId: string, bytes?: Buffer): Promise<FileObject> {
  const src = bytes ?? (await bytesOf(svg));
  const png = await sharp(src, { density: 300 }).resize({ width: 1024, height: 1024, fit: "inside" }).png().toBuffer();
  const { width, height } = await sharp(png).metadata();
  return storeFile({ brandId, kind: "media", name: svg.name.replace(/\.svg$/i, ".png"), bytes: png, mime: "image/png", width, height });
}

/** The WebP an event card shows (about 20–40 KB); the original is only fetched on Download. */
export async function previewOf(image: FileObject, brandId: string, bytes?: Buffer): Promise<FileObject> {
  const p = await previewWebp(bytes ?? (await bytesOf(image)), image.mime);
  return storeFile({ brandId, kind: "media", name: image.name.replace(/\.[a-z0-9]+$/i, "-preview.webp"), bytes: p.bytes, mime: "image/webp", width: p.width, height: p.height });
}

/** A file's bytes (one download, shared by everything made from it). */
export { bytesOf };

/** A short random suffix, for keys that must stay unique. */
export const shortId = () => crypto.randomBytes(3).toString("hex");
