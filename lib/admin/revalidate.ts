import "server-only";
import { updateTag } from "next/cache";
import { CACHE_TAGS } from "../brands";

/**
 * After an admin save: expire the public pages it touched, so the next visit shows the change
 * (read-your-own-writes; server actions only). `brands` covers the home page and every brand page.
 */
export function refreshPublic(...slugs: (string | null | undefined)[]) {
  updateTag(CACHE_TAGS.brands);
  for (const slug of new Set(slugs)) if (slug) updateTag(CACHE_TAGS.brand(slug));
}

export const refreshSettings = () => updateTag(CACHE_TAGS.settings);
