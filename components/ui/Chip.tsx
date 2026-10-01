export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full bg-track px-2 text-[11px] font-medium leading-none text-muted ${className}`}
    >
      {children}
    </span>
  );
}
