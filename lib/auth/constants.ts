/** Shared by proxy.ts (no database) and the session code. */
const prod = process.env.NODE_ENV === "production";

/** `__Host-` makes the browser refuse it unless it's Secure, path=/ and host-only. */
export const SESSION_COOKIE = prod ? "__Host-bp_session" : "bp_session";
export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: prod,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

/** Request header proxy.ts sets so a page can send you back after signing in. */
export const PATH_HEADER = "x-admin-path";

/** Only same-site admin paths: never `//evil.com` or an absolute URL. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith("/admin/login") ? next : "/admin";
}
