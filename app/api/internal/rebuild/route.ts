import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { rebuildAllKit, rebuildBrand } from "@/lib/admin/rebuild";

/**
 * Runs the background zip rebuilds (lib/admin/rebuild.ts). Called by the app itself after an
 * admin change, so the rebuild can expire the public cache: route handlers may call
 * revalidateTag, code running after a server action's response may not. Server-to-server only:
 * it needs CRON_SECRET.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = secret.length >= 16 && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brandId } = ((await req.json().catch(() => null)) ?? {}) as { brandId?: string };
  if (brandId) await rebuildBrand(brandId);
  else await rebuildAllKit();
  return NextResponse.json({ ok: true });
}
