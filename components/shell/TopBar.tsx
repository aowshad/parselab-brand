import { Download } from "lucide-react";
import type { FileRef } from "@/lib/manifest";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";

export function TopBar({ kit }: { kit: FileRef }) {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-hairline bg-ground/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 rounded-button-sm text-[15px] tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-[8px] bg-ink text-[13px] font-semibold text-on-dark">
            P
          </span>
          <span>
            ParseLab <span className="font-semibold">Brand</span>
          </span>
        </a>

        <nav aria-label="Sections" className="ml-auto hidden items-center gap-1 sm:flex">
          <a href="#logos" className={buttonClass({ variant: "quiet", size: "sm" })}>
            Logos
          </a>
          <a href="#colors" className={buttonClass({ variant: "quiet", size: "sm" })}>
            Colors
          </a>
        </nav>

        <DownloadLink file={kit} className={buttonClass({ variant: "primary", size: "sm", className: "ml-auto sm:ml-2" })}>
          <Download aria-hidden className="size-4" />
          Download kit
        </DownloadLink>
      </div>
    </header>
  );
}
