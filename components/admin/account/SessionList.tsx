"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { revokeOtherSessions, revokeSession, type FormState } from "@/app/admin/actions";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";

export type SessionRow = { id: string; device: string; createdAt: string; current: boolean };

/** In the viewer's own time zone (the server renders UTC; the browser re-renders it locally). */
const when = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<FormState>) =>
    start(async () => {
      const r = await fn();
      toast(r?.ok ?? r?.error ?? "Done", r?.error ? "error" : "success");
      router.refresh();
    });
  const others = sessions.filter((s) => !s.current).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-h3">Active sessions</h2>
          <p className="text-small text-muted">Signed-in browsers. Sessions end after 7 days without a visit.</p>
        </div>
        <button type="button" disabled={pending || !others} onClick={() => run(revokeOtherSessions)} className={buttonClass({ variant: "ghost", size: "sm" })}>
          Sign out all other sessions
        </button>
      </div>
      <ul className="mt-4 divide-y divide-hairline rounded-[12px] border border-hairline">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-small font-medium">{s.device}</p>
              <p className="text-caption tabular-nums text-muted" suppressHydrationWarning>
                Signed in {when(s.createdAt)}
              </p>
            </div>
            {s.current ? (
              <span className="ml-auto shrink-0 text-caption text-muted">This browser</span>
            ) : (
              <button type="button" disabled={pending} onClick={() => run(() => revokeSession(s.id))} className={buttonClass({ variant: "quiet", size: "sm", className: "ml-auto" })}>
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
