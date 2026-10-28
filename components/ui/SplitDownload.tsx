"use client";

import { ChevronDown, Download } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { formatSize } from "@/lib/format";
import type { FileRef } from "@/lib/files";
import { DownloadLink } from "./DownloadLink";

export type DownloadItem = { file: FileRef; label: string; detail: string; a11y: string; /** A heading shown before the first item of each group. */ group?: string };

/**
 * A main download plus a format menu (menu-button pattern). `onDark` sets the colors for a logo
 * stage (from `sm` up); without it the button is the page's primary button. `resetKey` closes
 * the menu when what it belongs to changes.
 */
export function SplitDownload({
  primary,
  items,
  menuLabel,
  onDark,
  resetKey,
  primaryProps,
}: {
  primary: { file: FileRef; label: string };
  items: DownloadItem[];
  menuLabel: string;
  onDark?: boolean;
  resetKey?: string;
  primaryProps?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // Which item to focus once the menu has rendered: "first", "last" or null.
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const menuId = useId();

  const openMenu = (focus: "first" | "last") => {
    focusOnOpen.current = focus;
    setOpen(true);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const els = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (focusOnOpen.current) els[focusOnOpen.current === "first" ? 0 : els.length - 1]?.focus();
    focusOnOpen.current = null;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // The menu belongs to one file set; close it when that changes.
  useEffect(() => setOpen(false), [resetKey]);

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowDown" ? "first" : "last");
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const els = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    const i = els.indexOf(document.activeElement as HTMLAnchorElement);
    const move = (to: number) => {
      e.preventDefault();
      els[(to + els.length) % els.length]?.focus();
    };
    switch (e.key) {
      case "ArrowDown":
        return move(i + 1);
      case "ArrowUp":
        return move(i - 1);
      case "Home":
        return move(0);
      case "End":
        return move(els.length - 1);
      case "Escape":
        e.preventDefault();
        return close(true);
      case "Tab":
        return close(false);
      case " ":
        // Anchors don't activate on Space by default; menu items should.
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.click();
    }
  };

  // Stage colors only apply from `sm` up: on phones the button sits under the stage, on the page.
  const tone = `bg-btn text-btn-ink hover:bg-btn-hover ${
    onDark === undefined
      ? ""
      : onDark
        ? "sm:bg-on-dark sm:text-on-light sm:hover:bg-on-dark/90 sm:focus-visible:outline-on-dark"
        : "sm:bg-on-light sm:text-on-dark sm:hover:bg-on-light/85 sm:focus-visible:outline-on-light"
  }`;
  const divider = `border-btn-ink/15 ${onDark === undefined ? "" : onDark ? "sm:border-on-light/10" : "sm:border-on-dark/15"}`;

  return (
    <div ref={rootRef} className="relative">
      <div className="flex rounded-button shadow-pill">
        <DownloadLink
          file={primary.file}
          feedback
          {...primaryProps}
          className={`motion-press inline-flex h-10 items-center gap-2 rounded-l-button pl-4 pr-3 text-small font-medium ${tone}`}
        >
          <Download aria-hidden className="size-4" />
          {primary.label}
        </DownloadLink>
        <button
          ref={triggerRef}
          type="button"
          aria-label="More download formats"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => (open ? close(false) : openMenu("first"))}
          onKeyDown={onTriggerKeyDown}
          className={`motion-press grid h-10 w-10 place-items-center rounded-r-button border-l ${tone} ${divider}`}
        >
          <ChevronDown
            aria-hidden
            className={`size-4 transition-[rotate] duration-(--dur-base) ease-out ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          onKeyDown={onMenuKeyDown}
          className="absolute bottom-full right-0 z-20 mb-2 w-[min(17rem,calc(100vw-3rem))] origin-bottom-right animate-menu-in rounded-[12px] border border-hairline bg-surface p-2 text-ink shadow-menu"
        >
          {items.map((item, i) => (
            <div key={item.file.filename}>
              {item.group && item.group !== items[i - 1]?.group && (
                <p aria-hidden className="mt-1 border-t border-hairline px-2 pb-1 pt-3 text-caption uppercase tracking-[0.06em] text-muted">
                  {item.group}
                </p>
              )}
              <DownloadLink
                ref={(el: HTMLAnchorElement | null) => {
                  itemRefs.current[i] = el;
                }}
                file={item.file}
                role="menuitem"
                aria-label={item.a11y}
                tabIndex={-1}
                onClick={() => close(true)}
                className="motion-colors flex h-9 items-center gap-3 rounded-[8px] px-2 text-small outline-none hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
              >
                <span className="font-medium tabular-nums">{item.label}</span>
                <span className="text-caption text-muted tabular-nums">{item.detail}</span>
                <span className="ml-auto text-caption tabular-nums text-muted">{formatSize(item.file.sizeKb)}</span>
              </DownloadLink>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
