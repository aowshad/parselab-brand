"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { OpReply } from "@/lib/admin/api-client";
import { MAX_STOPS, MIN_STOPS, normalizeHex } from "@/lib/admin/color-input";
import type { EditorColor } from "@/lib/admin/color-editor";
import { describeColor, gradientCss } from "@/lib/color";
import { buttonClass } from "../../ui/Button";
import { inputClass } from "../Form";

type Stop = { hex: string; at: number };
type Draft = { kind: "SOLID" | "GRADIENT"; role: string; name: string; hex: string; cmyk: string; pantone: string; angle: number; stops: Stop[] };

const fromColor = (c: EditorColor | null): Draft => ({
  kind: c?.kind ?? "SOLID",
  role: c?.role ?? "",
  name: c?.name ?? "",
  hex: c?.hex ?? "#6CA9F3",
  cmyk: c?.cmyk ?? "",
  pantone: c?.pantone ?? "",
  angle: c?.gradient?.angle ?? 135,
  stops: c?.gradient?.stops ?? [
    { hex: "#6CA9F3", at: 0 },
    { hex: "#FF9933", at: 100 },
  ],
});

/** Side panel (a modal <dialog> docked right: focus stays inside, Esc closes) to add or edit a color. */
export function ColorPanel({ open, color, onClose, onSave }: { open: boolean; color: EditorColor | null; onClose: () => void; onSave: (c: unknown) => Promise<OpReply> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [d, setD] = useState<Draft>(() => fromColor(color));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setD(fromColor(color));
      setError(null);
      el.showModal();
    } else if (!open && el.open) el.close();
  }, [open, color]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const hex = normalizeHex(d.hex);
  const info = hex ? describeColor(hex) : null;
  const stopsValid = d.stops.every((s) => normalizeHex(s.hex));
  const preview = d.kind === "SOLID" ? (hex ?? "transparent") : stopsValid ? gradientCss(d.angle, d.stops.map((s) => ({ ...s, hex: normalizeHex(s.hex)! }))) : "transparent";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload =
      d.kind === "SOLID"
        ? { kind: "SOLID", role: d.role, name: d.name, hex: d.hex, cmyk: d.cmyk, pantone: d.pantone }
        : { kind: "GRADIENT", role: d.role, name: d.name, angle: d.angle, stops: d.stops };
    const r = await onSave(payload);
    setSaving(false);
    setError(r.error ?? null);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(420px,100vw)] max-w-none border-l border-hairline bg-surface p-0 text-ink shadow-menu backdrop:bg-ink/20"
    >
      <form onSubmit={save} className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-hairline px-5 py-4">
          <h2 id={titleId} className="text-h3">
            {color ? `Edit ${color.name}` : "Add color"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid size-8 place-items-center rounded-[8px] text-muted hover:bg-hover hover:text-ink">
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div role="radiogroup" aria-label="Type" className="inline-flex self-start rounded-segment bg-track p-1">
            {(["SOLID", "GRADIENT"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={d.kind === k}
                onClick={() => set("kind", k)}
                className={`motion-colors h-8 rounded-segment-item px-3 text-small font-medium ${d.kind === k ? "bg-pill text-ink shadow-pill" : "text-muted hover:text-ink"}`}
              >
                {k === "SOLID" ? "Solid" : "Gradient"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-caption text-muted">Role</span>
              <input required value={d.role} onChange={(e) => set("role", e.target.value)} maxLength={40} placeholder="Primary" className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-caption text-muted">Name</span>
              <input required value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="Blue" className={inputClass} />
            </label>
          </div>

          <div aria-hidden className="h-24 rounded-[12px] shadow-[inset_0_0_0_1px_var(--swatch-edge)]" style={{ background: preview }} />

          {d.kind === "SOLID" ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-caption text-muted">Hex</span>
                <span className="flex items-center gap-2">
                  <input type="color" aria-label="Pick the color" value={hex ?? "#000000"} onChange={(e) => set("hex", e.target.value.toUpperCase())} className="h-10 w-12 shrink-0 cursor-pointer rounded-button border border-strong bg-surface p-1" />
                  <input value={d.hex} onChange={(e) => set("hex", e.target.value)} aria-invalid={!hex || undefined} className={`${inputClass} tabular-nums`} placeholder="#6CA9F3" />
                </span>
                <span className={`mt-1.5 block text-caption tabular-nums ${hex ? "text-muted" : "text-error"}`}>
                  {info ? `${info.rgb} · ${info.hsl} (calculated)` : "3 or 6 hex digits, with or without #"}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-caption text-muted">CMYK (optional)</span>
                  <input value={d.cmyk} onChange={(e) => set("cmyk", e.target.value)} maxLength={40} placeholder="56 30 0 5" className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-caption text-muted">Pantone (optional)</span>
                  <input value={d.pantone} onChange={(e) => set("pantone", e.target.value)} maxLength={40} placeholder="2915 C" className={inputClass} />
                </label>
              </div>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 flex justify-between text-caption text-muted">
                  Angle <span className="tabular-nums text-ink">{d.angle}°</span>
                </span>
                <input type="range" min={0} max={360} value={d.angle} onChange={(e) => set("angle", Number(e.target.value))} className="w-full accent-ink" />
              </label>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-caption text-muted">
                  Stops ({MIN_STOPS}–{MAX_STOPS})
                </legend>
                {d.stops.map((s, i) => {
                  const ok = normalizeHex(s.hex);
                  const update = (patch: Partial<Stop>) => set("stops", d.stops.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <input type="color" aria-label={`Stop ${i + 1} color`} value={ok ?? "#000000"} onChange={(e) => update({ hex: e.target.value.toUpperCase() })} className="h-9 w-10 shrink-0 cursor-pointer rounded-button border border-strong bg-surface p-1" />
                      <span className="min-w-0 flex-1">
                        <input aria-label={`Stop ${i + 1} hex`} value={s.hex} onChange={(e) => update({ hex: e.target.value })} aria-invalid={!ok || undefined} className={`${inputClass} h-9 tabular-nums`} />
                      </span>
                      <span className="w-[72px] shrink-0">
                        <input aria-label={`Stop ${i + 1} position`} type="number" min={0} max={100} value={s.at} onChange={(e) => update({ at: Number(e.target.value) })} className={`${inputClass} h-9 tabular-nums`} />
                      </span>
                      <span className="text-caption text-muted">%</span>
                      <button type="button" disabled={d.stops.length <= MIN_STOPS} onClick={() => set("stops", d.stops.filter((_, j) => j !== i))} aria-label={`Remove stop ${i + 1}`} className="grid size-8 shrink-0 place-items-center rounded-[8px] text-muted hover:bg-hover hover:text-ink disabled:opacity-30">
                        <Minus aria-hidden className="size-4" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  disabled={d.stops.length >= MAX_STOPS}
                  onClick={() => set("stops", [...d.stops, { hex: d.stops.at(-1)?.hex ?? "#FFFFFF", at: 100 }])}
                  className={buttonClass({ variant: "ghost", size: "sm", className: "self-start" })}
                >
                  <Plus aria-hidden className="size-3.5" /> Add stop
                </button>
              </fieldset>
            </>
          )}
          {error && (
            <p role="alert" className="text-small text-error">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-hairline px-5 py-4">
          <button type="button" onClick={onClose} className={buttonClass({ variant: "ghost" })}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={buttonClass({ variant: "primary" })}>
            {saving && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
            {color ? "Save color" : "Add color"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
