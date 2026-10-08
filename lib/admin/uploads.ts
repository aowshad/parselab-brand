import "server-only";
import DOMPurify from "isomorphic-dompurify";
import { optimize } from "svgo";

/*
 * What an uploaded file may be, and how it's checked. The browser's file name and type are only
 * hints: the server sniffs the real content, sanitizes SVGs and measures images itself.
 */

export const MB = 1024 * 1024;
/** Signed upload tickets are honored for this long (Supabase's own URLs last 2 hours). */
export const TICKET_TTL_MS = 2 * 60 * 1000;

type Kind = "svg" | "png";
export type Purpose = { kinds: Kind[]; maxBytes: number; label: string; square?: boolean };

export const PURPOSES: Record<string, Purpose> = {
  "brand-icon": { kinds: ["svg", "png"], maxBytes: 5 * MB, label: "Brand icon", square: true },
};

export const MIME: Record<Kind, string> = { svg: "image/svg+xml", png: "image/png" };

/** A user-facing reason the upload was refused. */
export class UploadError extends Error {}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** What the bytes really are, whatever the name or declared type says. */
export function sniff(bytes: Buffer): Kind | null {
  if (bytes.subarray(0, 8).equals(PNG_MAGIC)) return "png";
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
export function inspect(purpose: Purpose, bytes: Buffer): { kind: Kind; bytes: Buffer; width: number; height: number } {
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
      : { kind, bytes, ...pngSize(bytes) };
  if (purpose.square) {
    const ratio = out.width / out.height;
    if (ratio < 0.95 || ratio > 1.05) throw new UploadError(`${purpose.label} must be square (this one is ${Math.round(out.width)} × ${Math.round(out.height)}).`);
  }
  return out;
}
