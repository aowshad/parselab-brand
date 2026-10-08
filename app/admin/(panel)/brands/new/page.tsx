import type { Metadata } from "next";
import { NewBrandForm } from "@/components/admin/brands/NewBrandForm";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New brand" };
export const instant = false;

export default async function NewBrandPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="text-h2">New brand</h1>
      <p className="mt-1 text-small text-muted">You&apos;ll add logos, colors and the rest in the brand editor next.</p>
      <div className="mt-6 rounded-card border border-hairline bg-surface p-6 max-sm:p-4">
        <NewBrandForm />
      </div>
    </div>
  );
}
