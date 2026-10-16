import "server-only";
import { ZipArchive } from "archiver";

/** Builds a zip in memory. Entry dates are fixed so the same files give the same bytes. */
export async function zipBuffer(entries: { name: string; bytes: Buffer }[], date = new Date("2026-01-01T00:00:00Z")): Promise<Buffer> {
  const zip = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    zip.on("data", (c: Buffer) => chunks.push(c));
    zip.on("end", () => resolve(Buffer.concat(chunks)));
    zip.on("error", reject);
  });
  for (const e of entries) zip.append(e.bytes, { name: e.name, date });
  await zip.finalize();
  return done;
}
