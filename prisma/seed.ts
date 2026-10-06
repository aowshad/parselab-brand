/**
 * `pnpm db:seed`: creates the admin (once) and imports the brands in prisma/seed-data/ into
 * Postgres and Supabase Storage. Idempotent: brands and settings that already exist are left
 * alone, and files are matched by content hash, so a second run changes nothing.
 *
 * Refuses to run with NODE_ENV=production unless `--force` is passed.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { getAllBrands } from "../lib/content";
import type { FileRef, ImageRef } from "../lib/files";
import { PrismaClient, type FileObject, type Prisma } from "../lib/generated/prisma/client";
import { getManifest } from "../lib/manifest";

const ROOT = process.cwd();
if (fs.existsSync(path.join(ROOT, ".env.local"))) process.loadEnvFile(path.join(ROOT, ".env.local"));

const FORCE = process.argv.includes("--force");
if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("✗ NODE_ENV=production: refusing to seed. Pass --force if you really mean the production database.");
  process.exit(1);
}

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in .env.local.`);
  if (v.includes("[YOUR-PASSWORD]")) throw new Error(`${name} still has the [YOUR-PASSWORD] placeholder: put the database password in .env.local.`);
  return v;
};

/** Where scripts/build-assets.ts writes its output. */
const OUT_ROOT = path.join(ROOT, ".generated", "assets");
const BUCKET = process.env.SUPABASE_BUCKET ?? "brand-assets";
const MIN_PASSWORD = 12;

// The seed runs from a laptop: the direct (session) connection avoids transaction-pooler limits.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL") }) });
const storage = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage.from(BUCKET);

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".zip": "application/zip",
  ".css": "text/css",
  ".json": "application/json",
};

const stats = { uploaded: 0, reused: 0 };

/**
 * Uploads one generated file under a server-generated UUID key, or reuses an identical file
 * (same bytes, same download name) that's already stored.
 */
async function store(ref: FileRef | ImageRef, owner: string, kind: string): Promise<FileObject> {
  const abs = path.join(OUT_ROOT, ref.path);
  const bytes = fs.readFileSync(abs);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const existing = await db.fileObject.findFirst({ where: { sha256, name: ref.filename } });
  if (existing) {
    stats.reused++;
    return existing;
  }
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Unexpected file type: ${abs}`);
  const key = `${owner}/${kind}/${crypto.randomUUID()}${ext}`;
  // UUID keys never change content, so CDNs and browsers may cache them for a year.
  const { error } = await storage.upload(key, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Upload failed for ${ref.filename}: ${error.message}`);
  stats.uploaded++;
  const dims = "width" in ref ? { width: ref.width, height: ref.height } : {};
  return db.fileObject.create({ data: { key, mime, size: bytes.length, name: ref.filename, sha256, ...dims } });
}

