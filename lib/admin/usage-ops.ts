import "server-only";
import { db } from "../db";
import { Prisma } from "../generated/prisma/client";
import { USAGE_LIMITS, usageFileIds, type UsageData, type UsageSide } from "../usage";
import { deleteFiles } from "./files";
import type { OpResult } from "./logo-ops";
import { expirePublic } from "./revalidate";

const side = (raw: unknown): UsageSide => {
  const s = (raw ?? {}) as Record<string, unknown>;
  return { fileId: typeof s.fileId === "string" && s.fileId ? s.fileId : null, caption: String(s.caption ?? "").trim() };
};

/** Saves a brand's usage guidelines, or null for "Coming soon". Removed images are deleted. */
export async function saveUsage(brandId: string, raw: unknown): Promise<OpResult> {
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { slug: true, usage: true } });
  if (!brand) return { error: "This brand no longer exists." };

  let value: UsageData | null = null;
  if (raw !== null) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const markdown = String(r.markdown ?? "").replace(/\r\n/g, "\n").trim();
    const pairs = (Array.isArray(r.pairs) ? r.pairs : []).map((p) => ({ do: side((p as Record<string, unknown>).do), dont: side((p as Record<string, unknown>).dont) }));
    if (markdown.length > USAGE_LIMITS.markdown) return { error: `Keep the guidelines under ${USAGE_LIMITS.markdown.toLocaleString("en-US")} characters.` };
    if (pairs.length > USAGE_LIMITS.pairs) return { error: `Up to ${USAGE_LIMITS.pairs} Do / Don't pairs.` };
    for (const [i, p] of pairs.entries()) {
      for (const [label, s] of [["Do", p.do], ["Don't", p.dont]] as const) {
        if (s.caption.length > USAGE_LIMITS.caption) return { error: `Pair ${i + 1}: keep the "${label}" caption under ${USAGE_LIMITS.caption} characters.` };
        if (!s.fileId && !s.caption) return { error: `Pair ${i + 1}: add an image or a caption to "${label}".` };
      }
    }
    if (!markdown && !pairs.length) return { error: "Write some guidelines or add a Do / Don't pair (or switch back to Coming soon)." };
    // Images must be this brand's own uploads.
    const ids = usageFileIds({ pairs });
    const files = ids.length ? await db.fileObject.findMany({ where: { id: { in: ids } }, select: { id: true, key: true } }) : [];
    if (files.length !== new Set(ids).size || files.some((f) => !f.key.startsWith(`brands/${brandId}/usage/`))) return { error: "One of the images can't be used here. Upload it again." };
    value = { markdown, pairs };
  }

  const before = new Set(usageFileIds(brand.usage));
  const after = new Set(usageFileIds(value));
  await db.brand.update({ where: { id: brandId }, data: { usage: value ?? Prisma.DbNull } });
  await deleteFiles([...before].filter((id) => !after.has(id)));
  expirePublic(brand.slug);
  return { ok: value ? "Usage guidelines saved" : "Usage shows as Coming soon" };
}
