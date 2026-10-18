import "server-only";
import { revalidateTag, updateTag } from "next/cache";
import { CACHE_TAGS } from "../cache-tags";

/**
 * After an admin save: expire the public pages it touched, so the next visit shows the change
 * (read-your-own-writes; server actions only). `brands` covers the home page and every brand page.
 */
export function refreshPublic(...slugs: (string | null | undefined)[]) {
  updateTag(CACHE_TAGS.brands);
  for (const slug of new Set(slugs)) if (slug) updateTag(CACHE_TAGS.brand(slug));
}

export const refreshSettings = () => updateTag(CACHE_TAGS.settings);

/**
 * The same as refreshPublic, for route handlers (updateTag only works in server actions):
 * expires at once, so the next visit is fresh.
 */
export function expirePublic(...slugs: (string | null | undefined)[]) {
  revalidateTag(CACHE_TAGS.brands, { expire: 0 });
  for (const slug of new Set(slugs)) if (slug) revalidateTag(CACHE_TAGS.brand(slug), { expire: 0 });
}
