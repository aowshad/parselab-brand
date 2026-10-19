import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth/origin";
import { getCurrentAdmin } from "@/lib/auth/session";
import { storeFile } from "@/lib/admin/files";
import { bucket } from "@/lib/admin/storage";
import { EXT, inspect, MIME, PURPOSES, TICKET_TTL_MS, UploadError } from "@/lib/admin/uploads";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage-url";

/**
 * Step 3 of an upload (after the browser has put the file at its signed URL): fetches the staged
 * file, sniffs and sanitizes it, stores the result under a new key and returns its FileObject.
 * The ticket is single-use and only honored for 2 minutes; the staged copy is always deleted.
 */
export const maxDuration = 60; // a manual brand kit can be up to 50 MB

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await sameOrigin())) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  const { ticketId } = ((await req.json().catch(() => null)) ?? {}) as { ticketId?: string };
  // Claim the ticket atomically: a second call (or a replay) finds nothing to claim.
  const claimed = ticketId
    ? await db.uploadTicket.updateMany({ where: { id: ticketId, usedAt: null, issuedAt: { gte: new Date(Date.now() - TICKET_TTL_MS) } }, data: { usedAt: new Date() } })
    : { count: 0 };
  if (!claimed.count) return NextResponse.json({ error: "This upload expired. Try again." }, { status: 410 });
  const ticket = await db.uploadTicket.findUniqueOrThrow({ where: { id: ticketId } });
  const purpose = PURPOSES[ticket.purpose]!;

  try {
    const { data, error } = await bucket().download(ticket.key);
    if (error || !data) return NextResponse.json({ error: "The upload didn't arrive. Try again." }, { status: 400 });
    const checked = await inspect(purpose, Buffer.from(await data.arrayBuffer()));
    const base = ticket.fileName.replace(/\.[^.]*$/, "") || "file";
    const file = await storeFile({
      brandId: ticket.brandId,
      kind: ({ "brand-icon": "icon", "logo-variant": "logos", "usage-image": "usage", "kit-zip": "zips", "site-kit-zip": "zips" } as Record<string, string>)[ticket.purpose] ?? "uploads",
      name: `${base}.${EXT[checked.kind]}`,
      bytes: checked.bytes,
      mime: MIME[checked.kind],
      width: checked.width ? Math.round(checked.width) : undefined,
      height: checked.height ? Math.round(checked.height) : undefined,
    });
    return NextResponse.json({ fileId: file.id, url: publicUrl(file.key), kind: checked.kind, width: file.width, height: file.height, size: file.size });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  } finally {
    await bucket().remove([ticket.key]);
  }
}
