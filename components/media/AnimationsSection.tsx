"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { formatSize } from "@/lib/format";
import type { FileRef } from "@/lib/files";
import type { MediaView } from "@/lib/view";
import { SegmentedTabs } from "../logos/SegmentedTabs";
import { Section } from "../sections/Section";
import { buttonClass } from "../ui/Button";
import { DownloadLink } from "../ui/DownloadLink";
import { MediaDownload } from "./MediaDownload";
import { VideoPlayer } from "./VideoPlayer";

const PANEL_ID = "animations-panel";
const tabId = (key: string) => `animation-tab-${key}`;

/** Logo animations: one at a time on a stage, a tab per animation, every format to download. */
export function AnimationsSection({ items, zip }: { items: MediaView[]; zip: FileRef | null }) {
  const [key, setKey] = useState(items[0]!.key);
  const item = items.find((i) => i.key === key) ?? items[0]!;
  const video = item.video!;
  return (
    <Section
      id="animations"
      title="Animations"
      subtitle="Logo animations as MP4, WebM and GIF."
      aside={
        items.length > 1 && (
          <SegmentedTabs label="Animation" controls={PANEL_ID} items={items.map((i) => ({ id: i.key, tabId: tabId(i.key), label: i.name }))} active={item.key} onSelect={setKey} />
        )
      }
    >
      <div id={PANEL_ID} role={items.length > 1 ? "tabpanel" : undefined} aria-labelledby={items.length > 1 ? tabId(item.key) : undefined}>
        <div className="overflow-hidden rounded-card border border-hairline bg-black" style={{ aspectRatio: String(Math.max(item.width / item.height || 16 / 9, 4 / 3)) }}>
          <VideoPlayer key={item.key} video={video} label={item.name} />
        </div>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-h3">{item.name}</h3>
            {item.description && <p className="mt-1 text-small text-pretty text-muted">{item.description}</p>}
            <p className="mt-1 text-caption tabular-nums text-muted">
              {item.width} × {item.height} · {(video.durationMs / 1000).toFixed(1)} s · {video.hasAudio ? "with sound" : "no sound"}
            </p>
          </div>
          <MediaDownload item={item} />
        </div>
        {zip && items.length > 1 && (
          <DownloadLink file={zip} feedback className={buttonClass({ variant: "ghost", size: "sm", className: "mt-4" })}>
            <Download aria-hidden className="size-4" />
            <span className="tabular-nums">
              Download all animations <span className="text-muted">· ZIP · {formatSize(zip.sizeKb)}</span>
            </span>
          </DownloadLink>
        )}
      </div>
    </Section>
  );
}
