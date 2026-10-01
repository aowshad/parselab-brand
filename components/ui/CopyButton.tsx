"use client";

import type { ButtonHTMLAttributes } from "react";
import { copyText } from "@/lib/clipboard";
import { useToast } from "./Toast";

export function useCopy() {
  const toast = useToast();
  return async (text: string, label = text) => {
    const ok = await copyText(text);
    toast(ok ? `Copied ${label}` : "Couldn't copy. Your browser blocked clipboard access.", ok ? "success" : "error");
  };
}

/** Copies the current page URL. */
export function CopyLinkButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const copy = useCopy();
  return <button type="button" onClick={() => copy(window.location.href, "link")} {...props} />;
}
