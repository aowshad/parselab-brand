import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Brands" };

export default function BrandsPage() {
  return (
    <>
      <h1 className="text-h2">Brands</h1>
      <p className="mt-1 text-small text-muted">Editing arrives in the next phase. For now, this is what the public site shows.</p>
      <Suspense fallback={<div className="mt-6 h-64 rounded-card border border-hairline bg-surface" />}>
        <BrandTable />
      </Suspense>
    </>
  );
}

const STATUS: Record<string, string> = { LIVE: "Live", SOON: "Soon", DRAFT: "Draft" };
const updated = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

async function BrandTable() {
  await requireAdmin();
  const brands = await db.brand.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, status: true, updatedAt: true, _count: { select: { colors: true } }, logoTypes: { select: { _count: { select: { variants: true } } } } },
  });
  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-hairline bg-surface">
      <table className="w-full text-left text-small">
        <thead>
          <tr className="border-b border-hairline text-caption uppercase tracking-[0.06em] text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Brand</th>
            <th scope="col" className="px-4 py-3 font-medium max-sm:hidden">URL</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium max-sm:hidden">Content</th>
            <th scope="col" className="px-4 py-3 font-medium max-sm:hidden">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {brands.map((b) => {
            const logos = b.logoTypes.reduce((n, t) => n + t._count.variants, 0);
            return (
              <tr key={b.id}>
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 tabular-nums text-muted max-sm:hidden">/{b.slug}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex h-6 items-center rounded-full border px-2 text-caption ${b.status === "LIVE" ? "border-ink text-ink" : "border-strong text-muted"}`}>{STATUS[b.status]}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted max-sm:hidden">
                  {logos} logos · {b._count.colors} colors
                </td>
                <td className="px-4 py-3 tabular-nums text-muted max-sm:hidden">{updated.format(b.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
