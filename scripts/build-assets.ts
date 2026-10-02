/**
 * Build-time asset pipeline. For every brand:
 *   1. optimize each SVG with svgo  → public/brands/<slug>/logos/svg/<slug>-<id>.svg
 *   2. render transparent PNGs      → public/brands/<slug>/logos/png/<slug>-<id>@<width>.png
 *   3. write the palette            → public/brands/<slug>/colors.{css,json}
 *   4. zip the brand kit + each logo group (only for brands that have logos)
 *   5. zip every brand kit together  → public/brands/parselab-brand-kits.zip ("Download all")
 *   6. write .generated/manifest.json (paths + sizes) for the UI
 * Unchanged sources are skipped using a hash cache in .cache/.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { ZipArchive } from "archiver";
import { optimize } from "svgo";
import { describeColor, gradientCss } from "../lib/color";
import { CONTENT_DIR, ContentError, getAllBrands } from "../lib/content";
import { MANIFEST_PATH, PNG_WIDTHS, type BrandAssets, type FileRef, type Manifest } from "../lib/manifest";
import type { Brand } from "../lib/schema";

/** Bump to invalidate the cache when the pipeline's output changes. */
const PIPELINE_VERSION = 1;

const ROOT = process.cwd();
const PUBLIC_BRANDS = path.join(ROOT, "public", "brands");
const ALL_KITS = path.join(PUBLIC_BRANDS, "parselab-brand-kits.zip");
const CACHE_PATH = path.join(ROOT, ".cache", "build-assets.json");

type Cache = { version: number; entries: Record<string, string> };

const sha = (...parts: (string | Buffer)[]) => {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex").slice(0, 16);
};
const kebab = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const toPublic = (abs: string) => "/" + path.relative(path.join(ROOT, "public"), abs).split(path.sep).join("/");

function fileRef(abs: string): FileRef {
  return { path: toPublic(abs), filename: path.basename(abs), sizeKb: Math.round((fs.statSync(abs).size / 1024) * 10) / 10 };
}

function readCache(): Cache {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as Cache;
    if (c.version === PIPELINE_VERSION) return c;
  } catch {}
  return { version: PIPELINE_VERSION, entries: {} };
}

function optimizeSvg(source: string, file: string): string {
  const { data } = optimize(source, {
    path: file,
    multipass: false,
    plugins: [
      {
        name: "preset-default",
        params: {
          // Keep geometry exactly as drawn: merging or converting shapes can change rendering.
          overrides: { mergePaths: false, convertShapeToPath: false, collapseGroups: false },
        },
      },
    ],
  });
  if (!/\sviewBox=/.test(data)) {
    throw new Error(`${path.relative(ROOT, file)} has no viewBox. Add one so it scales correctly.`);
  }
  return data;
}

function renderPng(svg: string, width: number): { png: Buffer; height: number } {
  const hasText = /<text[\s>]/.test(svg);
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
    font: { loadSystemFonts: hasText },
  });
  const img = r.render();
  return { png: img.asPng(), height: img.height };
}

function paletteFiles(brand: Brand) {
  const seen = new Set<string>();
  const uniqueVar = (base: string, paletteName: string) => {
    const name = seen.has(base) ? base.replace(`--${brand.slug}-`, `--${brand.slug}-${kebab(paletteName)}-`) : base;
    seen.add(name);
    return name;
  };
  const palettes = brand.palettes.map((palette) => ({
    name: palette.name,
    colors: palette.colors.map((c) => {
      if ("gradient" in c) {
        const { angle, stops } = c.gradient;
        return {
          name: c.name,
          role: c.role,
          type: "gradient" as const,
          css: gradientCss(angle, stops),
          angle,
          stops: stops.map((s) => ({ at: s.at, ...describeColor(s.hex) })),
          cssVar: uniqueVar(`--${brand.slug}-${kebab(c.name)}`, palette.name),
        };
      }
      return {
        name: c.name,
        role: c.role,
        ...describeColor(c.hex),
        cmyk: c.cmyk,
        pantone: c.pantone,
        cssVar: uniqueVar(`--${brand.slug}-${kebab(c.name)}`, palette.name),
      };
    }),
  }));

  const json = JSON.stringify({ brand: brand.name, slug: brand.slug, updatedAt: brand.updatedAt, palettes }, null, 2) + "\n";
  const css =
    `/* ${brand.name} brand colors. Generated from content/brands/${brand.slug}/brand.json */\n:root {\n` +
    palettes
      .map(
        (p) =>
          `  /* ${p.name} */\n` +
          p.colors.map((c) => `  ${c.cssVar}: ${"css" in c ? c.css : c.hex}; /* ${c.role} */`).join("\n"),
      )
      .join("\n\n") +
    "\n}\n";
  return { json, css };
}

