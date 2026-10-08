"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type MenuItem =
  | { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }
  | { label: string; icon?: ReactNode; href: string; external?: boolean; disabled?: boolean; hint?: string };

const itemClass = "motion-colors flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-small outline-none hover:bg-hover focus-visible:bg-hover disabled:pointer-events-none disabled:opacity-50";

/** Menu button (WAI-ARIA menu pattern): arrow keys, Home/End, Esc returns focus. */
export function Menu({ label, trigger, items, align = "right" }: { label: string; trigger: ReactNode; items: MenuItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const els = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];

  useEffect(() => {
    if (!open) return;
    els()[0]?.focus();
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const list = els();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => (e.preventDefault(), list[(n + list.length) % list.length]?.focus());
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Escape") (e.preventDefault(), close());
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "ArrowDown" && (e.preventDefault(), setOpen(true))}
        className="motion-colors grid size-8 place-items-center rounded-[8px] text-muted hover:bg-hover hover:text-ink"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKey}
          className={`absolute top-full z-30 mt-1 w-56 animate-menu-in rounded-[12px] border border-hairline bg-surface p-1.5 shadow-menu ${align === "right" ? "right-0" : "left-0"}`}
        >
          {items.map((item) =>
            "href" in item ? (
              <a
                key={item.label}
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                href={item.disabled ? undefined : item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                onClick={() => close(false)}
                className={`${itemClass} ${item.disabled ? "pointer-events-none opacity-50" : ""}`}
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-caption text-muted">{item.hint}</span>}
                {item.external && <span className="sr-only">(opens in a new tab)</span>}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
                className={`${itemClass} ${item.danger ? "text-error" : ""}`}
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-caption text-muted">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
