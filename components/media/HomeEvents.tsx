"use client";

import { withBase } from "@/lib/paths";
import type { EventSummary } from "@/lib/view";
import { LiveBadge } from "./LiveBadge";
import { useEventOrder } from "./useEventOrder";

/** The home page's event chips: what's live and next first, at most four. */
export function HomeEvents({ events }: { events: EventSummary[] }) {
  const ordered = useEventOrder(events);
  return (
    <nav aria-label="Events" className="mt-6 flex flex-wrap items-center gap-2 text-small">
      <a href={withBase("/events/")} className="motion-colors font-medium text-muted hover:text-ink">
        Events:
      </a>
      {ordered.slice(0, 4).map((e) => (
        <a key={e.key} href={withBase(`/events/${e.key}/`)} className="motion-colors inline-flex h-8 items-center gap-2 rounded-full border border-hairline bg-surface px-3 font-medium hover:border-strong">
          {e.name}
          <LiveBadge startsOn={e.startsOn} endsOn={e.endsOn} />
        </a>
      ))}
      {events.length > 4 && (
        <a href={withBase("/events/")} className="motion-colors px-1 font-medium text-muted hover:text-ink">
          All events →
        </a>
      )}
    </nav>
  );
}
