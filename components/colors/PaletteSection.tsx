import { Download, Palette } from "lucide-react";
import type { BrandView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";
import { ColorCard } from "./ColorCard";

export function PaletteSection({ brand }: { brand: BrandView }) {
  const { css, json } = brand.colorFiles;
  return (
    <section id="colors" aria-labelledby="colors-heading" className="mt-20 sm:mt-24">
      <h2 id="colors-heading" className="text-2xl font-semibold tracking-[-0.02em]">
        Color palette
      </h2>
      {brand.palettes.length === 0 ? (
        <div className="mt-8 flex items-center gap-4 rounded-card border border-dashed border-control p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-button bg-track text-muted">
            <Palette aria-hidden className="size-4" />
          </span>
          <div>
            <p className="font-semibold">No brand colors yet</p>
            <p className="mt-0.5 text-sm text-muted">The palette for {brand.name} will appear here once it's approved.</p>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">Click a swatch to copy its hex, or any row to copy that value.</p>
      )}

      {brand.palettes.map((palette) => (
        <div key={palette.name} className="mt-8">
          <h3 className="font-semibold">{palette.name}</h3>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
            {palette.colors.map((c) => (
              <ColorCard key={`${c.name}-${c.hex}`} color={c} />
            ))}
          </ul>
        </div>
      ))}

      {brand.palettes.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-muted">Download palette</span>
          <DownloadLink file={css} className={buttonClass({ variant: "ghost", size: "sm" })}>
            <Download aria-hidden className="size-3.5" />
            <span className="font-mono">colors.css</span>
          </DownloadLink>
          <DownloadLink file={json} className={buttonClass({ variant: "ghost", size: "sm" })}>
            <Download aria-hidden className="size-3.5" />
            <span className="font-mono">colors.json</span>
          </DownloadLink>
        </div>
      )}
    </section>
  );
}
