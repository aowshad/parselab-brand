import { BrandCard } from "@/components/home/BrandCard";
import { Footer } from "@/components/shell/Footer";
import { HomeTopBar } from "@/components/shell/TopBar";
import type { Metadata } from "next";
import { LiveBadge } from "@/components/media/LiveBadge";
import { getEvents, getPublishedBrands, getSiteSettings } from "@/lib/brands";
import { withBase } from "@/lib/paths";

/** The home title from Settings, and the site-wide link-preview image (kept out of the root layout; see app/layout.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  const { og, homeTitle, homeSubtitle } = await getSiteSettings();
  return {
    title: { absolute: homeTitle },
    openGraph: {
      type: "website",
      siteName: "ParseLab Brand",
      title: homeTitle,
      description: homeSubtitle,
      images: og ? [{ url: withBase(og.path), width: 1200, height: 630 }] : [],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function Home() {
  const [site, brands, events] = await Promise.all([getSiteSettings(), getPublishedBrands(), getEvents()]);
  return (
    <>
      <HomeTopBar all={site.allKit} />
      <main className="container-page">
        <header className="pt-24">
          <h1 className="text-display text-balance">{site.homeTitle}</h1>
          <p className="mt-3 max-w-[560px] text-body text-pretty text-muted">{site.homeSubtitle}</p>
          {events.length > 0 && (
            <nav aria-label="Events" className="mt-6 flex flex-wrap items-center gap-2 text-small">
              <a href={withBase("/events/")} className="motion-colors font-medium text-muted hover:text-ink">
                Events:
              </a>
              {events.slice(0, 4).map((e) => (
                <a key={e.key} href={withBase(`/events/${e.key}/`)} className="motion-colors inline-flex h-8 items-center gap-2 rounded-full border border-hairline bg-surface px-3 font-medium hover:border-strong">
                  {e.name}
                  <LiveBadge startsOn={e.startsOn} endsOn={e.endsOn} />
                </a>
              ))}
            </nav>
          )}
        </header>
        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <li key={b.slug} className="flex">
              <BrandCard brand={b} />
            </li>
          ))}
        </ul>
      </main>
      <Footer contact={site.contact} text={site.footerText} />
    </>
  );
}
