import { NextResponse } from "next/server";
import * as ops from "@/lib/admin/color-ops";
import type { OpResult } from "@/lib/admin/logo-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Colors tab operations: { op, ...args } → { ok | error, id? }. */
export const maxDuration = 60;

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  let r: OpResult;
  switch (b.op) {
    case "add":
      r = await ops.addColor(str(b.brandId), b.color);
      break;
    case "update":
      r = await ops.updateColor(str(b.colorId), b.color);
      break;
    case "remove":
      r = await ops.removeColor(str(b.colorId));
      break;
    case "reorder":
      r = await ops.reorderColors(str(b.brandId), Array.isArray(b.ids) ? b.ids.map(str) : []);
      break;
    default:
      return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  }
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
