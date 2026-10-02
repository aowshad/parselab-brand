import { BrandCard } from "@/components/home/BrandCard";
import { Footer } from "@/components/shell/Footer";
import { HomeTopBar } from "@/components/shell/TopBar";
import { SITE } from "@/lib/site";
import { getAllKits, getBrandCards } from "@/lib/view";

export default function Home() {
  return (
    <>
      <HomeTopBar all={getAllKits()} />
      <main className="container-page">
        <header className="pt-24">
          <h1 className="text-display text-balance">Brand assets</h1>
          <p className="mt-3 max-w-[560px] text-body text-pretty text-muted">Logos, colors and guidelines for every ParseLab product.</p>
        </header>
        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {getBrandCards().map((b) => (
            <li key={b.slug} className="flex">
              <BrandCard brand={b} />
            </li>
          ))}
        </ul>
      </main>
      <Footer contact={SITE.contact} />
    </>
  );
}
