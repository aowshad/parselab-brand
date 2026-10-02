"use client";

import { useEffect, useState } from "react";
import type { BrandNavItem } from "@/lib/content";
import { withBase } from "@/lib/paths";
import { Chip } from "../ui/Chip";

export type PageSection = { id: string; label: string; count?: number; planned?: boolean };

const itemClass =
  "flex h-9 items-center gap-2.5 rounded-button-sm px-2.5 text-sm transition-colors duration-150 ease-out-soft";

export function BrandList({ brands, current, onNavigate }: { brands: BrandNavItem[]; current: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Brands">
      <h2 className="px-2.5 text-xs font-medium text-muted">Brands</h2>
      <ul className="mt-2 space-y-0.5">
        {brands.map((b) => {
          const active = b.slug === current;
          const tile = (
            <span
              aria-hidden
              className={`grid size-6 shrink-0 place-items-center rounded-[7px] text-[11px] font-semibold ${
                active ? "bg-ink text-on-dark" : "bg-track text-ink"
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
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`${itemClass} ${active ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink"}`}
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
  );
}

/** Highlights the section in view. IntersectionObserver triggers a recompute as sections cross the viewport. */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string>();
  const idKey = ids.join(" ");

  useEffect(() => {
    const els = idKey
      .split(" ")
      .map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    const footer = document.querySelector("footer");
    if (!els.length) return;

    let frame = 0;
    const compute = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = 64 + window.innerHeight * 0.35;
        const atBottom = footer && footer.getBoundingClientRect().top < window.innerHeight;
        // Near the bottom, short trailing sections can't reach the line: pick the last one on screen.
        const passed = els.filter((el) => el.getBoundingClientRect().top <= (atBottom ? window.innerHeight - 40 : line));
        setActive((passed.at(-1) ?? els[0]!).id);
      });
    };

    const io = new IntersectionObserver(compute, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    els.forEach((el) => io.observe(el));
    if (footer) io.observe(footer);
    compute();
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [idKey]);

  return active;
}

export function OnThisPage({ sections, onNavigate }: { sections: PageSection[]; onNavigate?: () => void }) {
  const active = useActiveSection(sections.map((s) => s.id));

  return (
    <nav aria-label="On this page">
      <h2 className="px-2.5 text-xs font-medium text-muted">On this page</h2>
      <ul className="mt-2 space-y-0.5">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={onNavigate}
                className={`${itemClass} ${isActive ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink"}`}
              >
                {s.label}
                {s.planned ? (
                  <Chip className="ml-auto">Soon</Chip>
                ) : (
                  s.count !== undefined && <span className="ml-auto font-mono text-xs">{s.count}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
