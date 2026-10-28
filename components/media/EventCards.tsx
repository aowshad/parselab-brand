"use client";

import { ArrowRight } from "lucide-react";
import { eventDates } from "@/lib/event-dates";
import { plural } from "@/lib/format";
import { withBase } from "@/lib/paths";
import type { EventSummary } from "@/lib/view";
import { LiveBadge } from "./LiveBadge";
import { useEventOrder } from "./useEventOrder";

/** The events index: live, then upcoming, then past. */
export function EventCards({ events }: { events: (EventSummary & { brands: number; items: number })[] }) {
  const ordered = useEventOrder(events);
  return (
    <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ordered.map((e) => (
        <li key={e.key} className="flex">
          <a href={withBase(`/events/${e.key}/`)} className="motion-card group flex w-full flex-col rounded-card border border-hairline bg-surface p-6 hover:-translate-y-0.5 hover:border-strong hover:shadow-lift">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h3">{e.name}</h2>
              <LiveBadge startsOn={e.startsOn} endsOn={e.endsOn} />
            </div>
            <p className="mt-1 text-small tabular-nums text-muted">{eventDates(e.startsOn, e.endsOn) ?? " "}</p>
            <div className="mt-auto flex items-center justify-between pt-4">
              <span className="text-caption tabular-nums text-muted">
                {plural(e.items, "file")} · {plural(e.brands, "brand")}
              </span>
              <ArrowRight aria-hidden className="motion-nudge size-4 text-muted group-hover:translate-x-0.5 group-hover:text-ink" />
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
