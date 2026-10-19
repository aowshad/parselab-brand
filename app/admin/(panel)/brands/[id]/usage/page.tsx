import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UsageEditor, type EditorUsage } from "@/components/admin/usage/UsageEditor";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage-url";
import { usageFileIds, type UsageData } from "@/lib/usage";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await db.brand.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: b ? `${b.name} · Usage` : "Usage" };
}

export default async function UsageTab({ params }: Props) {
  await requireAdmin();
  const brand = await db.brand.findUnique({ where: { id: (await params).id }, select: { id: true, usage: true } });
  if (!brand) notFound();
  const u = brand.usage as UsageData | null;
  const files = new Map((await db.fileObject.findMany({ where: { id: { in: usageFileIds(u) } } })).map((f) => [f.id, publicUrl(f.key)]));
  const side = (s: { fileId: string | null; caption: string }) => ({ ...s, src: s.fileId ? (files.get(s.fileId) ?? null) : null });
  const initial: EditorUsage = u ? { markdown: u.markdown, pairs: u.pairs.map((p) => ({ do: side(p.do), dont: side(p.dont) })) } : null;
  return <UsageEditor brandId={brand.id} initial={initial} />;
}
