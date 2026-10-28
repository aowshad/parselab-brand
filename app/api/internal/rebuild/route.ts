import { NextResponse } from "next/server";
import { processVideo } from "@/lib/admin/media";
import { rebuildAllKit, rebuildBrand } from "@/lib/admin/rebuild";
import { hasCronSecret } from "@/lib/auth/cron";

/**
 * Runs the background zip rebuilds (lib/admin/rebuild.ts). Called by the app itself after an
 * admin change, so the rebuild can expire the public cache: route handlers may call
 * revalidateTag, code running after a server action's response may not. Server-to-server only:
 * it needs CRON_SECRET.
 */
// Turning a video into four formats can take a while on one CPU.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!hasCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brandId, mediaItemId } = ((await req.json().catch(() => null)) ?? {}) as { brandId?: string; mediaItemId?: string };
  if (mediaItemId) await processVideo(mediaItemId);
  else if (brandId) await rebuildBrand(brandId);
  else await rebuildAllKit();
  return NextResponse.json({ ok: true });
}
