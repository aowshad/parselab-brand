// Shared helpers for the browser tests. Uses the system Chrome (no browser download).
import puppeteer from "puppeteer-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:4173";
export const BRANDS = ["parselab", "optionia", "inkybay", "jewelslab", "quotend"];
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Headless Chrome pinned to a light OS (tests that need dark set it themselves). */
export const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--blink-settings=preferredColorScheme=1"] });

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
