"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "../ui/Button";
import { inputClass } from "./Form";

/**
 * Confirm dialog on the native <dialog> (focus trap, Esc to close, inert background). With
 * `requireText`, the confirm button stays disabled until that exact text is typed.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  requireText,
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  requireText?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setTyped("");
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const ready = !pending && (!requireText || typed === requireText);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-hairline bg-surface p-0 text-ink shadow-menu backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
    >
      <form
        method="dialog"
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onConfirm();
        }}
      >
        <h2 id={titleId} className="text-h3">
          {title}
        </h2>
        <div className="mt-2 text-small text-pretty text-muted">{children}</div>
        {requireText && (
          <div className="mt-4">
            <label htmlFor={inputId} className="mb-1.5 block text-caption text-muted">
              Type <strong className="font-semibold text-ink">{requireText}</strong> to confirm
            </label>
            <input id={inputId} autoFocus autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass({ variant: "ghost" })}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready}
            autoFocus={!requireText}
            className={buttonClass({ variant: "primary", className: danger ? "bg-error text-btn-ink hover:bg-error/90" : "" })}
          >
            {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
