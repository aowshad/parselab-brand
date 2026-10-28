"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MediaView } from "@/lib/view";

/**
 * A looping animation. It plays muted (browsers only autoplay muted video), except for people
 * who ask for reduced motion: they get the still and a play button. Pause is always there
 * (moving content longer than 5 seconds needs one), and sound when the video has any.
 */
export function VideoPlayer({ video, label }: { video: NonNullable<MediaView["video"]>; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) v.play().catch(() => {});
  }, [video.src]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) v.play().catch(() => {});
  };

  const button = "motion-colors grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 focus-visible:outline-white";
  return (
    <div className="relative size-full">
      <video
        ref={ref}
        src={video.src}
        poster={video.poster}
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        className="size-full object-contain"
      />
      <div className="absolute bottom-3 left-3 flex gap-2">
        <button type="button" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`} className={button}>
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </button>
        {video.hasAudio && (
          <button type="button" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"} aria-pressed={!muted} className={button}>
            {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
