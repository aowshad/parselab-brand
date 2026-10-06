"use client";

import { ArrowUpRight, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { logout } from "@/app/admin/actions";

const item = "motion-colors flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-small text-ink outline-none hover:bg-hover focus-visible:bg-hover";

/** Avatar button + menu (menu-button pattern): Account, View site ↗, Log out. */
export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const els = items();
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Account menu for ${email}`}
        onClick={() => setOpen((o) => !o)}
        className="motion-colors grid size-8 place-items-center rounded-full border border-hairline bg-track text-caption font-semibold uppercase text-ink hover:border-strong"
      >
        {email.charAt(0)}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-50 mt-2 w-60 animate-menu-in rounded-[12px] border border-hairline bg-surface p-2 shadow-menu"
        >
          <p className="truncate px-2 pb-2 pt-1 text-caption text-muted">{email}</p>
          <Link role="menuitem" tabIndex={-1} href="/admin/account/" onClick={() => setOpen(false)} className={item}>
            <UserRound aria-hidden className="size-4 text-muted" /> Account
          </Link>
          <a role="menuitem" tabIndex={-1} href="/" target="_blank" rel="noreferrer" className={item}>
            <ArrowUpRight aria-hidden className="size-4 text-muted" /> View site
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <form action={logout} className="mt-1 border-t border-hairline pt-1">
            <button role="menuitem" tabIndex={-1} type="submit" className={item}>
              <LogOut aria-hidden className="size-4 text-muted" /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
