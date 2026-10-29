import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import { gradientCss, isDark } from "./color";
import { db } from "./db";
import { displayImage, type FileRef, type ImageRef, type PngWidth } from "./files";
import { BRAND_FONTS } from "./fonts";
import type { BrandStatus, Event, FileObject, MediaItem } from "./generated/prisma/client";
import { typographySchema, type Typeface } from "./schema";
import { downloadUrl, publicUrl } from "./storage-url";
import { typeScale } from "./typography";
import { usageFileIds, type UsageData } from "./usage";
import { cardVariant, variantPublicId, type Theme } from "./variants";
import type { BrandCardView, BrandEventView, BrandView, CardThumb, ColorView, EventPageView, EventSummary, LogoGroupView, MediaView, PublicStatus, SiteView, TypographyView, UsageView, VariantView } from "./view";

/*
 * The public site's one data layer. Every read is cached ('use cache') and tagged, so an admin
 * save expires exactly what it changed: `brands` (home + every brand page), `brand:<slug>`, or
 * `settings`. DRAFT brands never leave this file.
 */
export { CACHE_TAGS };

const PUBLIC: BrandStatus[] = ["SOON", "LIVE"];
const toPublic = (s: BrandStatus): PublicStatus => (s === "LIVE" ? "live" : "soon");

// ── Files ──────────────────────────────────────────────────────────────────────────────

type Files = Map<string, FileObject>;

async function loadFiles(ids: (string | null | undefined)[]): Promise<Files> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const rows = wanted.length ? await db.fileObject.findMany({ where: { id: { in: wanted } } }) : [];
  return new Map(rows.map((f) => [f.id, f]));
}

const fileRef = (f: FileObject): FileRef => ({
  path: publicUrl(f.key),
  downloadUrl: downloadUrl(f.key, f.name),
  filename: f.name,
  sizeKb: Math.round((f.size / 1024) * 10) / 10,
});

const imageRef = (f: FileObject): ImageRef => ({ ...fileRef(f), width: f.width ?? 0, height: f.height ?? 0 });

function need(files: Files, id: string | null | undefined, what: string): FileObject {
  const f = id ? files.get(id) : undefined;
  if (!f) throw new Error(`Missing file for ${what}. Re-upload it in the admin, or re-run the seed.`);
  return f;
}

const optional = (files: Files, id: string | null | undefined) => (id ? files.get(id) : undefined);

// ── Mapping ────────────────────────────────────────────────────────────────────────────

export { variantPublicId };

const PNG_COLUMNS = [
  [512, "png512Id"],
  [1024, "png1024Id"],
  [2048, "png2048Id"],
  [4096, "png4096Id"],
] as const;

type BrandRow = NonNullable<Awaited<ReturnType<typeof loadBrandRow>>>;

const brandInclude = {
  logoTypes: { orderBy: { sortOrder: "asc" }, include: { variants: { orderBy: { sortOrder: "asc" } } } },
  colors: { orderBy: { sortOrder: "asc" } },
} as const;

function loadBrandRow(slug: string) {
  return db.brand.findFirst({ where: { slug, status: { in: PUBLIC } }, include: brandInclude });
}

function fileIdsOf(b: BrandRow): (string | null)[] {
  return [
    b.iconFileId,
    b.kitFileId,
    b.colorsCssFileId,
    b.colorsJsonFileId,
    b.ogFileId,
    ...b.logoTypes.flatMap((t) => [t.zipFileId, ...t.variants.flatMap((v) => [v.svgFileId, ...PNG_COLUMNS.map(([, col]) => v[col])])]),
  ];
}

function logoGroups(b: BrandRow, files: Files): LogoGroupView[] {
  return b.logoTypes
    .filter((t) => t.variants.length)
    .map((t) => {
      const zip = optional(files, t.zipFileId);
      return {
      key: t.key,
      label: t.label,
      description: t.description,
      zip: zip ? fileRef(zip) : null,
      // A variant needs an SVG or at least one PNG; one mid-upload (neither yet) is left out.
      variants: t.variants.filter((v) => v.svgFileId || PNG_COLUMNS.some(([, col]) => v[col])).map((v): VariantView => {
        const id = variantPublicId(t.key, v.key);
        const svg = optional(files, v.svgFileId);
        return {
          id,
          name: v.name,
          usage: v.hint,
          previewBg: v.previewBg,
          dot: v.dot ?? v.previewBg,
          darkStage: isDark(v.previewBg),
          assets: {
            svg: svg ? imageRef(svg) : null,
            png: PNG_COLUMNS.flatMap(([size, col]) => {
              const f = optional(files, v[col]);
              return f ? [{ ...imageRef(f), size: size as PngWidth }] : [];
            }),
          },
        };
      }),
      };
    })
    .filter((g) => g.variants.length);
}

