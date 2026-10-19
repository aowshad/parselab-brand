// Phase 5: the Colors tab end to end, on a temporary brand "ColorTest" (deleted at the end).
import { BASE, check, done, launch, wait } from "./lib.mjs";

process.loadEnvFile(".env.local");
const NAME = "ColorTest";
const SLUG = "colortest";
const browser = await launch();
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.66.66.66" });
await page.setViewport({ width: 1280, height: 1000 });

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 15000 }, sel);
const go = async (path, ready) => (await page.goto(BASE + path, { waitUntil: "load" }), ready && (await hydrated(ready)));
const toast = (text) => page.waitForFunction((t) => document.querySelector("[data-toast-region]")?.textContent.trim() === t, { timeout: 30000 }, text).then(() => true).catch(() => false);
const rows = () => page.$$eval('ul[aria-label="Colors"] li', (l) => l.map((x) => x.querySelector("p")?.textContent));
const panel = "dialog[open]";
async function fill(sel, value) {
  await page.click(sel, { count: 3 });
  await page.keyboard.press("Backspace");
  await page.type(sel, value);
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
  const tab = `/admin/brands/${id}/colors/`;

  console.log("Add");
  await go(tab, "main button.bg-btn");
  check((await page.$eval("main", (m) => m.textContent)).includes("No colors yet"), "a new brand has no colors");
  await page.click("::-p-text(Add color)");
  await page.waitForSelector(panel);
  await page.type(`${panel} input[placeholder="Primary"]`, "Primary");
  await page.type(`${panel} input[placeholder="Blue"]`, "Blue");
  await fill(`${panel} input[placeholder="#6CA9F3"]`, "zz");
  check((await page.$eval(panel, (d) => d.textContent)).includes("3 or 6 hex digits"), "a bad hex is flagged as you type");
  await page.click(`${panel} button[type=submit]`);
  await page.waitForSelector(`${panel} [role="alert"]`);
  check((await page.$eval(`${panel} [role="alert"]`, (e) => e.textContent)).includes("isn't") || (await page.$eval(`${panel} [role="alert"]`, (e) => e.textContent)).includes("hex"), "and the server refuses it");
  await fill(`${panel} input[placeholder="#6CA9F3"]`, "6af");
  check((await page.$eval(panel, (d) => d.textContent)).includes("rgb(102, 170, 255) · hsl(213, 100%, 70%)"), "RGB and HSL are calculated from the shorthand");
  await page.click(`${panel} button[type=submit]`);
  check(await toast("Blue added"), "save → Blue added");
  await page.waitForFunction(() => document.querySelector('ul[aria-label="Colors"]')?.textContent.includes("#66AAFF"));
  check(true, "stored as #66AAFF (3-digit hex, no #)");

  await page.click("::-p-text(Add color)");
  await page.waitForSelector(panel);
  await page.type(`${panel} input[placeholder="Primary"]`, "Brand gradient");
  await page.type(`${panel} input[placeholder="Blue"]`, "Sunset");
  await page.click(`${panel} [role="radio"]:last-child`);
  await page.click(`${panel} ::-p-text(Add stop)`);
  await fill(`${panel} input[aria-label="Stop 3 hex"]`, "#D42427");
  await fill(`${panel} input[aria-label="Stop 2 position"]`, "50");
  await page.click(`${panel} button[type=submit]`);
  check(await toast("Sunset added"), "a 3-stop gradient");
  await page.waitForFunction(() => document.querySelector('ul[aria-label="Colors"]')?.textContent.includes("3 stops · 135°"));
  check(true, "listed as 3 stops · 135°");

  console.log("Edit and reorder");
  await page.click('button[aria-label="Edit Blue"]');
  await page.waitForSelector(panel);
  await fill(`${panel} input[placeholder="Blue"]`, "Sky");
  await page.click(`${panel} button[type=submit]`);
  check(await toast("Sky saved"), "edit: Blue → Sky");
  await go(tab, 'button[aria-label="Reorder Sunset"]');
  await page.focus('button[aria-label="Reorder Sunset"]');
  await page.keyboard.press("Space");
  await wait(150);
  await page.keyboard.press("ArrowUp");
  await wait(150);
  await page.keyboard.press("Space");
  check(await toast("Order saved"), "keyboard reorder");
  await go(tab, 'ul[aria-label="Colors"]');
  check(JSON.stringify(await rows()) === JSON.stringify(["Sunset", "Sky"]), `order survives a reload: ${(await rows()).join(", ")}`);
  check((await page.$$('ul[aria-label="Colors"] ~ * li, section li')).length >= 2, "live preview shows the public cards");

  console.log("Public page and files");
  await go("/admin/", `select[aria-label="Status of ${NAME}"]`);
  await page.select(`select[aria-label="Status of ${NAME}"]`, "LIVE");
  await toast(`${NAME}: Live`);
  const html = await (await fetch(`${BASE}/${SLUG}/`)).text();
  check(html.includes(">Sky<") && html.includes(">Sunset<") && html.indexOf(">Sunset<") < html.indexOf(">Sky<"), "the public page shows both colors, in order");
  const cssUrl = html.match(/href="([^"]*colors\.css[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
  const css = cssUrl ? await (await fetch(cssUrl)).text() : "";
  check(css.includes(`--${SLUG}-sky: #66AAFF; /* Primary */`) && css.includes(`--${SLUG}-sunset: linear-gradient(135deg, #6CA9F3 0%, #FF9933 50%, #D42427 100%)`), "colors.css is generated from the list");
  const jsonUrl = html.match(/href="([^"]*colors\.json[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
  const json = jsonUrl ? await (await fetch(jsonUrl)).json() : {};
  const sky = json.palettes?.[0]?.colors?.find((c) => c.name === "Sky");
  check(sky?.rgb === "rgb(102, 170, 255)" && sky?.hsl === "hsl(213, 100%, 70%)", "colors.json has the computed RGB and HSL");

  console.log("Delete");
  await go(tab, 'button[aria-label="Delete Sky"]');
  await page.click('button[aria-label="Delete Sky"]');
  await page.waitForSelector("dialog[open] button[type=submit]");
  await page.click("dialog[open] button[type=submit]");
  check(await toast("Sky deleted"), "delete a color");
  const after = await (await fetch(`${BASE}/${SLUG}/`)).text();
  check(!after.includes(">Sky<") && after.includes(">Sunset<"), "it's gone from the public page");
} finally {
  await deleteTestBrand().catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Colors tab works");
