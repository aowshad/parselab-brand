"use client";

/** Calls /api/admin/logos. Always resolves: { ok } or { error } (never throws for HTTP errors). */
export async function logoOp(op: string, args: Record<string, unknown>): Promise<{ ok?: string; error?: string; id?: string }> {
  try {
    const res = await fetch("/api/admin/logos/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, ...args }) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) window.location.assign(`/admin/login/?next=${encodeURIComponent(window.location.pathname)}`);
    return res.ok ? body : { error: body.error ?? "That didn't save. Try again." };
  } catch {
    return { error: "No connection. Check your network and try again." };
  }
}
