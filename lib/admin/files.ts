import "server-only";
import crypto from "node:crypto";
import path from "node:path";
import { db } from "../db";
import type { FileObject } from "../generated/prisma/client";
import { bucket } from "./storage";

/** Letters, digits, `.`, `-`, `_` and `@` only: no slashes, no traversal. */
export const safeName = (name: string) => name.replace(/[^A-Za-z0-9._@-]+/g, "-").replace(/^[.-]+/, "").slice(0, 120) || "file";

/** `<owner>/<kind>/<uuid>/<clean name>`: unique, unguessable, and saves under its real name. */
const newKey = (owner: string, kind: string, name: string) => `${owner}/${kind}/${crypto.randomUUID()}/${safeName(name)}`;
const ownerOf = (brandId: string | null) => (brandId ? `brands/${brandId}` : "site");

/**
 * One hour, for CDN and browsers. Keys never change content, but on Supabase's free plan the CDN
 * isn't purged when a file is deleted: a short lifetime makes a deleted file disappear within an
 * hour instead of lingering at its old URL for a year. (Pro's Smart CDN purges on delete.)
 */
export const CACHE_SECONDS = "3600";

/** Uploads bytes under a new server-generated key and records the FileObject. */
export async function storeFile(opts: {
  brandId: string | null;
  kind: string;
  name: string;
  bytes: Buffer;
  mime: string;
  width?: number;
  height?: number;
}): Promise<FileObject> {
  const key = newKey(ownerOf(opts.brandId), opts.kind, opts.name);
  const { error } = await bucket().upload(key, opts.bytes, { contentType: opts.mime, cacheControl: CACHE_SECONDS, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return db.fileObject.create({
    data: {
      key,
      mime: opts.mime,
      size: opts.bytes.length,
      name: opts.name,
      width: opts.width,
      height: opts.height,
      sha256: crypto.createHash("sha256").update(opts.bytes).digest("hex"),
    },
  });
}

/** Copies a stored file into another brand's folder (server side, no download). */
export async function copyFile(id: string, toBrandId: string): Promise<FileObject> {
  const f = await db.fileObject.findUniqueOrThrow({ where: { id } });
  const kind = f.key.split("/").at(-3) ?? "files";
  const key = newKey(ownerOf(toBrandId), kind, f.name);
  const { error } = await bucket().copy(f.key, key);
  if (error) throw new Error(`Storage copy failed: ${error.message}`);
  const { id: _id, createdAt: _c, key: _k, ...rest } = f;
  return db.fileObject.create({ data: { ...rest, key } });
}

/** Every FileObject id some brand, logo, variant or the site settings still points at. */
export async function referencedFileIds(): Promise<Set<string>> {
  const [brands, types, variants, site] = await Promise.all([
    db.brand.findMany({ select: { iconFileId: true, kitFileId: true, colorsCssFileId: true, colorsJsonFileId: true, ogFileId: true } }),
    db.logoType.findMany({ select: { zipFileId: true } }),
    db.logoVariant.findMany({ select: { svgFileId: true, png512Id: true, png1024Id: true, png2048Id: true, png4096Id: true } }),
    db.siteSettings.findMany({ select: { allKitFileId: true, ogFileId: true } }),
  ]);
  const ids = [...brands, ...types, ...variants, ...site].flatMap((row) => Object.values(row));
  return new Set(ids.filter((v): v is string => typeof v === "string"));
}

/** Deletes files from storage and the database, skipping any that something still uses. */
export async function deleteFiles(ids: (string | null | undefined)[]): Promise<number> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return 0;
  const used = await referencedFileIds();
  const rows = await db.fileObject.findMany({ where: { id: { in: wanted.filter((id) => !used.has(id)) } } });
  if (!rows.length) return 0;
  const { error } = await bucket().remove(rows.map((r) => r.key));
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
  await db.fileObject.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  return rows.length;
}

export const extOf = (name: string) => path.extname(name).toLowerCase();

/** Every object under a storage prefix (folders are walked recursively). */
async function listAll(prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket().list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Storage list failed: ${error.message}`);
    for (const e of data) {
      if (e.id) out.push(`${prefix}/${e.name}`);
      else out.push(...(await listAll(`${prefix}/${e.name}`)));
    }
    if (data.length < 1000) return out;
  }
}

/**
 * Removes everything a deleted brand owned: every object under brands/<id>/ (including uploads
 * that were never attached) and their FileObject rows.
 */
export async function deleteBrandFolder(brandId: string): Promise<number> {
  const prefix = `brands/${brandId}`;
  const keys = await listAll(prefix);
  for (let i = 0; i < keys.length; i += 100) {
    const { error } = await bucket().remove(keys.slice(i, i + 100));
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }
  await db.fileObject.deleteMany({ where: { key: { startsWith: `${prefix}/` } } });
  return keys.length;
}
