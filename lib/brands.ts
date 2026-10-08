import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { gradientCss, isDark } from "./color";
import { db } from "./db";
import type { FileRef, ImageRef, PngWidth } from "./files";
import { BRAND_FONTS } from "./fonts";
import type { BrandStatus, FileObject } from "./generated/prisma/client";
import { typographySchema, type Typeface } from "./schema";
import { downloadUrl, publicUrl } from "./storage-url";
import { typeScale } from "./typography";
import { cardVariant, type Theme } from "./variants";
import type { BrandCardView, BrandView, CardThumb, ColorView, LogoGroupView, PublicStatus, SiteView, TypographyView, VariantView } from "./view";

/*
 * The public site's one data layer. Every read is cached ('use cache') and tagged, so an admin
 * save expires exactly what it changed: `brands` (home + every brand page), `brand:<slug>`, or
 * `settings`. DRAFT brands never leave this file.
 */
export const CACHE_TAGS = {
  brands: "brands",
  brand: (slug: string) => `brand:${slug}`,
  settings: "settings",
} as const;

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

/** Variant keys as they appear in public ids and file names: on-dark → dark-bg, on-light → light-bg. */
const LEGACY_SUFFIX: Record<string, string> = { "on-dark": "dark-bg", "on-light": "light-bg" };
export const variantPublicId = (typeKey: string, variantKey: string) => `${typeKey}-${LEGACY_SUFFIX[variantKey] ?? variantKey}`;

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
    .map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      zip: fileRef(need(files, t.zipFileId, `${b.slug}/${t.key} zip`)),
      variants: t.variants.map((v): VariantView => {
        const id = variantPublicId(t.key, v.key);
        return {
          id,
          name: v.name,
          usage: v.hint,
          previewBg: v.previewBg,
          dot: v.dot ?? v.previewBg,
          darkStage: isDark(v.previewBg),
          assets: {
            svg: imageRef(need(files, v.svgFileId, `${b.slug}/${id} SVG`)),
            png: PNG_COLUMNS.flatMap(([size, col]) => {
              const f = optional(files, v[col]);
              return f ? [{ ...imageRef(f), size: size as PngWidth }] : [];
            }),
          },
        };
      }),
    }));
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

  const brands = await db.brand.findMany({ where: { status: { in: PUBLIC } }, orderBy: { sortOrder: "asc" }, include: brandInclude });
  const files = await loadFiles(brands.flatMap((b) => b.logoTypes.flatMap((t) => t.variants.map((v) => v.svgFileId))));

  return brands.map((b) => {
    const groups = b.logoTypes.map((t) => ({
      key: t.key,
      variants: t.variants.map((v) => ({ id: variantPublicId(t.key, v.key), previewBg: v.previewBg, svgFileId: v.svgFileId })),
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
    };
  });
}

/** One public brand's page, or null (missing or DRAFT: a 404). */
export async function getBrandBySlug(slug: string): Promise<BrandView | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.brands, CACHE_TAGS.brand(slug));

  const b = await loadBrandRow(slug);
  if (!b) return null;
  const [files, site] = await Promise.all([loadFiles(fileIdsOf(b)), getSiteSettings()]);

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
    logoGroups: groups,
    palettes: colors.length ? [{ name: "Main palette", colors }] : [],
    kit: kit && groups.length ? fileRef(kit) : null,
    colorFiles: css && json && colors.length ? { css: fileRef(css), json: fileRef(json) } : null,
    og: og ? fileRef(og) : (site.og ?? { path: "", filename: "", sizeKb: 0 }),
    icon: iconFile
      ? { src: publicUrl(iconFile.key), isTile: true, plate: "transparent" }
      : first
        ? { src: first.assets.svg.path, isTile: false, plate: first.previewBg }
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
