"use client";

import type { VariantView } from "@/lib/view";
import { useRovingTabs } from "./useRovingTabs";

export const variantTabId = (id: string) => `logo-variant-tab-${id}`;
export const VARIANT_PANEL_ID = "logo-variant-panel";

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
  const tabProps = useRovingTabs(variants.map((v) => v.id), active, onSelect);
  const current = variants.find((v) => v.id === active);

  return (
    <div className="mt-3 flex items-center gap-6 border-b border-hairline">
      <div role="tablist" aria-label={`${label} variants`} className="-mb-px flex min-w-0 gap-6 overflow-x-auto scrollbar-none">
        {variants.map((v) => (
          <button
            key={v.id}
            id={variantTabId(v.id)}
            aria-controls={VARIANT_PANEL_ID}
            {...tabProps(v.id)}
            className={`h-11 shrink-0 border-b-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-150 ease-out-soft focus-visible:outline-offset-[-2px] ${
              v.id === active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>
      {current && (
        <span className="ml-auto hidden shrink-0 font-mono text-xs text-muted md:block">{current.assets.svg.filename}</span>
      )}
    </div>
  );
}
