import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogosEditor } from "@/components/admin/logos/LogosEditor";
import { getLogoEditor } from "@/lib/admin/logos";
import { requireAdmin } from "@/lib/auth/session";

export const instant = false;
// Attaching a logo renders four PNGs, and the zips rebuild after the response: allow up to 60 s.
export const maxDuration = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getLogoEditor((await params).id);
  return { title: e ? `${e.name} · Logos` : "Logos" };
}

// The selected type (?type=) is read in the browser: reading searchParams here made a router
// refresh of this page fall back to a full reload, which cancelled saves in flight.
export default async function LogosTab({ params }: Props) {
  await requireAdmin();
  const editor = await getLogoEditor((await params).id);
  if (!editor) notFound();
  return <LogosEditor editor={editor} />;
}
