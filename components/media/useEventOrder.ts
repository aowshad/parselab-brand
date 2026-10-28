"use client";

import { useEffect, useState } from "react";
import { byRelevance } from "@/lib/event-dates";

/**
 * Events in today's order (live, upcoming, past). The server renders its own order (pages are
 * cached and don't know today's date); the browser reorders once it has loaded.
 */
export function useEventOrder<T extends { startsOn: string | null; endsOn: string | null }>(events: T[]): T[] {
  const [ordered, setOrdered] = useState(events);
  useEffect(() => setOrdered(byRelevance(events)), [events]);
  return ordered;
}
