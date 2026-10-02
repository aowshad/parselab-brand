import { Download } from "lucide-react";
import { formatSize } from "@/lib/format";
import type { FileRef } from "@/lib/manifest";
import { withBase } from "@/lib/paths";
import type { BrandView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";
import { StickyBar } from "./StickyBar";
import { ThemeToggle } from "./ThemeToggle";

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
      className={buttonClass({ variant: "primary", size: "sm" })}
    >
      <Download aria-hidden className="size-4" />
      {/* `compact`: icon-only on phones. */}
      <span className={`tabular-nums ${compact ? "max-sm:hidden" : ""}`}>
        {label}
        <span className="text-btn-ink/60"> · {formatSize(file.sizeKb)}</span>
      </span>
    </DownloadLink>
  );
}

/** Right side of every navbar: the theme toggle, just left of the page's download button. */
function Actions({ children }: { children?: React.ReactNode }) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <ThemeToggle />
      {children}
    </div>
  );
}

/** Home (and 404): the platform name as text, and "Download all" when any kit exists. */
export function HomeTopBar({ all }: { all: FileRef | null }) {
  return (
    <StickyBar>
      <a href={withBase("/")} className="motion-colors rounded-[6px] text-body font-semibold tracking-[-0.01em] hover:text-muted">
        {SITE_NAME}
      </a>
      <Actions>{all && <KitButton file={all} label="Download all" />}</Actions>
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
      <Actions>{brand.kit && <KitButton file={brand.kit} label="Download kit" compact />}</Actions>
    </StickyBar>
  );
}