async function writeZip(dest: string, entries: { name: string; source: string | Buffer }[], date: Date) {
  const tmp = `${dest}.tmp`;
  const out = fs.createWriteStream(tmp);
  const zip = new ZipArchive({ zlib: { level: 9 } });
  const done = new Promise<void>((resolve, reject) => {
    out.on("close", resolve);
    out.on("error", reject);
    zip.on("error", reject);
  });
  zip.pipe(out);
  // Fixed entry dates keep the zip byte-identical between builds.
  for (const e of entries) zip.append(e.source, { name: e.name, date });
  await zip.finalize();
  await done;
  fs.renameSync(tmp, dest);
}

/** Delete anything under `dir` that isn't in `keep`, then empty directories. */
function prune(dir: string, keep: Set<string>) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      prune(abs, keep);
      if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
    } else if (!keep.has(abs)) {
      fs.rmSync(abs);
    }
  }
}

async function buildBrand(brand: Brand, cache: Cache, stats: { rendered: number; skipped: number }): Promise<BrandAssets> {
  const out = path.join(PUBLIC_BRANDS, brand.slug);
  const svgDir = path.join(out, "logos", "svg");
  const pngDir = path.join(out, "logos", "png");
  fs.mkdirSync(svgDir, { recursive: true });
  fs.mkdirSync(pngDir, { recursive: true });

  const keep = new Set<string>();
  const assets: BrandAssets = { kit: null, colors: null, groups: {}, variants: {} };
  const sourceHashes: Record<string, string> = {};

  for (const group of brand.logoGroups) {
    for (const variant of group.variants) {
      const srcPath = path.join(CONTENT_DIR, brand.slug, "logos", variant.file);
      const source = fs.readFileSync(srcPath, "utf8");
      const hash = sha(source, String(PIPELINE_VERSION), PNG_WIDTHS.join());
      const cacheKey = `${brand.slug}/${variant.id}`;
      sourceHashes[variant.id] = hash;

      const base = `${brand.slug}-${variant.id}`;
      const svgOut = path.join(svgDir, `${base}.svg`);
      const pngOut = (w: number) => path.join(pngDir, `${base}@${w}.png`);
      const outputs = [svgOut, ...PNG_WIDTHS.map(pngOut)];
      outputs.forEach((o) => keep.add(o));

      const fresh = cache.entries[cacheKey] === hash && outputs.every((o) => fs.existsSync(o));
      if (fresh) {
        stats.skipped++;
      } else {
        const svg = optimizeSvg(source, srcPath);
        fs.writeFileSync(svgOut, svg);
        for (const w of PNG_WIDTHS) fs.writeFileSync(pngOut(w), renderPng(svg, w).png);
        cache.entries[cacheKey] = hash;
        stats.rendered++;
      }

      const intrinsic = new Resvg(fs.readFileSync(svgOut));
      assets.variants[variant.id] = {
        svg: { ...fileRef(svgOut), width: Math.round(intrinsic.width), height: Math.round(intrinsic.height) },
        png: PNG_WIDTHS.map((w) => ({
          ...fileRef(pngOut(w)),
          size: w,
          width: w,
          height: Math.round((w * intrinsic.height) / intrinsic.width),
        })),
      };
    }
  }

  // Palette files, served individually and included in the kit.
  const colors = brand.palettes.length ? paletteFiles(brand) : null;
  if (colors) {
    const cssOut = path.join(out, "colors.css");
    const jsonOut = path.join(out, "colors.json");
    fs.writeFileSync(cssOut, colors.css);
    fs.writeFileSync(jsonOut, colors.json);
    keep.add(cssOut).add(jsonOut);
    assets.colors = { css: fileRef(cssOut), json: fileRef(jsonOut) };
  }

  const date = new Date(`${brand.updatedAt}T00:00:00Z`);
  const zipEntries = (variantIds: string[]) =>
    variantIds.flatMap((id) => {
      const v = assets.variants[id]!;
      return [
        { name: `svg/${v.svg.filename}`, source: path.join(svgDir, v.svg.filename) },
        ...v.png.map((p) => ({ name: `png/${p.size}/${p.filename}`, source: path.join(pngDir, p.filename) })),
      ];
    });

  const buildZip = async (dest: string, ids: string[], extra: { name: string; source: string }[] = []) => {
    keep.add(dest);
    const key = `${brand.slug}/zip/${path.basename(dest)}`;
    const hash = sha(...ids.map((id) => `${id}:${sourceHashes[id]}`), ...extra.map((e) => `${e.name}:${e.source}`));
    if (cache.entries[key] === hash && fs.existsSync(dest)) return fileRef(dest);
    const files = zipEntries(ids).map((e) => ({ name: e.name, source: fs.readFileSync(e.source) }));
    await writeZip(dest, [...files, ...extra], date);
    cache.entries[key] = hash;
    return fileRef(dest);
  };

  for (const group of brand.logoGroups) {
    const dest = path.join(out, `${brand.slug}-${group.key}-logos.zip`);
    assets.groups[group.key] = await buildZip(dest, group.variants.map((v) => v.id));
  }

  // A kit needs logos; a brand with only colors (or nothing yet) gets no kit and no download button.
  const allIds = brand.logoGroups.flatMap((g) => g.variants.map((v) => v.id));
  if (allIds.length) {
    const colorEntries = colors
      ? [
          { name: "colors.json", source: colors.json },
          { name: "colors.css", source: colors.css },
        ]
      : [];
    assets.kit = await buildZip(path.join(out, `${brand.slug}-brand-kit.zip`), allIds, colorEntries);
  }

  prune(out, keep);
  return assets;
}

