"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { changeEmail, type FormState } from "@/app/admin/actions";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { Field, PasswordInput, SubmitButton, TextInput } from "../Form";

/** New email + current password, then an inline "are you sure" before it changes. */
export function EmailForm({ email }: { email: string }) {
  const [state, action] = useActionState<FormState, FormData>(changeEmail, undefined);
  const [confirming, setConfirming] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    setConfirming(null);
    if (state?.ok) {
      toast(state.ok);
      formRef.current?.reset();
    }
  }, [state, toast]);

  const ask = () => {
    const form = formRef.current!;
    if (!form.reportValidity()) return;
    setConfirming(String(new FormData(form).get("email")).trim());
  };

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" onSubmit={(e) => !confirming && (e.preventDefault(), ask())}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New email" help={`Currently ${state?.ok ? state.values?.email : email}`}>
          {({ id, describedBy }) => <TextInput id={id} name="email" type="email" required autoComplete="email" aria-describedby={describedBy} defaultValue={state?.ok ? "" : state?.values?.email} />}
        </Field>
        <Field label="Current password">
          {({ id }) => <PasswordInput id={id} name="currentPassword" required autoComplete="current-password" />}
        </Field>
      </div>
      {state?.error && <p role="alert" className="text-small text-error">{state.error}</p>}
      {confirming ? (
        <div role="group" aria-label="Confirm email change" className="flex flex-wrap items-center justify-end gap-2 rounded-[10px] bg-track p-3">
          <p className="mr-auto text-small">
            Sign in with <strong className="font-semibold">{confirming}</strong> from now on?
          </p>
          <button type="button" onClick={() => setConfirming(null)} className={buttonClass({ variant: "ghost", size: "sm" })}>
            Cancel
          </button>
          <SubmitButton size="sm">Change email</SubmitButton>
        </div>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={ask} className={buttonClass({ variant: "ghost" })}>
            Update email
          </button>
        </div>
      )}
    </form>
  );
}
