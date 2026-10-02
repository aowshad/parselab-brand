import { Download, Link2 } from "lucide-react";
import { formatDate, formatSize } from "@/lib/format";
import type { BrandView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { BrandIcon } from "./BrandIcon";
import { CopyLinkButton } from "../ui/CopyButton";
import { DownloadLink } from "../ui/DownloadLink";

export function BrandHero({ brand }: { brand: BrandView }) {
  const { variants, colors } = brand.counts;
  // Only facts that apply: a brand with no logos yet just shows its update date.
  const meta = [
    ...(variants > 0 ? [`${variants} logo ${variants === 1 ? "variant" : "variants"}`] : []),
    ...(colors > 0 ? [`${colors} brand ${colors === 1 ? "color" : "colors"}`] : []),
    ...(variants > 0 ? ["SVG + PNG for every file"] : []),
    `Updated ${formatDate(brand.updatedAt)}`,
  ];

  return (
    <header className="pt-10 sm:pt-14">
      <BrandIcon name={brand.name} icon={brand.icon} size={76} radius={18} />
      <p className="mt-6 text-[13px] font-medium text-muted">Brand assets & guidelines</p>
      <h1 className="mt-1.5 text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">{brand.name}</h1>
      <p className="mt-3 max-w-xl text-base text-muted sm:text-lg">{brand.description}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <CopyLinkButton className={buttonClass({ variant: "ghost" })}>
          <Link2 aria-hidden className="size-4" />
          Copy link
        </CopyLinkButton>
        {brand.kit && (
          <DownloadLink file={brand.kit} className={buttonClass({ variant: "primary" })}>
            <Download aria-hidden className="size-4" />
            Download brand kit
            <span className="hidden tabular-nums text-xs text-on-dark/60 sm:inline">{formatSize(brand.kit.sizeKb)}</span>
          </DownloadLink>
        )}
      </div>

      {/* Each "·" is glued to the item before it, so wrapped lines never start with one. */}
      <p className="mt-6 text-[13px] leading-6 text-muted">
        {meta.map((m, i) => (
          <span key={m}>
            <span className="whitespace-nowrap">
              {m}
              {i < meta.length - 1 && <span aria-hidden>{"\u00a0\u00a0·"}</span>}
            </span>
            {i < meta.length - 1 && " "}
          </span>
        ))}
      </p>
    </header>
  );
}

