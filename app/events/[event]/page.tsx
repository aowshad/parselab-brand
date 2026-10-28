import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBadge } from "@/components/media/LiveBadge";
import { MediaCard } from "@/components/media/MediaCard";
import { Footer } from "@/components/shell/Footer";
import { TrailTopBar } from "@/components/shell/TopBar";
import { getEventPage, getEvents, getSiteSettings } from "@/lib/brands";
import { eventDates } from "@/lib/event-dates";
import { withBase } from "@/lib/paths";

// Events with public items are prerendered; one added later renders on its first visit. Cache
// Components needs at least one entry, so with no events yet a placeholder prerenders as a 404.
export async function generateStaticParams() {
  const keys = (await getEvents()).map((e) => ({ event: e.key }));
  return keys.length ? keys : [{ event: "_" }];
}

type Props = { params: Promise<{ event: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventPage((await params).event);
  if (!event) return {};
  const description = event.description || `${event.name} logos and videos for every ParseLab product.`;
  return { title: event.name, description, openGraph: { title: `${event.name} — Brand assets`, description, url: withBase(`/events/${event.key}/`) } };
}

/** One event across every brand: each brand's seasonal logos and videos, in the home page's order. */
export default async function EventPage({ params }: Props) {
  const [event, site] = await Promise.all([getEventPage((await params).event), getSiteSettings()]);
  if (!event) notFound();
  const dates = eventDates(event.startsOn, event.endsOn);
  return (
    <>
      <TrailTopBar trail={[{ label: "Events", href: "/events/" }, { label: event.name }]} />
      <main className="container-page pb-8">
        <header className="pt-24">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-display text-balance">{event.name}</h1>
            <LiveBadge startsOn={event.startsOn} endsOn={event.endsOn} />
          </div>
          <p className="mt-3 max-w-[560px] text-body text-pretty text-muted">
            {[dates, event.description || `Seasonal logos and videos for every product.`].filter(Boolean).join(" · ")}
          </p>
        </header>
        {event.brands.map((b) => (
          <section key={b.slug} aria-labelledby={`brand-${b.slug}`} className="mt-16">
            <h2 id={`brand-${b.slug}`} className="text-h2">
              <a href={withBase(`/${b.slug}/`)} className="motion-colors hover:text-muted">
                {b.name}
              </a>
            </h2>
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {b.items.map((item) => (
                <li key={item.key} className="flex">
                  <MediaCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Footer contact={site.contact} text={site.footerText} />
    </>
  );
}
