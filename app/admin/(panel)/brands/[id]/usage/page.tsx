import type { Metadata } from "next";
import { UpcomingTab, upcomingTitle } from "@/components/admin/brands/UpcomingTab";

export const instant = false;
export const metadata: Metadata = { title: upcomingTitle("usage") };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <UpcomingTab id={(await params).id} tab="usage" />;
}
