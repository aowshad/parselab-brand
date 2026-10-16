"use client";

import { Download, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { attachVariant, removeVariant, updateVariant } from "@/app/admin/brands/logo-actions";
import type { EditorVariant } from "@/lib/admin/logos";
import { SLOTS, type SlotKey } from "@/lib/admin/slots";
import { uploadFile } from "@/lib/admin/upload-client";
import { isDark } from "@/lib/color";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";
import { inputClass } from "../Form";

type Phase = { step: "upload"; progress: number } | { step: "process" } | null;

/** One slot of a logo type: an empty drop zone, or the variant with its name, hint and actions. */
export function VariantCell({ brandId, typeId, typeLabel, slot, variant }: { brandId: string; typeId: string; typeLabel: string; slot: SlotKey; variant?: EditorVariant }) {
  const def = SLOTS[slot];
  const [phase, setPhase] = useState<Phase>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const inputId = useId();
  const bg = variant?.previewBg ?? def.previewBg;
  const dark = isDark(bg);

  async function upload(file: File) {
    setError(null);
    setPhase({ step: "upload", progress: 0 });
    try {
      const up = await uploadFile(file, { purpose: "logo-variant", brandId }, (p) => setPhase(p < 1 ? { step: "upload", progress: p } : { step: "process" }));
      setPhase({ step: "process" });
      const r = await attachVariant(typeId, slot, up.fileId);
      if (r.error) throw new Error(r.error);
      toast(r.ok!);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase(null);
    }
  }

  const busy = phase !== null || pending;
  const dropProps = {
    onDragOver: (e: React.DragEvent) => (e.preventDefault(), setOver(true)),
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const f = e.dataTransfer.files[0];
      if (f && !busy) upload(f);
    },
  };
  const fileInput = (
    <input id={inputId} type="file" accept=".svg,.png,image/svg+xml,image/png" className="sr-only" disabled={busy} onChange={(e) => (e.target.files?.[0] && upload(e.target.files[0]), (e.target.value = ""))} />
  );

  return (
    <article aria-label={`${typeLabel}, ${def.name}`} className="flex flex-col overflow-hidden rounded-[14px] border border-hairline bg-surface" {...dropProps}>
      <div className={`relative grid h-36 place-items-center ${variant ? "" : `border-b-[1.5px] border-dashed ${over ? "border-ink" : "border-strong"}`}`} style={{ background: variant || over ? bg : undefined }}>
        {phase ? (
          <div className="w-2/3 text-center" aria-live="polite">
            <p className={`text-caption font-medium ${variant && dark ? "text-on-dark" : "text-ink"}`}>
              {phase.step === "upload" ? `Uploading… ${Math.round(phase.progress * 100)}%` : "Cleaning the SVG, making PNGs…"}
            </p>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-hairline">
              <span className={`block h-full rounded-full bg-ink ${phase.step === "process" ? "animate-pulse" : ""}`} style={{ width: `${phase.step === "upload" ? phase.progress * 100 : 100}%` }} />
            </span>
          </div>
        ) : variant ? (
          <img src={variant.preview} alt={`${typeLabel}, ${variant.name}`} className="max-h-[58%] max-w-[62%] object-contain" />
        ) : (
          <label htmlFor={inputId} className="grid cursor-pointer place-items-center gap-1 px-4 text-center text-small text-muted">
            <UploadCloud aria-hidden className="size-5" />
            <span className="font-medium text-ink">Drop SVG or click to upload</span>
            <span className="text-caption">SVG or PNG · max 5 MB</span>
          </label>
        )}
        {fileInput}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className={`size-2.5 rounded-full ${isDark(def.dot) ? "" : "ring-1 ring-inset ring-ink/30"}`} style={{ background: def.dot }} />
          <h4 className="text-small font-semibold">{def.name}</h4>
          <span className="ml-auto text-caption text-muted">
            {variant ? (variant.kind === "svg" ? "SVG · PNG 512–4096" : `PNG only · ${variant.pngSizes.join(", ")}`) : "Empty"}
          </span>
        </div>
        {variant ? (
          <>
            <InlineField key={`f-${variant.fileName}`} label="File name" value={variant.fileName} onSave={(v) => updateVariant(variant.id, { fileName: v })} />
            <InlineField key={`h-${variant.hint}`} label="Usage hint" value={variant.hint} onSave={(v) => updateVariant(variant.id, { hint: v })} />
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <label htmlFor={inputId} className={buttonClass({ variant: "ghost", size: "sm", className: `cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}` })}>
                Replace
              </label>
              <a href={variant.download} className={buttonClass({ variant: "quiet", size: "sm" })}>
                <Download aria-hidden className="size-3.5" /> Download
              </a>
              <button type="button" disabled={busy} onClick={() => setConfirm(true)} className={buttonClass({ variant: "quiet", size: "sm", className: "ml-auto hover:text-error" })}>
                Remove
              </button>
            </div>
          </>
        ) : (
          <p className="text-caption text-muted">{def.hint} Hidden on the public page until a file is uploaded.</p>
        )}
        {error && (
          <p role="alert" className="text-caption text-error">
            {error}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Remove ${typeLabel} · ${def.name}?`}
        confirmLabel="Remove"
        danger
        pending={pending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            const r = await removeVariant(variant!.id);
            toast(r.ok ?? r.error!, r.error ? "error" : "success");
            setConfirm(false);
            router.refresh();
          })
        }
      >
        Its SVG and PNGs are deleted, and it disappears from the public page and the downloads.
      </ConfirmDialog>
    </article>
  );
}

/** A text field that saves on Enter or when you leave it (Esc restores the saved value). */
function InlineField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => Promise<{ ok?: string; error?: string }> }) {
  const [v, setV] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const id = useId();
  useEffect(() => setV(value), [value]);
  const save = () => {
    if (v.trim() === value || pending) return setV(value);
    start(async () => {
      const r = await onSave(v.trim());
      if (r.error) {
        setError(r.error);
        return;
      }
      setError(null);
      toast(r.ok!);
      router.refresh();
    });
  };
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        value={v}
        onChange={(e) => (setV(e.target.value), setError(null))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.preventDefault(), save());
          if (e.key === "Escape") (setV(value), setError(null));
        }}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-e` : undefined}
        title={label}
        className={`${inputClass} h-8 text-caption ${pending ? "opacity-60" : ""}`}
      />
      {error && (
        <p id={`${id}-e`} role="alert" className="mt-1 text-caption text-error">
          {error}
        </p>
      )}
    </div>
  );
}
