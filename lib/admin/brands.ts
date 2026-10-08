import "server-only";
import { variantPublicId } from "../brands";
import { db } from "../db";
import { publicUrl } from "../storage-url";
import { cardVariant, variantTone, type Theme } from "../variants";

/* Reads for the admin panel: every brand (drafts included), never cached. */

export type AdminBrandRow = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "SOON" | "LIVE";
  icon: string | null;
  logos: number;
  colors: number;
  updatedAt: string;
};

export async function listBrands(): Promise<AdminBrandRow[]> {
  const rows = await db.brand.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, slug: true, status: true, updatedAt: true, iconFileId: true,
      _count: { select: { colors: true } },
      logoTypes: { select: { _count: { select: { variants: true } } } },
    },
  });
  const icons = await db.fileObject.findMany({ where: { id: { in: rows.flatMap((r) => (r.iconFileId ? [r.iconFileId] : [])) } }, select: { id: true, key: true } });
  const iconUrl = new Map(icons.map((f) => [f.id, publicUrl(f.key)]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    icon: r.iconFileId ? (iconUrl.get(r.iconFileId) ?? null) : null,
    logos: r.logoTypes.reduce((n, t) => n + t._count.variants, 0),
    colors: r._count.colors,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export type CardPreview = { src: string; plate: string | null; label: string } | null;

export type EditorBrand = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  status: "DRAFT" | "SOON" | "LIVE";
  accent: string | null;
  updatedAt: string;
  icon: { url: string; name: string; width: number | null; height: number | null } | null;
  redirects: string[];
  counts: { logos: number; colors: number; typefaces: number };
  /** The home card in each theme, as the public site will pick it. */
  preview: Record<Theme, CardPreview>;
  /** Plain-language notes when a theme falls back (e.g. no On dark logo). */
  previewNotes: string[];
};

const VARIANT_NAME: Record<string, string> = { "on-light": "On light", "on-dark": "On dark", black: "Black", white: "White" };

export async function getEditorBrand(id: string): Promise<EditorBrand | null> {
  const b = await db.brand.findUnique({
    where: { id },
    include: { logoTypes: { orderBy: { sortOrder: "asc" }, include: { variants: { orderBy: { sortOrder: "asc" } } } }, redirects: true, _count: { select: { colors: true } } },
  });
  if (!b) return null;
  const fileIds = [b.iconFileId, ...b.logoTypes.flatMap((t) => t.variants.map((v) => v.svgFileId))].filter((x): x is string => Boolean(x));
  const files = new Map((await db.fileObject.findMany({ where: { id: { in: fileIds } } })).map((f) => [f.id, f]));
  const icon = b.iconFileId ? files.get(b.iconFileId) : undefined;

  const groups = b.logoTypes.map((t) => ({
    key: t.key,
    label: t.label,
    variants: t.variants.map((v) => ({ id: variantPublicId(t.key, v.key), key: v.key, name: v.name, previewBg: v.previewBg, svgFileId: v.svgFileId })),
  }));
  const preview = {} as Record<Theme, CardPreview>;
  const notes: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    const pick = cardVariant(groups, theme);
    const f = pick?.variant.svgFileId ? files.get(pick.variant.svgFileId) : undefined;
    const group = groups.find((g) => g.variants.includes(pick?.variant as never));
    preview[theme] = pick && f ? { src: publicUrl(f.key), plate: pick.plate, label: `${group?.label ?? "Logo"} · ${pick.variant.name}` } : null;
    const want = theme === "light" ? "on-light" : "on-dark";
    const full = groups.find((g) => g.key === "full");
    if (!pick) continue;
    if (full && !full.variants.some((v) => variantTone(v.id) === want)) {
      notes.push(`No ${VARIANT_NAME[want]} full logo: ${theme} mode uses ${pick.variant.name}${pick.plate ? " on a plate of its own background" : ""}.`);
    } else if (!full) {
      notes.push(`No Full logo yet: the home card uses the ${group?.label ?? "first logo"}.`);
    }
  }

  const typography = b.typography as { typefaces?: unknown[] } | null;
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    tagline: b.tagline,
    status: b.status,
    accent: b.accent,
    updatedAt: b.updatedAt.toISOString(),
    icon: icon ? { url: publicUrl(icon.key), name: icon.name, width: icon.width, height: icon.height } : null,
    redirects: b.redirects.map((r) => r.fromSlug),
    counts: { logos: b.logoTypes.reduce((n, t) => n + t.variants.length, 0), colors: b._count.colors, typefaces: typography?.typefaces?.length ?? 0 },
    preview,
    previewNotes: [...new Set(notes)],
  };
}
