import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandHero } from "@/components/brand/BrandHero";
import { PaletteSection } from "@/components/colors/PaletteSection";
import { LogoSection } from "@/components/logos/LogoSection";
import { MoreAssets, SECTION_INFO } from "@/components/sections/PlannedSection";
import { Footer } from "@/components/shell/Footer";
import { Sidebar, type PageSection } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { getBrandNav, getPublishedBrands } from "@/lib/content";
import { getBrandView } from "@/lib/view";

// Only published brands become pages; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedBrands().map((b) => ({ brand: b.slug }));
}

type Props = { params: Promise<{ brand: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = getBrandView((await params).brand);
  return brand ? { title: brand.name, description: `${brand.name} logos, colors and brand guidelines.` } : {};
}

export default async function BrandPage({ params }: Props) {
  const brand = getBrandView((await params).brand);
  if (!brand) notFound();

  const nav = getBrandNav();
  const sections: PageSection[] = [
    { id: "logos", label: "Logos", count: brand.counts.variants },
    { id: "colors", label: "Color palette", count: brand.counts.colors, planned: brand.counts.colors === 0 },
    ...(["typography", "guidelines"] as const).map((k) => ({
      id: SECTION_INFO[k].id,
      label: SECTION_INFO[k].title,
      planned: brand.sections[k] === "planned",
    })),
  ];

  return (
    <div id="top">
      <TopBar kit={brand.kit} brands={nav} current={brand.slug} sections={sections} />
      <div className="mx-auto flex max-w-[1440px]">
        <Sidebar brands={nav} current={brand.slug} sections={sections} />
        <main className="min-w-0 flex-1 px-4 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[1040px]">
            <BrandHero brand={brand} />
            <LogoSection brandName={brand.name} groups={brand.logoGroups} />
            <PaletteSection brand={brand} />
            <MoreAssets brand={brand} />
            <Footer contact={brand.contact} />
          </div>
        </main>
      </div>
    </div>
  );
}
