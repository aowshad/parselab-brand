"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ColorView } from "@/lib/view";
import { useCopy } from "../ui/CopyButton";

const COPIED_MS = 1500;
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * One palette color. No text is drawn on the color itself: the swatch is pure fill and every
 * label lives in the info area, so the card works for any hex or gradient.
 */
export function ColorCard({ color }: { color: ColorView }) {
  const copy = useCopy();
  // Which control just copied: "swatch" or a row label. Shows a check for 1.5s.
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async (key: string, value: string, toastLabel?: string) => {
    if (!(await copy(value, toastLabel ?? value))) return;
    clearTimeout(timer.current);
    setCopied(key);
    timer.current = setTimeout(() => setCopied(null), COPIED_MS);
  };

  const { text } = color;

  return (
    <li className="flex h-full flex-col rounded-card border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => run("swatch", color.copy.value, color.copy.toastLabel)}
        aria-label={color.copy.action}
        style={{ background: color.swatch }}
        className={`group relative h-24 w-full shrink-0 rounded-t-[15px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] sm:h-28 ${focusRing}`}
      >
        {/* Frosted so it stays readable on any color; hover/focus only, so touch shows nothing extra. */}
        <span
          aria-hidden
          className="absolute bottom-2.5 right-2.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-white/85 px-2.5 text-xs font-medium text-ink opacity-0 shadow-pill backdrop-blur-[8px] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {copied === "swatch" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied === "swatch" ? "Copied" : color.copy.chip}
        </span>
      </button>

      <div className="flex flex-1 flex-col p-4 pt-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{color.role}</p>
        <p className="mt-0.5 text-base font-semibold tracking-[-0.01em]">{color.name}</p>

        <ul className="-mx-2 mt-3 space-y-0.5">
          {color.rows.map((row) => (
            <li key={row.label}>
              <button
                type="button"
                onClick={() => run(row.label, row.value, row.toastLabel)}
                aria-label={row.action}
                className={`group relative grid w-full grid-cols-[minmax(44px,auto)_1fr] items-start gap-x-2 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-150 ease-out-soft hover:bg-hover focus-visible:bg-hover ${focusRing}`}
              >
                <span className="text-[11px] font-semibold uppercase leading-5 tracking-[0.06em] text-muted">{row.label}</span>
                {/* Never truncated: long values (gradient CSS) wrap, at spaces first. */}
                <span className="flex min-w-0 items-start gap-1.5 font-mono text-[13px] leading-5 [overflow-wrap:anywhere]">
                  {row.dot && (
                    <span
                      aria-hidden
                      style={{ backgroundColor: row.dot }}
                      className="mt-[5px] size-2.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]"
                    />
                  )}
                  {row.value}
                </span>
                {/* Overlays the row's end so it doesn't take width from the value. */}
                <span
                  aria-hidden
                  className={`absolute right-1 top-1 grid size-6 place-items-center rounded-[6px] bg-hover transition-opacity duration-150 ${
                    copied === row.label ? "text-success opacity-100" : "text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  }`}
                >
                  {copied === row.label ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Pushed to the bottom so the divider lines up across cards of different heights. */}
        <div className="mt-auto pt-3">
          <p className="flex items-center gap-2 border-t border-hairline pt-3 text-[13px]">
            <span className="sr-only">
              {`Recommended text on ${color.name}: ${text.label}, contrast ${text.ratio}${text.worstCase ? " at the lowest stop" : ""}, ${
                text.rating === "Fail" ? "fails WCAG" : `WCAG ${text.rating}`
              }`}
            </span>
            <span aria-hidden className="w-11 shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Text
            </span>
            <span
              aria-hidden
              style={{ background: color.text.sample, color: text.color }}
              className="grid h-5 w-7 shrink-0 place-items-center rounded-[5px] text-[10px] font-semibold shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]"
            >
              Aa
            </span>
            <span aria-hidden className="text-ink">
              {text.label}
              <span className="text-muted">
                {" · "}
                <span className="font-mono">{text.ratio.toFixed(1)}</span>
                {text.worstCase && " min"}
                {" · "}
              </span>
              <span className={text.rating === "Fail" ? "text-muted" : "font-medium"}>{text.rating}</span>
            </span>
          </p>
        </div>
      </div>
    </li>
  );
}
