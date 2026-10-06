import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/admin/actions";
import { EmailForm } from "@/components/admin/account/EmailForm";
import { PasswordForm } from "@/components/admin/account/PasswordForm";
import { SessionList } from "@/components/admin/account/SessionList";
import { buttonClass } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { describeUserAgent } from "@/lib/user-agent";

export const metadata: Metadata = { title: "Account" };

const card = "rounded-card border border-hairline bg-surface p-6 max-sm:p-4";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2">Account</h1>
          <p className="mt-1 text-small text-muted">The one admin. This is you.</p>
        </div>
        <form action={logout}>
          <button type="submit" className={buttonClass({ variant: "ghost" })}>
            Log out
          </button>
        </form>
      </div>
      <Suspense fallback={<div className={`${card} mt-6 h-96`} />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const me = await requireAdmin();
  const sessions = await db.session.findMany({ where: { adminId: me.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  return (
    <div className="mt-6 flex flex-col gap-4">
      <section aria-labelledby="email-h" className={card}>
        <h2 id="email-h" className="mb-4 text-h3">Email</h2>
        <EmailForm email={me.email} />
      </section>
      <section aria-labelledby="pw-h" className={card}>
        <h2 id="pw-h" className="mb-4 text-h3">Password</h2>
        <PasswordForm />
      </section>
      <section className={card}>
        <SessionList
          sessions={sessions.map((s) => ({
            id: s.id,
            device: describeUserAgent(s.userAgent),
            createdAt: s.createdAt.toISOString(),
            current: s.id === me.sessionId,
          }))}
        />
      </section>
    </div>
  );
}
