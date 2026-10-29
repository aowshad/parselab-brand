// Phase 5: the Usage tab end to end, on a temporary brand "UsageTest" (deleted at the end).
import fs from "node:fs";
import { BASE, check, done, inStorage, launch, wait } from "./lib.mjs";

process.loadEnvFile(".env.local");
const NAME = "UsageTest";
const SLUG = "usagetest";
const FIX = "test-results/fixtures";
fs.mkdirSync(FIX, { recursive: true });
const png = fs.readdirSync(".generated/assets/brands/parselab/logos/png").find((f) => f.endsWith("full-light-bg@512.png"));
fs.copyFileSync(`.generated/assets/brands/parselab/logos/png/${png}`, `${FIX}/do.png`);

const browser = await launch();
const page = await (await browser.createBrowserContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.69.69.69" });
await page.setViewport({ width: 1280, height: 1000 });

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 15000 }, sel);
const go = async (path, ready) => (await page.goto(BASE + path, { waitUntil: "load" }), ready && (await hydrated(ready)));
const toast = (text) => page.waitForFunction((t) => document.querySelector("[data-toast-region]")?.textContent.trim() === t, { timeout: 30000 }, text).then(() => true).catch(() => false);
const save = () => page.click('[aria-label="Unsaved changes"] button:last-child');
const usageSection = async () => {
  const html = await (await fetch(`${BASE}/${SLUG}/`)).text();
  const i = html.indexOf('id="usage"');
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
  const tab = `/admin/brands/${id}/usage/`;
  await go("/admin/", `select[aria-label="Status of ${NAME}"]`);
  await page.select(`select[aria-label="Status of ${NAME}"]`, "LIVE");
  await toast(`${NAME}: Live`);

  console.log("Coming soon by default");
  await go(tab, 'input[type="checkbox"]');
  check(await page.$eval('input[type="checkbox"]', (c) => c.checked) && (await usageSection()).includes("Coming soon"), "a new brand's usage is Coming soon, on the site too");

  console.log("Guidelines");
  await page.click('input[type="checkbox"]');
  await page.waitForSelector("#usage-md");
  await page.type("#usage-md", "## Clear space\nKeep **one icon height** around the logo.\n\n- Never stretch it\n- Never recolor it\n\n[Brand portal](https://example.com)\n\n<script>alert(1)</script>\n\n![tracker](https://evil.example/t.png)");
  await page.click('[role="radio"]:last-child');
  await page.waitForFunction(() => document.querySelector("main h3")?.textContent === "Clear space");
  check(true, "Preview renders the Markdown");
  await page.click('[role="radio"]:first-child');

  console.log("Do / Don't");
  await page.click("::-p-text(Add pair)");
  await page.waitForSelector('li[aria-label="Pair 1"]');
  const input = await page.$('li[aria-label="Pair 1"] [aria-label="Do"] input[type=file]');
  await input.uploadFile(`${FIX}/do.png`);
  await page.waitForSelector('li[aria-label="Pair 1"] [aria-label="Do"] img', { timeout: 30000 });
  const doSrc = await page.$eval('li[aria-label="Pair 1"] [aria-label="Do"] img', (i) => i.src);
  check(/\/brands\/[^/]+\/usage\/[0-9a-f-]{36}\/do\.png$/.test(new URL(doSrc).pathname), "the Do image uploads into the brand's usage folder");
  await page.type('input[aria-label="Do caption"]', "Use the full logo on white");
  await save();
  await page.waitForSelector('[role="alert"]');
  check((await page.$eval('[role="alert"]', (e) => e.textContent)) === `Pair 1: add an image or a caption to "Don't".`, "an empty side is refused");
  await page.type(`input[aria-label="Don't caption"]`, "Stretch or skew it");
  await save();
  check(await toast("Usage guidelines saved"), "save");

  console.log("Public page");
  const pub = await usageSection();
  check(pub.includes(">Clear space</h3>") && pub.includes("one icon height</strong>") && pub.includes(">Never recolor it</li>"), "headings, bold and lists render");
  check(/<a href="https:\/\/example\.com"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/.test(pub), "external links open safely in a new tab");
  check(!pub.includes("<script") && !pub.includes("alert(1)") && !pub.includes("evil.example"), "raw HTML and external images never reach the page");
  check(pub.includes(">Do</span>") && pub.includes("Use the full logo on white") && pub.includes(">Don&#x27;t</span>") && pub.includes("Stretch or skew it") && pub.includes("/usage/"), "the Do / Don't pair shows, with its image");
  const toc = await (await fetch(`${BASE}/${SLUG}/`)).text();
  check(!/Usage guidelines<\/a>[^]*?Soon/.test(toc.slice(toc.indexOf("On this page"), toc.indexOf("On this page") + 1500)), "the table of contents drops the Soon tag");

  console.log("Images are cleaned up");
  await go(tab, '[aria-label="Do"] img');
  await page.click('li[aria-label="Pair 1"] [aria-label="Do"] ::-p-text(Remove image)');
  await save();
  check(await toast("Usage guidelines saved"), "remove the Do image and save");
  check(!(await inStorage(doSrc)), "the removed image is deleted from storage");

  console.log("Back to Coming soon");
  await page.click('input[type="checkbox"]');
  await save();
  check(await toast("Usage shows as Coming soon"), "switch back to Coming soon");
  check((await usageSection()).includes("Coming soon"), "the public page follows");
} finally {
  await deleteTestBrand().catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Usage tab works");
