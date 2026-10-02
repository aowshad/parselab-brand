"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { savePref, THEME_PREFS, useThemePref, watchTheme, type ThemePref } from "@/lib/theme";

const OPTIONS: Record<ThemePref, { label: string; icon: LucideIcon }> = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
};

const nextPref = (p: ThemePref) => THEME_PREFS[(THEME_PREFS.indexOf(p) + 1) % THEME_PREFS.length]!;

/**
 * 36px icon button that cycles Light → Dark → System. The icon and tooltip come from
 * `data-theme-pref` on <html> through CSS, so they're right before hydration too.
 */
export function ThemeToggle() {
  const pref = useThemePref();
  useEffect(watchTheme, []);

  return (
    <button
      type="button"
      onClick={() => savePref(nextPref(pref ?? "system"))}
      aria-label={pref ? `Theme: ${OPTIONS[pref].label}. Switch to ${OPTIONS[nextPref(pref)].label}` : "Change theme"}
      className="motion-press group relative grid size-9 shrink-0 place-items-center rounded-button text-muted hover:bg-hover hover:text-ink"
    >
      {THEME_PREFS.map((p) => {
        const Icon = OPTIONS[p].icon;
        return <Icon key={p} aria-hidden data-option={p} className="theme-option size-[18px]" />;
      })}
      {/* Names the current mode; hover or keyboard focus only. */}
      <span
        aria-hidden
        className="motion-fade pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-btn px-2 py-1 text-caption text-btn-ink opacity-0 shadow-pill group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {THEME_PREFS.map((p) => (
          <span key={p} data-option={p} className="theme-option">
            {OPTIONS[p].label} theme
          </span>
        ))}
      </span>
    </button>
  );
}
