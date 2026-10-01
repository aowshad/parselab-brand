import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrand, getBrandNav, getPublishedBrands } from "@/lib/content";

// Only published brands become pages; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedBrands().map((b) => ({ brand: b.slug }));
}

type Props = { params: Promise<{ brand: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = getBrand((await params).brand);
  return brand ? { title: brand.name, description: brand.description } : {};
}

// Phase 2 placeholder: proves content flows through. Replaced by the real UI in phase 4.
export default async function BrandPage({ params }: Props) {
  const brand = getBrand((await params).brand);
  if (!brand) notFound();
  const nav = getBrandNav();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Brand assets & guidelines</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{brand.name}</h1>
      <p className="mt-2 text-muted">{brand.description}</p>

      <h2 className="mt-10 font-semibold">Brands</h2>
      <ul className="mt-2 text-sm">
        {nav.map((b) => (
          <li key={b.slug}>
            {b.name} <span className="font-mono text-muted">{b.status}</span>
          </li>
        ))}
      </ul>

      {brand.logoGroups.map((group) => (
        <section key={group.key} className="mt-10">
          <h2 className="font-semibold">{group.label}</h2>
          <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {group.variants.map((v) => (
              <li key={v.id} className="rounded-card border border-hairline bg-surface p-3 text-xs">
                <p className="font-medium">{v.name}</p>
                <p className="font-mono text-muted">{v.file}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {brand.palettes.map((p) => (
        <section key={p.name} className="mt-10">
          <h2 className="font-semibold">{p.name}</h2>
          <ul className="mt-3 flex gap-2 font-mono text-xs">
            {p.colors.map((c) => (
              <li key={c.hex}>{c.name} {c.hex}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
