import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorTabs } from "@/components/admin/brands/EditorTabs";
import { STATUS_LABEL } from "@/lib/admin/status";
import { getEditorBrand } from "@/lib/admin/brands";
import { requireAdmin } from "@/lib/auth/session";

// Request-time on purpose (the session is checked before anything renders).
export const instant = false;

export default async function BrandEditorLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  await requireAdmin();
  const brand = await getEditorBrand((await params).id);
  if (!brand) notFound();
  return (
    <>
      <p className="text-caption text-muted">
        <Link href="/admin/" className="rounded-[4px] hover:text-ink">
          Brands
        </Link>{" "}
        / {brand.name}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {brand.icon ? (
          <img src={brand.icon.url} alt="" className="size-12 rounded-[12px] ring-1 ring-hairline" />
        ) : (
          <span aria-hidden className="grid size-12 place-items-center rounded-[12px] bg-track text-h3 text-muted ring-1 ring-hairline">
            {brand.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-h2">{brand.name}</h1>
          <p className="text-small tabular-nums text-muted">
            /{brand.slug}/ · {STATUS_LABEL[brand.status]}
          </p>
        </div>
        {brand.status === "DRAFT" ? (
          <span className="ml-auto text-caption text-muted">Draft: not on the public site</span>
        ) : (
          <a href={`/${brand.slug}/`} target="_blank" rel="noreferrer" className="motion-press ml-auto inline-flex h-9 items-center gap-1.5 rounded-button border border-control bg-surface px-3 text-small font-medium hover:bg-hover">
            View page <ArrowUpRight aria-hidden className="size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
      <EditorTabs
        brandId={brand.id}
        counts={{ logos: String(brand.counts.logos), colors: String(brand.counts.colors), typography: brand.counts.typefaces ? String(brand.counts.typefaces) : "Soon" }}
      />
      {children}
    </>
  );
}
