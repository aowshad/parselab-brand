"use client";

import { ArrowRight } from "lucide-react";
import { useCallback, useState } from "react";
import { withBase } from "@/lib/paths";
import type { BrandCardView, CardThumb } from "@/lib/view";
import { Chip } from "../ui/Chip";

/** Card logo: skeleton until loaded, then a fade-in. Catches images that loaded before hydration. */
function CardLogo({ thumb, className = "" }: { thumb: CardThumb; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);
  const img = (
    // Fixed box (52% × 28% of the preview) so every brand carries similar visual weight.
    <span className={`relative h-[28%] w-[52%] rounded-[8px] ${loaded ? "" : "skeleton opacity-40"} ${thumb.plate ? "" : className}`}>
      <img
        ref={ref}
        src={withBase(thumb.src)}
        alt=""
        // Lazy, so the other theme's logo (display: none) isn't fetched until it's shown.
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`motion-fade-slow absolute inset-0 size-full object-contain ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
  if (!thumb.plate) return img;
  // Last resort, a logo made for the other theme: on a small plate of its own background.
  return (
    <span style={{ background: thumb.plate }} className={`grid h-[48%] w-[68%] place-items-center rounded-[12px] [&>span]:h-[58%] [&>span]:w-[76%] ${className}`}>
      {img}
    </span>
  );
}

/** Both themes' logos are in the HTML; CSS shows one, so switching is instant. */
function Thumbnail({ name, thumbs }: { name: string; thumbs: BrandCardView["thumbs"] }) {
  const { light, dark } = thumbs;
  if (!light && !dark) {
    // No logo yet: the name, quietly, on the same thumbnail background as every other card.
    return (
      <span aria-hidden className="text-display text-muted">
        {name}
      </span>
    );
  }
  if (light && dark && light.src === dark.src && light.plate === dark.plate) return <CardLogo thumb={light} />;
  return (
    <>
      {light && <CardLogo thumb={light} className={dark ? "thumb-light" : ""} />}
      {dark && <CardLogo thumb={dark} className={light ? "thumb-dark" : ""} />}
    </>
  );
}

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
      className="motion-card group flex h-full w-full flex-col overflow-hidden rounded-card border border-hairline bg-surface hover:-translate-y-0.5 hover:border-strong hover:shadow-lift"
    >
      <div className="grid aspect-[16/10] place-items-center border-b border-hairline bg-thumb">
        <Thumbnail name={brand.name} thumbs={brand.thumbs} />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-h3">{brand.name}</h2>
          {brand.status === "soon" && <Chip>Soon</Chip>}
        </div>
        <p className="mt-1 line-clamp-2 text-small text-pretty text-muted">{brand.description}</p>
        {/* Pinned to the bottom so meta rows and arrows line up across cards. */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-caption tabular-nums text-muted">{meta}</span>
          <ArrowRight aria-hidden className="motion-nudge size-4 text-muted group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </div>
    </a>
  );
}
