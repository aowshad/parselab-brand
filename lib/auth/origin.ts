import "server-only";
import { headers } from "next/headers";

/**
 * CSRF check for admin route handlers (server actions get this from Next.js): a mutating request
 * must come from a page on this same host.
 */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
