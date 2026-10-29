// Phase 5: the Brand kit tab end to end, on a temporary brand "KitTest" (deleted at the end).
// Includes the brief's check: a 20 MB manual kit uploads (straight to storage, past the 4.5 MB
// limit on serverless request bodies).
import crypto from "node:crypto";
import fs from "node:fs";
import { ZipArchive } from "archiver";
import { BASE, check, done, inStorage, launch, wait, zipInfo } from "./lib.mjs";

process.loadEnvFile(".env.local");
const NAME = "KitTest";
const SLUG = "kittest";
const FIX = "test-results/fixtures";
fs.mkdirSync(FIX, { recursive: true });
fs.copyFileSync("prisma/seed-data/brands/quotend/logos/full-light-bg.svg", `${FIX}/kit-logo.svg`);
fs.writeFileSync(`${FIX}/not-a-zip.zip`, "plain text pretending to be a zip");
// ~20 MB of random bytes (incompressible), stored in a zip.
if (!fs.existsSync(`${FIX}/big-kit.zip`) || fs.statSync(`${FIX}/big-kit.zip`).size < 20e6) {
  const zip = new ZipArchive({ zlib: { level: 0 } });
  const out = fs.createWriteStream(`${FIX}/big-kit.zip`);
  zip.pipe(out);
  zip.append(crypto.randomBytes(20 * 1024 * 1024), { name: "assets/random.bin" });
  zip.append("Hand-made kit for the KitTest brand.\n", { name: "README.txt" });
  await zip.finalize();
  await new Promise((r) => out.on("close", r));
}
const bigMb = fs.statSync(`${FIX}/big-kit.zip`).size / 1024 / 1024;

const browser = await launch();
const page = await (await browser.createBrowserContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.70.70.70" });
await page.setViewport({ width: 1280, height: 1000 });

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 15000 }, sel);
const go = async (path, ready) => (await page.goto(BASE + path, { waitUntil: "load" }), ready && (await hydrated(ready)));
const toast = (text) => page.waitForFunction((t) => document.querySelector("[data-toast-region]")?.textContent.trim() === t, { timeout: 60000 }, text).then(() => true).catch(() => false);
const main = () => page.$eval("main", (m) => m.textContent);
async function waitKitReady(tab) {
  for (let i = 0; i < 45; i++) {
    await go(tab, "main");
    if (!(await main()).includes("Rebuilding the kit")) return true;
    await wait(2000);
  }
  return false;
}
async function deleteTestBrand() {
  await go("/admin/", "tbody");
  if (!(await page.$(`button[aria-label="Actions for ${NAME}"]`))) return;
  await page.click(`button[aria-label="Actions for ${NAME}"]`);
  await page.click("::-p-text(Delete…)");
  await page.waitForSelector("dialog[open] input");
  await page.type("dialog[open] input", NAME);
  await page.click("dialog[open] button[type=submit]");
  await wait(2500);
}

try {
  await go("/admin/login/", 'button[type="submit"]');
  await page.type('input[name="email"]', process.env.ADMIN_EMAIL);
  await page.type('input[name="password"]', process.env.ADMIN_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  await deleteTestBrand();
  await go("/admin/brands/new/", 'button[type="submit"]');
  await page.type('input[name="name"]', NAME);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  const id = new URL(page.url()).pathname.split("/")[3];
  const tab = `/admin/brands/${id}/kit/`;

  console.log("Auto kit");
  await go(tab, "main");
  check((await main()).includes("No kit yet: it's built once the brand has a logo."), "no logos, no kit");
  // Give it a logo (Logos tab), which builds the kit in the background.
  await go(`/admin/brands/${id}/logos/`, 'button[aria-label="Add logo type"]');
  await page.click('button[aria-label="Add logo type"]');
  await page.click('[role="menu"] ::-p-text(Full logo)');
  await page.waitForSelector('article[aria-label="Full logo, On light"] input[type=file]');
  await (await page.$('article[aria-label="Full logo, On light"] input[type=file]')).uploadFile(`${FIX}/kit-logo.svg`);
  await toast("On light added · SVG + 4 PNGs");
  check(await waitKitReady(tab), "the kit builds in the background");
  const autoUrl = await page.$eval("main a[href*='brand-kit.zip']", (a) => a.href);
  const auto = await zipInfo(autoUrl);
  check(auto.names[0] === "README.txt" && auto.names.includes(`svg/${SLUG}-full-light-bg.svg`) && auto.names.includes(`png/4096/${SLUG}-full-light-bg@4096.png`), `Auto kit: README.txt, svg/ and png/<width>/ (${auto.names.length} files)`);
  check((await main()).includes("1 logo · 0 colors"), "the tab says what it contains");
  await page.click("::-p-text(Rebuild now)");
  check(await toast("Rebuilding the kit…"), "Rebuild now");
  check(await waitKitReady(tab), "and it finishes");

  console.log("Manual kit");
  await page.click('[role="radio"]:last-child');
  check(await toast("Manual: upload your own kit"), "switch to Manual");
  await go(tab, "input[type=file]");
  await (await page.$("input[type=file]")).uploadFile(`${FIX}/not-a-zip.zip`);
  await page.waitForSelector('[role="alert"]', { timeout: 30000 });
  check((await page.$eval('[role="alert"]', (e) => e.textContent)) === "That isn't a ZIP file.", "a file that isn't really a zip is refused");
  const t0 = Date.now();
  await (await page.$("input[type=file]")).uploadFile(`${FIX}/big-kit.zip`);
  check(await toast("Kit uploaded"), `a ${bigMb.toFixed(1)} MB zip uploads straight to storage (${Math.round((Date.now() - t0) / 1000)}s)`);
  await go(tab, "main");
  check((await main()).includes(`${SLUG}-brand-kit.zip`) && /20\.\d MB/.test(await main()), "it becomes the kit, saved under the brand kit name");
  await go("/admin/", `select[aria-label="Status of ${NAME}"]`);
  await page.select(`select[aria-label="Status of ${NAME}"]`, "LIVE");
  await toast(`${NAME}: Live`);
  const pub = await (await fetch(`${BASE}/${SLUG}/`)).text();
  const pubKit = pub.match(/href="([^"]+brand-kit\.zip[^"]*)"[^>]*download/)?.[1]?.replace(/&amp;/g, "&");
  check(/aria-label="Download kit, 20\.\d MB"/.test(pub) && pubKit,"the public Download kit shows the uploaded kit and its size");
  const manual = pubKit ? await zipInfo(pubKit) : { names: [], size: 0 };
  check(manual.names.includes("assets/random.bin") && manual.size > 20e6, "and serves exactly that file");

  console.log("Back to Auto");
  await go(tab, '[role="radio"]');
  await page.click('[role="radio"]:first-child');
  check(await toast("Auto: rebuilding the kit from the logos"), "switch back to Auto");
  check(await waitKitReady(tab), "the automatic kit is rebuilt");
  check(!(await inStorage(pubKit)), "the uploaded kit is deleted from storage");
} finally {
  await deleteTestBrand().catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Brand kit tab works");
