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
  item.soon ? <Chip className="ml-auto">Soon</Chip> : item.count !== undefined ? <span className="ml-auto tabular-nums text-xs">{item.count}</span> : null;

/** Desktop: sticky "On this page" list. Hidden below 900px, where TocChips takes over. */
export function TocSidebar({ items }: { items: TocItem[] }) {
  const active = useActiveSection(items.map((i) => i.id));
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[248px] shrink-0 overflow-y-auto px-4 py-8 min-[900px]:block">
      <nav aria-label="On this page">
        <h2 className="px-2.5 text-xs font-medium text-muted">On this page</h2>
        <ul className="mt-2 space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={item.id === active ? "location" : undefined}
                className={`flex h-9 items-center gap-2.5 rounded-button-sm px-2.5 text-sm transition-colors duration-150 ease-out-soft ${
                  item.id === active ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink"
                }`}
              >
                {item.label}
                <Badge item={item} />
              </a>
            </li>
          ))}
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
      className="sticky top-16 z-30 border-b border-hairline bg-ground/85 backdrop-blur-md min-[900px]:hidden"
    >
      <ul className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              ref={(el) => {
                if (el) refs.current.set(item.id, el);
              }}
              href={`#${item.id}`}
              aria-current={item.id === active ? "location" : undefined}
              className={`flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150 ease-out-soft ${
                item.id === active
                  ? "border-ink bg-ink text-on-dark"
                  : "border-control bg-surface text-muted hover:text-ink"
              }`}
            >
              {item.label}
              {/* Full-strength muted text: 11px needs 4.5:1, so no opacity tricks here. */}
              {(item.soon || item.count !== undefined) && (
                <span className={`text-[11px] font-normal ${item.soon ? "" : "tabular-nums"} ${item.id === active ? "text-on-dark/75" : "text-muted"}`}>
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
