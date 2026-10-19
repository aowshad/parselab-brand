"use client";

import { Check, ImageUp, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { uploadFile } from "@/lib/admin/upload-client";
import { USAGE_LIMITS } from "@/lib/usage";
import { Markdown } from "../../usage/Markdown";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { inputClass } from "../Form";
import { useLeaveGuard } from "../useLeaveGuard";

export type EditorSide = { fileId: string | null; src: string | null; caption: string };
export type EditorPair = { do: EditorSide; dont: EditorSide };
export type EditorUsage = { markdown: string; pairs: EditorPair[] } | null;

const PLACEHOLDER = `## Clear space
Keep space around the logo equal to the height of the icon.

## Minimum size
Don't use the full logo smaller than 96 px wide on screen, or 24 mm in print.`;

const emptySide = (): EditorSide => ({ fileId: null, src: null, caption: "" });
/** What's saved: file ids and captions (image URLs are only for the editor). */
const toSaved = (u: EditorUsage) =>
  u && { markdown: u.markdown, pairs: u.pairs.map((p) => ({ do: { fileId: p.do.fileId, caption: p.do.caption }, dont: { fileId: p.dont.fileId, caption: p.dont.caption } })) };

/** Usage tab: "Coming soon", or written guidelines (Markdown) plus Do / Don't pairs. */
export function UsageEditor({ brandId, initial }: { brandId: string; initial: EditorUsage }) {
  const [saved, setSaved] = useState(initial);
  const [comingSoon, setComingSoon] = useState(initial === null);
  const [markdown, setMarkdown] = useState(initial?.markdown ?? "");
  const [pairs, setPairs] = useState<EditorPair[]>(initial?.pairs ?? []);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const current: EditorUsage = comingSoon ? null : { markdown, pairs };
  const dirty = JSON.stringify(toSaved(current)) !== JSON.stringify(toSaved(saved));
  useLeaveGuard(dirty);

  const setSide = (i: number, which: "do" | "dont", patch: Partial<EditorSide>) =>
    setPairs((ps) => ps.map((p, j) => (j === i ? { ...p, [which]: { ...p[which], ...patch } } : p)));

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/usage/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, usage: toSaved(current) }) }).catch(() => null);
    const r = res ? await res.json().catch(() => ({})) : { error: "No connection. Try again." };
    setSaving(false);
    if (r.error) return setError(r.error);
    setError(null);
    setSaved(current);
    toast(r.ok);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <label className="flex cursor-pointer items-start gap-3 rounded-card border border-hairline bg-surface p-5">
        <input type="checkbox" checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} className="mt-1 size-4 accent-ink" />
        <span>
          <span className="block text-small font-semibold">Show as &ldquo;Coming soon&rdquo;</span>
          <span className="block text-small text-muted">Turn off to publish usage guidelines on the public page.</span>
        </span>
      </label>

      {!comingSoon && (
        <>
          <section aria-labelledby="guide-h" className="rounded-card border border-hairline bg-surface p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="guide-h" className="mr-auto text-h3">
                Guidelines
              </h2>
              <div role="radiogroup" aria-label="Editor mode" className="inline-flex rounded-segment bg-track p-1">
                {(["write", "preview"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={`motion-colors h-7 rounded-segment-item px-3 text-caption font-medium ${mode === m ? "bg-pill text-ink shadow-pill" : "text-muted hover:text-ink"}`}
                  >
                    {m === "write" ? "Write" : "Preview"}
                  </button>
                ))}
              </div>
            </div>
            {mode === "write" ? (
              <>
                <label htmlFor="usage-md" className="sr-only">
                  Guidelines (Markdown)
                </label>
                <textarea
                  id="usage-md"
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  maxLength={USAGE_LIMITS.markdown}
                  placeholder={PLACEHOLDER}
                  className={`${inputClass} mt-3 h-auto min-h-[240px] resize-y py-3 leading-6`}
                />
                <p className="mt-1.5 text-caption text-muted">
                  Markdown: ## headings, **bold**, lists and links. Images go in the Do / Don&apos;t pairs below.
                </p>
              </>
            ) : (
              <div className="mt-4 min-h-[120px]">{markdown.trim() ? <Markdown>{markdown}</Markdown> : <p className="text-small text-muted">Nothing written yet.</p>}</div>
            )}
          </section>

          <section aria-labelledby="pairs-h" className="rounded-card border border-hairline bg-surface p-5">
            <div className="flex items-center gap-3">
              <h2 id="pairs-h" className="mr-auto text-h3">
                Do / Don&apos;t
              </h2>
              <button
                type="button"
                disabled={pairs.length >= USAGE_LIMITS.pairs}
                onClick={() => setPairs((ps) => [...ps, { do: emptySide(), dont: emptySide() }])}
                className={buttonClass({ variant: "ghost", size: "sm" })}
              >
                <Plus aria-hidden className="size-3.5" /> Add pair
              </button>
            </div>
            {pairs.length ? (
              <ol className="mt-4 flex flex-col gap-5">
                {pairs.map((p, i) => (
                  <li key={i} aria-label={`Pair ${i + 1}`} className="rounded-[12px] border border-hairline p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SideEditor brandId={brandId} label="Do" good side={p.do} onChange={(patch) => setSide(i, "do", patch)} />
                      <SideEditor brandId={brandId} label="Don't" good={false} side={p.dont} onChange={(patch) => setSide(i, "dont", patch)} />
                    </div>
                    <button type="button" onClick={() => setPairs((ps) => ps.filter((_, j) => j !== i))} className={buttonClass({ variant: "quiet", size: "sm", className: "mt-3 hover:text-error" })}>
                      <Trash2 aria-hidden className="size-3.5" /> Remove pair
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-small text-muted">No pairs yet. Show a correct use next to a wrong one, each with a short caption.</p>
            )}
          </section>
        </>
      )}

      {error && (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      )}
      <div inert={!dirty} className={`motion-fade fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 ${dirty ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div role="region" aria-label="Unsaved changes" className="flex items-center gap-2 rounded-[14px] bg-btn py-2 pl-4 pr-2 text-small text-btn-ink shadow-toast">
          <span className="mr-2">Unsaved changes</span>
          <button
            type="button"
            onClick={() => {
              setComingSoon(saved === null);
              setMarkdown(saved?.markdown ?? "");
              setPairs(saved?.pairs ?? []);
              setError(null);
            }}
            className="motion-colors h-8 rounded-button-sm px-3 font-medium hover:bg-btn-ink/10"
          >
            Discard
          </button>
          <button type="button" disabled={saving} onClick={save} className={buttonClass({ variant: "inverse", size: "sm" })}>
            {saving && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** One side of a pair: an image (upload, replace, remove) and a caption. */
function SideEditor({ brandId, label, good, side, onChange }: { brandId: string; label: string; good: boolean; side: EditorSide; onChange: (patch: Partial<EditorSide>) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const r = await uploadFile(file, { purpose: "usage-image", brandId }, setProgress);
      onChange({ fileId: r.fileId, src: r.url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  return (
    <div aria-label={label} role="group" className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-small font-semibold">
        <span className={`grid size-5 place-items-center rounded-full text-btn-ink ${good ? "bg-success" : "bg-error"}`}>
          {good ? <Check aria-hidden className="size-3.5" /> : <X aria-hidden className="size-3.5" />}
        </span>
        {label}
      </p>
      <label
        htmlFor={id}
        className={`relative grid aspect-[16/10] cursor-pointer place-items-center overflow-hidden rounded-[10px] ${side.src ? "bg-thumb ring-1 ring-hairline" : "border-[1.5px] border-dashed border-strong bg-track"}`}
      >
        {progress !== null ? (
          <span className="text-caption tabular-nums text-muted">Uploading… {Math.round(progress * 100)}%</span>
        ) : side.src ? (
          <img src={side.src} alt="" className="max-h-full max-w-full object-contain p-3" />
        ) : (
          <span className="grid place-items-center gap-1 text-caption text-muted">
            <ImageUp aria-hidden className="size-5" />
            Upload an image (SVG, PNG, JPEG or WebP, max 5 MB)
          </span>
        )}
        <input id={id} type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" disabled={progress !== null} onChange={(e) => (e.target.files?.[0] && upload(e.target.files[0]), (e.target.value = ""))} />
      </label>
      {side.src && (
        <button type="button" onClick={() => onChange({ fileId: null, src: null })} className={buttonClass({ variant: "quiet", size: "sm", className: "self-start" })}>
          Remove image
        </button>
      )}
      {error && (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      )}
      <input aria-label={`${label} caption`} value={side.caption} onChange={(e) => onChange({ caption: e.target.value })} maxLength={USAGE_LIMITS.caption} placeholder={good ? "Use the full logo on light backgrounds" : "Don't stretch or recolor the logo"} className={inputClass} />
    </div>
  );
}
