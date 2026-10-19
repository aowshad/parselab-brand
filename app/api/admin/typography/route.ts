import { NextResponse } from "next/server";
import { saveTypography } from "@/lib/admin/typography-ops";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Saves a brand's typography: { brandId, typography: {...} | null }. */
export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const b = ((await req.json().catch(() => null)) ?? {}) as { brandId?: string; typography?: unknown };
  const r = await saveTypography(String(b.brandId ?? ""), b.typography ?? null);
  return NextResponse.json(r, { status: r.error ? 422 : 200 });
}
