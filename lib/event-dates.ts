/** "Oct 15 – Nov 1, 2026", "From Oct 15, 2026", or null without dates. Dates are UTC days. */
export function eventDates(startsOn: Date | string | null, endsOn: Date | string | null): string | null {
  const d = (v: Date | string | null) => (v === null ? null : typeof v === "string" ? new Date(`${v}T00:00:00Z`) : v);
  const [s, e] = [d(startsOn), d(endsOn)];
  const day = (x: Date, year: boolean) => x.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  if (s && e) return `${day(s, s.getUTCFullYear() !== e.getUTCFullYear())} – ${day(e, true)}`;
  if (s) return `From ${day(s, true)}`;
  if (e) return `Until ${day(e, true)}`;
  return null;
}

/** Whether today (in the viewer's time zone) falls within the event's dates. */
export function isLive(startsOn: string | null, endsOn: string | null, today = new Date()): boolean {
  if (!startsOn && !endsOn) return false;
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (!startsOn || t >= startsOn) && (!endsOn || t <= endsOn);
}

type Dated = { startsOn: string | null; endsOn: string | null };

/**
 * Today's order: live events first, then upcoming ones (soonest first), then past ones (most
 * recent first); events without dates last, in their given order.
 */
export function byRelevance<T extends Dated>(events: T[], today = new Date()): T[] {
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const rank = (e: Dated) => (!e.startsOn && !e.endsOn ? 3 : isLive(e.startsOn, e.endsOn, today) ? 0 : e.startsOn && e.startsOn > t ? 1 : 2);
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ra = rank(a.e), rb = rank(b.e);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return (a.e.startsOn ?? "").localeCompare(b.e.startsOn ?? "");
      if (ra === 2) return (b.e.endsOn ?? b.e.startsOn ?? "").localeCompare(a.e.endsOn ?? a.e.startsOn ?? "");
      return a.i - b.i;
    })
    .map(({ e }) => e);
}
