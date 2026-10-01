/** Prefix a public path with the deploy base path (see BASE_PATH in next.config.ts). */
export function withBase(p: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
}
