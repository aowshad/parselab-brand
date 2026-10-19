import "server-only";
import { db } from "../db";
import { downloadUrl } from "../storage-url";

export type EditorColor = {
  id: string;
  role: string;
  name: string;
  kind: "SOLID" | "GRADIENT";
  hex: string | null;
  gradient: { angle: number; stops: { hex: string; at: number }[] } | null;
  cmyk: string | null;
  pantone: string | null;
};

export type ColorEditor = { brandId: string; slug: string; name: string; colors: EditorColor[]; files: { css: string; json: string } | null };

export async function getColorEditor(brandId: string): Promise<ColorEditor | null> {
  const b = await db.brand.findUnique({ where: { id: brandId }, include: { colors: { orderBy: { sortOrder: "asc" } } } });
  if (!b) return null;
  const [css, json] = await Promise.all(
    [b.colorsCssFileId, b.colorsJsonFileId].map((id) => (id ? db.fileObject.findUnique({ where: { id } }) : null)),
  );
  return {
    brandId: b.id,
    slug: b.slug,
    name: b.name,
    colors: b.colors.map((c) => ({
      id: c.id,
      role: c.role,
      name: c.name,
      kind: c.kind,
      hex: c.hex,
      gradient: (c.gradient as EditorColor["gradient"]) ?? null,
      cmyk: c.cmyk,
      pantone: c.pantone,
    })),
    files: css && json ? { css: downloadUrl(css.key, css.name), json: downloadUrl(json.key, json.name) } : null,
  };
}
