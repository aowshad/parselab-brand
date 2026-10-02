"use client";

import { Download, Info } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  const sectionRef = useRef<HTMLElement>(null);

  const group = groups.find((g) => g.key === groupKey) ?? groups[0]!;
  const variant = group.variants.find((v) => v.id === selected[group.key]) ?? group.variants[0]!;
  const allVariants = groups.flatMap((g) => g.variants);

  // Deep link: ?logo=<groupKey>&variant=<variantId> selects that tab on load.
  // Either param alone works; unknown values are ignored.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const logo = params.get("logo");
    const variantId = params.get("variant");
    const target =
      groups.find((g) => g.key === logo) ?? groups.find((g) => g.variants.some((v) => v.id === variantId));
    if (!target) return;
    setGroupKey(target.key);
    if (target.variants.some((v) => v.id === variantId)) setSelected((s) => ({ ...s, [target.key]: variantId! }));
    if (!window.location.hash) sectionRef.current?.scrollIntoView();
  }, [groups]);

  // Keep the URL shareable without adding history entries or scrolling.
  const syncUrl = (logo: string, variantId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("logo", logo);
    url.searchParams.set("variant", variantId);
    window.history.replaceState(window.history.state, "", url);
  };

  const selectGroup = (key: string) => {
    setGroupKey(key);
    const g = groups.find((x) => x.key === key)!;
    syncUrl(key, selected[key] ?? g.variants[0]!.id);
  };

  const selectVariant = (id: string) => {
    setSelected((s) => ({ ...s, [group.key]: id }));
    syncUrl(group.key, id);
  };

  // Single-key shortcuts, active only while focus is inside this section (WCAG 2.1.4).
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('[role="menu"], input, textarea')) return;
    const key = e.key.toLowerCase();
    if (key === "t") {
      e.preventDefault();
      setTransparent((t) => !t);
    } else if (key === "d") {
      e.preventDefault();
      sectionRef.current?.querySelector<HTMLAnchorElement>("[data-primary-download]")?.click();
    }
  };

  return (
    <section
      ref={sectionRef}
      id="logos"
      aria-labelledby="logos-heading"
      onKeyDown={onKeyDown}
      className="mt-16"
    >
      {/* Same header layout as components/sections/Section, plus the ref and shortcut handler this section needs. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 id="logos-heading" className="text-h2 text-balance">
            Logos
          </h2>
          <p className="mt-1 text-small text-muted">Every file in SVG and transparent PNG.</p>
        </div>
        {groups.length > 1 && <LogoTypeTabs groups={groups} active={group.key} onSelect={selectGroup} />}
      </div>

      {/* With a single logo type there are no type tabs, so this is a plain block. */}
      <div
        id={TYPE_PANEL_ID}
        role={groups.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={groups.length > 1 ? typeTabId(group.key) : undefined}
        className="mt-6"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <Stack
            items={groups}
            getKey={(g) => g.key}
            isActive={(g) => g.key === group.key}
            className="min-w-0 grow basis-64"
            render={(g) => (
              <>
                <h3 className="text-h3">{g.label}</h3>
                <p className="text-small text-pretty text-muted">{g.description}</p>
              </>
            )}
          />
          <DownloadLink
            file={group.zip}
            feedback
            aria-label={`Download all ${group.label} files, ZIP, ${formatSize(group.zip.sizeKb)}`}
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            <Download aria-hidden className="size-4" />
            Download all
            <span className="tabular-nums text-muted">· ZIP · {formatSize(group.zip.sizeKb)}</span>
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
          onSelect={selectVariant}
        />

        <Stack
          items={allVariants}
          getKey={(v) => v.id}
          isActive={(v) => v.id === variant.id}
          className="mt-3"
          render={(v) => (
            <p className="flex gap-2 text-small text-pretty text-muted">
              <Info aria-hidden className="mt-[2px] size-4 shrink-0" />
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
