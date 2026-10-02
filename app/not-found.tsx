import type { Metadata } from "next";
import { withBase } from "@/lib/paths";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="tabular-nums text-sm text-muted">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Page not found</h1>
        <p className="mt-2 text-sm text-muted">There's no brand at this address.</p>
        <a href={withBase("/")} className={buttonClass({ variant: "primary", className: "mt-6" })}>
          All brands
        </a>
      </div>
    </main>
  );
}
