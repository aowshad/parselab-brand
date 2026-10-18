import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Is this brand's zip rebuild still running, and what are the ZIPs now? Polled by the Logos tab,
 * which updates just that text: refreshing the whole page could cancel a save still in flight.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const b = await db.brand.findUnique({ where: { id: (await params).id }, select: { assetsStaleAt: true, logoTypes: { select: { id: true, zipFileId: true } } } });
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ids = b.logoTypes.flatMap((t) => (t.zipFileId ? [t.zipFileId] : []));
  const files = new Map((await db.fileObject.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, size: true } })).map((f) => [f.id, f]));
  const zips = Object.fromEntries(
    b.logoTypes.map((t) => {
      const f = t.zipFileId ? files.get(t.zipFileId) : undefined;
      return [t.id, f ? { name: f.name, sizeKb: Math.round(f.size / 102.4) / 10 } : null];
    }),
  );
  return NextResponse.json({ rebuilding: b.assetsStaleAt !== null, zips }, { headers: { "cache-control": "no-store" } });
}
