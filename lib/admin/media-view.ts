import "server-only";
import { db } from "../db";
import { formatSize } from "../format";
import type { MediaItem } from "../generated/prisma/client";
import { downloadUrl, publicUrl } from "../storage-url";

/** One animation or event item as the admin editor shows it. */
export type AdminMediaItem = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  name: string;
  description: string;
  processing: boolean;
  error: string | null;
  preview: { video: string; poster: string } | { image: string } | null;
  /** "1920 × 1080 · 8.1 s · with sound" */
  info: string | null;
  files: { label: string; url: string; size: string }[];
};

const LABEL: Record<string, string> = { "video/mp4": "MP4", "video/webm": "WebM", "image/gif": "GIF", "image/svg+xml": "SVG", "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP" };

export async function adminMediaItems(items: MediaItem[]): Promise<AdminMediaItem[]> {
  const ids = items.flatMap((m) => [m.imageFileId, m.pngFileId, m.mp4FileId, m.silentFileId, m.webmFileId, m.gifFileId, m.posterFileId]).filter((x): x is string => Boolean(x));
  const files = new Map((ids.length ? await db.fileObject.findMany({ where: { id: { in: ids } } }) : []).map((f) => [f.id, f]));
  const get = (id: string | null) => (id ? files.get(id) : undefined);
  return items.map((m) => {
    const mp4 = get(m.mp4FileId);
    const poster = get(m.posterFileId);
    const image = get(m.imageFileId);
    const listed = m.kind === "VIDEO" ? [m.mp4FileId, m.silentFileId, m.webmFileId, m.gifFileId] : [m.imageFileId, m.pngFileId];
    const info =
      m.kind === "VIDEO" && m.durationMs
        ? `${m.width} × ${m.height} · ${(m.durationMs / 1000).toFixed(1)} s · ${m.hasAudio ? "with sound" : "no sound"}`
        : m.kind === "IMAGE" && image?.width
          ? `${image.width} × ${image.height}`
          : null;
    return {
      id: m.id,
      kind: m.kind,
      name: m.name,
      description: m.description,
      processing: Boolean(m.processingAt),
      error: m.error,
      preview: m.kind === "VIDEO" ? (mp4 && poster ? { video: publicUrl(mp4.key), poster: publicUrl(poster.key) } : null) : image ? { image: publicUrl(image.key) } : null,
      info,
      files: listed
        .map(get)
        .filter((f) => f !== undefined)
        .map((f) => ({ label: f.name.endsWith("-no-sound.mp4") ? "MP4, no sound" : (LABEL[f.mime] ?? "File"), url: downloadUrl(f.key, f.name), size: formatSize(Math.round((f.size / 1024) * 10) / 10) })),
    };
  });
}
