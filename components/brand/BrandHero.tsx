import { formatDate } from "@/lib/format";
import type { BrandView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { CopyLinkButton } from "../ui/CopyButton";
import { BrandIcon } from "./BrandIcon";

/** Compact hero: icon and name in one row, then description, Copy link and the meta line. */
export function BrandHero({ brand }: { brand: BrandView }) {
  const { variants, colors } = brand.counts;
  // Only facts that apply: a brand with no logos yet just shows its update date.
  const meta = [
    ...(variants > 0 ? [`${variants} logo ${variants === 1 ? "variant" : "variants"}`] : []),
    ...(colors > 0 ? [`${colors} ${colors === 1 ? "color" : "colors"}`] : []),
    ...(variants > 0 ? ["SVG + PNG"] : []),
    `Updated ${formatDate(brand.updatedAt)}`,
  ];

  return (
    <header className="pt-12">
      <div className="flex items-center gap-4">
        <BrandIcon name={brand.name} icon={brand.icon} size={48} radius={12} />
        <h1 className="text-display text-balance">{brand.name}</h1>
      </div>
      <div className="sm:pl-16">
        <p className="mt-3 max-w-[560px] text-body text-pretty text-muted">{brand.description}</p>
        <div className="mt-4">
          <CopyLinkButton className={buttonClass({ variant: "ghost", size: "sm" })} />
        </div>
        {/* Same spacing on both sides of every "·"; each dot sticks to the item before it. */}
        <p className="mt-4 text-caption tabular-nums text-muted">
          {meta.map((m, i) => (
            <span key={m}>
              <span className="whitespace-nowrap">
                {m}
                {i < meta.length - 1 && <span aria-hidden>{" ·"}</span>}
              </span>
              {i < meta.length - 1 && " "}
            </span>
          ))}
        </p>
      </div>
    </header>
  );
}
