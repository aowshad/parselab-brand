import "server-only";
import { db } from "../db";
import { slugify } from "../slug";
import { deleteFiles } from "./files";
import type { OpResult } from "./logo-ops";
import { fileIdsOf } from "./media-ops";
import { expirePublic } from "./revalidate";

/*
 * Events ("Halloween 2026"), run by /api/admin/events (session + same origin checked there).
 * Shared by every brand: each brand adds its own items in its Events tab.
 */

export const EVENT_LIMITS = { name: 60, description: 200 };

const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** "2026-10-15" → a date, "" → null; anything else is an error. */
function day(v: unknown): Date | null | "bad" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "bad";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "bad" : d;
}

function fields(args: Record<string, unknown>) {
  const name = clean(args.name);
  if (!name) return { error: "Give the event a name, like Halloween 2026." };
  if (name.length > EVENT_LIMITS.name) return { error: `Keep the name under ${EVENT_LIMITS.name} characters.` };
  const description = clean(args.description);
  if (description.length > EVENT_LIMITS.description) return { error: `Keep the description under ${EVENT_LIMITS.description} characters.` };
  const startsOn = day(args.startsOn);
  const endsOn = day(args.endsOn);
  if (startsOn === "bad" || endsOn === "bad") return { error: "Dates look like 2026-10-31." };
  if (startsOn && endsOn && endsOn < startsOn) return { error: "The event ends before it starts." };
  return { data: { name, description, startsOn, endsOn } };
}

export async function createEvent(args: Record<string, unknown>): Promise<OpResult> {
  const f = fields(args);
  if ("error" in f) return { error: f.error };
  const key = slugify(f.data.name);
  if (!key) return { error: "Use letters or numbers in the name." };
  if (await db.event.findUnique({ where: { key } })) return { error: `There's already an event called ${f.data.name}.` };
  const event = await db.event.create({ data: { key, ...f.data } });
  expirePublic();
  return { ok: `${f.data.name} created`, id: event.id };
}

/** Name, description and dates. The URL (key) stays as it was, so shared links keep working. */
export async function updateEvent(eventId: string, args: Record<string, unknown>): Promise<OpResult> {
  const f = fields(args);
  if ("error" in f) return { error: f.error };
  if (!(await db.event.findUnique({ where: { id: eventId }, select: { id: true } }))) return { error: "This event no longer exists." };
  await db.event.update({ where: { id: eventId }, data: f.data });
  expirePublic();
  return { ok: "Event saved" };
}

/** Deletes the event and every brand's items in it, files included. */
export async function deleteEvent(eventId: string, confirm: unknown): Promise<OpResult> {
  const event = await db.event.findUnique({ where: { id: eventId }, include: { items: true } });
  if (!event) return { error: "This event no longer exists." };
  if (event.items.length && confirm !== event.name) return { error: `Type ${event.name} to delete it with its ${event.items.length} items.` };
  await db.event.delete({ where: { id: eventId } });
  const removed = await deleteFiles(event.items.flatMap(fileIdsOf));
  expirePublic();
  return { ok: `${event.name} deleted${event.items.length ? ` · ${removed} files removed` : ""}` };
}
