"use client";

import { useEffect } from "react";

/**
 * Subtle one-time reveal: sections that start below the fold fade up 8px the first time they
 * enter the viewport. Never the hero, never again on scroll back, and skipped with reduced motion.
 */
export function RevealOnScroll({ selector = "main section[id]" }: { selector?: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pending = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    );
    pending.forEach((el) => (el.dataset.reveal = "pending"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          (e.target as HTMLElement).dataset.reveal = "done";
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -10% 0px" },
    );
    pending.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
  return null;
}
