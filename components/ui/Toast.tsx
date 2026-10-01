"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Tone = "success" | "error";
type ToastState = { id: number; message: string; tone: Tone } | null;

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const DURATION = 2200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string, tone: Tone = "success") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), DURATION);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* The live region stays mounted so screen readers announce each new message. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="flex max-w-full animate-toast-in items-center gap-2 rounded-full bg-ink py-2.5 pl-3 pr-4 text-sm text-on-dark shadow-toast"
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
