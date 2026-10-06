"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-script";

export type ThemePref = "light" | "dark" | "system";
export type { Theme } from "./variants";
import type { Theme } from "./variants";

export const THEME_PREFS: ThemePref[] = ["light", "dark", "system"];
const root = () => document.documentElement;

export function readPref(): ThemePref {
  const p = root().dataset.themePref;
  return p === "light" || p === "dark" ? p : "system";
}

const resolve = (pref: ThemePref): Theme =>
  pref === "system" ? (matchMedia(DARK_QUERY).matches ? "dark" : "light") : pref;

/**
 * The inline <head> script normally sets the theme before first paint. A page rendered entirely
 * in the browser (a 404 for an unknown brand arrives as an error shell) never runs it, so the
 * toggle calls this on mount to apply the stored choice before that paint instead.
 */
export function ensureTheme() {
  if (root().dataset.theme) return;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {}
  applyPref(stored === "light" || stored === "dark" ? stored : "system", { animate: false });
}

let switchTimer: ReturnType<typeof setTimeout> | undefined;

/** Applies a theme choice. Colors cross-fade for one --dur-slow; never on first load. */
export function applyPref(pref: ThemePref, { animate = true } = {}) {
  const el = root();
  const next = resolve(pref);
  if (animate && el.dataset.theme !== next) {
    el.dataset.themeSwitching = "";
    clearTimeout(switchTimer);
    // --dur-slow plus a frame, so the last transition isn't cut short.
    switchTimer = setTimeout(() => delete el.dataset.themeSwitching, 300);
  }
  el.dataset.theme = next;
  el.dataset.themePref = pref;
}

export function savePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  applyPref(pref);
}

/** Keeps "System" in step with the OS, and other tabs in step with this one. */
export function watchTheme(): () => void {
  const mq = matchMedia(DARK_QUERY);
  const onOs = () => readPref() === "system" && applyPref("system");
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    const v = e.newValue;
    applyPref(v === "light" || v === "dark" ? v : "system");
  };
  mq.addEventListener("change", onOs);
  window.addEventListener("storage", onStorage);
  return () => {
    mq.removeEventListener("change", onOs);
    window.removeEventListener("storage", onStorage);
  };
}

/** Re-renders whenever <html>'s theme attributes change. */
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(root(), { attributes: true, attributeFilter: ["data-theme", "data-theme-pref"] });
  return () => mo.disconnect();
}

/** The resolved theme. Light during server rendering and hydration, then the real one. */
export const useTheme = (): Theme =>
  useSyncExternalStore(subscribe, () => (root().dataset.theme === "dark" ? "dark" : "light"), () => "light");

/** The stored choice; null during server rendering and hydration. */
export const useThemePref = (): ThemePref | null => useSyncExternalStore(subscribe, readPref, () => null);
