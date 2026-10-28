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
