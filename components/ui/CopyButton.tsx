"use client";

import type { ButtonHTMLAttributes } from "react";
import { copyText } from "@/lib/clipboard";
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

/** Copies the current page URL. */
export function CopyLinkButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const copy = useCopy();
  return <button type="button" onClick={() => copy(window.location.href, "link")} {...props} />;
}
