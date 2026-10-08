"use client";

import { useActionState, useState } from "react";
import { createBrand, type ActionResult } from "@/app/admin/brands/actions";
import { slugify, slugProblem } from "@/lib/slug";
import { Field, inputClass, SubmitButton, TextInput } from "../Form";

/** Name → slug follows automatically until you edit the slug yourself. New brands start as Draft. */
export function NewBrandForm() {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(createBrand, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const shownSlug = slugTouched ? slug : slugify(name);
  const hint = shownSlug ? slugProblem(shownSlug) : null;
  const err = state?.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Brand name" error={err.name}>
        {({ id, describedBy }) => <TextInput id={id} name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ProductsModel" aria-describedby={describedBy} invalid={!!err.name} />}
      </Field>
      <Field label="URL" error={err.slug ?? hint ?? undefined} help={!err.slug && !hint ? "Filled in from the name. Lowercase letters, numbers and dashes." : undefined}>
        {({ id, describedBy }) => (
          <div className="flex">
            <span className="flex items-center rounded-l-button border border-r-0 border-strong bg-track px-3 text-small text-muted">/</span>
            <input
              id={id}
              name="slug"
              value={shownSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              aria-describedby={describedBy}
              aria-invalid={!!(err.slug || hint) || undefined}
              placeholder="productsmodel"
              className={`${inputClass} rounded-l-none`}
            />
          </div>
        )}
      </Field>
      <Field label="Tagline" error={err.tagline} help="One short line, shown under the name.">
        {({ id, describedBy }) => <TextInput id={id} name="tagline" maxLength={140} placeholder="Optional" aria-describedby={describedBy} invalid={!!err.tagline} />}
      </Field>
      {state?.error && <p role="alert" className="text-small text-error">{state.error}</p>}
      <p className="rounded-[10px] bg-track px-3 py-2.5 text-caption text-muted">
        New brands start as <strong className="font-semibold text-ink">Draft</strong>: hidden from the public site until you set them to Soon or Live.
      </p>
      <div className="flex justify-end gap-2">
        <a href="/admin/" className="motion-press inline-flex h-10 items-center rounded-button border border-control bg-surface px-4 text-small font-medium hover:bg-hover">
          Cancel
        </a>
        <SubmitButton>Create brand</SubmitButton>
      </div>
    </form>
  );
}