async function seedAdmin() {
  if ((await db.admin.count()) > 0) {
    console.log("• Admin exists; ADMIN_EMAIL / ADMIN_PASSWORD are ignored (the database is the source of truth).");
    return;
  }
  const email = env("ADMIN_EMAIL").trim().toLowerCase();
  const password = env("ADMIN_PASSWORD");
  if (password.length < MIN_PASSWORD) throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters.`);
  // @node-rs/argon2 defaults to argon2id.
  await db.admin.create({ data: { email, passwordHash: await hash(password) } });
  console.log(`✓ Admin created: ${email}`);
}

/** brand.json variant ids are `<type>-<suffix>`; the database stores the suffix as the variant key. */
const variantKey = (groupKey: string, id: string) => {
  const suffix = id.startsWith(`${groupKey}-`) ? id.slice(groupKey.length + 1) : id;
  return ({ "dark-bg": "on-dark", "light-bg": "on-light" } as Record<string, string>)[suffix] ?? suffix;
};

async function seedBrands() {
  const manifest = getManifest();
  // Home order as it was: live brands first, then by `order`.
  const brands = [...getAllBrands()].sort((a, b) => (a.status === b.status ? 0 : a.status === "live" ? -1 : 1));

  for (const [sortOrder, brand] of brands.entries()) {
    if (await db.brand.findUnique({ where: { slug: brand.slug }, select: { id: true } })) {
      console.log(`• ${brand.slug.padEnd(10)} already imported, left as is`);
      continue;
    }
    const assets = manifest.brands[brand.slug];
    if (!assets) throw new Error(`No generated assets for ${brand.slug}. Run \`pnpm assets\`.`);
    const id = crypto.randomUUID();
    const owner = `brands/${id}`;

    const logoTypes: Prisma.LogoTypeCreateWithoutBrandInput[] = [];
    let iconFileId: string | undefined;
    for (const [ti, group] of brand.logoGroups.entries()) {
      const zip = await store(assets.groups[group.key]!, owner, "zips");
      const variants: Prisma.LogoVariantCreateWithoutLogoTypeInput[] = [];
      for (const [vi, v] of group.variants.entries()) {
        const a = assets.variants[v.id]!;
        const svg = await store(a.svg, owner, "logos");
        const png: Record<number, string> = {};
        for (const p of a.png) png[p.size] = (await store(p, owner, "png")).id;
        if (v.id === "icon-brand") iconFileId = svg.id;
        variants.push({
          key: variantKey(group.key, v.id),
          name: v.name,
          hint: v.usage,
          fileName: a.svg.filename,
          previewBg: v.previewBg,
          dot: v.dot ?? null,
          svgFileId: svg.id,
          png512Id: png[512],
          png1024Id: png[1024],
          png2048Id: png[2048],
          png4096Id: png[4096],
          sortOrder: vi,
        });
      }
      logoTypes.push({ key: group.key, label: group.label, description: group.description, sortOrder: ti, zipFileId: zip.id, variants: { create: variants } });
    }

    const colors: Prisma.ColorCreateWithoutBrandInput[] = brand.palettes
      .flatMap((p) => p.colors)
      .map((c, i) =>
        "gradient" in c
          ? { role: c.role, name: c.name, kind: "GRADIENT" as const, gradient: c.gradient, sortOrder: i }
          : { role: c.role, name: c.name, kind: "SOLID" as const, hex: c.hex, cmyk: c.cmyk, pantone: c.pantone, sortOrder: i },
      );

    const kit = assets.kit ? await store(assets.kit, owner, "zips") : null;
    const css = assets.colors ? await store(assets.colors.css, owner, "colors") : null;
    const json = assets.colors ? await store(assets.colors.json, owner, "colors") : null;
    const og = await store(assets.og, owner, "og");

    await db.brand.create({
      data: {
        id,
        slug: brand.slug,
        name: brand.name,
        tagline: brand.description,
        status: brand.status === "live" ? "LIVE" : "SOON",
        sortOrder,
        iconFileId,
        kitFileId: kit?.id,
        kitBuiltAt: kit ? new Date() : null,
        colorsCssFileId: css?.id,
        colorsJsonFileId: json?.id,
        ogFileId: og.id,
        typography: brand.typography ?? undefined,
        // Keep the "Updated" date the brand page showed before the move.
        updatedAt: new Date(`${brand.updatedAt}T00:00:00Z`),
        logoTypes: { create: logoTypes },
        colors: { create: colors },
      },
    });
    const n = brand.logoGroups.reduce((s, g) => s + g.variants.length, 0);
    console.log(`✓ ${brand.slug.padEnd(10)} ${n} logos, ${colors.length} colors`);
  }
}

async function seedSettings() {
  if (await db.siteSettings.findUnique({ where: { id: 1 } })) {
    console.log("• Site settings exist, left as is");
    return;
  }
  const manifest = getManifest();
  const allKit = manifest.all ? await store(manifest.all, "site", "zips") : null;
  const og = await store(manifest.og, "site", "og");
  await db.siteSettings.create({ data: { id: 1, allKitFileId: allKit?.id, ogFileId: og.id } });
  console.log("✓ Site settings created");
}

async function main() {
  // Make sure the generated files match the seed data (cached, so usually instant).
  const built = spawnSync(path.join(ROOT, "node_modules", ".bin", "tsx"), ["scripts/build-assets.ts"], { stdio: "inherit" });
  if (built.status !== 0) throw new Error("Asset build failed.");

  await seedAdmin();
  await seedBrands();
  await seedSettings();
  console.log(`\nFiles: ${stats.uploaded} uploaded, ${stats.reused} already stored.`);
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