function colorViews(b: BrandRow): ColorView[] {
  return b.colors.map((c) => {
    if (c.kind === "GRADIENT") {
      const g = c.gradient as { angle: number; stops: { hex: string; at: number }[] };
      return { name: c.name, role: c.role, kind: "gradient", css: gradientCss(g.angle, g.stops), stops: g.stops.map((s) => s.hex.toUpperCase()) };
    }
    return { name: c.name, role: c.role, kind: "solid", hex: (c.hex ?? "").toUpperCase() };
  });
}

function typographyView(b: BrandRow): TypographyView | null {
  if (b.typography == null) return null;
  const parsed = typographySchema.safeParse(b.typography);
  if (!parsed.success) throw new Error(`${b.slug}: invalid typography data: ${parsed.error.message}`);
  const typefaces = parsed.data.typefaces.map((f) => {
    const fontFamily = BRAND_FONTS[f.family];
    if (!fontFamily) throw new Error(`${b.slug}: typeface "${f.family}" isn't registered in lib/fonts.ts.`);
    return { ...f, fontFamily };
  });
  const byFamily = (f: Typeface) => typefaces.find((t) => t.family === f.family)!;
  return { typefaces, scale: typeScale(b.name, parsed.data.typefaces).map(({ use: _use, ...s }) => ({ ...s, face: byFamily(s.face) })) };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// ── Animations and events ──────────────────────────────────────────────────────────────

const mediaFileIds = (m: MediaItem) => [m.imageFileId, m.pngFileId, m.previewFileId, m.mp4FileId, m.silentFileId, m.webmFileId, m.gifFileId, m.posterFileId];
const IMAGE_FORMAT: Record<string, string> = { "image/svg+xml": "SVG", "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP" };
const dims = (f: FileObject) => (f.width && f.height ? `${f.width} × ${f.height}` : "");

/** A finished item for the page; null while its video is still being made (or has no file yet). */
function mediaView(m: MediaItem, files: Files): MediaView | null {
  const base = { key: m.key, name: m.name, description: m.description, width: m.width ?? 0, height: m.height ?? 0 };
  if (m.kind === "VIDEO") {
    const mp4 = optional(files, m.mp4FileId);
    const poster = optional(files, m.posterFileId);
    if (!mp4 || !poster) return null;
    const silent = optional(files, m.silentFileId);
    const webm = optional(files, m.webmFileId);
    const gif = optional(files, m.gifFileId);
    return {
      ...base,
      kind: "video",
      video: { src: publicUrl(mp4.key), poster: publicUrl(poster.key), durationMs: m.durationMs ?? 0, hasAudio: m.hasAudio },
      image: null,
      downloads: [
        { file: fileRef(mp4), format: "MP4", detail: m.hasAudio ? "With sound" : dims(mp4) },
        ...(silent ? [{ file: fileRef(silent), format: "MP4", detail: "No sound" }] : []),
        ...(webm ? [{ file: fileRef(webm), format: "WebM", detail: "Smaller, for websites" }] : []),
        ...(gif ? [{ file: fileRef(gif), format: "GIF", detail: `${dims(gif)}, no sound` }] : []),
      ],
    };
  }
  const img = optional(files, m.imageFileId);
  if (!img) return null;
  const png = optional(files, m.pngFileId);
  // The card shows the small WebP; the original is only fetched when someone downloads it.
  const preview = optional(files, m.previewFileId);
  return {
    ...base,
    kind: "image",
    video: null,
    image: { src: publicUrl((preview ?? img).key) },
    downloads: [
      { file: fileRef(img), format: IMAGE_FORMAT[img.mime] ?? "File", detail: img.mime === "image/svg+xml" ? "Any size" : dims(img) },
      ...(png ? [{ file: fileRef(png), format: "PNG", detail: dims(png) }] : []),
    ],
  };
}

const eventSummary = (e: Event): EventSummary => ({
  key: e.key,
  name: e.name,
  description: e.description,
  startsOn: e.startsOn ? isoDate(e.startsOn) : null,
  endsOn: e.endsOn ? isoDate(e.endsOn) : null,
});
/** Newest first: by start date, else by when the event was created. */
const byNewest = (a: Event, b: Event) => (b.startsOn ?? b.createdAt).getTime() - (a.startsOn ?? a.createdAt).getTime();

// ── Public reads (cached) ──────────────────────────────────────────────────────────────

/** Home text, footer and site-wide files. */
export async function getSiteSettings(): Promise<SiteView> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.settings);

  const s = await db.siteSettings.findUnique({ where: { id: 1 } });
  const files = await loadFiles([s?.allKitFileId, s?.ogFileId]);
  const allKit = optional(files, s?.allKitFileId);
  const og = optional(files, s?.ogFileId);
  return {
    homeTitle: s?.homeTitle ?? "Brand assets",
    homeSubtitle: s?.homeSubtitle ?? "Logos, colors and guidelines for every ParseLab product.",
    footerText: s?.footerText ?? "© ParseLab LLC. Assets are for approved use only.",
    contact: s?.contactEmail ?? "brand@parselab.com",
    allKit: allKit ? fileRef(allKit) : null,
    og: og ? fileRef(og) : null,
  };
}

