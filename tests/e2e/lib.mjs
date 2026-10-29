// Shared helpers for the browser tests. Uses the system Chrome (no browser download).
import puppeteer from "puppeteer-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:4173";
/** The brands in the old static build: what the parity test compares against. */
export const BRANDS = ["parselab", "optionia", "inkybay", "jewelslab", "quotend"];
/** Every brand the home page links to right now (brands added in the admin included). */
export async function publishedBrands() {
  const html = await (await fetch(`${BASE}/`)).text();
  return [...new Set([...html.matchAll(/href="\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))].filter((slug) => slug !== "events");
}
/** Every event the events index links to. */
export async function publishedEvents() {
  const html = await (await fetch(`${BASE}/events/`)).text();
  return [...new Set([...html.matchAll(/href="\/events\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))];
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Headless Chrome pinned to a light OS (tests that need dark set it themselves). */
// On GitHub's Ubuntu runners Chrome's sandbox can't start (AppArmor), so CI runs without it.
export const launch = () =>
  puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--blink-settings=preferredColorScheme=1", ...(process.env.CI ? ["--no-sandbox"] : [])] });

let failures = 0;
export function check(ok, msg) {
  if (!ok) failures++;
  console.log(ok ? "  ✓" : "  ✗", msg);
  return ok;
}
export function done(label) {
  console.log(failures ? `\n${failures} FAILURES` : `\n${label}`);
  process.exitCode = failures ? 1 : 0;
}

/** A page in its own browser context (fresh localStorage), optionally with a stored theme. */
export async function open(browser, url, { theme, width = 1440, height = 900, os, clipboard = false } = {}) {
  const ctx = await browser.createBrowserContext();
  if (clipboard) await ctx.overridePermissions(new URL(url).origin, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 404/.test(m.text()) && page.errors.push(m.text()));
  if (os) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: os }]);
  if (theme) await page.evaluateOnNewDocument((t) => localStorage.setItem("theme", t), theme);
  await page.setViewport({ width, height });
  const res = await page.goto(url, { waitUntil: "networkidle0" });
  page.status = res?.status();
  const close = page.close.bind(page);
  page.close = async () => { await close(); await ctx.close(); };
  return page;
}

/** Scroll through once so one-time section reveals run, then back to the top. */
export async function revealAll(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    scrollTo(0, 0);
  });
  await page.evaluate(() => document.fonts.ready);
  await wait(500);
}

// ── Storage checks without downloading files ──────────────────────────────────────────────
// Supabase egress is metered, so the suites read headers or a few KB, never whole ZIPs or videos.

/**
 * Status, type, size and download name, from a one-byte request. (Supabase leaves the download
 * name out of HEAD responses; a `bytes=0-0` range has every header for one byte of body.)
 */
export async function headInfo(url) {
  const r = await fetch(url, { headers: { range: "bytes=0-0" } });
  await r.arrayBuffer();
  const ok = r.status === 206 || r.status === 200;
  const size = Number(r.headers.get("content-range")?.split("/")[1] ?? r.headers.get("content-length") ?? 0);
  return { ok, status: ok ? 200 : r.status, type: r.headers.get("content-type"), size, disposition: r.headers.get("content-disposition") ?? "" };
}

/** Waits (up to 20 s) for a file to leave storage: replaced files are deleted after the response. */
export async function goneFromStorage(publicUrl) {
  for (let i = 0; i < 20; i++) {
    if (!(await inStorage(publicUrl))) return true;
    await wait(1000);
  }
  return false;
}

const rangeOf = async (url, range) => {
  const r = await fetch(url, { headers: { range } });
  if (r.status !== 206) throw new Error(`No partial content for ${url} (${r.status})`);
  return { bytes: Buffer.from(await r.arrayBuffer()), total: Number(r.headers.get("content-range")?.split("/")[1] ?? 0) };
};

/** A ZIP's file names and total size, read from its central directory (the last few KB). */
export async function zipInfo(url) {
  const tail = await rangeOf(url, "bytes=-65536");
  const eocd = tail.bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error(`Not a ZIP: ${url}`);
  const count = tail.bytes.readUInt16LE(eocd + 10);
  const cdSize = tail.bytes.readUInt32LE(eocd + 12);
  const cdOffset = tail.bytes.readUInt32LE(eocd + 16);
  const tailStart = tail.total - tail.bytes.length;
  // The directory is usually inside the tail already; a very long one needs its own range.
  const cd = cdOffset >= tailStart ? tail.bytes.subarray(cdOffset - tailStart) : (await rangeOf(url, `bytes=${cdOffset}-${cdOffset + cdSize - 1}`)).bytes;
  const names = [];
  for (let i = 0, off = 0; i < count; i++) {
    const len = cd.readUInt16LE(off + 28), extra = cd.readUInt16LE(off + 30), comment = cd.readUInt16LE(off + 32);
    names.push(cd.subarray(off + 46, off + 46 + len).toString("utf8"));
    off += 46 + len + extra + comment;
  }
  return { names, size: tail.total };
}
export const zipNames = async (url) => (await zipInfo(url)).names;

/** A GIF's size and whether it's animated (at least two frames in its first 64 KB). */
export async function gifInfo(url) {
  const { bytes } = await rangeOf(url, "bytes=0-65535");
  let frames = 0;
  for (let i = bytes.indexOf(Buffer.from([0x21, 0xf9])); i >= 0; i = bytes.indexOf(Buffer.from([0x21, 0xf9]), i + 2)) frames++;
  return { type: bytes.subarray(0, 6).toString("latin1"), width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8), animated: frames >= 2 };
}

/** A PNG's size, from its header (the first 33 bytes). */
export async function pngSize(url) {
  const { bytes, total } = await rangeOf(url, "bytes=0-32");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: total };
}

/** Whether a public file still exists in storage (the origin, not the CDN's cache), by HEAD. */
export async function inStorage(publicUrl) {
  const key = decodeURIComponent(new URL(publicUrl).pathname.replace("/storage/v1/object/public/brand-assets/", ""));
  const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/brand-assets/${key}`, {
    method: "HEAD",
    headers: { authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY },
  });
  return r.ok;
}
