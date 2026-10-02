import { Download } from "lucide-react";
import type { BrandView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";
import { ColorCard } from "./ColorCard";

/** Palette cards and downloads. The page renders a Coming-soon card instead when there are no colors. */
export function PaletteSection({ palettes, files }: Pick<BrandView, "palettes"> & { files: NonNullable<BrandView["colorFiles"]> }) {
  return (
    <>
      {palettes.map((palette, i) => (
        <div key={palette.name} className={i > 0 ? "mt-8" : ""}>
          <h3 className="font-semibold">{palette.name}</h3>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
            {palette.colors.map((c, j) => (
              <ColorCard key={`${j}-${c.name}`} color={c} />
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Download palette</span>
        <DownloadLink file={files.css} className={buttonClass({ variant: "ghost", size: "sm" })}>
          <Download aria-hidden className="size-3.5" />
          <span className="font-mono">colors.css</span>
        </DownloadLink>
        <DownloadLink file={files.json} className={buttonClass({ variant: "ghost", size: "sm" })}>
          <Download aria-hidden className="size-3.5" />
          <span className="font-mono">colors.json</span>
        </DownloadLink>
      </div>
    </>
  );
}
