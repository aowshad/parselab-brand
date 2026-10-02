"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type FeedbackState = "idle" | "busy" | "done";

const BUSY_MS = 450;
const DONE_MS = 1500;

/** idle → (busy →) done → idle, for "✓ Copied" / spinner → "✓ Downloaded" button states. */
export function useFeedback() {
  const [state, setState] = useState<FeedbackState>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => timers.current.splice(0).forEach(clearTimeout);
  useEffect(() => clear, []);

  const run = (withBusy: boolean) => {
    clear();
    setState(withBusy ? "busy" : "done");
    if (withBusy) timers.current.push(setTimeout(() => setState("done"), BUSY_MS));
    timers.current.push(setTimeout(() => setState("idle"), (withBusy ? BUSY_MS : 0) + DONE_MS));
  };
  return { state, run };
}

/**
 * Swaps a button's content for a status without changing its width: every state is
 * rendered in the same grid cell and only the current one is visible, cross-fading.
 */
export function FeedbackLabel({ state, doneLabel, children }: { state: FeedbackState; doneLabel: React.ReactNode; children: React.ReactNode }) {
  const layer = (visible: boolean) =>
    `motion-fade col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${visible ? "opacity-100" : "opacity-0"}`;
  return (
    <span className="grid">
      <span className={layer(state === "idle")} aria-hidden={state !== "idle"}>
        {children}
      </span>
      <span className={layer(state === "busy")} aria-hidden>
        <LoaderCircle className="size-4 animate-spin" />
      </span>
      <span className={layer(state === "done")} aria-hidden={state !== "done"}>
        <Check className="size-4" />
        {doneLabel}
      </span>
    </span>
  );
}
