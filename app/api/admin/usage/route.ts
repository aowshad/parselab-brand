import { NextResponse } from "next/server";
import { saveUsage } from "@/lib/admin/usage-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Saves a brand's usage guidelines: { brandId, usage: { markdown, pairs } | null }. */
export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as { brandId?: string; usage?: unknown };
  const r = await saveUsage(String(b.brandId ?? ""), b.usage ?? null);
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
