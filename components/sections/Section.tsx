import type { LucideIcon } from "lucide-react";

/** A page section: anchor id, heading and subtitle. TOC labels must match `title` word for word. */
export function Section({
  id,
  title,
  subtitle,
  aside,
  first = false,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  /** Rendered to the right of the heading, e.g. the logo-type switcher. */
  aside?: React.ReactNode;
  /** The first section sits 64px below the hero; the rest are 96px apart. */
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={first ? "mt-16" : "mt-24"}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 id={`${id}-heading`} className="text-h2 text-balance">
            {title}
          </h2>
          <p className="mt-1 text-small text-pretty text-muted">{subtitle}</p>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Placeholder for a section that has no content yet. */
export function ComingSoonCard({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[12px] border border-dashed border-control px-6 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-track text-muted">
        <Icon aria-hidden className="size-4" />
      </span>
      <div>
        <p className="text-small font-semibold">Coming soon</p>
        <p className="text-small text-pretty text-muted">{text}</p>
      </div>
    </div>
  );
}
