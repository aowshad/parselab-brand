import { NextResponse } from "next/server";
import * as ops from "@/lib/admin/event-ops";
import type { OpResult } from "@/lib/admin/logo-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Events shared by every brand: { op: "create" | "update" | "delete", ... }. */
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const eventId = String(b.eventId ?? "");
  let r: OpResult;
  if (b.op === "create") r = await ops.createEvent(b);
  else if (b.op === "update") r = await ops.updateEvent(eventId, b);
  else if (b.op === "delete") r = await ops.deleteEvent(eventId, b.confirm);
  else return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
