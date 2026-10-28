"use client";

import { formatSize } from "@/lib/format";
import type { MediaView } from "@/lib/view";
import { SplitDownload } from "../ui/SplitDownload";

/** "Download MP4" (or the image's format) plus a menu of every format. */
export function MediaDownload({ item }: { item: MediaView }) {
  const [primary] = item.downloads;
  if (!primary) return null;
  return (
    <SplitDownload
      primary={{ file: primary.file, label: `Download ${primary.format}` }}
      items={item.downloads.map((d) => ({
        file: d.file,
        label: d.format,
        detail: d.detail,
        a11y: `${d.format}, ${d.detail}, ${formatSize(d.file.sizeKb)}`,
      }))}
      menuLabel={`Download ${item.name}`}
      resetKey={item.key}
    />
  );
}
