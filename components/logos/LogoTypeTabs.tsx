"use client";

import type { LogoGroupView } from "@/lib/view";
import { useRovingTabs } from "./useRovingTabs";

export const typeTabId = (key: string) => `logo-type-tab-${key}`;
export const TYPE_PANEL_ID = "logo-type-panel";

export function LogoTypeTabs({ groups, active, onSelect }: { groups: LogoGroupView[]; active: string; onSelect: (key: string) => void }) {
  const tabProps = useRovingTabs(groups.map((g) => g.key), active, onSelect);

  return (
    <div role="tablist" aria-label="Logo type" className="flex max-w-full overflow-x-auto rounded-segment bg-track p-1 scrollbar-none">
      {groups.map((g) => (
        <button
          key={g.key}
          id={typeTabId(g.key)}
          aria-controls={TYPE_PANEL_ID}
          {...tabProps(g.key)}
          className={`h-8 shrink-0 rounded-segment-item px-3.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease-out-soft focus-visible:outline-offset-0 ${
            g.key === active ? "bg-surface text-ink shadow-pill" : "text-muted hover:text-ink"
          }`}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
