"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/app/admin/actions";
import { Field, PasswordInput, SubmitButton, TextInput } from "./Form";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        {({ id }) => <TextInput id={id} name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.values?.email} invalid={!!state?.error} />}
      </Field>
      <Field label="Password">
        {({ id }) => <PasswordInput id={id} name="password" autoComplete="current-password" required invalid={!!state?.error} />}
      </Field>
      {state?.error && (
        <p role="alert" className="text-small text-error">
          {state.error}
        </p>
      )}
      <SubmitButton className="mt-2 w-full">Sign in</SubmitButton>
    </form>
  );
}
