import { NextResponse } from "next/server";
import type { OpResult } from "@/lib/admin/logo-ops";
import * as ops from "@/lib/admin/media-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Animations and event items: { op: "add" | "update" | "move" | "upload" | "delete", ... }. */
export const maxDuration = 60;

/** Which of a brand's videos are still being processed, and which failed (polled by the editor). */
export async function GET(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const brandId = new URL(req.url).searchParams.get("brandId") ?? "";
  return NextResponse.json(await ops.itemStatus(brandId), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const itemId = String(b.itemId ?? "");
  let r: OpResult;
  if (b.op === "add") r = await ops.addItem(String(b.brandId ?? ""), b);
  else if (b.op === "update") r = await ops.updateItem(itemId, b);
  else if (b.op === "move") r = await ops.moveItem(itemId, b.direction);
  else if (b.op === "upload") r = await ops.attachUpload(itemId, b.fileId);
  else if (b.op === "delete") r = await ops.deleteItem(itemId);
  else return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
