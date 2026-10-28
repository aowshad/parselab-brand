// Animations and events end to end, on a temporary brand "MediaTest" and a temporary event
// "Test Event 2099" (both deleted at the end). Videos are generated with ffmpeg, so it must be
// installed (brew install ffmpeg).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";
import { BASE, check, done, launch, wait } from "./lib.mjs";

process.loadEnvFile(".env.local");
const NAME = "MediaTest";
const SLUG = "mediatest";
const EVENT = "Test Event 2099";
const EVENT_KEY = "test-event-2099";
const FIX = "test-results/fixtures";
fs.mkdirSync(FIX, { recursive: true });
const ff = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
if (!fs.existsSync(`${FIX}/clip.mp4`)) ff("-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=3", "-f", "lavfi", "-i", "sine=frequency=660:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", `${FIX}/clip.mp4`);
if (!fs.existsSync(`${FIX}/clip-silent.mp4`)) ff("-f", "lavfi", "-i", "testsrc2=size=720x720:rate=30:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", `${FIX}/clip-silent.mp4`);
fs.copyFileSync("prisma/seed-data/brands/quotend/logos/icon-brand.svg", `${FIX}/event-icon.svg`);
await sharp({ create: { width: 512, height: 512, channels: 3, background: "#E04E2A" } }).png().toFile(`${FIX}/event-icon.png`);

const browser = await launch();
const page = await (await browser.createBrowserContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.72.72.72" });
await page.setViewport({ width: 1280, height: 1000 });

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 15000 }, sel);
const go = async (path, ready) => (await page.goto(BASE + path, { waitUntil: "load" }), ready && (await hydrated(ready)));
const toast = (text) => page.waitForFunction((t) => document.querySelector("[data-toast-region]")?.textContent.trim().startsWith(t), { timeout: 60000 }, text).then(() => true).catch(() => false);
const row = (name) => `li[aria-label="${name}"]`;
const head = async (url) => {
  const r = await fetch(url);
  return { ok: r.ok, type: r.headers.get("content-type"), bytes: Buffer.from(await r.arrayBuffer()) };
};
const inStorage = async (url) => {
  const key = decodeURIComponent(new URL(url).pathname.replace("/storage/v1/object/public/brand-assets/", ""));
  const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/brand-assets/${key}`, { headers: { authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY } });
  await r.arrayBuffer();
  return r.ok;
};
async function addItem(label, name, kind) {
  await page.type(`input[aria-label="${label}: name"]`, name);
  if (kind) await page.select(`select[aria-label="${label}: type"]`, kind);
  await page.click(`::-p-xpath(//input[@aria-label="${label}: name"]/ancestor::form//button[@type="submit"])`);
  await page.waitForSelector(row(name), { timeout: 15000 });
  // The list re-renders while the page refreshes; let it settle before using the new row.
  await toast(`${name} added`);
  await wait(1500);
}
async function upload(name, file) {
  await (await page.$(`${row(name)} input[type=file]`)).uploadFile(file);
}
/** Reloads until the item's text matches (processing runs in the background). */
async function waitFor(path, name, re, timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await go(path, "main");
    const text = await page.$eval(row(name), (li) => li.textContent).catch(() => "");
    if (re.test(text)) return Math.round((Date.now() - t0) / 1000);
    if (Date.now() - t0 + 3000 >= timeoutMs) console.log(`    (${name} still shows: ${text.replace(/\s+/g, " ").slice(0, 160)})`);
    await wait(3000);
  }
  return -1;
}
const links = (name) => page.$$eval(`${row(name)} a[href*="download="]`, (as) => as.map((a) => ({ text: a.textContent.trim(), href: a.href })));
async function cleanup() {
  await go("/admin/", "tbody");
  if (await page.$(`button[aria-label="Actions for ${NAME}"]`)) {
    await page.click(`button[aria-label="Actions for ${NAME}"]`);
    await page.click("::-p-text(Delete…)");
    await page.waitForSelector("dialog[open] input");
    await page.type("dialog[open] input", NAME);
    await page.click("dialog[open] button[type=submit]");
    await wait(2500);
  }
}
async function deleteTestEvent() {
  await go("/admin/events/", "main");
  if (!(await page.$(`section[aria-label="${EVENT}"]`))) return;
  await page.click(`section[aria-label="${EVENT}"] ::-p-text(Delete)`);
  await page.waitForSelector("dialog[open]");
  if (await page.$("dialog[open] input")) await page.type("dialog[open] input", EVENT);
  await page.click("dialog[open] button[type=submit]");
  await toast(`${EVENT} deleted`);
}

