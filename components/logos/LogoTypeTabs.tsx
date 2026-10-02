"use client";

import type { LogoGroupView } from "@/lib/view";
import { SegmentedTabs } from "./SegmentedTabs";

export const typeTabId = (key: string) => `logo-type-tab-${key}`;
export const TYPE_PANEL_ID = "logo-type-panel";

export function LogoTypeTabs({ groups, active, onSelect }: { groups: LogoGroupView[]; active: string; onSelect: (key: string) => void }) {
  return (
    <SegmentedTabs
      label="Logo type"
      controls={TYPE_PANEL_ID}
      items={groups.map((g) => ({ id: g.key, tabId: typeTabId(g.key), label: g.label }))}
      active={active}
      onSelect={onSelect}
    />
  );
}
