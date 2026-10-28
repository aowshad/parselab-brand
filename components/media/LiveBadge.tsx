"use client";

import { useEffect, useState } from "react";
import { isLive } from "@/lib/event-dates";

/**
 * "Live now" while today is within the event's dates. Decided in the browser: pages are cached,
 * and the date moves on without the page changing.
 */
export function LiveBadge({ startsOn, endsOn, label = "Live now" }: { startsOn: string | null; endsOn: string | null; label?: string }) {
  const [live, setLive] = useState(false);
  useEffect(() => setLive(isLive(startsOn, endsOn)), [startsOn, endsOn]);
  if (!live) return null;
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-success/12 px-2 text-caption font-medium text-success">
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      {label}
    </span>
  );
}

/** The name of the first of these events that's live today (home cards), or nothing. */
export function LiveEventBadge({ events }: { events: { name: string; startsOn: string | null; endsOn: string | null }[] }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => setName(events.find((e) => isLive(e.startsOn, e.endsOn))?.name ?? null), [events]);
  if (!name) return null;
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-success/12 px-2 text-caption font-medium text-success">
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      {name}
    </span>
  );
}