/** Slugs of every public brand, for prerendering. */
export async function getPublishedSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.brands);
  const rows = await db.brand.findMany({ where: { status: { in: PUBLIC } }, select: { slug: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((r) => r.slug);
}

/** Home cards, in the admin's order. SOON and LIVE only. */
export async function getPublishedBrands(): Promise<BrandCardView[]> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.brands);

  cacheTag(CACHE_TAGS.events);
  const brands = await db.brand.findMany({ where: { status: { in: PUBLIC } }, orderBy: { sortOrder: "asc" }, include: brandInclude });
  const eventItems = await db.mediaItem.findMany({ where: { brandId: { in: brands.map((b) => b.id) }, event: { isNot: null } }, include: { event: true } });
  const files = await loadFiles(brands.flatMap((b) => b.logoTypes.flatMap((t) => t.variants.flatMap((v) => [v.svgFileId, v.png4096Id, v.png2048Id, v.png1024Id, v.png512Id]))));

  return brands.map((b) => {
    const groups = b.logoTypes.map((t) => ({
      key: t.key,
      variants: t.variants.map((v) => ({ id: variantPublicId(t.key, v.key), previewBg: v.previewBg, svgFileId: v.svgFileId ?? v.png4096Id ?? v.png2048Id ?? v.png1024Id ?? v.png512Id })),
    }));
    const thumb = (theme: Theme): CardThumb | null => {
      const pick = cardVariant(groups, theme);
      const svg = pick && optional(files, pick.variant.svgFileId);
      return svg ? { src: publicUrl(svg.key), plate: pick.plate } : null;
    };
    return {
      slug: b.slug,
      name: b.name,
      description: b.tagline,
      status: toPublic(b.status),
      thumbs: { light: thumb("light"), dark: thumb("dark") },
      counts: { variants: b.logoTypes.reduce((n, t) => n + t.variants.length, 0), colors: b.colors.length },
      events: [...new Map(eventItems.filter((m) => m.brandId === b.id && m.event).map((m) => [m.event!.id, m.event!])).values()].sort(byNewest).map(eventSummary),
    };
  });
}

