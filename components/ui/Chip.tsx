export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-full bg-track px-2 text-caption text-muted ${className}`}>{children}</span>
  );
}
