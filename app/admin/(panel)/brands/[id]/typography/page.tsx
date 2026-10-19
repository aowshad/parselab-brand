import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TypographyEditor, type FontOption } from "@/components/admin/typography/TypographyEditor";
import { getEditorBrand } from "@/lib/admin/brands";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FONT_SOURCES, FONT_WEIGHTS } from "@/lib/font-catalog";
// Loading the font registry here also brings in the @font-face rules, so previews use the real fonts.
import { BRAND_FONTS } from "@/lib/fonts";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getEditorBrand((await params).id);
  return { title: b ? `${b.name} · Typography` : "Typography" };
}

export default async function TypographyTab({ params }: Props) {
  await requireAdmin();
  const brand = await db.brand.findUnique({ where: { id: (await params).id }, select: { id: true, name: true, typography: true } });
  if (!brand) notFound();
  const fonts: FontOption[] = Object.keys(FONT_WEIGHTS).map((family) => ({ family, stack: BRAND_FONTS[family]!, weights: FONT_WEIGHTS[family]!, source: FONT_SOURCES[family]! }));
  return <TypographyEditor brandId={brand.id} brandName={brand.name} initial={(brand.typography as never) ?? null} fonts={fonts} />;
}
