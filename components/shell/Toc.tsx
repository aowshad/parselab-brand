"use client";

import { useEffect, useRef, useState } from "react";
import { Chip } from "../ui/Chip";

export type TocItem = { id: string; label: string; count?: number; soon?: boolean };

/** The section in view. IntersectionObserver triggers a recompute as sections cross the viewport. */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string>();
  const idKey = ids.join(" ");

  useEffect(() => {
    const els = idKey
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const footer = document.querySelector("footer");
    if (!els.length) return;

    let frame = 0;
    // After a TOC click, keep that item highlighted even if the page can't scroll it to the
    // top (short sections near the bottom), until the user scrolls on their own.
    let pinned: string | null = null;
    const compute = () => {
      if (pinned) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.35;
        const atBottom = footer && footer.getBoundingClientRect().top < window.innerHeight;
        // Near the bottom, short trailing sections can't reach the line: pick the last one on screen.
        const passed = els.filter((el) => el.getBoundingClientRect().top <= (atBottom ? window.innerHeight - 40 : line));
        setActive((passed.at(-1) ?? els[0]!).id);
      });
    };

    const onHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!els.some((el) => el.id === id)) return;
      pinned = id;
      setActive(id);
    };
    const unpin = () => {
      if (!pinned) return;
      pinned = null;
      compute();
    };
    const userScroll = ["wheel", "touchmove", "keydown"] as const;

    const io = new IntersectionObserver(compute, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    els.forEach((el) => io.observe(el));
    if (footer) io.observe(footer);
    window.addEventListener("hashchange", onHash);
    userScroll.forEach((t) => window.addEventListener(t, unpin, { passive: true }));
    compute();
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHash);
      userScroll.forEach((t) => window.removeEventListener(t, unpin));
    };
  }, [idKey]);

  return active;
}

const Badge = ({ item }: { item: TocItem }) =>
  item.soon ? (
    <Chip className="ml-auto">Soon</Chip>
  ) : item.count !== undefined ? (
    <span className="ml-auto text-caption tabular-nums text-muted">{item.count}</span>
  ) : null;

/**
 * Desktop: sticky "On this page" list. One highlight slides between rows (translateY) as the
 * scroll-spy moves; the rows themselves don't animate. Hidden below 900px, where TocChips takes over.
 */
export function TocSidebar({ items }: { items: TocItem[] }) {
  const active = useActiveSection(items.map((i) => i.id));
  const index = Math.max(0, items.findIndex((i) => i.id === active));
  const ROW = 32;
  const GAP = 4;

  return (
    <aside className="sticky top-20 hidden self-start pt-12 min-[900px]:block">
      <nav aria-label="On this page">
        <h2 className="px-2 text-caption text-muted">On this page</h2>
        <ul className="relative mt-2 flex flex-col gap-1">
          <li
            aria-hidden
            style={{ translate: `0 ${index * (ROW + GAP)}px`, opacity: active ? 1 : 0 }}
            className="motion-slide pointer-events-none absolute inset-x-0 top-0 h-8 rounded-[6px] bg-hover"
          />
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <li key={item.id} className="relative">
                <a
                  href={`#${item.id}`}
                  aria-current={isActive ? "location" : undefined}
                  className={`motion-colors flex h-8 items-center gap-2 rounded-[6px] px-2 text-small ${
                    isActive ? "font-medium text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                  <Badge item={item} />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/** Mobile: the same items as a sticky, horizontally scrolling chip row under the navbar. */
export function TocChips({ items }: { items: TocItem[] }) {
  const active = useActiveSection(items.map((i) => i.id));
  const refs = useRef(new Map<string, HTMLAnchorElement>());

  // Keep the active chip visible as the page scrolls.
  useEffect(() => {
    if (active) refs.current.get(active)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-14 z-30 border-b border-hairline bg-ground/85 backdrop-blur-[12px] min-[900px]:hidden"
    >
      <ul className="container-page flex gap-2 overflow-x-auto py-2 scrollbar-none">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              ref={(el) => {
                if (el) refs.current.set(item.id, el);
              }}
              href={`#${item.id}`}
              aria-current={item.id === active ? "location" : undefined}
              className={`motion-colors flex h-8 items-center gap-2 rounded-full border px-3 text-small font-medium ${
                item.id === active
                  ? "border-ink bg-ink text-on-dark"
                  : "border-control bg-surface text-muted hover:text-ink"
              }`}
            >
              {item.label}
              {/* Full-strength muted text: 11px needs 4.5:1, so no opacity tricks here. */}
              {(item.soon || item.count !== undefined) && (
                <span className={`text-caption font-normal tabular-nums ${item.id === active ? "text-on-dark/75" : "text-muted"}`}>
                  {item.soon ? "Soon" : item.count}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
