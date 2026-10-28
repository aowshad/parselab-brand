import "server-only";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { optimize } from "svgo";

// jsdom is pinned to 26: from 27.1 it require()s an ESM-only package, which Vercel's Node runtime
// refuses (ERR_REQUIRE_ESM), so every upload failed in production. Check that before upgrading.
const DOMPurify = createDOMPurify(new JSDOM("").window as unknown as Window & typeof globalThis);

/*
 * What an uploaded file may be, and how it's checked. The browser's file name and type are only
 * hints: the server sniffs the real content, sanitizes SVGs and measures images itself.
 */

export const MB = 1024 * 1024;
/** Manual brand kit upload limit: raise it here on a paid Supabase plan. */
export const KIT_MAX_MB = 50;
/** Signed upload tickets are honored for this long (Supabase's own URLs last 2 hours). */
export const TICKET_TTL_MS = 2 * 60 * 1000;

export type Kind = "svg" | "png" | "jpeg" | "webp" | "zip" | "mp4" | "mov";
export type Purpose = { kinds: Kind[]; maxBytes: number; label: string; square?: boolean };

export const PURPOSES: Record<string, Purpose> = {
  "brand-icon": { kinds: ["svg", "png"], maxBytes: 5 * MB, label: "Brand icon", square: true },
  "logo-variant": { kinds: ["svg", "png"], maxBytes: 5 * MB, label: "Logo" },
  "usage-image": { kinds: ["svg", "png", "jpeg", "webp"], maxBytes: 5 * MB, label: "Image" },
  /** A hand-made brand kit (Brand kit tab, Manual mode). Supabase's free plan allows 50 MB per file. */
  "kit-zip": { kinds: ["zip"], maxBytes: KIT_MAX_MB * MB, label: "Brand kit" },
  /** A hand-made "Download all" zip (Settings, Manual mode). Stored under site/, not a brand. */
  "site-kit-zip": { kinds: ["zip"], maxBytes: KIT_MAX_MB * MB, label: "All-brands kit" },
  /** An animation or event video; the other formats are made from it (lib/admin/media.ts). */
  "media-video": { kinds: ["mp4", "mov"], maxBytes: KIT_MAX_MB * MB, label: "Video" },
  /** An event logo or picture, offered for download as it is (an SVG also gets a PNG). */
  "media-image": { kinds: ["svg", "png", "jpeg", "webp"], maxBytes: 10 * MB, label: "Image" },
};

export const MIME: Record<Kind, string> = { svg: "image/svg+xml", png: "image/png", jpeg: "image/jpeg", webp: "image/webp", zip: "application/zip", mp4: "video/mp4", mov: "video/quicktime" };
/** What browsers may also declare for these types (Windows labels zips differently). */
export const MIME_ALIASES: Record<Kind, string[]> = { svg: [], png: [], jpeg: ["image/jpg"], webp: [], zip: ["application/x-zip-compressed", "application/x-zip", "multipart/x-zip"], mp4: ["video/x-m4v"], mov: [] };
export const EXT: Record<Kind, string> = { svg: "svg", png: "png", jpeg: "jpg", webp: "webp", zip: "zip", mp4: "mp4", mov: "mov" };

/** A user-facing reason the upload was refused. */
export class UploadError extends Error {}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** What the bytes really are, whatever the name or declared type says. */
export function sniff(bytes: Buffer): Kind | null {
  if (bytes.subarray(0, 8).equals(PNG_MAGIC)) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  // ISO media: an `ftyp` box first; QuickTime's brand is "qt  ", everything else plays as MP4.
  if (bytes.subarray(4, 8).toString("latin1") === "ftyp") return bytes.subarray(8, 12).toString("latin1") === "qt  " ? "mov" : "mp4";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05) && (bytes[3] === 0x04 || bytes[3] === 0x06)) return "zip";
  // Text that starts (after an optional BOM, XML declaration, comments and doctype) with <svg.
  const head = bytes.subarray(0, 4096).toString("utf8").replace(/^﻿/, "");
  const rest = head.replace(/^\s*(<\?xml[^>]*\?>\s*)?((<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)\s*)*/i, "");
  return /^<svg[\s>]/i.test(rest) ? "svg" : null;
}

