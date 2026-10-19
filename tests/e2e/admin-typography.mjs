// Phase 5: the Typography tab end to end, on a temporary brand "TypeTest" (deleted at the end).
import { BASE, check, done, launch, wait } from "./lib.mjs";

process.loadEnvFile(".env.local");
const NAME = "TypeTest";
const SLUG = "typetest";
const browser = await launch();
const page = await (await browser.createBrowserContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept()); // "Leave with unsaved changes?" when the test moves on
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.68.68.68" });
await page.setViewport({ width: 1280, height: 1000 });

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 15000 }, sel);
const go = async (path, ready) => (await page.goto(BASE + path, { waitUntil: "load" }), ready && (await hydrated(ready)));
const toast = (text) => page.waitForFunction((t) => document.querySelector("[data-toast-region]")?.textContent.trim() === t, { timeout: 30000 }, text).then(() => true).catch(() => false);
const save = () => page.click('[aria-label="Unsaved changes"] button:last-child');
const typographySection = async () => {
  const html = await (await fetch(`${BASE}/${SLUG}/`)).text();
  const i = html.indexOf('id="typography"');
  return html.slice(i, html.indexOf("</section>", i));
};
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
  const tab = `/admin/brands/${id}/typography/`;
  await go("/admin/", `select[aria-label="Status of ${NAME}"]`);
  await page.select(`select[aria-label="Status of ${NAME}"]`, "LIVE");
  await toast(`${NAME}: Live`);

  console.log("Coming soon by default");
  await go(tab, 'input[type="checkbox"]');
  check(await page.$eval('input[type="checkbox"]', (c) => c.checked), "a new brand's typography is Coming soon");
  check((await typographySection()).includes("Coming soon"), "and the public page says so");

  console.log("Publish");
  await page.click('input[type="checkbox"]');
  await page.waitForSelector('section[aria-label="Typeface 1"] select');
  await page.select('section[aria-label="Typeface 1"] select', "Outfit");
  await wait(200);
  check((await page.$eval('section[aria-label="Typeface 1"] input[type="url"]', (i) => i.value)) === "https://fonts.google.com/specimen/Outfit", "picking a family fills in where to get it");
  const aaFont = await page.$eval('section[aria-label="Typeface 1"] [style*="font-family"]', (e) => getComputedStyle(e).fontFamily);
  check(/Outfit/i.test(aaFont), `the preview uses the real font (${aaFont.split(",")[0]})`);
  await save();
  check(await toast("Typography saved"), "save");
  const pub = await typographySection();
  check(pub.includes("Outfit") && pub.includes("Type scale") && !pub.includes("Coming soon"), "the public page shows the Outfit card and the type scale");

  console.log("Rules");
  await page.click("::-p-text(Add typeface)");
  await page.waitForSelector('section[aria-label="Typeface 2"]');
  await page.select('section[aria-label="Typeface 1"] select:nth-of-type(1)', "Outfit");
  const sets = await page.$$('section select');
  await sets[1].select("headings");
  await sets[3].select("headings");
  await save();
  await page.waitForSelector('[role="alert"]');
  check((await page.$eval('[role="alert"]', (e) => e.textContent)).startsWith("No typeface sets the body text"), "someone must set the body text");
  await sets[3].select("body");
  for (const chip of await page.$$('section[aria-label="Typeface 2"] fieldset input:checked')) await chip.evaluate((c) => c.click());
  await save();
  await wait(1000);
  check((await page.$eval('[role="alert"]', (e) => e.textContent)) === "Pick at least one weight for each typeface.", "a typeface needs a weight, in plain words");

  console.log("Back to Coming soon");
  await go(tab, 'input[type="checkbox"]');
  await page.click('input[type="checkbox"]');
  await save();
  check(await toast("Typography shows as Coming soon"), "switch back to Coming soon");
  check((await typographySection()).includes("Coming soon"), "the public page follows");
} finally {
  await deleteTestBrand().catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Typography tab works");
