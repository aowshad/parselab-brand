import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { PATH_HEADER, SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions } from "./constants";
import { hashToken } from "./token";


/** Extend the database expiry at most once a day (the cookie itself is renewed by proxy.ts). */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export type CurrentAdmin = { id: string; email: string; sessionId: string };

/** Starts a session: a random 32-byte token in an httpOnly cookie. Server actions only. */
export async function createSession(adminId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.session.create({
    data: { id: hashToken(token), adminId, userAgent, expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) },
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

/** The signed-in admin, or null. Expired sessions are deleted on sight. */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const session = await db.session.findUnique({ where: { id }, include: { admin: { select: { id: true, email: true } } } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  // Sliding renewal: in use within the last day keeps it alive for 7 more days.
  if (session.expiresAt.getTime() - now < SESSION_MAX_AGE * 1000 - RENEW_AFTER_MS) {
    await db.session.update({ where: { id }, data: { expiresAt: new Date(now + SESSION_MAX_AGE * 1000) } });
  }
  return { id: session.admin.id, email: session.admin.email, sessionId: id };
}

/** For admin pages: the admin, or a redirect to the login page (coming back here afterwards). */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (admin) return admin;
  const here = (await headers()).get(PATH_HEADER);
  redirect(here ? `/admin/login?next=${encodeURIComponent(here)}` : "/admin/login");
}

/** Ends this session: deletes the row and clears the cookie. */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete({ name: SESSION_COOKIE, path: "/", secure: sessionCookieOptions.secure, httpOnly: true, sameSite: "lax" });
}
