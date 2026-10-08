"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Tone = "success" | "error";
type ToastState = { id: number; message: string; tone: Tone; leaving: boolean } | null;

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 2000;
/** Exits are faster than entrances: in over --dur-slow (260ms), out over 180ms. */
const EXIT_MS = 180;

/** The one toast for every copy and download action: bottom-center, polite live region. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => timers.current.splice(0).forEach(clearTimeout);

  const show = useCallback((message: string, tone: Tone = "success") => {
    clear();
    setToast({ id: Date.now(), message, tone, leaving: false });
    timers.current.push(
      setTimeout(() => setToast((t) => t && { ...t, leaving: true }), VISIBLE_MS),
      setTimeout(() => setToast(null), VISIBLE_MS + EXIT_MS),
    );
  }, []);

  useEffect(() => clear, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* The live region stays mounted so screen readers announce each new message. */}
      <div role="status" aria-live="polite" data-toast-region className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            style={{ transition: `opacity ${EXIT_MS}ms var(--ease-out)` }}
            className={`flex max-w-full animate-toast-in items-center gap-2 rounded-full bg-btn py-2 pl-3 pr-4 text-small text-btn-ink shadow-toast ${
              toast.leaving ? "opacity-0" : "opacity-100"
            }`}
          >
            {toast.tone === "success" ? (
              <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
            ) : (
              <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
