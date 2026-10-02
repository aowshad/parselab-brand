import { withBase } from "@/lib/paths";
import type { BrandView } from "@/lib/view";

/** The brand's app icon, its first logo on a white tile, or its initial when it has no logos yet. */
export function BrandIcon({ name, icon, size, radius }: { name: string; icon: BrandView["icon"]; size: number; radius: number }) {
  const box = { width: size, height: size, borderRadius: radius };
  if (icon?.isTile) {
    return <img src={withBase(icon.src)} alt="" width={size} height={size} style={box} className="shrink-0 object-contain shadow-pill" />;
  }
  if (icon) {
    return (
      <span style={{ ...box, padding: size * 0.18 }} className="grid shrink-0 place-items-center border border-hairline bg-surface shadow-pill">
        <img src={withBase(icon.src)} alt="" className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...box, fontSize: size * 0.42 }}
      className="grid shrink-0 place-items-center bg-track font-semibold text-muted"
    >
      {name.charAt(0)}
    </span>
  );
}
