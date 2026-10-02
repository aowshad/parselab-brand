import { BrandCard } from "@/components/home/BrandCard";
import { Footer } from "@/components/shell/Footer";
import { HomeTopBar } from "@/components/shell/TopBar";
import { SITE } from "@/lib/site";
import { getAllKits, getBrandCards } from "@/lib/view";

export default function Home() {
  return (
    <>
      <HomeTopBar all={getAllKits()} />
      <main className="mx-auto max-w-[1120px] px-4 sm:px-8">
        <header className="pt-12 sm:pt-16">
          <p className="text-[13px] font-medium text-muted">Brand assets</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
            Logos, colors and guidelines for every ParseLab product.
          </h1>
        </header>
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {getBrandCards().map((b) => (
            <li key={b.slug} className="flex">
              <BrandCard brand={b} />
            </li>
          ))}
        </ul>
        <Footer contact={SITE.contact} />
      </main>
    </>
  );
}
