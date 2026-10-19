"use client";

export type OpReply = { ok?: string; error?: string; id?: string };

/** POSTs { op, ...args } to an admin JSON route. Always resolves to { ok } or { error }. */
export async function adminOp(route: string, op: string, args: Record<string, unknown>): Promise<OpReply> {
  try {
    const res = await fetch(route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, ...args }) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) window.location.assign(`/admin/login/?next=${encodeURIComponent(window.location.pathname)}`);
    return res.ok ? body : { error: body.error ?? "That didn't save. Try again." };
  } catch {
    return { error: "No connection. Check your network and try again." };
  }
}
