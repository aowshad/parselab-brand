"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { changePassword, type FormState } from "@/app/admin/actions";
import { useToast } from "../../ui/Toast";
import { Field, PasswordInput, StrengthMeter, SubmitButton } from "../Form";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, undefined);
  const [next, setNext] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (state?.ok) {
      toast(state.ok);
      formRef.current?.reset();
      setNext("");
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <Field label="Current password">
        {({ id }) => <PasswordInput id={id} name="currentPassword" required autoComplete="current-password" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password">
          {({ id }) => (
            <>
              <PasswordInput id={id} name="newPassword" required minLength={12} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
              <StrengthMeter password={next} />
            </>
          )}
        </Field>
        <Field label="Confirm new password">
          {({ id }) => <PasswordInput id={id} name="confirmPassword" required minLength={12} autoComplete="new-password" />}
        </Field>
      </div>
      {state?.error && <p role="alert" className="text-small text-error">{state.error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-caption text-muted">Signs you out everywhere else. This browser stays signed in.</p>
        <SubmitButton>Change password</SubmitButton>
      </div>
    </form>
  );
}
