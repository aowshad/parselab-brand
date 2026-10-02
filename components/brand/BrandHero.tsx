import { formatDate } from "@/lib/format";
import type { BrandView } from "@/lib/view";
import { CopyLinkButton } from "../ui/CopyButton";
import { BrandIcon } from "./BrandIcon";

/**
 * Brand header: icon, name and tagline in one row with Copy link on the right, then a stat strip.
 * Below 640px Copy link drops under the title and goes full width, and the stats form a 2×2 grid.
 */
export function BrandHero({ brand }: { brand: BrandView }) {
  const { variants, colors } = brand.counts;
  // Items with a zero or missing value are left out (e.g. no Colors until a palette exists).
  const stats = [
    { label: "Logos", value: variants || null },
    { label: "Colors", value: colors || null },
    { label: "Formats", value: variants ? "SVG · PNG" : null },
    { label: "Updated", value: formatDate(brand.updatedAt) },
  ].filter((s) => s.value !== null);

  return (
    <header className="pt-12">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <BrandIcon name={brand.name} icon={brand.icon} size={64} className="size-14 rounded-[12px] sm:size-16 sm:rounded-[14px]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[36px] font-semibold leading-[40px] tracking-[-0.025em] text-balance">{brand.name}</h1>
          <p className="mt-1 text-body text-pretty text-muted">{brand.description}</p>
        </div>
        <CopyLinkButton
          doneLabel="Link copied"
          className="motion-press inline-flex h-10 items-center justify-center rounded-button border border-strong bg-surface px-4 text-[14px] font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)] hover:bg-hover max-sm:w-full sm:ml-auto"
        />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-10 gap-y-4 border-t border-hairline pt-4 sm:flex">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] font-medium uppercase leading-4 tracking-[0.06em] text-muted">{s.label}</dt>
            <dd className="mt-1 text-body font-medium tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
