import type { Metadata } from "next";

// Admin pages are never indexed (proxy.ts also sends X-Robots-Tag, and robots.txt disallows /admin).
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Brand admin" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
