// Phase 5: the Settings page end to end. It edits the real site texts and "Download all" zip,
// and puts the texts back and the zip in Auto mode at the end.
import fs from "node:fs";
import { ZipArchive } from "archiver";
import { BASE, check, done, goneFromStorage, inStorage, launch, wait, zipNames } from "./lib.mjs";

process.loadEnvFile(".env.local");
const FIX = "test-results/fixtures";
fs.mkdirSync(FIX, { recursive: true });
{
  const zip = new ZipArchive({ zlib: { level: 9 } });
  const out = fs.createWriteStream(`${FIX}/all-kit.zip`);
  zip.pipe(out);
  zip.append("Hand-made all-brands kit.\n", { name: "HAND-MADE.txt" });
  await zip.finalize();
  await new Promise((r) => out.on("close", r));
}

const browser = await launch();
const page = await (await browser.createBrowserContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.71.71.71" });
await page.setViewport({ width: 1280, height: 1000 });

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 15000 }, sel);
const go = async (path, ready) => (await page.goto(BASE + path, { waitUntil: "load" }), ready && (await hydrated(ready)));
const toast = (text) => page.waitForFunction((t) => document.querySelector("[data-toast-region]")?.textContent.trim() === t, { timeout: 60000 }, text).then(() => true).catch(() => false);
const html = async (path) => (await (await fetch(BASE + path)).text()).replace(/<!-- -->/g, "");
async function fill(label, value) {
  const id = await page.$$eval("label", (ls, t) => ls.find((l) => l.textContent === t)?.htmlFor, label);
  const el = await page.$(`[id="${id}"]`);
  await el.evaluate((e) => (e.focus(), e.select()));
  await page.keyboard.press("Backspace");
  await el.type(value);
}
const api = (body) => page.evaluate((b) => fetch("/api/admin/settings/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json()), body);
const allKitLink = async () => (await html("/")).match(/href="([^"]+parselab-brand-kits\.zip[^"]*)"/)?.[1]?.replace(/&amp;/g, "&") ?? null;
async function waitRebuilt() {
  for (let i = 0; i < 60; i++) {
    const r = await page.evaluate(() => fetch("/api/admin/settings/", { cache: "no-store" }).then((x) => x.json()));
    if (!r.rebuilding) return true;
    await wait(2000);
  }
  return false;
}

let original;
try {
  await go("/admin/login/", 'button[type="submit"]');
  await page.type('input[name="email"]', process.env.ADMIN_EMAIL);
  await page.type('input[name="password"]', process.env.ADMIN_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);

  console.log("Site texts");
  await page.click('nav[aria-label="Admin"] a[href="/admin/settings/"]');
  await page.waitForFunction(() => location.pathname === "/admin/settings/");
  await hydrated("form button[type=submit]");
  check(await page.$eval('nav[aria-label="Admin"] a[href="/admin/settings/"]', (a) => a.getAttribute("aria-current") === "page"), "Settings is in the admin nav");
  original = await page.$$eval('section[aria-labelledby="texts-h"] :is(input, textarea)', (els) => els.map((e) => e.value));
  check(original.length === 4 && original.every(Boolean), `the form shows the current texts ("${original[0]}")`);
  check(await page.$eval("form button[type=submit]", (b) => b.disabled), "Save is off until something changes");
  await fill("Home title", "Brand assets test");
  await fill("Footer text", "Footer from the settings test.");
  await fill("Contact email", "design-test@parselab.com");
  await page.click("form button[type=submit]");
  check(await toast("Settings saved"), "save");
  const home = await html("/");
  check(home.includes(">Brand assets test</h1>") && home.includes("Footer from the settings test.") && home.includes('href="mailto:design-test@parselab.com"'), "the home page shows the new title, footer and contact");
  check(/<title>Brand assets test/.test(home), "and the new page title");
  const brandPage = await html("/quotend/");
  check(brandPage.includes("Footer from the settings test.") && brandPage.includes("mailto:design-test@parselab.com"), "brand pages show the new footer and contact too");

  console.log("Validation");
  check((await api({ op: "save", homeTitle: "x", homeSubtitle: "x", footerText: "x", contactEmail: "nope" })).error === "Contact email doesn't look like an email address.", "a bad email is refused, in plain words");
  check((await api({ op: "save", homeTitle: "  ", homeSubtitle: "x", footerText: "x", contactEmail: "a@b.co" })).error === "Home title can't be empty.", "an empty title is refused");
  check((await api({ op: "save", homeTitle: "x".repeat(81), homeSubtitle: "x", footerText: "x", contactEmail: "a@b.co" })).error?.startsWith("Home title is too long"), "a long title is refused");
  const cross = await fetch(`${BASE}/api/admin/settings/`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
  check(cross.status === 401, "the API needs a session");

  console.log("Put the texts back");
  await go("/admin/settings/", "form button[type=submit]");
  for (const [label, value] of [["Home title", original[0]], ["Home subtitle", original[1]], ["Footer text", original[2]], ["Contact email", original[3]]]) await fill(label, value);
  await page.click("form button[type=submit]");
  check(await toast("Settings saved"), "restore");
  original = null;
  check((await html("/")).includes(`>Brand assets</h1>`), "the home page is back");

  console.log("All-brands kit: Auto");
  await waitRebuilt(); // one queued by an earlier suite (a test brand deleted) could swap the file mid-check
  const before = await allKitLink();
  check(before && (await zipNames(before)).some((n) => n.startsWith("quotend/")), "Download all has a folder per public brand");
  await go("/admin/settings/", '[role="radio"]');
  check(/\d+ public brands?/.test(await page.$eval("main", (m) => m.textContent)), "the page says what it's built from");
  const t0 = Date.now();
  await page.click("::-p-text(Rebuild now)");
  check(await toast("Rebuilding the kit…"), "Rebuild now");
  check(await waitRebuilt(), `the zip is rebuilt (${Math.round((Date.now() - t0) / 1000)}s)`);
  const rebuilt = await allKitLink();
  check(rebuilt && rebuilt !== before && (await goneFromStorage(before)), "a new file, and the old one is deleted");

  console.log("All-brands kit: Manual");
  await go("/admin/settings/", '[role="radio"]');
  await page.click('[role="radio"]:last-child');
  check(await toast("Manual: upload your own ZIP"), "switch to Manual");
  await go("/admin/settings/", "input[type=file]");
  await (await page.$("input[type=file]")).uploadFile(`${FIX}/all-kit.zip`);
  check(await toast("Kit uploaded"), "upload a ZIP");
  const manual = await allKitLink();
  check(manual && /\/site\/zips\/[0-9a-f-]{36}\/parselab-brand-kits\.zip/.test(manual) && (await zipNames(manual)).includes("HAND-MADE.txt"), "Download all serves the uploaded ZIP, under the usual name");
  check((await goneFromStorage(rebuilt)), "the automatic zip it replaced is deleted");

  console.log("Back to Auto");
  await go("/admin/settings/", '[role="radio"]');
  await page.click('[role="radio"]:first-child');
  check(await toast("Auto: rebuilding from the public brands"), "switch back to Auto");
  check(await waitRebuilt(), "the zip is rebuilt from the brands");
  const auto = await allKitLink();
  check(auto && auto !== manual && (await zipNames(auto)).some((n) => n.startsWith("quotend/")) && (await goneFromStorage(manual)), "Download all is automatic again, and the uploaded one is deleted");
} finally {
  if (original) {
    // A failure mid-way: put the texts back through the API.
    await api({ op: "save", homeTitle: original[0], homeSubtitle: original[1], footerText: original[2], contactEmail: original[3] }).catch(() => {});
  }
  await api({ op: "mode", mode: "AUTO" }).catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Settings page works");
