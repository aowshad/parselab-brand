"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * WAI-ARIA tabs keyboard model: one tab in the Tab order, arrows/Home/End move
 * focus and select (automatic activation).
 */
export function useRovingTabs<T extends string>(items: readonly T[], active: T, onSelect: (item: T) => void) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const select = (item: T, focus: boolean) => {
    onSelect(item);
    const el = refs.current.get(item);
    if (focus) el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = items.indexOf(active);
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    select(items[next]!, true);
  };

  return (item: T) => ({
    ref: (el: HTMLButtonElement | null) => {
      if (el) refs.current.set(item, el);
      else refs.current.delete(item);
    },
    type: "button" as const,
    role: "tab" as const,
    "aria-selected": item === active,
    tabIndex: item === active ? 0 : -1,
    onClick: () => select(item, false),
    onKeyDown,
  });
}
