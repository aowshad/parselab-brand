import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "quiet";
type Size = "md" | "sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 ease-out-soft " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-on-dark hover:bg-ink-soft",
  ghost: "border border-control bg-surface text-ink hover:bg-hover",
  quiet: "text-muted hover:bg-hover hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-10 rounded-button px-4 text-sm",
  sm: "h-8 rounded-button-sm px-3 text-[13px]",
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
