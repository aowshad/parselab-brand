import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogosEditor } from "@/components/admin/logos/LogosEditor";
import { getLogoEditor } from "@/lib/admin/logos";
import { requireAdmin } from "@/lib/auth/session";

export const instant = false;
// Attaching a logo renders four PNGs, and the zips rebuild after the response: allow up to 60 s.
export const maxDuration = 60;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getLogoEditor((await params).id);
  return { title: e ? `${e.name} · Logos` : "Logos" };
}

export default async function LogosTab({ params, searchParams }: Props) {
  await requireAdmin();
  const [editor, { type }] = await Promise.all([getLogoEditor((await params).id), searchParams]);
  if (!editor) notFound();
  return <LogosEditor editor={editor} initialType={type} />;
}
