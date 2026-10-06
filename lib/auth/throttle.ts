import "server-only";
import crypto from "node:crypto";
import { db } from "../db";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export const throttleKey = (ip: string, email: string) =>
  crypto.createHash("sha256").update(`${ip} ${email.toLowerCase()}`).digest("hex");

/** Minutes left on a lockout for this IP + email, or 0. */
export async function lockedMinutes(key: string): Promise<number> {
  const row = await db.loginThrottle.findUnique({ where: { key } });
  const left = row?.lockedUntil ? row.lockedUntil.getTime() - Date.now() : 0;
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

/** Counts a failure; returns the lockout in minutes when this one triggered it, else 0. */
export async function recordFailure(key: string): Promise<number> {
  const now = new Date();
  const row = await db.loginThrottle.findUnique({ where: { key } });
  const fresh = !row || now.getTime() - row.windowStart.getTime() > WINDOW_MS;
  const failures = fresh ? 1 : row.failures + 1;
  const lockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;
  await db.loginThrottle.upsert({
    where: { key },
    create: { key, failures, windowStart: now, lockedUntil },
    update: { failures, lockedUntil, ...(fresh ? { windowStart: now } : {}) },
  });
  // Housekeeping: forget pairs that have been quiet for a day.
  await db.loginThrottle.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } });
  return lockedUntil ? LOCK_MS / 60_000 : 0;
}

export const clearFailures = (key: string) => db.loginThrottle.deleteMany({ where: { key } });
