import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEditorBrand } from "@/lib/admin/brands";
import { requireAdmin } from "@/lib/auth/session";

export const instant = false;

/** Tabs whose editors arrive in later phases. Until then: what the brand has, and where to see it. */
const UPCOMING: Record<string, { title: string; phase: string; what: (c: { logos: number; colors: number; typefaces: number }) => string; anchor: string }> = {
  logos: { title: "Logos", phase: "Phase 4", what: (c) => `${c.logos} logo files`, anchor: "logos" },
  colors: { title: "Colors", phase: "Phase 5", what: (c) => `${c.colors} colors`, anchor: "colors" },
  typography: { title: "Typography", phase: "Phase 5", what: (c) => (c.typefaces ? `${c.typefaces} typeface${c.typefaces === 1 ? "" : "s"}` : "Coming soon on the site"), anchor: "typography" },
  usage: { title: "Usage", phase: "Phase 5", what: () => "Coming soon on the site", anchor: "usage" },
  kit: { title: "Brand kit", phase: "Phase 5", what: (c) => (c.logos ? "Built automatically from the logos and colors" : "No kit until there are logos"), anchor: "logos" },
};

type Props = { params: Promise<{ id: string; tab: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: UPCOMING[(await params).tab]?.title ?? "Brand" };
}

export default async function UpcomingTab({ params }: Props) {
  await requireAdmin();
  const { id, tab } = await params;
  const info = UPCOMING[tab];
  const brand = info ? await getEditorBrand(id) : null;
  if (!info || !brand) notFound();
  return (
    <section className="rounded-card border border-dashed border-control bg-surface px-6 py-10 text-center">
      <h2 className="text-h3">The {info.title} editor arrives in {info.phase}</h2>
      <p className="mx-auto mt-2 max-w-md text-small text-pretty text-muted">
        {brand.name} has: {info.what(brand.counts)}. They stay exactly as they are on the public site until then.
      </p>
      {brand.status !== "DRAFT" && (
        <a href={`/${brand.slug}/#${info.anchor}`} target="_blank" rel="noreferrer" className="motion-colors mt-4 inline-flex items-center gap-1 rounded-[6px] text-small font-medium hover:underline hover:underline-offset-4">
          See them on the site <ArrowUpRight aria-hidden className="size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}
