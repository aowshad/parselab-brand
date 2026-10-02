"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ColorView } from "@/lib/view";
import { useCopy } from "../ui/CopyButton";

const COPIED_MS = 1500;
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
/** Inset edge, so dark colors stay visible on a dark page (and light ones on a light page). */
const hairline = "shadow-[inset_0_0_0_1px_var(--swatch-edge)]";
/** Frosted, so it reads on any color. */
const frosted = "bg-chip text-chip-ink shadow-pill backdrop-blur-[8px]";

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

/** ⧉ cross-fades to ✓ (--dur-base) while a copy is confirmed. */
function CrossfadeIcon({ done }: { done: boolean }) {
  return (
    <span className="grid">
      <Copy className={`motion-fade col-start-1 row-start-1 size-3.5 ${done ? "opacity-0" : "opacity-100"}`} />
      <Check className={`motion-fade col-start-1 row-start-1 size-3.5 ${done ? "opacity-100" : "opacity-0"}`} />
    </span>
  );
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
            className={`motion-fade absolute bottom-3 right-3 inline-flex h-7 items-center gap-2 rounded-full px-3 tabular-nums text-caption opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 ${frosted}`}
          >
            <CrossfadeIcon done={copied !== null} />
            {copied ? <span className="font-medium">Copied</span> : color.hex}
          </span>
        </button>
      ) : (
        <div aria-hidden style={{ background: color.css }} className={`h-24 w-full shrink-0 rounded-t-[15px] sm:h-28 ${hairline}`} />
      )}

      <div className="flex flex-1 flex-col p-4">
        <p className="text-caption uppercase tracking-[0.06em] text-muted">{color.role}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-h3">{color.name}</p>
          {color.kind === "solid" && (
            <button
              type="button"
              onClick={() => run(color.hex)}
              aria-label={`Copy hex ${color.hex}`}
              className={`motion-colors shrink-0 rounded-[6px] tabular-nums text-small text-muted hover:text-ink ${focusRing}`}
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
                    // Inverted and below the chip: a frosted tooltip would vanish on the card, and above it would cover the name.
                    className="motion-fade pointer-events-none absolute left-1/2 top-full z-10 mt-2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-btn px-2 py-1 tabular-nums text-caption text-btn-ink opacity-0 shadow-pill group-hover:opacity-100 group-focus-visible:opacity-100"
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
