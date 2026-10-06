import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/session";

/** Who is signed in. Every /api/admin route checks the session like this, beyond proxy.ts. */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ email: admin.email });
}
