"use client";

import { adminOp, type OpReply } from "./api-client";

/** Calls /api/admin/logos. Always resolves: { ok } or { error }. */
export const logoOp = (op: string, args: Record<string, unknown>): Promise<OpReply> => adminOp("/api/admin/logos/", op, args);