/** One public brand's page, or null (missing or DRAFT: a 404). */
export async function getBrandBySlug(slug: string): Promise<BrandView | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.brands, CACHE_TAGS.brand(slug), CACHE_TAGS.events);

  const b = await loadBrandRow(slug);
  if (!b) return null;
  const media = await db.mediaItem.findMany({ where: { brandId: b.id }, include: { event: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const [files, site] = await Promise.all([
    loadFiles([...fileIdsOf(b), ...usageFileIds(b.usage), ...media.flatMap(mediaFileIds), b.animationsZipFileId]),
    getSiteSettings(),
  ]);
  const animations = media.filter((m) => !m.eventId && m.kind === "VIDEO").map((m) => mediaView(m, files)).filter((m): m is MediaView => m !== null);
  const eventRows = [...new Map(media.filter((m) => m.event).map((m) => [m.event!.id, m.event!])).values()].sort(byNewest);
  const events: BrandEventView[] = eventRows
    .map((e) => ({ ...eventSummary(e), items: media.filter((m) => m.eventId === e.id).map((m) => mediaView(m, files)).filter((m): m is MediaView => m !== null) }))
    .filter((e) => e.items.length);
  const animationsZip = optional(files, b.animationsZipFileId);
  const u = b.usage as UsageData | null;
  const sideView = (x: { fileId: string | null; caption: string }) => {
    const f = optional(files, x.fileId);
    return { src: f ? publicUrl(f.key) : null, caption: x.caption };
  };
  const usage: UsageView | null = u ? { markdown: u.markdown, pairs: u.pairs.map((p) => ({ do: sideView(p.do), dont: sideView(p.dont) })) } : null;

  const groups = logoGroups(b, files);
  const colors = colorViews(b);
  const allVariants = groups.flatMap((g) => g.variants);
  const iconFile = optional(files, b.iconFileId);
  const first = allVariants[0];
  const css = optional(files, b.colorsCssFileId);
  const json = optional(files, b.colorsJsonFileId);
  const kit = optional(files, b.kitFileId);
  const og = optional(files, b.ogFileId);

  return {
    slug: b.slug,
    name: b.name,
    description: b.tagline,
    status: toPublic(b.status),
    updatedAt: isoDate(b.updatedAt),
    contact: site.contact,
    typography: typographyView(b),
    usage,
    logoGroups: groups,
    animations,
    animationsZip: animations.length && animationsZip ? fileRef(animationsZip) : null,
    events,
    palettes: colors.length ? [{ name: "Main palette", colors }] : [],
    kit: kit && groups.length ? fileRef(kit) : null,
    colorFiles: css && json && colors.length ? { css: fileRef(css), json: fileRef(json) } : null,
    og: og ? fileRef(og) : (site.og ?? { path: "", filename: "", sizeKb: 0 }),
    icon: iconFile
      ? { src: publicUrl(iconFile.key), isTile: true, plate: "transparent" }
      : first
        ? { src: displayImage(first.assets).path, isTile: false, plate: first.previewBg }
        : null,
    counts: { variants: allVariants.length, colors: colors.length },
  };
}

/** Where an old slug now lives (after a rename that kept a redirect), or null. Public brands only. */
export async function getRedirectTarget(slug: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.brands, CACHE_TAGS.brand(slug));
  const r = await db.brandRedirect.findUnique({ where: { fromSlug: slug }, select: { brand: { select: { slug: true, status: true } } } });
  return r && PUBLIC.includes(r.brand.status) ? r.brand.slug : null;
}

/** Events with at least one public brand's item, newest first (the /events/ index). */
export async function getEvents(): Promise<(EventSummary & { brands: number; items: number })[]> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.events, CACHE_TAGS.brands);
  const events = await db.event.findMany({ include: { items: { where: { brand: { status: { in: PUBLIC } } }, select: { brandId: true, mp4FileId: true, imageFileId: true } } } });
  return events
    .map((e) => ({ e, ready: e.items.filter((i) => i.mp4FileId || i.imageFileId) }))
    .filter(({ ready }) => ready.length)
    .sort((a, b) => byNewest(a.e, b.e))
    .map(({ e, ready }) => ({ ...eventSummary(e), brands: new Set(ready.map((i) => i.brandId)).size, items: ready.length }));
}

/** /events/<key>/: every public brand's items in one event, in the home page's brand order. */
export async function getEventPage(key: string): Promise<EventPageView | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.events, CACHE_TAGS.brands);
  const e = await db.event.findUnique({
    where: { key },
    include: { items: { where: { brand: { status: { in: PUBLIC } } }, include: { brand: { select: { slug: true, name: true, sortOrder: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!e) return null;
  const files = await loadFiles(e.items.flatMap(mediaFileIds));
  const brands = [...new Map(e.items.map((i) => [i.brandId, i.brand])).entries()]
    .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
    .map(([id, brand]) => ({
      slug: brand.slug,
      name: brand.name,
      items: e.items.filter((i) => i.brandId === id).map((i) => mediaView(i, files)).filter((m): m is MediaView => m !== null),
    }))
    .filter((b) => b.items.length);
  return brands.length ? { ...eventSummary(e), brands } : null;
}
