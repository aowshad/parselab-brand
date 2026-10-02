import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { withBase } from "@/lib/paths";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Brand not found" };

export default function NotFound() {
  return (
    <main className="container-page grid min-h-dvh place-items-center text-center">
      <div>
        <h1 className="text-display text-balance">Brand not found</h1>
        <p className="mt-3 text-body text-pretty text-muted">There's no brand at this address.</p>
        <a href={withBase("/")} className={buttonClass({ variant: "primary", className: "mt-6" })}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to all brands
        </a>
      </div>
    </main>
  );
}
