"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "../ui/Button";

export const inputClass =
  "motion-colors h-10 w-full rounded-button border border-strong bg-surface px-3 text-small text-ink placeholder:text-muted aria-invalid:border-error";

/** Label, control, then help or error text, wired up with ids for screen readers. */
export function Field({
  label,
  help,
  error,
  aside,
  children,
}: {
  label: string;
  help?: ReactNode;
  error?: string;
  aside?: ReactNode;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}) {
  const id = useId();
  const note = error ?? help;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-caption text-muted">
          {label}
        </label>
        {aside}
      </div>
      {children({ id, describedBy: note ? `${id}-note` : undefined })}
      {note && (
        <p id={`${id}-note`} className={`mt-1.5 text-caption ${error ? "text-error" : "text-muted"}`}>
          {note}
        </p>
      )}
    </div>
  );
}

export function TextInput({ invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={inputClass} {...props} />;
}

/** Password input with a Show / Hide toggle inside the field. */
export function PasswordInput({ invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input type={shown ? "text" : "password"} aria-invalid={invalid || undefined} className={`${inputClass} pr-11`} {...props} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="motion-colors absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-button text-muted hover:text-ink"
      >
        {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

/** Submit button that shows a spinner and blocks double submits while the action runs. */
export function SubmitButton({ children, variant = "primary", className = "" }: { children: ReactNode; variant?: "primary" | "ghost"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass({ variant, className })}>
      {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

/** Rough strength: length plus character variety, 0–4 bars. Never sent anywhere. */
export function strength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  let score = pw.length >= 12 ? 2 : pw.length >= 8 ? 1 : 0;
  if (pw.length >= 16) score++;
  if (kinds >= 3) score++;
  if (/^(.)\1+$/.test(pw) || /password|parselab|qwerty|123456/i.test(pw)) score = Math.min(score, 1);
  score = Math.min(score, 4);
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score]! };
}

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = strength(password);
  return (
    <div aria-live="polite" className="mt-2">
      <div aria-hidden className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`motion-colors h-1 rounded-full ${password && i <= score ? "bg-ink" : "bg-track"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-caption text-muted">
        {password ? `${label} · ` : ""}At least 12 characters
      </p>
    </div>
  );
}
