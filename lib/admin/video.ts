import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

/*
 * Video conversion with the bundled ffmpeg: files in, files out. No database or storage here,
 * so it can be tested on a local video (tests/unit/media.test.ts).
 */

/** MP4 and WebM keep up to this many pixels on the long side; GIFs, which get big, much less. */
export const VIDEO_MAX = 1920;
export const GIF_MAX = 640;
export const GIF_FPS = 20;

let binary: Promise<string> | undefined;
/**
 * The ffmpeg that ships with @ffmpeg-installer. Its package marks the binary executable in an
 * install script, which doesn't run on Vercel (cached installs) or in CI, so make sure here: a
 * copy in the temp folder can be made executable even where node_modules is read-only.
 */
export function ffmpeg(): Promise<string> {
  binary ??= (async () => {
    const original = ffmpegInstaller.path;
    try {
      await fs.access(original, fs.constants.X_OK);
      return original;
    } catch {
      const copy = path.join(os.tmpdir(), "ffmpeg");
      await fs.copyFile(original, copy);
      await fs.chmod(copy, 0o755);
      return copy;
    }
  })();
  return binary;
}

/** Runs ffmpeg; resolves with what it printed (ffmpeg reports on stderr). */
async function run(args: string[], { allowFailure = false } = {}): Promise<string> {
  const bin = await ffmpeg();
  return new Promise((resolve, reject) => {
    execFile(bin, ["-hide_banner", "-y", ...args], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err && !allowFailure) return reject(new Error(lastLine(stderr) || err.message));
      // ffmpeg itself missing or not runnable: report that, not a confusing parse failure later.
      if (err && !stderr) return reject(new Error(`ffmpeg didn't run (${bin}): ${err.message}`));
      resolve(stderr);
    });
  });
}
const lastLine = (s: string) => s.trim().split("\n").filter(Boolean).at(-1) ?? "";

export type VideoInfo = { width: number; height: number; durationMs: number; hasAudio: boolean };

/** Size, length and whether there's sound, read from `ffmpeg -i` (no ffprobe ships with it). */
export async function probe(file: string): Promise<VideoInfo> {
  // Reading the header is enough; a file that isn't a video fails here with a clear message.
  const out = await run(["-i", file, "-t", "0", "-f", "null", "-"], { allowFailure: true });
  const d = out.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = out.match(/Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  // Some builds report a GIF's duration as N/A: only the picture size is required.
  if (!v) {
    console.error("ffmpeg couldn't read the upload:", out.slice(-600));
    throw new Error("That video couldn't be read. Export it again as MP4 (H.264) and retry.");
  }
  const rotated = /rotate\s*:\s*-?(90|270)/.test(out) || /rotation of -?(90|270)/.test(out);
  const [w, h] = [Number(v[1]), Number(v[2])];
  return {
    width: rotated ? h : w,
    height: rotated ? w : h,
    durationMs: d ? Math.round((Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])) * 1000) : 0,
    hasAudio: /Stream #[^\n]*Audio:/.test(out),
  };
}

/** The long side capped, both sides even (H.264 and VP9 need even sizes). */
const fit = (max: number) => `scale='if(gte(iw,ih),min(${max},iw),-2)':'if(gte(iw,ih),-2,min(${max},ih))'`;

export type Converted = {
  /** The upload's own size, length and sound. */
  info: VideoInfo;
  /** The MP4's size (capped at VIDEO_MAX) and the GIF's (capped at GIF_MAX). */
  sized: VideoInfo;
  gifSize: VideoInfo;
  /** Paths in `dir`; `silent` only when the video has sound. */
  files: { mp4: string; silent: string | null; webm: string; gif: string; poster: string };
};

/**
 * Makes every format from one video: an MP4 (H.264/AAC, starts playing before it has loaded),
 * the same without sound, a WebM (VP9/Opus), a looping GIF and a still from the last moment.
 */
export async function convertVideo(input: string, dir: string): Promise<Converted> {
  const info = await probe(input);
  const out = (name: string) => path.join(dir, name);
  await run(["-i", input, "-vf", fit(VIDEO_MAX), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    ...(info.hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]), out("v.mp4")]);
  if (info.hasAudio) await run(["-i", out("v.mp4"), "-c:v", "copy", "-an", "-movflags", "+faststart", out("silent.mp4")]);
  await run(["-i", out("v.mp4"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "good", "-cpu-used", "5", "-row-mt", "1",
    ...(info.hasAudio ? ["-c:a", "libopus", "-b:a", "96k"] : ["-an"]), out("v.webm")]);
  await run(["-i", out("v.mp4"), "-vf", `fps=${GIF_FPS},${fit(GIF_MAX)}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0", out("v.gif")]);
  // The preview's still: the last moment, where a logo animation shows the finished logo.
  await run(["-sseof", "-0.3", "-i", out("v.mp4"), "-frames:v", "1", "-q:v", "3", out("poster.jpg")]);
  return {
    info,
    sized: await probe(out("v.mp4")),
    gifSize: await probe(out("v.gif")),
    files: { mp4: out("v.mp4"), silent: info.hasAudio ? out("silent.mp4") : null, webm: out("v.webm"), gif: out("v.gif"), poster: out("poster.jpg") },
  };
}

