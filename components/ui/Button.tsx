import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "quiet";
type Size = "md" | "sm";

// motion-press: colors fade over --dur-fast, and :active presses to 0.98 for 80ms.
const base =
  "motion-press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-btn text-btn-ink hover:bg-btn-hover",
  ghost: "border border-control bg-surface text-ink hover:border-strong hover:bg-hover",
  quiet: "text-muted hover:bg-hover hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-10 rounded-button px-4 text-small",
  sm: "h-8 rounded-button-sm px-3 text-small",
};

export function buttonClass({ variant = "ghost", size = "md", className = "" }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

type Common = { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={buttonClass({ variant, size, className })} {...props} />;
}
