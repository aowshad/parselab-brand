import type { Metadata } from "next";
import { KitEditor, type KitInfo } from "@/components/admin/kit/KitEditor";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { SETTINGS_LIMITS } from "@/lib/admin/settings-ops";
import { KIT_MAX_MB } from "@/lib/admin/uploads";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { plural } from "@/lib/format";
import { downloadUrl } from "@/lib/storage-url";

export const metadata: Metadata = { title: "Settings" };
export const instant = false;

const card = "rounded-card border border-hairline bg-surface p-6 max-sm:p-4";

export default async function SettingsPage() {
  await requireAdmin();
  const [s, brands] = await Promise.all([
    db.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    // Public brands with at least one logo: what the automatic "Download all" zip is built from.
    db.brand.count({ where: { status: { in: ["SOON", "LIVE"] }, logoTypes: { some: { variants: { some: {} } } } } }),
  ]);
  const kit = s.allKitFileId ? await db.fileObject.findUnique({ where: { id: s.allKitFileId } }) : null;
  const info: KitInfo = {
    brandId: null,
    mode: s.allKitMode,
    kit: kit ? { name: kit.name, sizeKb: Math.round(kit.size / 102.4) / 10, builtAt: kit.createdAt.toISOString(), url: downloadUrl(kit.key, kit.name) } : null,
    contains: brands ? plural(brands, "public brand") : null,
    rebuilding: s.allKitMode === "AUTO" && s.allKitStaleAt !== null,
    maxMb: KIT_MAX_MB,
  };
  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="text-h2">Settings</h1>
      <p className="mt-1 text-small text-muted">Texts on the public site, and the &ldquo;Download all&rdquo; button on the home page.</p>
      <section aria-labelledby="texts-h" className={`${card} mt-6`}>
        <h2 id="texts-h" className="mb-4 text-h3">
          Site texts
        </h2>
        <SettingsForm
          initial={{ homeTitle: s.homeTitle, homeSubtitle: s.homeSubtitle, footerText: s.footerText, contactEmail: s.contactEmail }}
          limits={SETTINGS_LIMITS}
        />
      </section>
      <h2 className="mb-3 mt-8 text-h3">All-brands kit</h2>
      <KitEditor info={info} />
    </div>
  );
}
