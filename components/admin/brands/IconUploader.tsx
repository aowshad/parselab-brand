"use client";

import { ImageUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removeIcon, setIcon } from "@/app/admin/brands/actions";
import { uploadFile } from "@/lib/admin/upload-client";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";

/** Square SVG or PNG, up to 5 MB. Drop it or pick it; it's checked, cleaned and saved right away. */
export function IconUploader({ brandId, icon }: { brandId: string; icon: { url: string; name: string } | null }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const { fileId } = await uploadFile(file, { purpose: "brand-icon", brandId }, setProgress);
      const r = await setIcon(brandId, fileId);
      if (r.error) throw new Error(r.error);
      toast(r.ok!);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  const busy = progress !== null || pending;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f && !busy) upload(f);
          }}
          className={`motion-colors grid size-20 shrink-0 place-items-center overflow-hidden rounded-[18px] ${icon ? "ring-1 ring-hairline" : `border-[1.5px] border-dashed ${over ? "border-ink bg-hover" : "border-strong bg-track"}`}`}
        >
          {progress !== null ? (
            <span className="w-12 text-center text-caption tabular-nums text-muted" aria-live="polite">
              {Math.round(progress * 100)}%
              <span className="mt-1 block h-1 rounded-full bg-hairline">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${progress * 100}%` }} />
              </span>
            </span>
          ) : icon ? (
            <img src={icon.url} alt="Current brand icon" className="size-full object-contain" />
          ) : (
            <ImageUp aria-hidden className="size-6 text-muted" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept=".svg,.png,image/svg+xml,image/png" className="sr-only" id={`icon-${brandId}`} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={busy} />
          <label htmlFor={`icon-${brandId}`} className={buttonClass({ variant: "ghost", size: "sm", className: `cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}` })}>
            {icon ? "Replace" : "Upload icon"}
          </label>
          {icon && (
            <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className={buttonClass({ variant: "quiet", size: "sm" })}>
              Remove
            </button>
          )}
        </div>
      </div>
      <p className={`mt-2 text-caption ${error ? "text-error" : "text-muted"}`} role={error ? "alert" : undefined}>
        {error ?? "Square SVG or PNG, up to 5 MB. Used for the favicon and the brand page header. Drop a file on the box or choose one."}
      </p>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove the brand icon?"
        confirmLabel="Remove icon"
        danger
        pending={pending}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() =>
          start(async () => {
            const r = await removeIcon(brandId);
            toast(r.ok ?? r.error!, r.error ? "error" : "success");
            setConfirmRemove(false);
            router.refresh();
          })
        }
      >
        The favicon and header fall back to the first logo (or the brand&apos;s initial).
      </ConfirmDialog>
    </div>
  );
}
