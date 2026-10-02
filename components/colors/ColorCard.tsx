"use client";

import { Copy } from "lucide-react";
import type { ColorView } from "@/lib/view";
import { useCopy } from "../ui/CopyButton";

export function ColorCard({ color }: { color: ColorView }) {
  const copy = useCopy();
  // Narrow label column unless a long label (CMYK, Pantone) needs more room.
  const labelWidth = color.values.some((v) => v.label.length > 3) ? "w-16" : "w-9";

  return (
    <li className="overflow-hidden rounded-card border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => copy(color.copy.value, color.copy.label)}
        aria-label={`Copy ${color.name} ${color.copy.label === color.copy.value ? `hex ${color.copy.value}` : color.copy.label}`}
        style={{ background: color.swatch }}
        className={`group flex h-[168px] w-full flex-col justify-between p-4 text-left focus-visible:outline-current focus-visible:outline-offset-[-4px] ${
          color.darkSwatch ? "text-on-dark" : "text-ink"
        } ${color.faint ? "border-b border-hairline" : ""}`}
      >
        <span className="text-xs font-medium">{color.role}</span>
        <span className="flex items-end justify-between gap-2">
          <span className="text-lg font-semibold tracking-[-0.01em]">{color.name}</span>
          <Copy aria-hidden className="size-4 opacity-0 transition-opacity duration-150 group-hover:opacity-75 group-focus-visible:opacity-75" />
        </span>
      </button>

      <ul className="p-1.5">
        {color.values.map(({ label, value }) => (
          <li key={label}>
            <button
              type="button"
              // The CSS row's value is long, so the toast names it instead of repeating it.
              onClick={() => copy(value, label === "CSS" ? `${color.name} gradient CSS` : value)}
              aria-label={label === "CSS" ? `Copy ${color.name} gradient CSS` : `Copy ${color.name} ${label} ${value}`}
              className="group relative flex h-9 w-full items-center gap-3 rounded-[8px] px-2.5 text-left transition-colors duration-150 ease-out-soft hover:bg-hover focus-visible:outline-offset-0"
            >
              <span className={`${labelWidth} shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted`}>{label}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span>
              {/* Overlays the end of the row so it doesn't take width from the value. */}
              <span
                aria-hidden
                className="absolute inset-y-1.5 right-1.5 grid w-7 place-items-center rounded-[6px] bg-hover text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <Copy className="size-3.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}
