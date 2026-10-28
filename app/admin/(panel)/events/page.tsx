import type { Metadata } from "next";
import { EventsEditor, type AdminEvent } from "@/components/admin/events/EventsEditor";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Events" };
export const instant = false;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EventsPage() {
  await requireAdmin();
  const events = await db.event.findMany({
    orderBy: [{ startsOn: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { items: { select: { brandId: true } } },
  });
  const list: AdminEvent[] = events.map((e) => ({
    id: e.id,
    key: e.key,
    name: e.name,
    description: e.description,
    startsOn: day(e.startsOn),
    endsOn: day(e.endsOn),
    items: e.items.length,
    brands: new Set(e.items.map((i) => i.brandId)).size,
  }));
  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="text-h2">Events</h1>
      <p className="mt-1 text-small text-pretty text-muted">
        Seasons and campaigns shared by every brand, one per year (Halloween 2026, Black Friday 2026…). Each brand adds its own logos and videos in its Events tab. Between the dates, the event shows a &ldquo;Live now&rdquo; badge.
      </p>
      <EventsEditor events={list} />
    </div>
  );
}
