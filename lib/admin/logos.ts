import "server-only";
import { db } from "../db";
import { downloadUrl, publicUrl } from "../storage-url";

export type EditorVariant = {
  id: string;
  key: string;
  name: string;
  hint: string;
  fileName: string;
  previewBg: string;
  /** SVG if there is one, else the largest PNG. */
  preview: string;
  download: string;
  kind: "svg" | "png";
  pngSizes: number[];
};

export type EditorLogoType = {
  id: string;
  key: string;
  label: string;
  description: string;
  zip: { name: string; sizeKb: number } | null;
  variants: EditorVariant[];
};

export type LogoEditor = { brandId: string; slug: string; name: string; rebuilding: boolean; types: EditorLogoType[] };

const COLS = [
  [512, "png512Id"],
  [1024, "png1024Id"],
  [2048, "png2048Id"],
  [4096, "png4096Id"],
] as const;

export async function getLogoEditor(brandId: string): Promise<LogoEditor | null> {
  const b = await db.brand.findUnique({
    where: { id: brandId },
    include: { logoTypes: { orderBy: { sortOrder: "asc" }, include: { variants: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!b) return null;
  const ids = b.logoTypes.flatMap((t) => [t.zipFileId, ...t.variants.flatMap((v) => [v.svgFileId, ...COLS.map(([, c]) => v[c])])]);
  const files = new Map((await db.fileObject.findMany({ where: { id: { in: ids.filter((x): x is string => Boolean(x)) } } })).map((f) => [f.id, f]));

  return {
    brandId: b.id,
    slug: b.slug,
    name: b.name,
    rebuilding: b.assetsStaleAt !== null,
    types: b.logoTypes.map((t) => {
      const zip = t.zipFileId ? files.get(t.zipFileId) : undefined;
      return {
        id: t.id,
        key: t.key,
        label: t.label,
        description: t.description,
        zip: zip ? { name: zip.name, sizeKb: Math.round(zip.size / 102.4) / 10 } : null,
        variants: t.variants.flatMap((v): EditorVariant[] => {
          const svg = v.svgFileId ? files.get(v.svgFileId) : undefined;
          const pngs = COLS.flatMap(([size, c]) => {
            const f = v[c] ? files.get(v[c]!) : undefined;
            return f ? [{ size, f }] : [];
          });
          const shown = svg ?? pngs.at(-1)?.f;
          if (!shown) return [];
          return [
            {
              id: v.id,
              key: v.key,
              name: v.name,
              hint: v.hint,
              fileName: v.fileName,
              previewBg: v.previewBg,
              preview: publicUrl(shown.key),
              download: downloadUrl(shown.key, shown.name),
              kind: svg ? "svg" : "png",
              pngSizes: pngs.map((p) => p.size),
            },
          ];
        }),
      };
    }),
  };
}
