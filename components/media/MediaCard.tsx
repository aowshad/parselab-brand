import type { MediaView } from "@/lib/view";
import { MediaDownload } from "./MediaDownload";
import { VideoPlayer } from "./VideoPlayer";

/** One event item: its picture or video, what it is, and its downloads. */
export function MediaCard({ item }: { item: MediaView }) {
  const ratio = item.width && item.height ? Math.min(Math.max(item.width / item.height, 9 / 16), 16 / 9) : 1;
  return (
    <article aria-label={item.name} className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface">
      <div className={`border-b border-hairline ${item.video ? "bg-black" : "bg-thumb"}`} style={{ aspectRatio: String(ratio) }}>
        {item.video ? (
          <VideoPlayer video={item.video} label={item.name} />
        ) : item.image ? (
          <img src={item.image.src} alt={item.name} loading="lazy" className="size-full object-contain p-4" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h4 className="text-body font-semibold">{item.name}</h4>
        {item.description && <p className="text-small text-pretty text-muted">{item.description}</p>}
        <p className="text-caption tabular-nums text-muted">
          {[item.width && item.height ? `${item.width} × ${item.height}` : null, item.video ? `${(item.video.durationMs / 1000).toFixed(1)} s` : null, item.video ? (item.video.hasAudio ? "with sound" : "no sound") : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-auto pt-3">
          <MediaDownload item={item} />
        </div>
      </div>
    </article>
  );
}
