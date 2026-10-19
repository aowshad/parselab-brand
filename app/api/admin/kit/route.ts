import { NextResponse } from "next/server";
import * as ops from "@/lib/admin/kit-ops";
import type { OpResult } from "@/lib/admin/logo-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Brand kit operations: { op: "mode" | "upload" | "rebuild", brandId, ... }. */
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const brandId = String(b.brandId ?? "");
  let r: OpResult;
  if (b.op === "mode") r = await ops.setKitMode(brandId, String(b.mode ?? ""));
  else if (b.op === "upload") r = await ops.useUploadedKit(brandId, String(b.fileId ?? ""));
  else if (b.op === "rebuild") r = await ops.rebuildKitNow(brandId);
  else return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
