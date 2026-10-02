import fs from "node:fs";
import path from "node:path";
import { brandSchema, type Brand } from "./schema";

export const CONTENT_DIR = path.join(process.cwd(), "content", "brands");

export class ContentError extends Error {
  constructor(problems: string[]) {
    super(`Invalid brand content:\n\n${problems.join("\n\n")}\n`);
    this.name = "ContentError";
  }
}

const rel = (p: string) => path.relative(process.cwd(), p);

function formatPath(segments: PropertyKey[]): string {
  return segments.reduce<string>(
    (out, seg) => (typeof seg === "number" ? `${out}[${seg}]` : out ? `${out}.${String(seg)}` : String(seg)),
    "",
  );
}

/** Variant label for error messages, e.g. `full/full-dark-bg`. */
function describeVariant(raw: unknown, segments: PropertyKey[]): string | null {
  const [, g, , v] = segments;
  if (segments[0] !== "logoGroups" || typeof g !== "number" || typeof v !== "number") return null;
  const group = (raw as { logoGroups?: { key?: string; variants?: { id?: string }[] }[] }).logoGroups?.[g];
  return `${group?.key ?? `#${g}`}/${group?.variants?.[v]?.id ?? `#${v}`}`;
}

function loadBrandFolder(folder: string, problems: string[]): Brand | null {
  const dir = path.join(CONTENT_DIR, folder);
  const file = path.join(dir, "brand.json");
  const issues: string[] = [];

  if (!fs.existsSync(file)) {
    problems.push(`${rel(dir)}\n  • missing brand.json`);
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    problems.push(`${rel(file)}\n  • not valid JSON: ${(err as Error).message}`);
    return null;
  }

  const parsed = brandSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const variant = describeVariant(raw, issue.path);
      issues.push(`${formatPath(issue.path) || "(root)"}${variant ? ` (${variant})` : ""}: ${issue.message}`);
    }
  }

  // Checked on the raw JSON so these show up even when the schema also fails.
  const loose = raw as { slug?: unknown; logoGroups?: unknown };
  if (typeof loose.slug === "string" && loose.slug !== folder) {
    issues.push(`slug: "${loose.slug}" must match its folder name "${folder}"`);
  }
  const groups = Array.isArray(loose.logoGroups) ? (loose.logoGroups as { key?: unknown; variants?: unknown }[]) : [];
  for (const group of groups) {
    const variants = Array.isArray(group?.variants) ? (group.variants as { id?: unknown; file?: unknown }[]) : [];
    for (const variant of variants) {
      if (typeof variant?.file !== "string") continue;
      const svg = path.join(dir, "logos", variant.file);
      if (!fs.existsSync(svg)) {
        issues.push(`${String(group.key)}/${String(variant.id)}: file "${variant.file}" not found (expected ${rel(svg)})`);
      }
    }
  }

  if (issues.length) {
    problems.push(`${rel(file)}\n${issues.map((i) => `  • ${i}`).join("\n")}`);
    return null;
  }
  return parsed.success ? parsed.data : null;
}

// Cached for builds; in `next dev` content is re-read on every request so edits show on refresh.
const useCache = process.env.NODE_ENV === "production";
let cache: Brand[] | null = null;

/** Every brand (live and soon), validated and in home-page order. Throws ContentError listing all problems. */
export function getAllBrands(): Brand[] {
  if (useCache && cache) return cache;

  const folders = fs.existsSync(CONTENT_DIR)
    ? fs
        .readdirSync(CONTENT_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
    : [];

  const problems: string[] = [];
  const brands = folders.map((f) => loadBrandFolder(f, problems)).filter((b): b is Brand => b !== null);

  if (problems.length) throw new ContentError(problems);
  if (!brands.length) throw new ContentError([`${rel(CONTENT_DIR)}\n  • no brands found`]);

  cache = brands.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return cache;
}

/** One brand by slug. Brand pages use only this, so a page never sees other brands. */
export function getBrand(slug: string): Brand | undefined {
  return getAllBrands().find((b) => b.slug === slug);
}
