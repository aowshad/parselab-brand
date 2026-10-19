import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ColorsEditor } from "@/components/admin/colors/ColorsEditor";
import { getColorEditor } from "@/lib/admin/color-editor";
import { requireAdmin } from "@/lib/auth/session";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getColorEditor((await params).id);
  return { title: e ? `${e.name} · Colors` : "Colors" };
}

export default async function ColorsTab({ params }: Props) {
  await requireAdmin();
  const editor = await getColorEditor((await params).id);
  if (!editor) notFound();
  return <ColorsEditor editor={editor} />;
}
