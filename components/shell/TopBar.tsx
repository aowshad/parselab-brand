import { Download } from "lucide-react";
import { formatSize } from "@/lib/format";
import type { FileRef } from "@/lib/manifest";
import { withBase } from "@/lib/paths";
import type { BrandView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";
import { StickyBar } from "./StickyBar";

const SITE_NAME = "ParseLab Brand";

/** The page's one download CTA, with its size in a lighter tone. */
function KitButton({ file, label, compact = false }: { file: FileRef; label: string; compact?: boolean }) {
  return (
    <DownloadLink
      file={file}
      feedback
      // Icon-only on phones, so the status label must not reserve width there either.
      doneLabel={compact ? <span className="max-sm:hidden">Downloaded</span> : "Downloaded"}
      aria-label={`${label}, ${formatSize(file.sizeKb)}`}
      className={buttonClass({ variant: "primary", size: "sm", className: "ml-auto" })}
    >
      <Download aria-hidden className="size-4" />
      {/* `compact`: icon-only on phones. */}
      <span className={`tabular-nums ${compact ? "max-sm:hidden" : ""}`}>
        {label}
        <span className="text-on-dark/60"> · {formatSize(file.sizeKb)}</span>
      </span>
    </DownloadLink>
  );
}

/** Home: the platform name as text, and "Download all" when any kit exists. */
export function HomeTopBar({ all }: { all: FileRef | null }) {
  return (
    <StickyBar>
      <a href={withBase("/")} className="motion-colors rounded-[6px] text-body font-semibold tracking-[-0.01em] hover:text-ink-soft">
        {SITE_NAME}
      </a>
      {all && <KitButton file={all} label="Download all" />}
    </StickyBar>
  );
}

/** Brand page: a text breadcrumb back to all brands, and this brand's kit. Never names another brand. */
export function BrandTopBar({ brand }: { brand: Pick<BrandView, "name" | "kit"> }) {
  return (
    <StickyBar>
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-2 text-body">
          <li className="shrink-0">
            <a href={withBase("/")} className="motion-colors rounded-[6px] text-muted hover:text-ink">
              {SITE_NAME}
            </a>
          </li>
          <li aria-hidden className="text-muted">
            /
          </li>
          <li className="truncate font-semibold text-ink" aria-current="page">
            {brand.name}
          </li>
        </ol>
      </nav>
      {brand.kit && <KitButton file={brand.kit} label="Download kit" compact />}
    </StickyBar>
  );
}
