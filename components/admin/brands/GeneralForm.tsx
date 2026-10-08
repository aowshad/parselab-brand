"use client";

import { TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { removeRedirect, saveGeneral, type ActionResult } from "@/app/admin/brands/actions";
import type { EditorBrand } from "@/lib/admin/brands";
import { slugProblem } from "@/lib/slug";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { Field, inputClass, SubmitButton, TextInput } from "../Form";
import { STATUS_HELP, STATUS_LABEL, type Status } from "../StatusSelect";

type Values = { name: string; slug: string; tagline: string; status: Status; accent: string };

/** Asks before leaving with unsaved changes: closing the tab, or clicking an in-app link. */
function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}

export function GeneralForm({ brand }: { brand: EditorBrand }) {
  const initial: Values = { name: brand.name, slug: brand.slug, tagline: brand.tagline, status: brand.status, accent: brand.accent ?? "" };
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [keepRedirect, setKeepRedirect] = useState(true);
  const [state, action] = useActionState<ActionResult | undefined, FormData>(saveGeneral.bind(null, brand.id), undefined);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();

  const dirty = (Object.keys(v) as (keyof Values)[]).some((k) => v[k] !== saved[k]);
  useLeaveGuard(dirty);

  useEffect(() => {
    if (state?.ok) {
      toast(state.ok);
      setSaved(v);
      router.refresh();
    } else if (state?.error) toast(state.error, "error");
    // Only when a save comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: k === "slug" ? e.target.value.toLowerCase() : e.target.value }));
  const err = state?.fieldErrors ?? {};
  const slugHint = slugProblem(v.slug);
  const renamed = v.slug !== saved.slug;
  const accentValid = /^#[0-9A-Fa-f]{6}$/.test(v.accent);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      <Field label="Brand name" error={err.name}>
        {({ id, describedBy }) => <TextInput id={id} name="name" required value={v.name} onChange={set("name")} aria-describedby={describedBy} invalid={!!err.name} />}
      </Field>

      <Field label="URL" error={err.slug ?? (v.slug !== saved.slug ? slugHint : null) ?? undefined}>
        {({ id, describedBy }) => (
          <div className="flex">
            <span className="flex items-center rounded-l-button border border-r-0 border-strong bg-track px-3 text-small text-muted">/</span>
            <input id={id} name="slug" required value={v.slug} onChange={set("slug")} aria-describedby={describedBy} aria-invalid={!!(err.slug || (renamed && slugHint)) || undefined} className={`${inputClass} rounded-l-none`} />
          </div>
        )}
      </Field>
      {renamed && !slugHint && (
        <div role="status" className="-mt-2 rounded-[10px] border border-hairline bg-track p-3 text-small">
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-error" />
            <span>
              Changing the URL breaks links to <strong className="font-semibold">/{saved.slug}/</strong> that people have shared or bookmarked.
            </span>
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 pl-6">
            <input type="checkbox" name="keepRedirect" checked={keepRedirect} onChange={(e) => setKeepRedirect(e.target.checked)} className="size-4 accent-ink" />
            Keep /{saved.slug}/ working: redirect it to /{v.slug}/
          </label>
        </div>
      )}
      {brand.redirects.length > 0 && (
        <div className="-mt-2">
          <p className="text-caption text-muted">Old URLs that redirect here</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {brand.redirects.map((r) => (
              <li key={r} className="inline-flex h-7 items-center gap-1 rounded-full border border-hairline bg-track pl-3 pr-1 text-caption tabular-nums">
                /{r}/
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Stop redirecting /${r}/`}
                  onClick={() =>
                    start(async () => {
                      const res = await removeRedirect(brand.id, r);
                      toast(res.ok ?? res.error!, res.error ? "error" : "success");
                      router.refresh();
                    })
                  }
                  className="grid size-5 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field label="Tagline" error={err.tagline} help="One short line under the name, on the home card and the brand page.">
        {({ id, describedBy }) => <TextInput id={id} name="tagline" maxLength={140} value={v.tagline} onChange={set("tagline")} aria-describedby={describedBy} invalid={!!err.tagline} />}
      </Field>

      <Field label="Status" error={err.status} help={STATUS_HELP[v.status]}>
        {({ id, describedBy }) => (
          <select id={id} name="status" value={v.status} onChange={set("status")} aria-describedby={describedBy} className={`${inputClass} cursor-pointer`}>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Accent color" error={err.accent} help="Optional. A 6-digit hex color.">
        {({ id, describedBy }) => (
          <div className="flex items-center gap-2">
            {/* The swatch shows the color, or a struck-through "none"; the picker sits invisibly on top. */}
            <span
              className="relative h-10 w-12 shrink-0 overflow-hidden rounded-button border border-strong"
              style={accentValid ? { background: v.accent } : { background: "linear-gradient(to top right, transparent calc(50% - 0.75px), var(--border-strong) 50%, transparent calc(50% + 0.75px)), var(--surface)" }}
            >
              <input
                type="color"
                aria-label="Pick the accent color"
                value={accentValid ? v.accent : "#6CA9F3"}
                onChange={(e) => setV((x) => ({ ...x, accent: e.target.value.toUpperCase() }))}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </span>
            <TextInput id={id} name="accent" value={v.accent} onChange={set("accent")} placeholder="#6CA9F3" maxLength={7} aria-describedby={describedBy} invalid={!!err.accent} />
            {v.accent && (
              <button type="button" onClick={() => setV((x) => ({ ...x, accent: "" }))} className={buttonClass({ variant: "quiet", size: "sm" })}>
                Clear
              </button>
            )}
          </div>
        )}
      </Field>

      {/* Appears only with unsaved changes; Save is also the form's Enter key. */}
      <div
        inert={!dirty}
        className={`motion-fade fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 ${dirty ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div role="region" aria-label="Unsaved changes" className="flex items-center gap-2 rounded-[14px] bg-btn py-2 pl-4 pr-2 text-small text-btn-ink shadow-toast">
          <span className="mr-2">Unsaved changes</span>
          <button type="button" onClick={() => setV(saved)} className="motion-colors h-8 rounded-button-sm px-3 font-medium hover:bg-btn-ink/10">
            Discard
          </button>
          <SubmitButton variant="inverse" size="sm">Save</SubmitButton>
        </div>
      </div>
    </form>
  );
}
