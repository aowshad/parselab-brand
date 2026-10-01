"use client";

import { Download, Info } from "lucide-react";
import { useState } from "react";
import { formatSize } from "@/lib/format";
import type { LogoGroupView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";
import { LogoStage } from "./LogoStage";
import { LogoTypeTabs, TYPE_PANEL_ID, typeTabId } from "./LogoTypeTabs";
import { Stack } from "./Stack";
import { VARIANT_PANEL_ID, VariantTabs, variantTabId } from "./VariantTabs";

export function LogoSection({ brandName, groups }: { brandName: string; groups: LogoGroupView[] }) {
  const [groupKey, setGroupKey] = useState(groups[0]!.key);
  // Selected variant per logo type, so switching types and back keeps your place.
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, g.variants[0]!.id])),
  );
  const [transparent, setTransparent] = useState(false);

  const group = groups.find((g) => g.key === groupKey) ?? groups[0]!;
  const variant = group.variants.find((v) => v.id === selected[group.key]) ?? group.variants[0]!;
  const allVariants = groups.flatMap((g) => g.variants);

  return (
    <section id="logos" aria-labelledby="logos-heading" className="mt-16 scroll-mt-24 sm:mt-20">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 id="logos-heading" className="text-2xl font-semibold tracking-[-0.02em]">
            Logos
          </h2>
          <p className="mt-1 text-sm text-muted">Every file in SVG and transparent PNG.</p>
        </div>
        <LogoTypeTabs groups={groups} active={group.key} onSelect={setGroupKey} />
      </div>

      <div id={TYPE_PANEL_ID} role="tabpanel" aria-labelledby={typeTabId(group.key)} className="mt-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <Stack
            items={groups}
            getKey={(g) => g.key}
            isActive={(g) => g.key === group.key}
            className="min-w-0 grow basis-64"
            render={(g) => (
              <>
                <h3 className="font-semibold">{g.label}</h3>
                <p className="mt-0.5 text-sm text-muted">{g.description}</p>
              </>
            )}
          />
          <DownloadLink file={group.zip} className={buttonClass({ variant: "ghost", size: "sm" })}>
            <Download aria-hidden className="size-3.5" />
            All {group.label} files
            <span className="font-mono text-xs text-muted">.zip · {formatSize(group.zip.sizeKb)}</span>
          </DownloadLink>
        </div>

        <div id={VARIANT_PANEL_ID} role="tabpanel" aria-labelledby={variantTabId(variant.id)}>
          <LogoStage
            brandName={brandName}
            groupLabel={group.label}
            variants={group.variants}
            active={variant}
            transparent={transparent}
            onToggleTransparent={() => setTransparent((t) => !t)}
          />
        </div>

        <VariantTabs
          label={group.label}
          variants={group.variants}
          active={variant.id}
          onSelect={(id) => setSelected((s) => ({ ...s, [group.key]: id }))}
        />

        <Stack
          items={allVariants}
          getKey={(v) => v.id}
          isActive={(v) => v.id === variant.id}
          className="mt-4"
          render={(v) => (
            <p className="flex gap-2 text-sm text-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="sr-only">Usage: </span>
                {v.usage}
              </span>
            </p>
          )}
        />
      </div>
    </section>
  );
}
