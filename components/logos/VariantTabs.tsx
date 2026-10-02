"use client";

import type { VariantView } from "@/lib/view";
import { SegmentedTabs } from "./SegmentedTabs";

export const variantTabId = (id: string) => `logo-variant-tab-${id}`;
export const VARIANT_PANEL_ID = "logo-variant-panel";

/** Compact variant switcher under the stage, with the current file name on the right. */
export function VariantTabs({
  label,
  variants,
  active,
  onSelect,
}: {
  label: string;
  variants: VariantView[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const current = variants.find((v) => v.id === active);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <SegmentedTabs
        label={`${label} variants`}
        controls={VARIANT_PANEL_ID}
        items={variants.map((v) => ({ id: v.id, tabId: variantTabId(v.id), label: v.name, dot: v.dot }))}
        active={active}
        onSelect={onSelect}
      />
      {current && <span className="ml-auto font-mono text-xs text-muted">{current.assets.svg.filename}</span>}
    </div>
  );
}
