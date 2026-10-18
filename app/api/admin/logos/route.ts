import { NextResponse } from "next/server";
import * as ops from "@/lib/admin/logo-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/**
 * Logos tab operations as one JSON endpoint: { op, ...args } → { ok | error, id? }.
 * Session and same-origin checked here; the operations validate their own input.
 */
export const maxDuration = 60; // attaching renders four PNGs; rebuilds run after the response

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  let r: ops.OpResult;
  switch (b.op) {
    case "addType":
      r = await ops.addLogoType(str(b.brandId), typeof b.preset === "string" ? b.preset : null, str(b.label) || undefined);
      break;
    case "updateType":
      r = await ops.updateLogoType(str(b.typeId), str(b.label), str(b.description));
      break;
    case "reorderTypes":
      r = await ops.reorderLogoTypes(str(b.brandId), Array.isArray(b.ids) ? b.ids.map(str) : []);
      break;
    case "deleteType":
      r = await ops.deleteLogoType(str(b.typeId));
      break;
    case "attach":
      r = await ops.attachVariant(str(b.typeId), str(b.slot), str(b.fileId));
      break;
    case "updateVariant":
      r = await ops.updateVariant(str(b.variantId), {
        ...(typeof b.fileName === "string" ? { fileName: b.fileName } : {}),
        ...(typeof b.hint === "string" ? { hint: b.hint } : {}),
      });
      break;
    case "removeVariant":
      r = await ops.removeVariant(str(b.variantId));
      break;
    default:
      return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  }
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
