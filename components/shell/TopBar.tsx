import { Download } from "lucide-react";
import type { BrandNavItem } from "@/lib/content";
import type { FileRef } from "@/lib/manifest";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";
import { MobileNav } from "./MobileNav";
import type { PageSection } from "./NavLists";

export function TopBar({
  kit,
  brands,
  current,
  sections,
}: {
  kit: FileRef;
  brands: BrandNavItem[];
  current: string;
  sections: PageSection[];
}) {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-hairline bg-ground/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
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
          {/* Icon-only on the narrowest phones; the label stays available to screen readers. */}
          <span className="max-[379px]:sr-only">Download kit</span>
        </DownloadLink>
        <MobileNav brands={brands} current={current} sections={sections} />
      </div>
    </header>
  );
}
