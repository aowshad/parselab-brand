import "server-only";
import { db } from "../db";
import { bucket } from "./storage";
import { TICKET_TTL_MS } from "./uploads";

/** Removes tickets past their 2 minutes, and whatever was uploaded under them. */
export async function sweepTickets() {
  const stale = await db.uploadTicket.findMany({ where: { issuedAt: { lt: new Date(Date.now() - TICKET_TTL_MS) } }, select: { id: true, key: true, usedAt: true } });
  if (!stale.length) return;
  const leftovers = stale.filter((t) => !t.usedAt).map((t) => t.key);
  if (leftovers.length) await bucket().remove(leftovers); // missing objects are fine
  await db.uploadTicket.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });
}
