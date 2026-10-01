// Phase 1 placeholder: replaced by a redirect to the first published brand in phase 2.
const swatches = [
  ["ground", "bg-ground"],
  ["surface", "bg-surface"],
  ["ink", "bg-ink"],
  ["muted", "bg-muted"],
  ["hairline", "bg-hairline"],
  ["control", "bg-control"],
  ["hover", "bg-hover"],
  ["track", "bg-track"],
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Scaffold</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">ParseLab Brand</h1>
      <p className="mt-2 text-muted">Design tokens preview. Geist for UI, <span className="font-mono">Geist Mono</span> for values.</p>
      <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {swatches.map(([name, cls]) => (
          <li key={name} className="overflow-hidden rounded-card border border-hairline bg-surface">
            <div className={`h-20 ${cls}`} />
            <p className="px-3 py-2 font-mono text-xs text-muted">--color-{name}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
