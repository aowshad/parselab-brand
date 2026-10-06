import { BrandCard } from "@/components/home/BrandCard";
import { Footer } from "@/components/shell/Footer";
import { HomeTopBar } from "@/components/shell/TopBar";
import { getPublishedBrands, getSiteSettings } from "@/lib/brands";

export default async function Home() {
  const [site, brands] = await Promise.all([getSiteSettings(), getPublishedBrands()]);
  return (
    <>
      <HomeTopBar all={site.allKit} />
      <main className="container-page">
        <header className="pt-24">
          <h1 className="text-display text-balance">{site.homeTitle}</h1>
          <p className="mt-3 max-w-[560px] text-body text-pretty text-muted">{site.homeSubtitle}</p>
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
