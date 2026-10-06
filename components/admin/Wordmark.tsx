/** "ParseLab Brand" with an Admin tag: the same name as the public navbar. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-body font-semibold tracking-[-0.01em] ${className}`}>
      ParseLab Brand
      <span className="rounded-[6px] border border-hairline px-1.5 py-px text-caption font-medium text-muted">Admin</span>
    </span>
  );
}
