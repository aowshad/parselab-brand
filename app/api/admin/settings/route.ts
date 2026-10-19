import { NextResponse } from "next/server";
import type { OpResult } from "@/lib/admin/logo-ops";
import * as ops from "@/lib/admin/settings-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Site settings operations: { op: "save" | "mode" | "upload" | "rebuild", ... }. */
export const maxDuration = 60;

/** Whether the "Download all" zip is being rebuilt (polled by the Settings page). */
export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ rebuilding: await ops.allKitRebuilding() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  let r: OpResult;
  if (b.op === "save") r = await ops.saveSettings(b);
  else if (b.op === "mode") r = await ops.setAllKitMode(String(b.mode ?? ""));
  else if (b.op === "upload") r = await ops.useUploadedAllKit(String(b.fileId ?? ""));
  else if (b.op === "rebuild") r = await ops.rebuildAllKitNow();
  else return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
