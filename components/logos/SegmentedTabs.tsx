"use client";

import { isDark } from "@/lib/color";
import { useRovingTabs } from "./useRovingTabs";

export type Segment = { id: string; tabId: string; label: string; dot?: string };

/**
 * Segmented control with WAI-ARIA tabs semantics (arrow keys, Home/End). Labels never
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

  return (
    <div role="tablist" aria-label={label} className="flex max-w-full overflow-x-auto rounded-segment bg-track p-1 scrollbar-none">
      {items.map((item) => (
        <button
          key={item.id}
          id={item.tabId}
          aria-controls={controls}
          {...tabProps(item.id)}
          className={`flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-segment-item px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease-out-soft focus-visible:outline-offset-0 ${
            item.id === active ? "bg-surface text-ink shadow-pill" : "text-muted hover:text-ink"
          }`}
        >
          {item.dot && (
            <span
              aria-hidden
              style={{ backgroundColor: item.dot }}
              // Light dots get a hairline so white still reads as a swatch.
              className={`size-2.5 shrink-0 rounded-full ${isDark(item.dot) ? "" : "ring-1 ring-inset ring-ink/30"}`}
            />
          )}
          {item.label}
        </button>
      ))}
    </div>
  );
}
