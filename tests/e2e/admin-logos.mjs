// Phase 4: the Logos tab end to end, on a temporary brand "LogoTest" (deleted at the end).
import fs from "node:fs";
import { BASE, check, done, headInfo, inStorage, launch, pngSize, wait, zipNames } from "./lib.mjs";

process.loadEnvFile(".env.local");
const NAME = "LogoTest";
const SLUG = "logotest";
const FIX = "test-results/fixtures";
fs.mkdirSync(FIX, { recursive: true });
fs.copyFileSync("prisma/seed-data/brands/quotend/logos/full-light-bg.svg", `${FIX}/wordmark.svg`);
fs.copyFileSync("prisma/seed-data/brands/quotend/logos/mark-light-bg.svg", `${FIX}/mark.svg`);
fs.writeFileSync(`${FIX}/evil.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>');
const pngSrc = fs.readdirSync(".generated/assets/brands/parselab/logos/png").find((f) => f.endsWith("full-black@1024.png"));
fs.copyFileSync(`.generated/assets/brands/parselab/logos/png/${pngSrc}`, `${FIX}/black-1024.png`);

const browser = await launch();
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.44.44.44" });
await page.setViewport({ width: 1280, height: 1000 });

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 15000 }, sel);
const go = async (path, ready) => (await page.goto(BASE + path, { waitUntil: "load" }), ready && (await hydrated(ready)));
const toastIs = async (text, timeout = 30000) => {
  const ok = await page.waitForFunction((t) => document.querySelector("[data-toast-region]")?.textContent.trim() === t, { timeout }, text).then(() => true).catch(() => false);
  return ok ? text : await page.$eval("[data-toast-region]", (e) => e.textContent.trim()).catch(() => "");
};
const expectToast = async (text, label) => { const t = await toastIs(text); check(t === text, `${label}${t === text ? "" : ` (saw "${t}")`}`); };
const cell = (type, slot) => `article[aria-label="${type}, ${slot}"]`;
/** File names inside a zip, read from its central directory. */
async function waitRebuilt(timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await go(location(), "section");
    if (!(await page.$eval("main", (m) => m.textContent.includes("Rebuilding")))) return Math.round((Date.now() - t0) / 1000);
    await wait(2000);
  }
  return -1;
}
let editorPath = "";
const location = () => editorPath;
async function upload(type, slot, file) {
  // The result is a new error line in the cell, or a new "<slot> added · …" toast.
  const prevAlert = await page.$eval(`${cell(type, slot)} [role="alert"]`, (e) => e.textContent).catch(() => null);
  const prevToast = await page.$eval("[data-toast-region]", (e) => e.textContent.trim()).catch(() => "");
  const input = await page.$(`${cell(type, slot)} input[type=file]`);
  await input.uploadFile(`${FIX}/${file}`);
  await page.waitForFunction(
    (sel, pa, pt) => {
      const a = document.querySelector(`${sel} [role="alert"]`)?.textContent;
      const t = document.querySelector("[data-toast-region]")?.textContent.trim() ?? "";
      return (a && a !== pa) || (/(added|replaced) · /.test(t) && t !== pt);
    },
    { timeout: 60000 },
    cell(type, slot),
    prevAlert,
    prevToast,
  );
  return page.evaluate((sel, pa) => {
    const a = document.querySelector(`${sel} [role="alert"]`)?.textContent.trim();
    return a && a !== pa ? a : document.querySelector("[data-toast-region]")?.textContent.trim();
  }, cell(type, slot), prevAlert);
}
async function deleteTestBrand() {
  await go("/admin/", "tbody");
  if (!(await page.$(`button[aria-label="Actions for ${NAME}"]`))) return;
  await page.click(`button[aria-label="Actions for ${NAME}"]`);
  await page.click("::-p-text(Delete…)");
  await page.waitForSelector("dialog[open] input");
  await page.type("dialog[open] input", NAME);
  await page.click("dialog[open] button[type=submit]");
  await toastIs(`${NAME} deleted`, 5000);
  await wait(1000);
}

try {
  await go("/admin/login/", 'button[type="submit"]');
  await page.type('input[name="email"]', process.env.ADMIN_EMAIL);
  await page.type('input[name="password"]', process.env.ADMIN_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  await deleteTestBrand();

  console.log("Set up");
  await go("/admin/brands/new/", 'button[type="submit"]');
  await page.type('input[name="name"]', NAME);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  const id = new URL(page.url()).pathname.split("/")[3];
  editorPath = `/admin/brands/${id}/logos/`;
  await go(editorPath, 'button[aria-label="Add logo type"]');
  check((await page.$eval("main", (m) => m.textContent)).includes("Add a logo type to start uploading."), "a new brand starts with no logo types");
  await page.click('button[aria-label="Add logo type"]');
  await page.click('[role="menu"] ::-p-text(Full logo)');
  await expectToast("Full logo added", "add the Full logo preset");
  await page.waitForSelector(cell("Full logo", "On dark"));
  check((await page.$$("article[aria-label^='Full logo,']")).length === 4, "it shows the 2×2 grid: On dark, On light, Black, White");

  console.log("Uploads");
  { const r = await upload("Full logo", "On light", "wordmark.svg"); check(r === "On light added · SVG + 4 PNGs", `${"an SVG becomes the variant plus 4 PNGs"}${r === "On light added · SVG + 4 PNGs" ? "" : ` (saw "${r}")`}`); }
  { const r = await upload("Full logo", "On dark", "evil.svg"); check(r === "SVG contains scripts and was rejected.", `${"an SVG with a script is rejected, in its cell"}${r === "SVG contains scripts and was rejected." ? "" : ` (saw "${r}")`}`); }
  { const r = await upload("Full logo", "Black", "black-1024.png"); check(r === "Black added · 2 PNGs", `${"a PNG-only upload keeps the widths up to its own (512, 1024)"}${r === "Black added · 2 PNGs" ? "" : ` (saw "${r}")`}`); }
  await go(editorPath, cell("Full logo", "On light"));
  const meta = await page.$eval(cell("Full logo", "On light"), (c) => ({ text: c.textContent, file: c.querySelector('input[title="File name"]')?.value, src: c.querySelector("img")?.src, dl: c.querySelector("a[href*='download=']")?.href }));
  check(meta.file === `${SLUG}-full-light-bg.svg` && meta.src.endsWith(`/${SLUG}-full-light-bg.svg`), `file name filled in: ${meta.file}`);
  check(meta.text.includes("SVG · PNG 512–4096") && (await page.$eval(cell("Full logo", "Black"), (c) => c.textContent)).includes("PNG only · 512, 1024"), "cells say what they hold");
  check(meta.dl?.includes(`download=${SLUG}-full-light-bg.svg`), "Download saves under the file name");
  const svgText = await (await fetch(meta.src)).text();
  check(svgText.startsWith("<svg") && !/<script|onload/i.test(svgText), "the stored SVG is the cleaned one");
  const built = await waitRebuilt();
  check(built >= 0 && (await page.$eval("main", (m) => m.textContent)).includes(`${SLUG}-full-logos.zip`), `the ZIP rebuilds in the background (${built}s)`);

  console.log("File names and hints");
  const nameInput = `${cell("Full logo", "On light")} input[title="File name"]`;
  await page.click(nameInput, { count: 3 });
  await page.type(nameInput, "Bad Name.svg");
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${cell("Full logo", "On light")} [role="alert"]`);
  check((await page.$eval(`${cell("Full logo", "On light")} [role="alert"]`, (e) => e.textContent)).startsWith("Use lowercase letters"), "an invalid file name is refused");
  await page.click(nameInput, { count: 3 });
  await page.type(nameInput, `${SLUG}-wordmark.svg`);
  await page.keyboard.press("Enter");
  await expectToast(`Renamed to ${SLUG}-wordmark.svg`, "renaming saves on Enter");
  await go(editorPath, cell("Full logo", "On light"));
  const renamed = await page.$eval(`${cell("Full logo", "On light")} img`, (i) => i.src);
  check(renamed.endsWith(`/${SLUG}-wordmark.svg`) && (await fetch(renamed)).ok, "the stored file moved to the new name");
  const hint = `${cell("Full logo", "On light")} input[title="Usage hint"]`;
  await page.click(hint, { count: 3 });
  await page.type(hint, "Primary lockup for light backgrounds.");
  await page.click("h4");
  await expectToast("Hint saved", "the hint saves when you leave the field");

  console.log("Logo types");
  await page.click('button[aria-label="Add logo type"]');
  await page.click('[role="menu"] ::-p-text(Mark)');
  await expectToast("Mark added", "add a second type");
  await page.waitForSelector(cell("Mark", "On light"));
  { const r = await upload("Mark", "On light", "mark.svg"); check(r === "On light added · SVG + 4 PNGs", `${"upload to the Mark"}${r === "On light added · SVG + 4 PNGs" ? "" : ` (saw "${r}")`}`); }
  await go(editorPath, 'button[aria-label="Reorder Mark"]');
  await page.focus('button[aria-label="Reorder Mark"]');
  await page.keyboard.press("Space");
  await wait(150);
  await page.keyboard.press("ArrowUp");
  await wait(150);
  await page.keyboard.press("Space");
  await expectToast("Order saved", "reorder types with the keyboard");
  check((await page.$$eval('ul[aria-label="Logo types"] li', (l) => l.map((x) => x.textContent.replace(/\d.*$/, "").trim()))).join() === "Mark,Full logo", "Mark is first now");
  await page.click('ul[aria-label="Logo types"] li:last-child button:last-child');
  await page.waitForSelector('input[value="Full logo"]');
  await page.click('input[value="Full logo"]', { count: 3 });
  await page.type('section form input[maxlength="40"]', "Wordmark");
  await page.click("section form button[type=submit]");
  await expectToast("Saved", "rename a logo type");
  await waitRebuilt();

  console.log("Public page");
  await go("/admin/", `select[aria-label="Status of ${NAME}"]`);
  await page.select(`select[aria-label="Status of ${NAME}"]`, "LIVE");
  await toastIs(`${NAME}: Live`);
  const pub = await browser.newPage();
  await pub.goto(`${BASE}/${SLUG}/`, { waitUntil: "networkidle0" });
  const tabs = await pub.$$eval('[role="tablist"][aria-label="Logo type"] [role="tab"]', (t) => t.map((x) => x.textContent.trim()));
  check(tabs.join() === "Mark,Wordmark", `public tabs follow the order and labels: ${tabs.join(", ")}`);
  await pub.click("::-p-text(Wordmark)");
  await wait(300);
  const variants = await pub.$$eval('[role="tablist"][aria-label$="variants"] [role="tab"]', (t) => t.map((x) => x.textContent.trim()));
  check(variants.join() === "On light,Black", `only uploaded variants appear: ${variants.join(", ")}`);
  await pub.click('[role="tablist"][aria-label$="variants"] ::-p-text(Black)');
  await wait(300);
  { const label = await pub.$eval("[data-primary-download]", (a) => a.textContent); check(label.includes("Download PNG") && !label.includes("SVG"), "a PNG-only variant offers Download PNG (no SVG)"); }
  const kitHref = await pub.$eval("body > header a[download]", (a) => a.href);
  const kitNames = await zipNames(kitHref);
  check(kitNames.includes(`svg/${SLUG}-wordmark.svg`) && kitNames.includes(`png/4096/${SLUG}-wordmark@4096.png`) && kitNames.includes(`png/1024/${SLUG}-full-black@1024.png`), `the brand kit has svg/ and png/<width>/ (${kitNames.length} files)`);
  const groupHref = await pub.$eval('a[aria-label^="Download all Wordmark files"]', (a) => a.href).catch(() => "");
  check(groupHref && (await zipNames(groupHref)).every((n) => !n.includes("mark-light-bg")), "each logo type has its own ZIP");
  await pub.close();
  // "Download all" is rebuilt in the background too. Wait on the admin's status APIs (small JSON,
  // no storage), then read the ZIP's file list once.
  const idle = () => page.evaluate(async (brandId) => {
    const [brand, site] = await Promise.all([fetch(`/api/admin/brands/${brandId}/status/`).then((r) => r.json()), fetch("/api/admin/settings/").then((r) => r.json())]);
    return !brand.rebuilding && !site.rebuilding;
  }, id);
  for (let i = 0, calm = 0; i < 60 && calm < 2; i++) {
    calm = (await idle()) ? calm + 1 : 0;
    await wait(2000);
  }
  const home = await (await fetch(`${BASE}/`)).text();
  const allHref = home.match(/href="([^"]+parselab-brand-kits\.zip[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
  const all = allHref ? await zipNames(allHref) : [];
  check(all.some((n) => n === `${SLUG}/svg/${SLUG}-wordmark.svg`) && all.some((n) => n.startsWith("parselab/")), `Download all now includes ${NAME} (${all.length} files)`);

  console.log("Link preview");
  const ogUrl = (await (await fetch(`${BASE}/${SLUG}/`)).text()).match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  check(ogUrl && /\/brands\/[^/]+\/og\/[0-9a-f-]{36}\//.test(ogUrl) && ogUrl.includes(`/${SLUG}-og.png`), "the brand gets its own preview image (not the site-wide one)");
  if (ogUrl) {
    // Size from the header; a blank 1200 × 630 PNG compresses to a few KB, one with a logo doesn't.
    const { width, height, bytes } = await pngSize(ogUrl);
    check(width === 1200 && height === 630 && bytes > 15000, `it's 1200×630 and shows the logo (${width}×${height}, ${Math.round(bytes / 1024)} KB)`);
  }
  const ogFiles = (await (await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/list/brand-assets`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY },
    body: JSON.stringify({ prefix: `brands/${id}/og/`, limit: 100 }),
  })).json()).length;
  check(ogFiles === 1, `rebuilds replace the preview instead of piling them up (${ogFiles} in storage)`);

  console.log("Remove");
  await go(editorPath, "section");
  await page.click('ul[aria-label="Logo types"] li:last-child button:last-child');
  await page.waitForSelector(cell("Wordmark", "Black"));
  const blackPng = await page.$eval(`${cell("Wordmark", "Black")} img`, (i) => i.src);
  await page.click(`${cell("Wordmark", "Black")} ::-p-text(Remove)`);
  await page.waitForSelector("dialog[open]");
  await page.click("dialog[open] button[type=submit]");
  await expectToast("Black removed · 2 files", "remove a variant (its files go too)");
  check(!(await inStorage(blackPng)), "the variant's PNG is gone from storage");
  // Select Mark by name and wait for its panel, then delete it. (Scroll up first: otherwise the
  // row can land under the sticky header and the header takes the click.)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('ul[aria-label="Logo types"] li button:last-child ::-p-text(Mark)');
  await page.waitForSelector('section[aria-label="Mark"]');
  await page.click('section[aria-label="Mark"] ::-p-text(Delete type)');
  await page.waitForSelector("dialog[open] input");
  check(await page.$eval("dialog[open] button[type=submit]", (b) => b.disabled), "deleting a type with files needs its name typed");
  await page.type("dialog[open] input", "Mark");
  await page.click("dialog[open] button[type=submit]");
  // Its SVG and 4 PNGs, plus its ZIP if that had been built yet.
  {
    const seen = await page.waitForFunction(() => { const t = document.querySelector("[data-toast-region]")?.textContent.trim(); return t && /deleted|Couldn|error|exist/i.test(t) ? t : false; }, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => "");
    check(/^Mark deleted · [56] files removed$/.test(seen), `delete a logo type: its SVG, 4 PNGs (and ZIP)${/^Mark deleted/.test(seen) ? "" : ` (saw "${seen}")`}`);
  }
} finally {
  await deleteTestBrand().catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Logos tab works");
