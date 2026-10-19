import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitEditor, type KitInfo } from "@/components/admin/kit/KitEditor";
import { KIT_MAX_MB } from "@/lib/admin/uploads";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { downloadUrl } from "@/lib/storage-url";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await db.brand.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: b ? `${b.name} · Brand kit` : "Brand kit" };
}

export default async function KitTab({ params }: Props) {
  await requireAdmin();
  const b = await db.brand.findUnique({
    where: { id: (await params).id },
    select: { id: true, kitMode: true, kitFileId: true, kitBuiltAt: true, assetsStaleAt: true, _count: { select: { colors: true } }, logoTypes: { select: { _count: { select: { variants: true } } } } },
  });
  if (!b) notFound();
  const kit = b.kitFileId ? await db.fileObject.findUnique({ where: { id: b.kitFileId } }) : null;
  const info: KitInfo = {
    brandId: b.id,
    mode: b.kitMode,
    kit: kit ? { name: kit.name, sizeKb: Math.round(kit.size / 102.4) / 10, builtAt: b.kitBuiltAt?.toISOString() ?? null, url: downloadUrl(kit.key, kit.name) } : null,
    logos: b.logoTypes.reduce((n, t) => n + t._count.variants, 0),
    colors: b._count.colors,
    rebuilding: b.assetsStaleAt !== null && b.kitMode === "AUTO",
    maxMb: KIT_MAX_MB,
  };
  return <KitEditor info={info} />;
}
