import { eventDates } from "@/lib/event-dates";
import type { BrandEventView } from "@/lib/view";
import { Section } from "../sections/Section";
import { LiveBadge } from "./LiveBadge";
import { MediaCard } from "./MediaCard";

/** The brand's seasonal logos and videos, one block per event, newest first. */
export function EventsSection({ events }: { events: BrandEventView[] }) {
  return (
    <Section id="events" title="Events" subtitle="Seasonal logos and videos, like Halloween or Christmas.">
      <div className="flex flex-col gap-10">
        {events.map((e) => (
          <EventItems key={e.key} event={e} />
        ))}
      </div>
    </Section>
  );
}

export function EventItems({ event, heading = "h3" }: { event: { name: string; description: string; startsOn: string | null; endsOn: string | null; items: BrandEventView["items"] }; heading?: "h2" | "h3" }) {
  const H = heading;
  const dates = eventDates(event.startsOn, event.endsOn);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <H className="text-h3">{event.name}</H>
        <LiveBadge startsOn={event.startsOn} endsOn={event.endsOn} />
        {dates && <span className="text-caption tabular-nums text-muted">{dates}</span>}
      </div>
      {event.description && <p className="mt-1 text-small text-pretty text-muted">{event.description}</p>}
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {event.items.map((item) => (
          <li key={item.key} className="flex">
            <MediaCard item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
