import "server-only";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";
import { db } from "../db";
import type { FileObject } from "../generated/prisma/client";
import { storeFile } from "./files";
import { deleteAfterResponse, expirePublic } from "./rebuild";
import { bucket } from "./storage";
import { zipBuffer } from "./zip";

/*
 * Animations and event videos: the admin uploads one video, and this makes everything people
 * download: an MP4 with sound, the same without sound, a WebM, a GIF and a still for the
 * preview. Runs in /api/internal/rebuild after the upload's response, like the zip rebuilds,
 * and commits only if no newer upload arrived meanwhile (the processingAt stamp).
 */

/** MP4 and WebM keep up to this many pixels on the long side; GIFs, which get big, much less. */
const VIDEO_MAX = 1920;
const GIF_MAX = 640;
const GIF_FPS = 20;

let binary: Promise<string> | undefined;
/**
 * The ffmpeg that ships with @ffmpeg-installer. Its package marks the binary executable in an
 * install script, which doesn't run on Vercel (cached installs) or in CI, so make sure here: a
 * copy in the temp folder can be made executable even where node_modules is read-only.
 */
function ffmpeg(): Promise<string> {
  binary ??= (async () => {
    const original = ffmpegInstaller.path;
    try {
      await fs.access(original, fs.constants.X_OK);
      return original;
    } catch {
      const copy = path.join(os.tmpdir(), "ffmpeg");
      await fs.copyFile(original, copy);
      await fs.chmod(copy, 0o755);
      return copy;
    }
  })();
  return binary;
}

/** Runs ffmpeg; resolves with what it printed (ffmpeg reports on stderr). */
async function run(args: string[], { allowFailure = false } = {}): Promise<string> {
  const bin = await ffmpeg();
  return new Promise((resolve, reject) => {
    execFile(bin, ["-hide_banner", "-y", ...args], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err && !allowFailure) return reject(new Error(lastLine(stderr) || err.message));
      resolve(stderr);
    });
  });
}
const lastLine = (s: string) => s.trim().split("\n").filter(Boolean).at(-1) ?? "";

export type VideoInfo = { width: number; height: number; durationMs: number; hasAudio: boolean };

/** Size, length and whether there's sound, read from `ffmpeg -i` (no ffprobe ships with it). */
async function probe(file: string): Promise<VideoInfo> {
  // Reading the header is enough; a file that isn't a video fails here with a clear message.
  const out = await run(["-i", file, "-t", "0", "-f", "null", "-"], { allowFailure: true });
  const d = out.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = out.match(/Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  if (!d || !v) throw new Error("That video couldn't be read. Export it again as MP4 (H.264) and retry.");
  const rotated = /rotate\s*:\s*-?(90|270)/.test(out) || /rotation of -?(90|270)/.test(out);
  const [w, h] = [Number(v[1]), Number(v[2])];
  return {
    width: rotated ? h : w,
    height: rotated ? w : h,
    durationMs: Math.round((Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])) * 1000),
    hasAudio: /Stream #[^\n]*Audio:/.test(out),
  };
}

/** The long side capped, both sides even (H.264 and VP9 need even sizes). */
const fit = (max: number) => `scale='if(gte(iw,ih),min(${max},iw),-2)':'if(gte(iw,ih),-2,min(${max},ih))'`;

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
    const info = await probe(input);
    const out = (name: string) => path.join(dir, name);
    const base = `${item.brand.slug}-${item.key}`;

    // The MP4 everything else is made from: H.264 + AAC, starts playing before it has loaded.
    await run(["-i", input, "-vf", fit(VIDEO_MAX), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      ...(info.hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]), out("v.mp4")]);
    if (info.hasAudio) await run(["-i", out("v.mp4"), "-c:v", "copy", "-an", "-movflags", "+faststart", out("silent.mp4")]);
    await run(["-i", out("v.mp4"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "good", "-cpu-used", "5", "-row-mt", "1",
      ...(info.hasAudio ? ["-c:a", "libopus", "-b:a", "96k"] : ["-an"]), out("v.webm")]);
    await run(["-i", out("v.mp4"), "-vf", `fps=${GIF_FPS},${fit(GIF_MAX)}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0", out("v.gif")]);
    // The preview's still: the last moment, where a logo animation shows the finished logo.
    await run(["-sseof", "-0.3", "-i", out("v.mp4"), "-frames:v", "1", "-q:v", "3", out("poster.jpg")]);

    const sized = await probe(out("v.mp4"));
    const gifSize = await probe(out("v.gif"));
    const store = async (file: string, name: string, mime: string, size: { width: number; height: number } = sized) => {
      const f = await storeFile({ brandId: item.brandId, kind: "media", name, bytes: await fs.readFile(out(file)), mime, width: size.width, height: size.height });
      built.push(f);
      return f;
    };
    const mp4 = await store("v.mp4", `${base}.mp4`, "video/mp4");
    const silent = info.hasAudio ? await store("silent.mp4", `${base}-no-sound.mp4`, "video/mp4") : null;
    const webm = await store("v.webm", `${base}.webm`, "video/webm");
    const gif = await store("v.gif", `${base}.gif`, "image/gif", gifSize);
    const poster = await store("poster.jpg", `${base}.jpg`, "image/jpeg");

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
export async function pngFromSvg(svg: FileObject, brandId: string): Promise<FileObject> {
  const bytes = await bytesOf(svg);
  const png = await sharp(bytes, { density: 300 }).resize({ width: 1024, height: 1024, fit: "inside" }).png().toBuffer();
  const { width, height } = await sharp(png).metadata();
  return storeFile({ brandId, kind: "media", name: svg.name.replace(/\.svg$/i, ".png"), bytes: png, mime: "image/png", width, height });
}

/** A short random suffix, for keys that must stay unique. */
export const shortId = () => crypto.randomBytes(3).toString("hex");
