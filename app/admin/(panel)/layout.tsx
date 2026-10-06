import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/components/admin/AccountMenu";
import { NavLinks } from "@/components/admin/NavLinks";
import { Wordmark } from "@/components/admin/Wordmark";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { requireAdmin } from "@/lib/auth/session";

// Blocking on purpose: the session is checked before any HTML is sent, so a missing, forged or
// expired session gets a real HTTP redirect to the login page instead of a streamed frame.
export const instant = false;

/** Shell for every signed-in admin page. Pages still check the session again for their own data. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-hairline bg-surface">
        <div className="mx-auto flex h-full max-w-[1100px] items-center gap-6 px-6 max-sm:gap-3 max-sm:px-4">
          <Link href="/admin/" className="rounded-[6px]">
            <Wordmark />
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-2">
            <a href="/" target="_blank" rel="noreferrer" className="motion-colors inline-flex items-center gap-1 rounded-[8px] px-2 py-1.5 text-small text-muted hover:text-ink max-sm:hidden">
              View site <ArrowUpRight aria-hidden className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <ThemeToggle />
            <AccountMenu email={admin.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-6 pb-24 pt-8 max-sm:px-4">{children}</main>
    </>
  );
}
