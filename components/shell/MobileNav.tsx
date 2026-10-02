"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { BrandNavItem } from "@/lib/content";
import { BrandList, OnThisPage, type PageSection } from "./NavLists";

/** Below 900px the sidebar moves into a sheet that drops down from the top bar. */
export function MobileNav({ brands, current, sections }: { brands: BrandNavItem[]; current: string; sections: PageSection[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    const root = document.documentElement;
    root.style.overflow = "hidden";
    // The sheet is only for narrow screens; close it if the window grows past the breakpoint.
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => {
      root.style.overflow = "";
      mq.removeEventListener("change", onChange);
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    // Keep focus inside the sheet and its toggle while it is open.
    const focusables = [buttonRef.current!, ...panelRef.current.querySelectorAll<HTMLElement>("a[href], button")];
    const first = focusables[0]!;
    const last = focusables.at(-1)!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div onKeyDown={open ? onKeyDown : undefined} className="min-[900px]:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => (open ? close(false) : setOpen(true))}
        className="grid size-8 place-items-center rounded-button-sm text-ink transition-colors duration-150 hover:bg-hover"
      >
        {open ? <X aria-hidden className="size-[18px]" /> : <Menu aria-hidden className="size-[18px]" />}
      </button>

      {open && (
        <>
          <div aria-hidden onClick={() => close(false)} className="fixed inset-x-0 bottom-0 top-16 z-30 animate-fade-in bg-ink/20" />
          <div
            ref={panelRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] animate-menu-in overflow-y-auto border-b border-hairline bg-surface px-4 pb-6 pt-5 shadow-menu"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <BrandList brands={brands} current={current} onNavigate={() => close(false)} />
              <OnThisPage sections={sections} onNavigate={() => close(false)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
