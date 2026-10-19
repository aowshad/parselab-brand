/** Usage guidelines as stored on a brand (Brand.usage). Null shows "Coming soon". */
export type UsageSide = { fileId: string | null; caption: string };
export type UsagePair = { do: UsageSide; dont: UsageSide };
export type UsageData = { markdown: string; pairs: UsagePair[] };

export const USAGE_LIMITS = { markdown: 20_000, pairs: 12, caption: 140 };

/** Every image a usage block points at. */
export const usageFileIds = (u: unknown): string[] =>
  ((u as UsageData | null)?.pairs ?? []).flatMap((p) => [p.do?.fileId, p.dont?.fileId]).filter((x): x is string => typeof x === "string");
