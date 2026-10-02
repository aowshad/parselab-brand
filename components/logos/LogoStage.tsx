"use client";

import { Grid2x2 } from "lucide-react";
import { withBase } from "@/lib/paths";
import type { VariantView } from "@/lib/view";
import { DownloadSplitButton } from "./DownloadSplitButton";

/** Box the logo is scaled into. Wide lockups get more width, compact marks more air. */
function logoBox(v: VariantView) {
  const wide = v.assets.svg.width / v.assets.svg.height >= 2;
  const [x, y] = wide ? [20, 28] : [24, 24];
  return { left: `${x}%`, top: `${y}%`, width: `${100 - 2 * x}%`, height: `${100 - 2 * y}%` };
}

export function LogoStage({
  brandName,
  groupLabel,
  variants,
  active,
  transparent,
  onToggleTransparent,
}: {
  brandName: string;
  groupLabel: string;
  variants: VariantView[];
  active: VariantView;
  transparent: boolean;
  onToggleTransparent: () => void;
}) {
  // The checkerboard follows the variant's tone, so dark-stage logos stay dark-on-dark.
  const onDark = active.darkStage;
  // Below 640px the controls sit in a toolbar under the stage (a 16:9 stage is too short to
  // overlay them without covering the logo), so the on-stage colors only apply from `sm` up.
  const chrome = onDark
    ? "sm:bg-on-dark/10 sm:text-on-dark sm:hover:bg-on-dark/20 sm:focus-visible:outline-on-dark sm:border-transparent"
    : "sm:bg-ink/5 sm:hover:bg-ink/10 sm:border-transparent";

  return (
    <div className="relative">
      <div className="relative aspect-video">
        <div
          className={`absolute inset-0 overflow-hidden rounded-stage border transition-[border-color] duration-[400ms] ${
            onDark ? "border-transparent" : "border-hairline"
          }`}
        >
          <div
            className="absolute inset-0 transition-[background-color] duration-[400ms] ease-out-soft"
            style={{ backgroundColor: active.previewBg }}
          />
          <div
            className={`absolute inset-0 checkerboard transition-opacity duration-300 ease-out-soft ${onDark ? "checkerboard-dark" : ""} ${
              transparent ? "opacity-100" : "opacity-0"
            }`}
          />
          {/* All variants of the group stay mounted so switching is an instant crossfade. */}
          {variants.map((v) => {
            const isActive = v.id === active.id;
            return (
              <img
                key={v.id}
                src={withBase(v.assets.svg.path)}
                alt={isActive ? `${brandName} ${groupLabel}, ${v.name}` : ""}
                aria-hidden={!isActive}
                width={v.assets.svg.width}
                height={v.assets.svg.height}
                decoding="async"
                fetchPriority={isActive ? "high" : "low"}
                draggable={false}
                className={`absolute object-contain transition-opacity duration-300 ease-out-soft ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
                style={logoBox(v)}
              />
            );
          })}
        </div>
      </div>

      {/* `sm:contents` lifts these back onto the stage as absolutely positioned overlays. */}
      <div className="mt-3 flex items-center justify-between gap-3 sm:contents">
        <button
          type="button"
          aria-pressed={transparent}
          aria-keyshortcuts="T"
          title="Show transparency (T)"
          onClick={onToggleTransparent}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-control bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 ease-out-soft hover:bg-hover sm:absolute sm:right-4 sm:top-4 sm:backdrop-blur-sm ${chrome}`}
        >
          <Grid2x2 aria-hidden className="size-3.5" />
          Transparent
        </button>

        <div className="sm:absolute sm:bottom-4 sm:right-4">
          <DownloadSplitButton variant={active} onDark={onDark} />
        </div>
      </div>
    </div>
  );
}
