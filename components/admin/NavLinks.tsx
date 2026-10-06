"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [{ href: "/admin/", label: "Brands", match: (p: string) => p === "/admin" || p === "/admin/" || p.startsWith("/admin/brands") }];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1">
      {LINKS.map((l) => {
        const on = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`motion-colors rounded-[8px] px-2.5 py-1.5 text-small font-medium ${on ? "bg-hover text-ink" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
