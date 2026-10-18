/**
 * Cache tags for the public site's data (lib/brands.ts tags its reads with these; admin saves and
 * the background rebuilds expire them). Its own module so route handlers can use it without
 * pulling in page-only code such as the font loaders.
 */
export const CACHE_TAGS = {
  brands: "brands",
  brand: (slug: string) => `brand:${slug}`,
  settings: "settings",
} as const;
