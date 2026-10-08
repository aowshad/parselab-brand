/** Brand status labels, shared by server and client components (no "use client" here on purpose). */
export type Status = "DRAFT" | "SOON" | "LIVE";
export const STATUS_LABEL: Record<Status, string> = { DRAFT: "Draft", SOON: "Soon", LIVE: "Live" };
export const STATUS_HELP: Record<Status, string> = {
  DRAFT: "Hidden: not on the home page, and its URL is a 404.",
  SOON: "Public, with a Soon tag and coming-soon sections.",
  LIVE: "Public.",
};
