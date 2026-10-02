"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ColorView } from "@/lib/view";
import { useCopy } from "../ui/CopyButton";

const COPIED_MS = 1500;
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const hairline = "shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]";
/** Frosted, so it reads on any color. */
const frosted = "bg-white/85 text-ink shadow-pill backdrop-blur-[8px]";

/** Copies a hex and remembers which one, for a 1.5s "Copied" state. */
function useCopied() {
  const copy = useCopy();
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = async (hex: string) => {
    if (!(await copy(hex))) return;
    clearTimeout(timer.current);
    setCopied(hex);
    timer.current = setTimeout(() => setCopied(null), COPIED_MS);
  };
  return { copied, run };
}

/** One palette color: pure swatch, then role and name. No text is drawn on the color. */
export function ColorCard({ color }: { color: ColorView }) {
  const { copied, run } = useCopied();

  return (
    <li className="flex h-full flex-col rounded-card border border-hairline bg-surface">
      {color.kind === "solid" ? (
        <button
          type="button"
          onClick={() => run(color.hex)}
          aria-label={`Copy hex ${color.hex}`}
          style={{ background: color.hex }}
          className={`group relative h-24 w-full shrink-0 rounded-t-[15px] sm:h-28 ${hairline} ${focusRing}`}
        >
          {/* Hover/focus only, so touch devices show nothing extra; a tap still copies and toasts. */}
          <span
            aria-hidden
            className={`absolute bottom-2.5 right-2.5 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 tabular-nums text-xs opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${frosted}`}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? <span className="font-medium">Copied</span> : color.hex}
          </span>
        </button>
      ) : (
        <div aria-hidden style={{ background: color.css }} className={`h-24 w-full shrink-0 rounded-t-[15px] sm:h-28 ${hairline}`} />
      )}

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{color.role}</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <p className="text-base font-semibold tracking-[-0.01em]">{color.name}</p>
          {color.kind === "solid" && (
            <button
              type="button"
              onClick={() => run(color.hex)}
              aria-label={`Copy hex ${color.hex}`}
              className={`shrink-0 rounded-[6px] tabular-nums text-[13px] text-muted transition-colors duration-150 hover:text-ink ${focusRing}`}
            >
              {color.hex}
            </button>
          )}
        </div>

        {color.kind === "gradient" && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${color.name} stops`}>
            {color.stops.map((hex, i) => (
              <li key={`${i}-${hex}`}>
                <button
                  type="button"
                  onClick={() => run(hex)}
                  aria-label={`Copy hex ${hex}`}
                  style={{ background: hex }}
                  className={`group relative block size-7 rounded-[7px] ${hairline} ${focusRing}`}
                >
                  <span
                    aria-hidden
                    // Dark and below the chip: a frosted tooltip would vanish on the white card, and above it would cover the name.
                    className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-ink px-2 py-1 tabular-nums text-[11px] text-on-dark opacity-0 shadow-pill transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    {copied === hex ? (
                      <>
                        <Check className="size-3" />
                        <span className="font-medium">Copied</span>
                      </>
                    ) : (
                      hex
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
