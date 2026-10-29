// Media processing on local fixtures: no database, no storage, no network. The test videos are
// made with the same bundled ffmpeg the app uses, so nothing else needs installing.
// Run: pnpm test:unit
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { previewWebp, PREVIEW_MAX } from "../../lib/admin/preview";
import { convertVideo, ffmpeg, GIF_MAX, probe } from "../../lib/admin/video";
import { readZip, zipBuffer } from "../../lib/admin/zip";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "media-test-"));
const bin = await ffmpeg();
const ff = (...args: string[]) => execFileSync(bin, ["-v", "error", "-y", ...args]);
const clip = path.join(dir, "clip.mp4");
const silentClip = path.join(dir, "silent.mp4");
ff("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=2", "-f", "lavfi", "-i", "sine=frequency=660:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", clip);
ff("-f", "lavfi", "-i", "testsrc2=size=720x720:rate=30:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", silentClip);

test("a video with sound becomes MP4, MP4 without sound, WebM, GIF and a still", async () => {
  const out = fs.mkdtempSync(path.join(dir, "a-"));
  const r = await convertVideo(clip, out);
  assert.deepEqual([r.info.width, r.info.height, r.info.hasAudio], [1280, 720, true]);
  assert.ok(r.info.durationMs > 1900 && r.info.durationMs < 2200, `duration ${r.info.durationMs}`);
  for (const f of Object.values(r.files)) assert.ok(f && fs.statSync(f).size > 1000, `${f} exists`);
  assert.equal((await probe(r.files.mp4)).hasAudio, true, "the MP4 keeps the sound");
  assert.equal((await probe(r.files.silent!)).hasAudio, false, "the no-sound MP4 has none");
  assert.equal((await probe(r.files.webm)).hasAudio, true, "the WebM keeps the sound");
  const gif = await sharp(r.files.gif, { animated: true }).metadata();
  assert.equal(gif.width, GIF_MAX);
  assert.equal(gif.pageHeight, 360);
  assert.ok((gif.pages ?? 0) > 20, `the GIF is animated (${gif.pages} frames)`);
  const still = await sharp(r.files.poster).metadata();
  assert.deepEqual([still.format, still.width, still.height], ["jpeg", 1280, 720]);
});

test("a video without sound gets no separate no-sound MP4", async () => {
  const r = await convertVideo(silentClip, fs.mkdtempSync(path.join(dir, "b-")));
  assert.equal(r.info.hasAudio, false);
  assert.equal(r.files.silent, null);
  assert.deepEqual([r.sized.width, r.sized.height], [720, 720]);
});

test("event image previews are small WebPs", async () => {
  const png = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#E04E2A" } }).png().toBuffer();
  const p = await previewWebp(png, "image/png");
  assert.deepEqual([p.width, p.height], [PREVIEW_MAX, PREVIEW_MAX]);
  assert.equal((await sharp(p.bytes).metadata()).format, "webp");
  const small = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#123456" } }).png().toBuffer();
  assert.deepEqual([(await previewWebp(small, "image/png")).width], [200], "small images aren't enlarged");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="#f80"/></svg>');
  const v = await previewWebp(svg, "image/svg+xml");
  assert.deepEqual([v.width, v.height], [PREVIEW_MAX, PREVIEW_MAX / 2], "SVGs render at preview size");
});

test("readZip unpacks what zipBuffer packs (stored and deflated entries)", async () => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#00ff00" } }).png().toBuffer();
  const entries = [
    { name: "README.txt", bytes: Buffer.from("Hello kit\n".repeat(50)) },
    { name: "png/512/logo@512.png", bytes: png },
    { name: "svg/logo.svg", bytes: Buffer.from("<svg/>") },
  ];
  const back = readZip(await zipBuffer(entries));
  assert.deepEqual(back.map((e) => e.name), entries.map((e) => e.name));
  for (const [i, e] of back.entries()) assert.ok(e.bytes.equals(entries[i]!.bytes), `${e.name} round-trips`);
  assert.throws(() => readZip(Buffer.from("not a zip")), /Not a ZIP/);
});
