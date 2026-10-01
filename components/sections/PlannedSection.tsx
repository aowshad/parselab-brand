import { BookOpen, Images, Type, type LucideIcon } from "lucide-react";
import type { Brand } from "@/lib/schema";
import { Chip } from "../ui/Chip";

export type SectionKey = keyof Brand["sections"];

export const SECTION_INFO: Record<SectionKey, { id: string; title: string; description: string; icon: LucideIcon }> = {
  typography: { id: "typography", title: "Typography", description: "Typefaces, weights and the type scale.", icon: Type },
  guidelines: { id: "guidelines", title: "Usage guidelines", description: "Clear space, minimum sizes, do's and don'ts.", icon: BookOpen },
  screenshots: { id: "screenshots", title: "Product screenshots", description: "Approved app screenshots for press and listings.", icon: Images },
};

/**
 * Real components for sections that are `published`. None exist yet; add one
 * here when a section ships and the page renders it instead of the planned card.
 */
const PUBLISHED_SECTIONS: Partial<Record<SectionKey, React.ComponentType<{ brand: Brand }>>> = {};

export function MoreAssets({ brand }: { brand: Brand }) {
  const keys = Object.keys(SECTION_INFO) as SectionKey[];
  const published = keys.filter((k) => brand.sections[k] === "published");
  const planned = keys.filter((k) => brand.sections[k] === "planned");

  for (const k of published) {
    if (!PUBLISHED_SECTIONS[k]) {
      throw new Error(
        `${brand.slug}: sections.${k} is "published" but there is no component for it yet. ` +
          `Add one to PUBLISHED_SECTIONS in components/sections/PlannedSection.tsx, or set it back to "planned".`,
      );
    }
  }

  return (
    <>
      {published.map((k) => {
        const Section = PUBLISHED_SECTIONS[k]!;
        return <Section key={k} brand={brand} />;
      })}

      {planned.length > 0 && (
        <section aria-labelledby="more-heading" className="mt-20 sm:mt-24">
          <h2 id="more-heading" className="text-2xl font-semibold tracking-[-0.02em]">
            More assets
          </h2>
          <p className="mt-1 text-sm text-muted">On the way. These sections will appear here when they're ready.</p>
          <ul className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
            {planned.map((k) => {
              const { id, title, description, icon: Icon } = SECTION_INFO[k];
              return (
                <li key={k} id={id} className="scroll-mt-24 rounded-card border border-dashed border-control p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-button bg-track text-muted">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <Chip>Planned</Chip>
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{description}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
