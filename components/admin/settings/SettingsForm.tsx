"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminOp } from "@/lib/admin/api-client";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { Field, TextInput, inputClass } from "../Form";
import { useLeaveGuard } from "../useLeaveGuard";

export type SiteTexts = { homeTitle: string; homeSubtitle: string; footerText: string; contactEmail: string };

/** The home page and footer texts, saved together. */
export function SettingsForm({ initial, limits }: { initial: SiteTexts; limits: Record<keyof SiteTexts, number> }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  useLeaveGuard(dirty);
  const set = (k: keyof SiteTexts) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await adminOp("/api/admin/settings/", "save", values);
    setSaving(false);
    if (r.error) return setError(r.error);
    setError(null);
    setSaved(values);
    toast(r.ok!);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Home title">{({ id }) => <TextInput id={id} value={values.homeTitle} onChange={set("homeTitle")} required maxLength={limits.homeTitle} />}</Field>
      <Field label="Home subtitle">
        {({ id }) => <textarea id={id} value={values.homeSubtitle} onChange={set("homeSubtitle")} required maxLength={limits.homeSubtitle} rows={2} className={`${inputClass} h-auto resize-y py-2.5 leading-6`} />}
      </Field>
      <Field label="Footer text" help="Shown at the bottom of every public page.">
        {({ id, describedBy }) => <TextInput id={id} value={values.footerText} onChange={set("footerText")} required maxLength={limits.footerText} aria-describedby={describedBy} />}
      </Field>
      <Field label="Contact email" help="Linked in the footer of every public page.">
        {({ id, describedBy }) => <TextInput id={id} type="email" value={values.contactEmail} onChange={set("contactEmail")} required maxLength={limits.contactEmail} aria-describedby={describedBy} />}
      </Field>
      {error && (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {dirty && (
          <button type="button" onClick={() => (setValues(saved), setError(null))} className={buttonClass({ variant: "ghost" })}>
            Discard
          </button>
        )}
        <button type="submit" disabled={!dirty || saving} className={buttonClass({ variant: "primary" })}>
          {saving && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
          Save changes
        </button>
      </div>
    </form>
  );
}
