import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaList } from "@/components/admin/media/MediaList";
import { buttonClass } from "@/components/ui/Button";
import { adminMediaItems } from "@/lib/admin/media-view";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eventDates } from "@/lib/event-dates";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await db.brand.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: b ? `${b.name} · Events` : "Events" };
}

/** This brand's logos and videos for each event (Halloween 2026…); the events themselves live on /admin/events/. */
export default async function EventsTab({ params }: Props) {
  await requireAdmin();
  const id = (await params).id;
  const brand = await db.brand.findUnique({ where: { id }, select: { id: true } });
  if (!brand) notFound();
  const events = await db.event.findMany({
    orderBy: [{ startsOn: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { items: { where: { brandId: id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!events.length) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-6 text-small text-muted">
        No events yet. Create one (like Halloween 2026) on the{" "}
        <Link href="/admin/events/" className="font-medium text-ink underline underline-offset-4">
          Events page
        </Link>
        , then add this brand&apos;s logos and videos for it here.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-small text-pretty text-muted">
        Seasonal logos and videos. Images are offered as uploaded (an SVG also as PNG); videos get the same formats as animations.{" "}
        <Link href="/admin/events/" className="font-medium text-ink underline underline-offset-4">
          Manage events
        </Link>
      </p>
      {await Promise.all(
        events.map(async (e) => (
          <section key={e.id} aria-label={e.name} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-h3">{e.name}</h2>
              <span className="text-caption tabular-nums text-muted">{eventDates(e.startsOn, e.endsOn) ?? "No dates"}</span>
              <a href={`/events/${e.key}/`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "quiet", size: "sm", className: "ml-auto" })}>
                Public page <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </div>
            <MediaList brandId={id} eventId={e.id} items={await adminMediaItems(e.items)} allowImages addLabel={`${e.name} items`} placeholder="Nothing for this brand yet." />
          </section>
        )),
      )}
    </div>
  );
}
