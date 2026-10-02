import { withBase } from "@/lib/paths";
import type { BrandView } from "@/lib/view";

/**
 * The brand's app icon, its first logo on a white tile, or its initial when it has no logos yet.
 * `className` sets size and radius (so they can be responsive); `size` is the intrinsic pixel size.
 */
export function BrandIcon({ name, icon, size, className }: { name: string; icon: BrandView["icon"]; size: number; className: string }) {
  if (icon?.isTile) {
    return <img src={withBase(icon.src)} alt="" width={size} height={size} className={`shrink-0 object-contain shadow-pill ${className}`} />;
  }
  if (icon) {
    return (
      <span className={`grid shrink-0 place-items-center border border-hairline bg-surface p-[18%] shadow-pill ${className}`}>
        <img src={withBase(icon.src)} alt="" className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center bg-track text-h2 text-muted ${className}`}>
      {name.charAt(0)}
    </span>
  );
}
