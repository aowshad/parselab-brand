import type { LucideIcon } from "lucide-react";

/** A page section: anchor id, heading and subtitle. TOC labels must match `title` word for word. */
export function Section({
  id,
  title,
  subtitle,
  aside,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  /** Rendered to the right of the heading, e.g. the logo-type switcher. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-20 sm:mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 id={`${id}-heading`} className="text-2xl font-semibold tracking-[-0.02em]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {aside}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** Placeholder for a section that has no content yet. */
export function ComingSoonCard({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[12px] border border-dashed border-control px-5 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-track text-muted">
        <Icon aria-hidden className="size-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">Coming soon</p>
        <p className="mt-0.5 text-[13px] text-muted">{text}</p>
      </div>
    </div>
  );
}
