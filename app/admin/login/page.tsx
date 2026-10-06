import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { Wordmark } from "@/components/admin/Wordmark";
import { safeNext } from "@/lib/auth/constants";
import { getCurrentAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string }> };

/** The only admin page anyone can open. No sign-up, no password-reset link (see `pnpm admin:reset`). */
export default function LoginPage({ searchParams }: Props) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[380px] rounded-card border border-hairline bg-surface p-7 shadow-pill">
        <Wordmark />
        <h1 className="mt-6 text-h2">Sign in</h1>
        <p className="mt-1 text-small text-muted">Only the site owner can sign in.</p>
        <Suspense fallback={<div className="mt-6 h-[228px]" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Form({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  // Already signed in: skip the form.
  if (await getCurrentAdmin()) redirect(next);
  return <LoginForm next={next} />;
}
