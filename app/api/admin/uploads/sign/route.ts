import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";
import { safeName } from "@/lib/admin/files";
import { bucket } from "@/lib/admin/storage";
import { sweepTickets } from "@/lib/admin/tickets";
import { MB, MIME, PURPOSES } from "@/lib/admin/uploads";
import { db } from "@/lib/db";

/**
 * Step 1 of an upload: checks the session, origin, declared type and size, then returns a signed
 * URL for one server-generated staging key. The browser uploads straight to storage, so files
 * never pass through this server (no 4.5 MB function body limit).
 */
export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { purpose?: string; brandId?: string; fileName?: string; size?: number; type?: string } | null;
  const purpose = body?.purpose ? PURPOSES[body.purpose] : undefined;
  if (!purpose || !body) return NextResponse.json({ error: "Unknown upload." }, { status: 400 });
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (size > purpose.maxBytes) return NextResponse.json({ error: `File is over ${purpose.maxBytes / MB} MB.` }, { status: 413 });
  const declared = String(body.type ?? "");
  const allowed: string[] = purpose.kinds.map((k) => MIME[k]);
  if (declared && !allowed.includes(declared)) {
    return NextResponse.json({ error: `Upload ${purpose.kinds.map((k) => k.toUpperCase()).join(" or ")} only.` }, { status: 415 });
  }
  if (body.brandId && !(await db.brand.findUnique({ where: { id: body.brandId }, select: { id: true } }))) {
    return NextResponse.json({ error: "That brand no longer exists." }, { status: 404 });
  }

  await sweepTickets();
  const fileName = safeName(String(body.fileName ?? "upload"));
  const key = `staging/${crypto.randomUUID()}/${fileName}`;
  const { data, error } = await bucket().createSignedUploadUrl(key);
  if (error || !data) return NextResponse.json({ error: "Storage is unavailable. Try again." }, { status: 502 });
  const ticket = await db.uploadTicket.create({
    data: { key, purpose: body.purpose!, brandId: body.brandId ?? null, fileName, size, mime: declared || allowed[0]! },
  });
  return NextResponse.json({ ticketId: ticket.id, signedUrl: data.signedUrl });
}
