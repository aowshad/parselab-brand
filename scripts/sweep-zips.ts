/**
 * `pnpm storage:sweep`: lists generated zips that nothing references any more (left behind by
 * rebuilds that overlapped, before rebuilds learned to discard their own work). Add `-- --delete`
 * to delete them. Only zips older than 15 minutes, so a rebuild still running isn't touched;
 * uploads and logos are never considered. Zips are rebuilt from the logos whenever needed.
 */
import fs from "node:fs";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const { db } = await import("../lib/db");
const { deleteFiles, referencedFileIds } = await import("../lib/admin/files");

const MIN_AGE_MS = 15 * 60 * 1000;
const remove = process.argv.includes("--delete");

const used = await referencedFileIds();
const zips = await db.fileObject.findMany({
  where: { mime: "application/zip", createdAt: { lt: new Date(Date.now() - MIN_AGE_MS) } },
  select: { id: true, key: true, size: true },
});
const orphans = zips.filter((f) => !used.has(f.id) && /^(site|brands\/[^/]+)\/zips\//.test(f.key));
const mb = orphans.reduce((n, f) => n + f.size, 0) / 1024 / 1024;
console.log(`${orphans.length} unreferenced zip${orphans.length === 1 ? "" : "s"} (${mb.toFixed(1)} MB) of ${zips.length}.`);

if (remove && orphans.length) {
  let deleted = 0;
  // deleteFiles checks references again, so a zip that became the current one meanwhile stays.
  for (let i = 0; i < orphans.length; i += 50) deleted += await deleteFiles(orphans.slice(i, i + 50).map((f) => f.id));
  console.log(`Deleted ${deleted}.`);
} else if (orphans.length) {
  console.log("Run again with --delete to delete them.");
}
process.exit(0);
