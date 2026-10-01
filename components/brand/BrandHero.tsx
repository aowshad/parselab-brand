import { Download, Link2 } from "lucide-react";
import { formatDate, formatSize } from "@/lib/format";
import { withBase } from "@/lib/paths";
import type { BrandView } from "@/lib/view";
import { buttonClass } from "../ui/Button";
import { CopyLinkButton } from "../ui/CopyButton";
import { DownloadLink } from "../ui/DownloadLink";

export function BrandHero({ brand }: { brand: BrandView }) {
  const { variants, colors } = brand.counts;
  const meta = [
    `${variants} logo ${variants === 1 ? "variant" : "variants"}`,
    `${colors} brand ${colors === 1 ? "color" : "colors"}`,
    "SVG + PNG for every file",
    `Updated ${formatDate(brand.updatedAt)}`,
  ];

  return (
    <header className="pt-10 sm:pt-14">
      <img
        src={withBase(brand.heroIcon.assets.svg.path)}
        alt=""
        width={76}
        height={76}
        className="size-[76px] rounded-[18px] object-contain shadow-pill"
      />
      <p className="mt-6 text-[13px] font-medium text-muted">Brand assets & guidelines</p>
      <h1 className="mt-1.5 text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">{brand.name}</h1>
      <p className="mt-3 max-w-xl text-base text-muted sm:text-lg">{brand.description}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <CopyLinkButton className={buttonClass({ variant: "ghost" })}>
          <Link2 aria-hidden className="size-4" />
          Copy link
        </CopyLinkButton>
        <DownloadLink file={brand.kit} className={buttonClass({ variant: "primary" })}>
          <Download aria-hidden className="size-4" />
          Download brand kit
          <span className="hidden font-mono text-xs text-on-dark/60 sm:inline">{formatSize(brand.kit.sizeKb)}</span>
        </DownloadLink>
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

