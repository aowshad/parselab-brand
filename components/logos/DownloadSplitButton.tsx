"use client";

import { formatSize } from "@/lib/format";
import type { VariantView } from "@/lib/view";
import { SplitDownload } from "../ui/SplitDownload";

/**
 * "Download SVG" plus a format menu. On the stage it contrasts with the variant's background
 * (`onDark` makes it white); under the stage, on phones, it's the page's primary button.
 */
export function DownloadSplitButton({ variant, onDark }: { variant: VariantView; onDark: boolean }) {
  const { svg, png } = variant.assets;
  // PNG-only logos: the main button downloads the largest PNG and the menu lists PNGs only.
  const primary = svg ?? png.at(-1)!;
  const primaryLabel = svg ? "Download SVG" : "Download PNG";
  const items = [
    ...(svg ? [{ file: svg, label: "SVG", detail: "Any size", a11y: `SVG, any size, ${formatSize(svg.sizeKb)}` }] : []),
    ...png.map((p) => ({
      file: p,
      label: `${p.size}px`,
      detail: `${p.width} × ${p.height}`,
      a11y: `PNG, transparent, ${p.width} by ${p.height} pixels, ${formatSize(p.sizeKb)}`,
      group: "PNG · Transparent",
    })),
  ];
  return (
    <SplitDownload
      primary={{ file: primary, label: primaryLabel }}
      items={items}
      menuLabel={`Download ${variant.name}`}
      onDark={onDark}
      resetKey={variant.id}
      primaryProps={{ "data-primary-download": "", "aria-keyshortcuts": "D", title: `${primaryLabel} (D)` }}
    />
  );
}
