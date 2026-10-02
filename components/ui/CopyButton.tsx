"use client";

import { Link2 } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { FeedbackLabel, useFeedback } from "./Feedback";
import { useToast } from "./Toast";

export function useCopy() {
  const toast = useToast();
  /** Copies `text`, toasts "Copied <label>", and resolves to whether it worked. */
  return async (text: string, label = text): Promise<boolean> => {
    const ok = await copyText(text);
    toast(ok ? `Copied ${label}` : "Couldn't copy. Your browser blocked clipboard access.", ok ? "success" : "error");
    return ok;
  };
}

/** Copies the current page URL; the label turns into "✓ <doneLabel>" for 1.5s without changing width. */
export function CopyLinkButton({ className, doneLabel = "Copied" }: { className?: string; doneLabel?: string }) {
  const copy = useCopy();
  const { state, run } = useFeedback();
  return (
    <button type="button" className={className} onClick={async () => (await copy(window.location.href, "link")) && run(false)}>
      <FeedbackLabel state={state} doneLabel={doneLabel}>
        <Link2 aria-hidden className="size-4" />
        Copy link
      </FeedbackLabel>
    </button>
  );
}
