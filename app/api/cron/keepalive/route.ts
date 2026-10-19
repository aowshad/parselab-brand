import { NextResponse } from "next/server";
import { bucket } from "@/lib/admin/storage";
import { sweepTickets } from "@/lib/admin/tickets";
import { hasCronSecret } from "@/lib/auth/cron";
import { db } from "@/lib/db";

/**
 * Daily Vercel Cron (vercel.json). Supabase pauses a free project after 7 days without activity,
 * which takes the whole site down; one database query and one storage call a day prevent it.
 * Also clears expired upload tickets and their staged files.
 */
export async function GET(req: Request) {
  if (!hasCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brands = await db.brand.count();
  const { error } = await bucket().list("site", { limit: 1 });
  await sweepTickets();
  if (error) return NextResponse.json({ error: `Storage: ${error.message}` }, { status: 502 });
  return NextResponse.json({ ok: true, brands, at: new Date().toISOString() });
}