let brandId = "";
try {
  await go("/admin/login/", 'button[type="submit"]');
  await page.type('input[name="email"]', process.env.ADMIN_EMAIL);
  await page.type('input[name="password"]', process.env.ADMIN_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  await deleteTestEvent();
  await cleanup();
  await go("/admin/brands/new/", 'button[type="submit"]');
  await page.type('input[name="name"]', NAME);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  brandId = new URL(page.url()).pathname.split("/")[3];
  const anims = `/admin/brands/${brandId}/animations/`;

  console.log("Animations");
  await go(anims, 'input[aria-label="Animations: name"]');
  check((await page.$eval("main", (m) => m.textContent)).includes("No animations yet"), "a new brand has no animations");
  await addItem("Animations", "Logo reveal");
  check(true, "add an animation");
  await upload("Logo reveal", `${FIX}/event-icon.png`);
  await page.waitForSelector(`${row("Logo reveal")} [role="alert"]`, { timeout: 30000 });
  check((await page.$eval(`${row("Logo reveal")} [role="alert"]`, (e) => e.textContent)) === "Upload MP4 or MOV only.", "an image is refused as a video");
  await upload("Logo reveal", `${FIX}/clip.mp4`);
  check(await toast("Video uploaded"), "upload a video");
  const took = await waitFor(anims, "Logo reveal", /with sound/);
  check(took >= 0, `the formats are made in the background (${took}s)`);
  check((await page.$eval(row("Logo reveal"), (li) => li.textContent)).includes("1280 × 720 · 3.0 s · with sound"), "size, length and sound are read from the video");
  const files = await links("Logo reveal");
  check(files.map((f) => f.text.replace(/\s[\d.]+\s?[KM]B$/, "")).join() === "MP4,MP4, no sound,WebM,GIF", `four downloads: ${files.map((f) => f.text).join(" · ")}`);
  const fetched = await Promise.all(files.map((f) => head(f.href)));
  check(fetched.every((f) => f.ok) && fetched.map((f) => f.type).join() === "video/mp4,video/mp4,video/webm,image/gif", "each one downloads with the right type");
  const gif = await sharp(fetched[3].bytes, { animated: true }).metadata();
  check(gif.width === 640 && (gif.pageHeight ?? gif.height) === 360 && gif.pages > 10, `the GIF is 640 × 360 and animated (${gif.pages} frames)`);
  check(files.every((f) => new URL(f.href).searchParams.get("download")?.startsWith(`${SLUG}-logo-reveal`)), "files are named after the brand and the animation");

  await addItem("Animations", "Intro");
  await upload("Intro", `${FIX}/clip-silent.mp4`);
  await toast("Video uploaded");
  check((await waitFor(anims, "Intro", /no sound/)) >= 0, "a video without sound");
  check((await links("Intro")).length === 3, "gets no separate no-sound MP4");
  await page.click('button[aria-label="Move Intro up"]');
  await page.waitForFunction(() => document.querySelector("ol li")?.getAttribute("aria-label") === "Intro", { timeout: 15000 });
  check(true, "reorder");
  await page.$eval(`${row("Logo reveal")} input[aria-label="Name"]`, (i) => i.select());
  await page.type(`${row("Logo reveal")} input[aria-label="Name"]`, "Logo reveal v2");
  await page.$eval(`${row("Logo reveal")} input[aria-label="Description"]`, (i) => i.focus());
  check(await toast("Saved"), "rename");
  await go(anims, "main");
  check(!!(await page.$(row("Logo reveal v2"))), "the new name is kept");

  console.log("Events");
  await go("/admin/events/", 'section[aria-labelledby="new-event-h"] button[type=submit]');
  const newEvent = 'section[aria-labelledby="new-event-h"]';
  await page.type(`${newEvent} input[placeholder="Halloween 2026"]`, EVENT);
  await page.$$eval(`${newEvent} input[type=date]`, (els) => {
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
    set(els[0], "2099-10-31");
    set(els[1], "2099-10-01");
  });
  await page.click(`${newEvent} button[type=submit]`);
  await page.waitForSelector(`${newEvent} [role="alert"]`);
  check((await page.$eval(`${newEvent} [role="alert"]`, (e) => e.textContent)) === "The event ends before it starts.", "dates must be in order");
  await page.$$eval(`${newEvent} input[type=date]`, (els) => {
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
    set(els[0], "2099-10-15");
    set(els[1], "2099-11-01");
  });
  await page.click(`${newEvent} button[type=submit]`);
  check(await toast(`${EVENT} created`), "create an event");

  const eventsTab = `/admin/brands/${brandId}/events/`;
  await go(eventsTab, `section[aria-label="${EVENT}"]`);
  check((await page.$eval(`section[aria-label="${EVENT}"]`, (s) => s.textContent)).includes("Oct 15 – Nov 1, 2099"), "the brand's Events tab lists it with its dates");
  await addItem(`${EVENT} items`, "App icon", "IMAGE");
  await upload("App icon", `${FIX}/event-icon.png`);
  check(await toast("Image added"), "upload a PNG to the event");
  await addItem(`${EVENT} items`, "Vector icon", "IMAGE");
  await upload("Vector icon", `${FIX}/event-icon.svg`);
  check(await toast("Image added · SVG + PNG"), "an SVG also gets a PNG");
  await go(eventsTab, "main");
  const iconLinks = await links("App icon");
  check(iconLinks.length === 1 && new URL(iconLinks[0].href).searchParams.get("download") === `${SLUG}-${EVENT_KEY}-app-icon.png`, `event files are named after the event: ${new URL(iconLinks[0]?.href ?? BASE).searchParams.get("download")}`);
  const svgLinks = await links("Vector icon");
  check(svgLinks.map((l) => l.text.split(" ")[0]).join() === "SVG,PNG", "the SVG item offers SVG and PNG");

  console.log("Delete");
  await page.click(`${row("Vector icon")} ::-p-text(Delete)`);
  await page.waitForSelector("dialog[open]");
  await page.click("dialog[open] button[type=submit]");
  check(await toast("Vector icon deleted · 2 files removed"), "delete an item: its SVG and PNG go too");
  check(!(await inStorage(svgLinks[0].href)), "and are gone from storage");
  await go("/admin/events/", `section[aria-label="${EVENT}"]`);
  check((await page.$eval(`section[aria-label="${EVENT}"]`, (s) => s.textContent)).includes("1 item from 1 brand"), "the Events page counts items and brands");
  await page.click(`section[aria-label="${EVENT}"] ::-p-text(Delete)`);
  await page.waitForSelector("dialog[open] input");
  check(await page.$eval("dialog[open] button[type=submit]", (b) => b.disabled), "deleting an event with items needs its name typed");
  await page.type("dialog[open] input", EVENT);
  await page.click("dialog[open] button[type=submit]");
  check(await toast(`${EVENT} deleted · 1 file removed`), "delete the event with its items");
  check(!(await inStorage(iconLinks[0].href)), "its files are gone from storage");
} finally {
  await deleteTestEvent().catch(() => {});
  await cleanup().catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Animations and events work");
