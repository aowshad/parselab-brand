"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBrand } from "@/app/admin/brands/actions";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";

export function DangerZone({ brandId, name }: { brandId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <section aria-labelledby="danger-h" className="rounded-card border border-error/40 bg-surface p-6 max-sm:p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-4">
        <div className="mr-auto">
          <h2 id="danger-h" className="text-h3 text-error">Delete brand</h2>
          <p className="mt-1 text-small text-muted">Removes every logo, color and file of {name}. This can&apos;t be undone.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={buttonClass({ variant: "ghost", className: "border-error/50 text-error hover:border-error hover:bg-error/5" })}>
          Delete {name}…
        </button>
      </div>
      <ConfirmDialog
        open={open}
        title={`Delete ${name}?`}
        confirmLabel="Delete brand"
        danger
        requireText={name}
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const r = await deleteBrand(brandId, name);
            toast(r.ok ?? r.error!, r.error ? "error" : "success");
            if (!r.error) router.push("/admin/");
          })
        }
      >
        Every logo, color and file of this brand is removed from storage, and its public page stops working.
      </ConfirmDialog>
    </section>
  );
}
