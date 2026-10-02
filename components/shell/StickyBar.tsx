"use client";

import { useEffect, useState } from "react";

/** Sticky 56px bar on the page container. Its hairline fades in once the page has scrolled. */
export function StickyBar({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={`motion-border sticky top-0 z-40 h-14 border-b bg-ground/85 backdrop-blur-[12px] ${
        scrolled ? "border-hairline" : "border-transparent"
      }`}
    >
      <div className="container-page flex h-full items-center gap-3">{children}</div>
    </header>
  );
}
