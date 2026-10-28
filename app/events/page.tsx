import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { LiveBadge } from "@/components/media/LiveBadge";
import { Footer } from "@/components/shell/Footer";
import { TrailTopBar } from "@/components/shell/TopBar";
import { getEvents, getSiteSettings } from "@/lib/brands";
import { eventDates } from "@/lib/event-dates";
import { plural } from "@/lib/format";
import { withBase } from "@/lib/paths";

export const metadata: Metadata = { title: "Events", description: "Seasonal logos and videos for every ParseLab product: Halloween, Black Friday, Christmas and more." };

/** Every event with published items, newest first. */
export default async function EventsIndex() {
  const [events, site] = await Promise.all([getEvents(), getSiteSettings()]);
  return (
    <>
      <TrailTopBar trail={[{ label: "Events" }]} />
      <main className="container-page pb-8">
        <header className="pt-24">
          <h1 className="text-display text-balance">Events</h1>
          <p className="mt-3 max-w-[560px] text-body text-pretty text-muted">Seasonal logos and videos for every product, one page per event.</p>
        </header>
        {events.length ? (
          <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
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
        ) : (
          <p className="mt-12 text-small text-muted">No events yet.</p>
        )}
      </main>
      <Footer contact={site.contact} text={site.footerText} />
    </>
  );
}