/** Scripts, event handlers, javascript: URLs and foreignObject are refused outright. */
const DANGEROUS = /<script[\s>\/]|\son[a-z]+\s*=|javascript:|<foreignObject[\s>]|<!ENTITY/i;

/**
 * Sanitizes (DOMPurify, SVG profile, no external references) and optimizes (svgo) an SVG.
 * Throws UploadError with a reason the admin can act on.
 */
export function cleanSvg(raw: string): { svg: string; width: number; height: number } {
  if (DANGEROUS.test(raw)) throw new UploadError("SVG contains scripts and was rejected.");

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // Only same-document references (#id) stay, plus embedded rasters on <image>; nothing is fetched.
    const isImage = node.nodeName.toLowerCase() === "image";
    for (const attr of ["href", "xlink:href"]) {
      const v = node.getAttribute(attr);
      if (v != null && !v.startsWith("#") && !(isImage && /^data:image\/(png|jpeg|gif|webp);/i.test(v))) node.removeAttribute(attr);
    }
    const style = node.getAttribute("style");
    if (style && /url\(\s*['"]?(?!#)/i.test(style)) node.removeAttribute("style");
  });
  let clean: string;
  try {
    clean = DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true },
      // <use> is off by default because it can pull in outside content; the hook above limits it to #ids.
      ADD_TAGS: ["use"],
      ADD_ATTR: ["xlink:href", "href"],
      FORBID_TAGS: ["foreignObject", "script"],
      WHOLE_DOCUMENT: false });
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes");
  }
  if (!/^<svg[\s>]/i.test(clean.trim())) throw new UploadError("That SVG couldn't be read. Export it again and retry.");
  if (!/\sxmlns=/.test(clean)) clean = clean.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');

  const { data } = optimize(clean, {
    multipass: false,
    plugins: [{ name: "preset-default", params: { overrides: { mergePaths: false, convertShapeToPath: false, collapseGroups: false } } }],
  });
  const box = svgSize(data);
  if (!box) throw new UploadError("The SVG has no viewBox or size, so it can't scale. Export it with a viewBox.");
  return { svg: data, ...box };
}

/** Intrinsic size from the viewBox (else width/height). */
export function svgSize(svg: string): { width: number; height: number } | null {
  const tag = svg.match(/<svg[^>]*>/i)?.[0] ?? "";
  const vb = tag.match(/viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (vb) return { width: Number(vb[1]), height: Number(vb[2]) };
  const w = tag.match(/\swidth=["']([\d.]+)(px)?["']/i)?.[1];
  const h = tag.match(/\sheight=["']([\d.]+)(px)?["']/i)?.[1];
  return w && h ? { width: Number(w), height: Number(h) } : null;
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24) throw new UploadError("That PNG is damaged.");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Checks an upload's real content against its purpose; returns the bytes to store. */
export async function inspect(purpose: Purpose, bytes: Buffer): Promise<{ kind: Kind; bytes: Buffer; width: number; height: number }> {
  if (bytes.length > purpose.maxBytes) throw new UploadError(`File is over ${purpose.maxBytes / MB} MB.`);
  const kind = sniff(bytes);
  if (!kind || !purpose.kinds.includes(kind)) {
    const names = purpose.kinds.map((k) => k.toUpperCase());
    throw new UploadError(`That isn't ${/^[AEFHILMNORSX]/.test(names[0]!) ? "an" : "a"} ${names.join(" or ")} file.`);
  }
  const out =
    kind === "svg"
      ? (() => {
          const c = cleanSvg(bytes.toString("utf8"));
          return { kind, bytes: Buffer.from(c.svg), width: c.width, height: c.height };
        })()
      : kind === "png"
        ? { kind, bytes, ...pngSize(bytes) }
        : kind === "zip" || kind === "mp4" || kind === "mov"
          ? // Videos are measured when their formats are made.
            { kind, bytes, width: 0, height: 0 }
          : await (async () => {
              const m = await sharp(bytes).metadata().catch(() => null);
              if (!m?.width || !m.height) throw new UploadError("That image couldn't be read. Export it again and retry.");
              return { kind, bytes, width: m.width, height: m.height };
            })();
  if (purpose.square) {
    const ratio = out.width / out.height;
    if (ratio < 0.95 || ratio > 1.05) throw new UploadError(`${purpose.label} must be square (this one is ${Math.round(out.width)} × ${Math.round(out.height)}).`);
  }
  return out;
}
