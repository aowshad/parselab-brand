/** Prefix a site path with the deploy base path (see BASE_PATH in next.config.ts). Absolute URLs pass through. */
export function withBase(p: string): string {
  return /^https?:\/\//.test(p) ? p : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
}
