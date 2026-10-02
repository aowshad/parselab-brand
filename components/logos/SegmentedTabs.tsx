"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { isDark } from "@/lib/color";
import { useRovingTabs } from "./useRovingTabs";

export type Segment = { id: string; tabId: string; label: string; dot?: string };

/**
 * Segmented control with WAI-ARIA tabs semantics (arrow keys, Home/End). One indicator pill
 * slides under the active option; the options themselves don't animate. Labels never
 * truncate: when space runs out the track scrolls horizontally.
 */
export function SegmentedTabs({
  label,
  controls,
  items,
  active,
  onSelect,
}: {
  label: string;
  /** id of the tabpanel these tabs control. */
  controls: string;
  items: Segment[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const tabProps = useRovingTabs(items.map((i) => i.id), active, onSelect);
  const trackRef = useRef<HTMLDivElement>(null);
  // Measured position of the active option. Until it's known (first paint, before hydration)
  // the active option draws its own background, so nothing flashes.
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const el = track.querySelector<HTMLElement>('[aria-selected="true"]');
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [active, items]);

  // Only slide after the first placement, so the pill doesn't fly in on load.
  useLayoutEffect(() => {
    if (pill && !animate) requestAnimationFrame(() => setAnimate(true));
  }, [pill, animate]);

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={label}
      className="relative flex max-w-full overflow-x-auto rounded-segment bg-track p-1 scrollbar-none"
    >
      {pill && (
        <span
          aria-hidden
          style={{ width: pill.w, translate: `${pill.x}px 0` }}
          className={`pointer-events-none absolute left-0 top-1 h-8 rounded-segment-item bg-pill shadow-pill ${animate ? "motion-slide" : ""}`}
        />
      )}
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            id={item.tabId}
            aria-controls={controls}
            {...tabProps(item.id)}
            className={`motion-colors relative flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-segment-item px-3 text-small font-medium focus-visible:outline-offset-0 ${
              isActive ? "text-ink" : "text-muted hover:text-ink"
            } ${isActive && !pill ? "bg-pill shadow-pill" : ""}`}
          >
            {item.dot && (
              <span
                aria-hidden
                style={{ backgroundColor: item.dot }}
                // A hairline on dots close to the page's tone, so white (or black, in dark mode) still reads as a swatch.
                className={`size-2.5 shrink-0 rounded-full ${
                  isDark(item.dot) ? "dark:ring-1 dark:ring-inset dark:ring-ink/30" : "ring-1 ring-inset ring-ink/30 dark:ring-0"
                }`}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
