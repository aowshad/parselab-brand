import { BookOpen, Images, Palette, Type } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandHero } from "@/components/brand/BrandHero";
import { PaletteSection } from "@/components/colors/PaletteSection";
import { LogoSection } from "@/components/logos/LogoSection";
import { ComingSoonCard, Section } from "@/components/sections/Section";
import { Footer } from "@/components/shell/Footer";
import { TocChips, TocSidebar, type TocItem } from "@/components/shell/Toc";
import { BrandTopBar } from "@/components/shell/TopBar";
import { getAllBrands } from "@/lib/content";
import { getBrandView } from "@/lib/view";

// Every brand in content/brands gets a page; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBrands().map((b) => ({ brand: b.slug }));
}

type Props = { params: Promise<{ brand: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = getBrandView((await params).brand);
  return brand ? { title: brand.name, description: `${brand.name} logos, colors and brand guidelines.` } : {};
}

const LOGOS_SUBTITLE = "Every file in SVG and transparent PNG.";
const COLORS_SUBTITLE = "Click any color to copy its hex.";

/** One brand's page. It loads only this brand: no other brand is read, listed or linked. */
export default async function BrandPage({ params }: Props) {
  const brand = getBrandView((await params).brand);
  if (!brand) notFound();
  const { variants, colors } = brand.counts;

  // Labels match the section headings word for word.
  const toc: TocItem[] = [
    { id: "logos", label: "Logos", ...(variants ? { count: variants } : { soon: true }) },
    { id: "colors", label: "Colors", ...(colors ? { count: colors } : { soon: true }) },
    { id: "typography", label: "Typography", soon: true },
    { id: "usage", label: "Usage guidelines", soon: true },
  ];

  return (
    <>
      <BrandTopBar brand={brand} />
      <TocChips items={toc} />
      <div className="mx-auto flex max-w-[1440px]">
        <TocSidebar items={toc} />
        <main className="min-w-0 flex-1 px-4 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[1040px]">
            <BrandHero brand={brand} />

            {brand.logoGroups.length ? (
              <LogoSection brandName={brand.name} groups={brand.logoGroups} />
            ) : (
              <Section id="logos" title="Logos" subtitle={LOGOS_SUBTITLE}>
                <ComingSoonCard icon={Images} text="Logo files will be published here." />
              </Section>
            )}

            <Section id="colors" title="Colors" subtitle={colors ? COLORS_SUBTITLE : "Brand colors and their values."}>
              {brand.palettes.length && brand.colorFiles ? (
                <PaletteSection palettes={brand.palettes} files={brand.colorFiles} />
              ) : (
                <ComingSoonCard icon={Palette} text="The brand palette will be published here." />
              )}
            </Section>

            <Section id="typography" title="Typography" subtitle="Typefaces, weights and the type scale.">
              <ComingSoonCard icon={Type} text="Typefaces and the type scale will be published here." />
            </Section>

            <Section id="usage" title="Usage guidelines" subtitle="Clear space, minimum sizes, do's and don'ts.">
              <ComingSoonCard icon={BookOpen} text="Clear space, minimum sizes and do's and don'ts will be published here." />
            </Section>

            <Footer contact={brand.contact} />
          </div>
        </main>
      </div>
    </>
  );
}
