import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DangerZone } from "@/components/admin/brands/DangerZone";
import { GeneralForm } from "@/components/admin/brands/GeneralForm";
import { IconUploader } from "@/components/admin/brands/IconUploader";
import { getEditorBrand, type CardPreview } from "@/lib/admin/brands";
import { requireAdmin } from "@/lib/auth/session";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getEditorBrand((await params).id);
  return { title: b ? `${b.name} · General` : "Brand" };
}

const card = "rounded-card border border-hairline bg-surface p-6 max-sm:p-4";

export default async function GeneralTab({ params }: Props) {
  await requireAdmin();
  const brand = await getEditorBrand((await params).id);
  if (!brand) notFound();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="details-h" className={card}>
        <h2 id="details-h" className="mb-5 text-h3">Details</h2>
        <GeneralForm brand={brand} />
      </section>
      <div className="flex flex-col gap-4">
        <section aria-labelledby="icon-h" className={card}>
          <h2 id="icon-h" className="mb-4 text-h3">Brand icon</h2>
          <IconUploader brandId={brand.id} icon={brand.icon} />
        </section>
        <section aria-labelledby="card-h" className={card}>
          <h2 id="card-h" className="text-h3">Home card</h2>
          <p className="mt-1 text-small text-muted">Picked from the Full logo for each theme. There&apos;s no background to set.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Thumb theme="light" preview={brand.preview.light} name={brand.name} />
            <Thumb theme="dark" preview={brand.preview.dark} name={brand.name} />
          </div>
          {brand.previewNotes.map((n) => (
            <p key={n} className="mt-3 rounded-[10px] bg-track px-3 py-2 text-caption text-muted">
              {n}
            </p>
          ))}
        </section>
      </div>
      <DangerZone brandId={brand.id} name={brand.name} />
    </div>
  );
}

/** Same thumbnail as the public home card, in a fixed theme. */
function Thumb({ theme, preview, name }: { theme: "light" | "dark"; preview: CardPreview; name: string }) {
  return (
    <figure>
      <div data-theme={theme} className="grid aspect-[16/10] place-items-center overflow-hidden rounded-[12px] border border-hairline bg-thumb">
        {preview ? (
          preview.plate ? (
            <span style={{ background: preview.plate }} className="grid h-[48%] w-[68%] place-items-center rounded-[10px]">
              <img src={preview.src} alt="" className="h-[58%] w-[76%] object-contain" />
            </span>
          ) : (
            <img src={preview.src} alt="" className="h-[28%] w-[52%] object-contain" />
          )
        ) : (
          <span className="px-2 text-center text-small font-semibold text-muted">{name}</span>
        )}
      </div>
      <figcaption className="mt-1.5 text-caption text-muted">
        {theme === "light" ? "Light" : "Dark"} · {preview ? preview.label : "no logo yet, shows the name"}
      </figcaption>
    </figure>
  );
}
