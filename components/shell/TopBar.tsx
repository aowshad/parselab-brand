import { ArrowLeft, Download } from "lucide-react";
import type { FileRef } from "@/lib/manifest";
import { withBase } from "@/lib/paths";
import type { BrandView } from "@/lib/view";
import { BrandIcon } from "../brand/BrandIcon";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-hairline bg-ground/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-3 px-4 sm:px-6">{children}</div>
    </header>
  );
}

function KitButton({ file, label, compact = false }: { file: FileRef; label: string; compact?: boolean }) {
  return (
    <DownloadLink file={file} className={buttonClass({ variant: "primary", size: "sm", className: "ml-auto" })}>
      <Download aria-hidden className="size-4" />
      {/* `compact`: icon-only on phones, label kept for screen readers. */}
      <span className={compact ? "max-sm:sr-only" : ""}>{label}</span>
    </DownloadLink>
  );
}

/** Home: platform wordmark and, when any kit exists, "Download all". */
export function HomeTopBar({ all }: { all: FileRef | null }) {
  return (
    <Bar>
      <a href={withBase("/")} className="flex items-center gap-2.5 rounded-button-sm text-[15px] tracking-tight">
        <span aria-hidden className="grid size-7 place-items-center rounded-[8px] bg-ink text-[13px] font-semibold text-on-dark">
          P
        </span>
        <span>
          ParseLab <span className="font-semibold">Brand Assets</span>
        </span>
      </a>
      {all && <KitButton file={all} label="Download all" />}
    </Bar>
  );
}

/** Brand page: back to all brands, this brand, and its kit. Never references another brand. */
export function BrandTopBar({ brand }: { brand: Pick<BrandView, "name" | "icon" | "kit"> }) {
  return (
    <Bar>
      <a
        href={withBase("/")}
        className="flex shrink-0 items-center gap-1.5 rounded-button-sm text-sm text-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All brands
      </a>
      <span aria-hidden className="h-5 w-px shrink-0 bg-control" />
      <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
        <BrandIcon name={brand.name} icon={brand.icon} size={24} radius={6} />
        <span className="truncate">{brand.name}</span>
      </span>
      {brand.kit && <KitButton file={brand.kit} label="Download kit" compact />}
    </Bar>
  );
}
