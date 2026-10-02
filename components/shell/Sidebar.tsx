import type { BrandNavItem } from "@/lib/content";
import { BrandList, OnThisPage, type PageSection } from "./NavLists";

export type { PageSection };

export function Sidebar({ brands, current, sections }: { brands: BrandNavItem[]; current: string; sections: PageSection[] }) {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[248px] shrink-0 overflow-y-auto px-4 py-8 min-[900px]:block">
      <BrandList brands={brands} current={current} />
      <div className="mt-8">
        <OnThisPage sections={sections} />
      </div>
    </aside>
  );
}
