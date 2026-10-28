import type { Metadata } from "next";
import { EventCards } from "@/components/media/EventCards";
import { Footer } from "@/components/shell/Footer";
import { TrailTopBar } from "@/components/shell/TopBar";
import { getEvents, getSiteSettings } from "@/lib/brands";

export const metadata: Metadata = { title: "Events", description: "Seasonal logos and videos for every ParseLab product: Halloween, Black Friday, Christmas and more." };

/** Every event with published items: live, then upcoming, then past (ordered in the browser). */
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
          <EventCards events={events} />
        ) : (
          <p className="mt-12 text-small text-muted">No events yet.</p>
        )}
      </main>
      <Footer contact={site.contact} text={site.footerText} />
    </>
  );
}
