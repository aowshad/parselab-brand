import { ArrowRight } from "lucide-react";
import { withBase } from "@/lib/paths";
import type { BrandCardView } from "@/lib/view";
import { Chip } from "../ui/Chip";

/** The whole card is one link to the brand's page. */
export function BrandCard({ brand }: { brand: BrandCardView }) {
  const { variants, colors } = brand.counts;
  const meta =
    brand.status === "soon"
      ? "In progress"
      : [variants && `${variants} ${variants === 1 ? "logo" : "logos"}`, colors && `${colors} ${colors === 1 ? "color" : "colors"}`]
          .filter(Boolean)
          .join(" · ");

  return (
    <a
      href={withBase(`/${brand.slug}`)}
      className="group flex w-full flex-col overflow-hidden rounded-card border border-hairline bg-surface transition-[border-color,transform,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-control hover:shadow-pill"
    >
      <div
        className="grid aspect-[16/10] place-items-center border-b border-hairline"
        style={{ background: brand.preview.background }}
      >
        {brand.preview.logo ? (
          <img src={withBase(brand.preview.logo)} alt="" className="max-h-[34%] w-[62%] object-contain" />
        ) : (
          <span aria-hidden className="grid size-16 place-items-center rounded-[16px] bg-surface text-2xl font-semibold text-muted shadow-pill">
            {brand.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{brand.name}</h2>
          {brand.status === "soon" && <Chip>Soon</Chip>}
        </div>
        <p className="mt-1 text-sm text-muted">{brand.description}</p>
        <div className="mt-4 flex items-center justify-between pt-1">
          <span className="font-mono text-xs text-muted">{meta}</span>
          <ArrowRight
            aria-hidden
            className="size-4 text-muted transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5 group-hover:text-ink"
          />
        </div>
      </div>
    </a>
  );
}
