"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WEIGHT_NAMES, typeScale } from "@/lib/typography";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { inputClass } from "../Form";
import { useLeaveGuard } from "../useLeaveGuard";

export type FontOption = { family: string; stack: string; weights: number[]; source: string };
type Use = "headings" | "body" | "both";
type Face = { family: string; role: string; use: Use; weights: number[]; url: string };
type Typography = { typefaces: Face[] } | null;

const USE_LABEL: Record<Use, string> = { headings: "Headings", body: "Body", both: "Both" };
const MAX = 4;

/** Typography tab: "Coming soon" or a list of typefaces, previewed in the real fonts. */
export function TypographyEditor({ brandId, brandName, initial, fonts }: { brandId: string; brandName: string; initial: Typography; fonts: FontOption[] }) {
  const byFamily = new Map(fonts.map((f) => [f.family, f]));
  const blank = (family = fonts[0]!.family): Face => ({ family, role: "Headings & body", use: "both", weights: byFamily.get(family)!.weights.filter((w) => w >= 400 && w <= 700).slice(0, 4), url: byFamily.get(family)!.source });
  const [saved, setSaved] = useState(initial);
  const [comingSoon, setComingSoon] = useState(initial === null);
  const [faces, setFaces] = useState<Face[]>(initial?.typefaces ?? [blank()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const current: Typography = comingSoon ? null : { typefaces: faces };
  const dirty = JSON.stringify(current) !== JSON.stringify(saved);
  useLeaveGuard(dirty);

  const update = (i: number, patch: Partial<Face>) => setFaces((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const changeFamily = (i: number, family: string) => {
    const opt = byFamily.get(family)!;
    const f = faces[i]!;
    const kept = f.weights.filter((w) => opt.weights.includes(w));
    // Keep a custom link; replace the old family's default one.
    const url = !f.url || f.url === byFamily.get(f.family)?.source ? opt.source : f.url;
    update(i, { family, weights: kept.length ? kept : [opt.weights.includes(400) ? 400 : opt.weights[0]!], url });
  };

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/typography/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, typography: current }) }).catch(() => null);
    const r = res ? await res.json().catch(() => ({})) : { error: "No connection. Try again." };
    setSaving(false);
    if (r.error) return setError(r.error);
    setError(null);
    setSaved(current);
    toast(r.ok);
    router.refresh();
  }

  const preview = !comingSoon && faces.length ? typeScale(brandName, faces) : [];

  return (
    <div className="flex flex-col gap-4 pb-20">
      <label className="flex cursor-pointer items-start gap-3 rounded-card border border-hairline bg-surface p-5">
        <input type="checkbox" checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} className="mt-1 size-4 accent-ink" />
        <span>
          <span className="block text-small font-semibold">Show as &ldquo;Coming soon&rdquo;</span>
          <span className="block text-small text-muted">Turn off to publish the typography section on the public page.</span>
        </span>
      </label>

      {!comingSoon && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {faces.map((f, i) => {
              const opt = byFamily.get(f.family)!;
              return (
                <section key={i} aria-label={`Typeface ${i + 1}`} className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
                  <div className="grid h-24 place-items-center rounded-[12px] bg-thumb ring-1 ring-hairline" style={{ fontFamily: opt.stack }}>
                    <span className="text-[48px] leading-none" style={{ fontWeight: Math.max(...f.weights) }}>
                      Aa
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-caption text-muted">Family</span>
                      <select value={f.family} onChange={(e) => changeFamily(i, e.target.value)} className={`${inputClass} cursor-pointer`}>
                        {fonts.map((o) => (
                          <option key={o.family}>{o.family}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-caption text-muted">Sets</span>
                      <select value={f.use} onChange={(e) => update(i, { use: e.target.value as Use })} className={`${inputClass} cursor-pointer`}>
                        {(Object.keys(USE_LABEL) as Use[]).map((u) => (
                          <option key={u} value={u}>
                            {USE_LABEL[u]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-caption text-muted">Role (shown on the card)</span>
                    <input value={f.role} onChange={(e) => update(i, { role: e.target.value })} maxLength={40} placeholder="Body & UI" className={inputClass} />
                  </label>
                  <fieldset>
                    <legend className="mb-1.5 text-caption text-muted">Weights</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {opt.weights.map((w) => {
                        const on = f.weights.includes(w);
                        return (
                          <label key={w} className={`motion-colors cursor-pointer rounded-full border px-2.5 py-1 text-caption tabular-nums ${on ? "border-ink bg-ink text-btn-ink" : "border-control text-muted hover:text-ink"}`}>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={on}
                              onChange={() => update(i, { weights: on ? f.weights.filter((x) => x !== w) : [...f.weights, w].sort((a, b) => a - b) })}
                            />
                            {WEIGHT_NAMES[w]} {w}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className="block">
                    <span className="mb-1.5 block text-caption text-muted">Where to get it</span>
                    <input type="url" value={f.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://fonts.google.com/…" className={inputClass} />
                  </label>
                  <p className="text-small text-muted" style={{ fontFamily: opt.stack }}>
                    The quick brown fox jumps over the lazy dog. 0123456789
                  </p>
                  {faces.length > 1 && (
                    <button type="button" onClick={() => setFaces((fs) => fs.filter((_, j) => j !== i))} className={buttonClass({ variant: "quiet", size: "sm", className: "self-start hover:text-error" })}>
                      <Trash2 aria-hidden className="size-3.5" /> Remove typeface
                    </button>
                  )}
                </section>
              );
            })}
          </div>
          {faces.length < MAX && (
            <button type="button" onClick={() => setFaces((fs) => [...fs, { ...blank(), role: "Body & UI", use: "body" }])} className={buttonClass({ variant: "ghost", className: "self-start" })}>
              <Plus aria-hidden className="size-4" /> Add typeface
            </button>
          )}
          <p className="text-caption text-muted">
            Families are self-hosted, so only these are available. Adding another means listing it in lib/fonts.ts and lib/font-catalog.ts (a developer change).
          </p>

          {preview.length > 0 && (
            <section aria-labelledby="scale-h" className="rounded-card border border-hairline bg-surface p-5">
              <h2 id="scale-h" className="text-h3">
                Type scale
              </h2>
              <p className="mt-1 text-small text-muted">The same steps for every brand, set in these typefaces.</p>
              <ol className="mt-4 divide-y divide-hairline">
                {preview.map((step) => (
                  <li key={step.name} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-baseline">
                    <span className="text-caption tabular-nums text-muted">
                      {step.name} · {step.size}/{step.lineHeight} · {WEIGHT_NAMES[step.weight]}
                    </span>
                    <span className="min-w-0 truncate" style={{ fontFamily: byFamily.get(step.face.family)?.stack, fontSize: Math.min(step.size, 36), lineHeight: 1.25, fontWeight: step.weight }}>
                      {step.sample}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
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
              setFaces(saved?.typefaces ?? [blank()]);
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
