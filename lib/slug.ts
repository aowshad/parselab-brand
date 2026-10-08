/** Brand URL slugs: /<slug>/. Shared by the admin forms (live hints) and the server (the rules). */

/** Paths the site itself uses, or might: never a brand. */
export const RESERVED_SLUGS = ["admin", "api", "files", "login", "_next", "brands", "static", "assets", "robots", "favicon", "sitemap"];
export const MAX_SLUG = 48;

/** "ProductsModel" → "productsmodel", "Jewels & Co." → "jewels-and-co". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");
}

/** What's wrong with a slug, or null. Uniqueness is checked by the server. */
export function slugProblem(slug: string): string | null {
  if (!slug) return "Enter a URL slug.";
  if (slug.length > MAX_SLUG) return `Keep it under ${MAX_SLUG} characters.`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Use lowercase letters, numbers and single dashes (no dash at the start or end).";
  if (RESERVED_SLUGS.includes(slug)) return `"${slug}" is reserved by the site.`;
  return null;
}
