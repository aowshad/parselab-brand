import { withBase } from "@/lib/paths";
import type { BrandView } from "@/lib/view";

/**
 * The brand's app icon, its first logo on that variant's own background, or its initial when it
 * has no logos yet. Its artwork never changes with the theme; a 1px --border ring keeps the tile's
 * edge visible on light and dark pages. `className` sets size and radius; `size` is the pixel size.
 */
export function BrandIcon({ name, icon, size, className }: { name: string; icon: BrandView["icon"]; size: number; className: string }) {
  if (icon?.isTile) {
    return <img src={withBase(icon.src)} alt="" width={size} height={size} className={`shrink-0 object-contain shadow-pill ring-1 ring-hairline ${className}`} />;
  }
  if (icon) {
    return (
      <span style={{ background: icon.plate }} className={`grid shrink-0 place-items-center p-[18%] shadow-pill ring-1 ring-hairline ${className}`}>
        <img src={withBase(icon.src)} alt="" className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center bg-track text-h2 text-muted ring-1 ring-hairline ${className}`}>
      {name.charAt(0)}
    </span>
  );
}
