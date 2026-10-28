"use client";

import { ArrowDown, ArrowUp, Download, Film, ImageUp, Loader, Plus, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { adminOp } from "@/lib/admin/api-client";
import type { AdminMediaItem } from "@/lib/admin/media-view";
import { uploadFile } from "@/lib/admin/upload-client";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";
import { inputClass } from "../Form";

const op = (o: string, args: Record<string, unknown>) => adminOp("/api/admin/media/", o, args);
const ACCEPT = { VIDEO: ".mp4,.mov,video/mp4,video/quicktime", IMAGE: ".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" };

/**
 * A list of animations or event items: add, upload, rename, describe, reorder, delete. While a
 * video's formats are being made it polls the status and refreshes once they're ready.
 */
export function MediaList({
  brandId,
  eventId,
  items,
  allowImages,
  addLabel,
  placeholder,
}: {
  brandId: string;
  eventId: string | null;
  items: AdminMediaItem[];
  allowImages: boolean;
  addLabel: string;
  placeholder: string;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"VIDEO" | "IMAGE">(allowImages ? "IMAGE" : "VIDEO");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const processing = items.filter((i) => i.processing).map((i) => i.id).join();
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/admin/media/?brandId=${brandId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r && r.processing.join() !== processing) {
        clearInterval(t);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [processing, brandId, router]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await op("add", { brandId, eventId, kind, name });
    setBusy(false);
    toast(r.ok ?? r.error!, r.error ? "error" : "success");
    if (r.error) return;
    setName("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length ? (
        <ol aria-label={addLabel} className="flex flex-col gap-3">
          {items.map((item, i) => (
            <MediaRow key={item.id} brandId={brandId} item={item} first={i === 0} last={i === items.length - 1} />
          ))}
        </ol>
      ) : (
        <p className="text-small text-muted">{placeholder}</p>
      )}
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <input aria-label={`${addLabel}: name`} value={name} onChange={(e) => setName(e.target.value)} placeholder={allowImages ? "Name, e.g. App icon" : "Name, e.g. Logo reveal"} maxLength={60} required className={`${inputClass} w-64 max-w-full`} />
        {allowImages && (
          <select aria-label={`${addLabel}: type`} value={kind} onChange={(e) => setKind(e.target.value as "VIDEO" | "IMAGE")} className={`${inputClass} w-auto cursor-pointer`}>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
          </select>
        )}
        <button type="submit" disabled={busy} className={buttonClass({ variant: "ghost" })}>
          <Plus aria-hidden className="size-4" /> Add
        </button>
      </form>
    </div>
  );
}

function MediaRow({ brandId, item, first, last }: { brandId: string; item: AdminMediaItem; first: boolean; last: boolean }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const inputId = useId();

  async function save(field: "name" | "description", value: string) {
    if (value.trim() === item[field]) return;
    const r = await op("update", { itemId: item.id, [field]: value });
    toast(r.ok ?? r.error!, r.error ? "error" : "success");
    router.refresh();
  }

  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const up = await uploadFile(file, { purpose: item.kind === "VIDEO" ? "media-video" : "media-image", brandId }, setProgress);
      const r = await op("upload", { itemId: item.id, fileId: up.fileId });
      if (r.error) setError(r.error);
      else toast(r.ok!);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  async function move(direction: "up" | "down") {
    const r = await op("move", { itemId: item.id, direction });
    if (r.error) toast(r.error, "error");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const r = await op("delete", { itemId: item.id });
    setDeleting(false);
    setConfirming(false);
    toast(r.ok ?? r.error!, r.error ? "error" : "success");
    router.refresh();
  }

  const empty = !item.preview && !item.processing;
  return (
    <li aria-label={item.name} className="grid gap-4 rounded-card border border-hairline bg-surface p-4 sm:grid-cols-[240px_minmax(0,1fr)]">
      <label
        htmlFor={inputId}
        className={`relative grid aspect-video cursor-pointer place-items-center overflow-hidden rounded-[10px] ${empty ? "border-[1.5px] border-dashed border-strong bg-track" : "bg-thumb ring-1 ring-hairline"}`}
      >
        {progress !== null ? (
          <span aria-live="polite" className="text-caption tabular-nums text-muted">
            Uploading… {Math.round(progress * 100)}%
          </span>
        ) : item.processing ? (
          <span aria-live="polite" className="flex items-center gap-2 px-3 text-center text-caption text-muted">
            <Loader aria-hidden className="size-4 shrink-0 animate-spin" /> Making MP4, WebM and GIF…
          </span>
        ) : item.preview && "video" in item.preview ? (
          <video src={item.preview.video} poster={item.preview.poster} muted loop autoPlay playsInline className="size-full object-contain" />
        ) : item.preview && "image" in item.preview ? (
          <img src={item.preview.image} alt="" className="size-full object-contain p-2" />
        ) : (
          <span className="grid place-items-center gap-1 px-3 text-center text-caption text-muted">
            {item.kind === "VIDEO" ? <Film aria-hidden className="size-5" /> : <ImageUp aria-hidden className="size-5" />}
            {item.kind === "VIDEO" ? "Upload a video (MP4 or MOV, max 50 MB)" : "Upload an image (SVG, PNG, JPEG or WebP)"}
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept={ACCEPT[item.kind]}
          className="sr-only"
          disabled={progress !== null || item.processing}
          onChange={(e) => (e.target.files?.[0] && upload(e.target.files[0]), (e.target.value = ""))}
        />
      </label>

      <div className="flex min-w-0 flex-col gap-2">
        <input aria-label="Name" defaultValue={item.name} maxLength={60} onBlur={(e) => save("name", e.target.value)} className={`${inputClass} font-medium`} />
        <input aria-label="Description" defaultValue={item.description} maxLength={160} placeholder="One line on when to use it (optional)" onBlur={(e) => save("description", e.target.value)} className={inputClass} />
        {item.info && <p className="text-caption tabular-nums text-muted">{item.info}</p>}
        {(error ?? item.error) && (
          <p role="alert" className="text-caption text-error">
            {error ?? item.error}
          </p>
        )}
        {item.files.length > 0 && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption">
            {item.files.map((f) => (
              <a key={f.url} href={f.url} className="inline-flex items-center gap-1 text-muted hover:text-ink">
                <Download aria-hidden className="size-3.5" />
                {f.label} <span className="tabular-nums">{f.size}</span>
              </a>
            ))}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          <label htmlFor={inputId} className={buttonClass({ variant: "quiet", size: "sm", className: "cursor-pointer" })}>
            <UploadCloud aria-hidden className="size-3.5" /> {empty ? "Upload" : "Replace"}
          </label>
          <button type="button" aria-label={`Move ${item.name} up`} disabled={first} onClick={() => move("up")} className={buttonClass({ variant: "quiet", size: "sm" })}>
            <ArrowUp aria-hidden className="size-3.5" />
          </button>
          <button type="button" aria-label={`Move ${item.name} down`} disabled={last} onClick={() => move("down")} className={buttonClass({ variant: "quiet", size: "sm" })}>
            <ArrowDown aria-hidden className="size-3.5" />
          </button>
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass({ variant: "quiet", size: "sm", className: "ml-auto hover:text-error" })}>
            <Trash2 aria-hidden className="size-3.5" /> Delete
          </button>
        </div>
      </div>
      <ConfirmDialog open={confirming} title={`Delete ${item.name}?`} confirmLabel="Delete" danger pending={deleting} onConfirm={remove} onClose={() => setConfirming(false)}>
        Its files are deleted too, and it disappears from the public page.
      </ConfirmDialog>
    </li>
  );
}
