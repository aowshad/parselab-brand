import type { BrandNavItem } from "@/lib/content";
import { withBase } from "@/lib/paths";
import { Chip } from "../ui/Chip";

export type PageSection = { id: string; label: string; count?: number; planned?: boolean };

const itemClass =
  "flex h-9 items-center gap-2.5 rounded-button-sm px-2.5 text-sm transition-colors duration-150 ease-out-soft";

export function Sidebar({ brands, current, sections }: { brands: BrandNavItem[]; current: string; sections: PageSection[] }) {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[248px] shrink-0 overflow-y-auto px-4 py-8 min-[900px]:block">
      <nav aria-label="Brands">
        <h2 className="px-2.5 text-xs font-medium text-muted">Brands</h2>
        <ul className="mt-2 space-y-0.5">
          {brands.map((b) => {
            const tile = (
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-[7px] text-[11px] font-semibold ${
                  b.slug === current ? "bg-ink text-on-dark" : "bg-track text-ink"
                }`}
              >
                {b.name.charAt(0)}
              </span>
            );
            return (
              <li key={b.slug}>
                {b.status === "published" ? (
                  <a
                    href={withBase(`/${b.slug}`)}
                    aria-current={b.slug === current ? "page" : undefined}
                    className={`${itemClass} ${b.slug === current ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink"}`}
                  >
                    {tile}
                    {b.name}
                  </a>
                ) : (
                  <span className={`${itemClass} text-muted`}>
                    {tile}
                    {b.name}
                    <Chip className="ml-auto">Soon</Chip>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="On this page" className="mt-8">
        <h2 className="px-2.5 text-xs font-medium text-muted">On this page</h2>
        <ul className="mt-2 space-y-0.5">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={`${itemClass} text-muted hover:bg-hover hover:text-ink`}>
                {s.label}
                {s.planned ? (
                  <Chip className="ml-auto">Soon</Chip>
                ) : (
                  s.count !== undefined && <span className="ml-auto font-mono text-xs">{s.count}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
