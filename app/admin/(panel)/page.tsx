import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandsTable } from "@/components/admin/brands/BrandsTable";
import { buttonClass } from "@/components/ui/Button";
import { listBrands } from "@/lib/admin/brands";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Brands" };
export const instant = false;

export default async function BrandsPage() {
  await requireAdmin();
  const brands = await listBrands();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2">Brands</h1>
          <p className="mt-1 text-small text-muted">
            {brands.length} brand{brands.length === 1 ? "" : "s"} · drag to reorder the public home page
          </p>
        </div>
        <Link href="/admin/brands/new/" className={buttonClass({ variant: "primary" })}>
          <Plus aria-hidden className="size-4" /> New brand
        </Link>
      </div>
      <BrandsTable key={brands.map((b) => `${b.id}:${b.status}:${b.updatedAt}`).join()} initial={brands} />
    </>
  );
}
