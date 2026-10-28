import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaList } from "@/components/admin/media/MediaList";
import { adminMediaItems } from "@/lib/admin/media-view";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await db.brand.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: b ? `${b.name} · Animations` : "Animations" };
}

export default async function AnimationsTab({ params }: Props) {
  await requireAdmin();
  const brand = await db.brand.findUnique({
    where: { id: (await params).id },
    select: { id: true, media: { where: { eventId: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!brand) notFound();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-pretty text-muted">
        Logo animations, like a reveal or an intro. Upload one MP4 (or MOV): the page offers it as MP4 with and without sound, WebM and GIF, made automatically.
      </p>
      <MediaList brandId={brand.id} eventId={null} items={await adminMediaItems(brand.media)} allowImages={false} addLabel="Animations" placeholder="No animations yet. Name one below, then upload its video." />
    </div>
  );
}
