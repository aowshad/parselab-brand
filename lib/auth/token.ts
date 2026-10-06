import crypto from "node:crypto";
import { db } from "../db";

/*
 * Shared by proxy.ts and lib/auth/session.ts. No "server-only" import here: the proxy isn't a
 * React server environment, but it still runs on the server (Node.js runtime) only.
 */

/** The database stores HMAC-SHA256(SESSION_SECRET, token), never the token itself. */
export function hashToken(token: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters).");
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

/** One indexed lookup: does this cookie belong to a live session? */
export async function isLiveSession(token: string): Promise<boolean> {
  const row = await db.session.findUnique({ where: { id: hashToken(token) }, select: { expiresAt: true } });
  return !!row && row.expiresAt.getTime() > Date.now();
}
