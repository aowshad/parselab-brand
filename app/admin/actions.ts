"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/constants";
import { burnVerify, hashPassword, MIN_PASSWORD, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentAdmin } from "@/lib/auth/session";
import { clearFailures, lockedMinutes, recordFailure, throttleKey } from "@/lib/auth/throttle";
import { db } from "@/lib/db";

/*
 * Every admin mutation is a server action: Next.js rejects cross-origin action calls (CSRF),
 * and each action checks the session itself rather than trusting the page that rendered it.
 * There is deliberately no action that creates an admin.
 */

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

const BAD_LOGIN = "Email or password is incorrect.";
const lockedMessage = (m: number) => `Too many attempts. Try again in ${m} minute${m === 1 ? "" : "s"}.`;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function admin() {
  const a = await getCurrentAdmin();
  if (!a) redirect("/admin/login");
  return a;
}

// ── Sign in / out ───────────────────────────────────────────────────────────────────────

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const values = { email };
  if (!email || !password) return { error: BAD_LOGIN, values };

  const key = throttleKey(await clientIp(), email);
  const locked = await lockedMinutes(key);
  if (locked) return { error: lockedMessage(locked), values };

  const found = await db.admin.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const ok = found ? await verifyPassword(found.passwordHash, password) : (await burnVerify(password), false);
  if (!found || !ok) {
    const lockedNow = await recordFailure(key);
    return { error: lockedNow ? lockedMessage(lockedNow) : BAD_LOGIN, values };
  }

  await clearFailures(key);
  await createSession(found.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

// ── Account ─────────────────────────────────────────────────────────────────────────────

const emailSchema = z.email("Enter a valid email address.").max(254);

export async function changeEmail(_: FormState, form: FormData): Promise<FormState> {
  const me = await admin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const current = String(form.get("currentPassword") ?? "");
  const values = { email };

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, values };
  if (email === me.email) return { error: "That's already your email.", values };

  const row = await db.admin.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(row.passwordHash, current))) return { error: "Current password is incorrect.", values };

  await db.admin.update({ where: { id: me.id }, data: { email } });
  return { ok: "Email updated", values: { email } };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await admin();
  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  const row = await db.admin.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(row.passwordHash, current))) return { error: "Current password is incorrect." };
  if (next.length < MIN_PASSWORD) return { error: `New password must be at least ${MIN_PASSWORD} characters.` };
  if (next !== confirm) return { error: "The new passwords don't match." };
  if (await verifyPassword(row.passwordHash, next)) return { error: "New password must be different from the current one." };

  await db.admin.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  // Everywhere else is signed out; this browser stays signed in.
  const { count } = await db.session.deleteMany({ where: { adminId: me.id, id: { not: me.sessionId } } });
  return { ok: count ? `Password changed · ${count} other session${count === 1 ? "" : "s"} signed out` : "Password changed" };
}

export async function revokeSession(sessionId: string): Promise<FormState> {
  const me = await admin();
  if (sessionId === me.sessionId) return { error: "Use Log out to end this session." };
  await db.session.deleteMany({ where: { id: sessionId, adminId: me.id } });
  return { ok: "Session signed out" };
}

export async function revokeOtherSessions(): Promise<FormState> {
  const me = await admin();
  const { count } = await db.session.deleteMany({ where: { adminId: me.id, id: { not: me.sessionId } } });
  return { ok: count ? `${count} other session${count === 1 ? "" : "s"} signed out` : "No other sessions" };
}
