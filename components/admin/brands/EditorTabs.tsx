"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const TABS = [
  { slug: "", label: "General" },
  { slug: "logos", label: "Logos" },
  { slug: "colors", label: "Colors" },
  { slug: "typography", label: "Typography" },
  { slug: "usage", label: "Usage" },
  { slug: "kit", label: "Brand kit" },
] as const;

/** Tab row for the brand editor; each tab is its own URL, so it survives reloads and can be linked. */
export function EditorTabs({ brandId, counts }: { brandId: string; counts: Record<string, string | undefined> }) {
  const path = usePathname().replace(/\/$/, "");
  const base = `/admin/brands/${brandId}`;
  return (
    <nav aria-label="Brand editor" className="mb-6 mt-6 flex gap-1 overflow-x-auto border-b border-hairline scrollbar-none">
      {TABS.map((t) => {
        const href = t.slug ? `${base}/${t.slug}/` : `${base}/`;
        const on = path === (t.slug ? `${base}/${t.slug}` : base);
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`motion-colors -mb-px shrink-0 border-b-2 px-3 py-2.5 text-small font-medium ${on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            {counts[t.slug] && <span className="ml-1.5 text-caption tabular-nums text-muted">{counts[t.slug]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