/** Every brand kit's contents in one zip, each brand in its own folder. */
async function buildAllKits(brands: Brand[], manifest: Manifest, cache: Cache): Promise<FileRef | null> {
  const withKit = brands.filter((b) => manifest.brands[b.slug]?.kit);
  if (!withKit.length) return null;
  const hash = sha(...withKit.map((b) => `${b.slug}:${cache.entries[`${b.slug}/zip/${b.slug}-brand-kit.zip`]}`));
  if (cache.entries["all-kits"] !== hash || !fs.existsSync(ALL_KITS)) {
    const entries = withKit.flatMap((b) => {
      const a = manifest.brands[b.slug]!;
      const dir = path.join(PUBLIC_BRANDS, b.slug);
      const files = Object.values(a.variants).flatMap((v) => [
        { name: `${b.slug}/svg/${v.svg.filename}`, source: fs.readFileSync(path.join(dir, "logos", "svg", v.svg.filename)) },
        ...v.png.map((p) => ({ name: `${b.slug}/png/${p.size}/${p.filename}`, source: fs.readFileSync(path.join(dir, "logos", "png", p.filename)) })),
      ]);
      const colors = a.colors
        ? ["colors.json", "colors.css"].map((f) => ({ name: `${b.slug}/${f}`, source: fs.readFileSync(path.join(dir, f)) }))
        : [];
      return [...files, ...colors];
    });
    const latest = withKit.map((b) => b.updatedAt).sort().at(-1)!;
    await writeZip(ALL_KITS, entries, new Date(`${latest}T00:00:00Z`));
    cache.entries["all-kits"] = hash;
  }
  return fileRef(ALL_KITS);
}

async function main() {
  const started = Date.now();
  const brands = getAllBrands();
  const cache = readCache();
  const stats = { rendered: 0, skipped: 0 };
  const manifest: Manifest = { all: null, brands: {} };

  for (const brand of brands) {
    manifest.brands[brand.slug] = await buildBrand(brand, cache, stats);
    const a = manifest.brands[brand.slug]!;
    const kit = a.kit ? `kit ${a.kit.sizeKb} KB` : "no kit yet";
    console.log(`✓ ${brand.slug.padEnd(14)} ${brand.status.padEnd(5)} ${Object.keys(a.variants).length} variants, ${kit}`);
  }
  manifest.all = await buildAllKits(brands, manifest, cache);
  if (manifest.all) console.log(`✓ all brand kits   ${manifest.all.sizeKb} KB`);

  // Remove output for brands that were deleted, and the combined zip if no kits remain.
  if (fs.existsSync(PUBLIC_BRANDS)) {
    for (const name of fs.readdirSync(PUBLIC_BRANDS)) {
      const abs = path.join(PUBLIC_BRANDS, name);
      if (abs === ALL_KITS ? !manifest.all : !manifest.brands[name]) fs.rmSync(abs, { recursive: true, force: true });
    }
  }

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");

  console.log(`  ${stats.rendered} rendered, ${stats.skipped} cached · ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err instanceof ContentError ? `\n✗ ${err.message}` : err);
  process.exit(1);
});
