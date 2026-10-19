import "server-only";
import crypto from "node:crypto";

/**
 * Server-to-server calls (Vercel Cron, the app's own background rebuilds) carry CRON_SECRET as
 * a Bearer token. Compared in constant time; a missing or short secret refuses everything.
 */
export function hasCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return secret.length >= 16 && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
