import "server-only";
import zlib from "node:zlib";
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

/**
 * Every file in a ZIP: name and bytes, read from its central directory. Handles stored and
 * deflated entries (what archiver writes, so every brand kit); throws on anything else.
 */
export function readZip(buf: Buffer): { name: string; bytes: Buffer }[] {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a ZIP file.");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out: { name: string; bytes: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("The ZIP's file list is damaged.");
    const method = buf.readUInt16LE(off + 10);
    const size = buf.readUInt32LE(off + 20);
    const [nameLen, extraLen, commentLen] = [buf.readUInt16LE(off + 28), buf.readUInt16LE(off + 30), buf.readUInt16LE(off + 32)];
    const local = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    off += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`Unsupported compression (${method}) for ${name}.`);
    out.push({ name, bytes: method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data) });
  }
  return out;
}
