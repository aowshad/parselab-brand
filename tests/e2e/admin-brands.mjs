// Phase 3: the Brands list and the General tab, end to end, against the real database and
// storage. Creates "ProductsModel" (and a copy), exercises everything, then deletes them.
import fs from "node:fs";
import { BASE, check, done, launch, wait } from "./lib.mjs";

process.loadEnvFile(".env.local");
const NAME = "ProductsModel";
const browser = await launch();
const errors = [];
const FIX = "test-results/fixtures";
fs.mkdirSync(FIX, { recursive: true });
fs.copyFileSync("prisma/seed-data/brands/quotend/logos/icon-brand.svg", `${FIX}/icon.svg`);
fs.copyFileSync("prisma/seed-data/brands/quotend/logos/full-light-bg.svg", `${FIX}/wide.svg`);
fs.writeFileSync(`${FIX}/evil.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><rect width="10" height="10"/></svg>');
fs.writeFileSync(`${FIX}/fake.png`, "this is not an image");
fs.writeFileSync(`${FIX}/huge.png`, Buffer.alloc(6 * 1024 * 1024, 1));

const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.33.33.33" });
await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept()); // the "leave without saving?" confirm, when a test triggers it

const hydrated = (sel) => page.waitForFunction((s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, {}, sel);
const go = async (path, ready) => {
  await page.goto(BASE + path, { waitUntil: "load" });
  if (ready) await hydrated(ready);
};
/** Waits for a toast with this exact text; returns the text it saw (the last one, on timeout). */
const toastIs = async (text, timeout = 10000) => {
  const ok = await page.waitForFunction((t) => document.querySelector('[data-toast-region]')?.textContent.trim() === t, { timeout }, text).then(() => true).catch(() => false);
  return ok ? text : await page.$eval('[data-toast-region]', (e) => e.textContent.trim()).catch(() => "");
};
const status = async (path) => (await fetch(BASE + path, { redirect: "manual" })).status;
const homeHas = async (name) => (await (await fetch(`${BASE}/`)).text()).includes(`>${name}</h2>`);
const cookieHeader = async () => (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const brandId = () => new URL(page.url()).pathname.split("/")[3];
/** Asks storage itself (not the CDN, which may still hold a cached copy for up to an hour). */
const inStorage = async (publicUrl) => {
  const key = new URL(publicUrl).pathname.replace("/storage/v1/object/public/brand-assets/", "");
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/brand-assets/${key}`, { headers: { authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY } });
  await res.arrayBuffer();
  return res.ok;
};

async function cleanup() {
  // Delete anything this test may have left behind (by name), through the UI's own action.
  for (const n of [`${NAME} copy`, NAME]) {
    await go("/admin/", 'button[aria-label^="Actions for"]');
    if (!(await page.$(`button[aria-label="Actions for ${n}"]`))) continue;
    await page.click(`button[aria-label="Actions for ${n}"]`);
    await page.click("::-p-text(Delete…)");
    await page.waitForSelector("dialog[open] input");
    await page.type("dialog[open] input", n);
    await page.click("dialog[open] button[type=submit]");
    await toastIs(`${n} deleted`, 4000);
  }
}

try {
  // Sign in.
  await go("/admin/login/", 'button[type="submit"]');
  await page.type('input[name="email"]', process.env.ADMIN_EMAIL);
  await page.type('input[name="password"]', process.env.ADMIN_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  await cleanup();
  const startOrder = await page.$$eval("tbody tr td:nth-child(2)", (t) => t.map((x) => x.textContent.trim()));

  console.log("Create");
  await go("/admin/brands/new/", 'button[type="submit"]');
  await page.type('input[name="name"]', "Admin");
  await wait(150);
  check((await page.$eval('input[name="slug"]', (i) => i.value)) === "admin" && (await page.$eval("form", (f) => f.textContent)).includes("reserved"), 'slug follows the name; "admin" is reserved');
  await page.click('input[name="name"]', { count: 3 });
  await page.type('input[name="name"]', "ParseLab");
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.click('button[type="submit"]')]);
  await page.waitForFunction(() => document.querySelector("form")?.textContent.includes("already uses"));
  check(true, 'an existing slug is refused ("ParseLab already uses /parselab/.")');
  await page.click('input[name="name"]', { count: 3 });
  await page.type('input[name="name"]', NAME);
  await page.click('input[name="slug"]', { count: 3 });
  await page.keyboard.press("Backspace");
  await page.type('input[name="tagline"]', "Verified, simulation-ready CAD models.");
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('button[type="submit"]')]);
  check(/\/admin\/brands\/[^/]+\/\?created=1$/.test(page.url()), "Create brand opens its editor");
  const id = brandId();
  check((await page.$eval("h1", (h) => h.textContent)) === NAME && (await page.$eval("main", (m) => m.textContent)).includes("/productsmodel/ · Draft"), "starts as Draft at /productsmodel/");
  check(!(await homeHas(NAME)) && (await status("/productsmodel/")) === 404, "Draft: not on the home page, /productsmodel/ is a 404");

  console.log("Icon upload");
  await hydrated(`#icon-${id}`);
  const upload = async (file) => {
        const prev = await page.$eval('section [role="alert"]', (e) => e.textContent.trim()).catch(() => null);
    const input = await page.$(`#icon-${id}`);
    await input.uploadFile(`${FIX}/${file}`);
    // The result is either a new error line in the icon section or the "Icon updated" toast.
    await page.waitForFunction(
      (p) => { const a = document.querySelector('section [role="alert"]')?.textContent.trim(); return (a && a !== p) || document.querySelector('[data-toast-region]')?.textContent.trim() === "Icon updated"; },
      { timeout: 20000 },
      prev,
    );
    return page.evaluate(() => document.querySelector('section [role="alert"]')?.textContent.trim() ?? "Icon updated");
  };
  check((await upload("evil.svg")) === "SVG contains scripts and was rejected.", "an SVG with onload= is rejected");
  check((await upload("wide.svg")) === "Brand icon must be square (this one is 161 × 28).", "a non-square image is rejected with its size");
  check((await upload("fake.png")) === "That isn't an SVG or PNG file.", "content is sniffed: a text file named .png is rejected");
  check((await upload("huge.png")) === "File is over 5 MB.", "over 5 MB is refused before anything uploads");
  check((await upload("icon.svg")) === "Icon updated", "a square SVG uploads: Icon updated");
  await page.waitForSelector('img[alt="Current brand icon"]');
  const iconUrl = await page.$eval('img[alt="Current brand icon"]', (i) => i.src);
  const iconRes = await fetch(iconUrl);
  const iconBody = await iconRes.text();
  check(iconRes.status === 200 && /\/brands\/[^/]+\/icon\/[0-9a-f-]{36}\/icon\.svg$/.test(new URL(iconUrl).pathname) && !/onload|<script/i.test(iconBody), "stored at brands/<id>/icon/<uuid>/icon.svg, cleaned");

  console.log("Upload API");
  {
    const cookie = await cookieHeader();
    const sign = (headers, body) => fetch(`${BASE}/api/admin/uploads/sign/`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    const body = { purpose: "brand-icon", brandId: id, fileName: "x.svg", size: 100, type: "image/svg+xml" };
    check((await sign({ origin: BASE }, body)).status === 401, "sign without a session → 401");
    check((await sign({ cookie, origin: "https://evil.example" }, body)).status === 403, "sign from another origin → 403");
    check((await sign({ cookie, origin: BASE }, { ...body, purpose: "anything" })).status === 400, "unknown purpose → 400");
    const ok = await sign({ cookie, origin: BASE }, body);
    const t = await ok.json();
    check(ok.status === 200 && /\/object\/upload\/sign\/brand-assets\/staging\/[0-9a-f-]{36}\/x\.svg\?token=/.test(t.signedUrl), "signed URL is for a server-generated staging key");
    const put = await fetch(t.signedUrl, { method: "PUT", headers: { "content-type": "image/svg+xml" }, body: fs.readFileSync(`${FIX}/icon.svg`) });
    const complete = () => fetch(`${BASE}/api/admin/uploads/complete/`, { method: "POST", headers: { "content-type": "application/json", cookie, origin: BASE }, body: JSON.stringify({ ticketId: t.ticketId }) });
    const first = await complete();
    const second = await complete();
    check(put.ok && first.status === 200 && second.status === 410, `a ticket works once (PUT ${put.status}, complete ${first.status}, replay ${second.status})`);
    const staged = await fetch(t.signedUrl.replace("/object/upload/sign/", "/object/public/").replace(/\?.*$/, ""));
    check(staged.status >= 400, "the staged upload is deleted after processing");
  }

  console.log("Status and the public site");
  await go("/admin/", `select[aria-label="Status of ${NAME}"]`);
    await page.select(`select[aria-label="Status of ${NAME}"]`, "LIVE");
  { const t = await toastIs(`${NAME}: Live`); check(t === `${NAME}: Live`, `${"inline status → Live"}${t === `${NAME}: Live` ? "" : ` (saw "${t}")`}`); }
  check((await homeHas(NAME)) && (await status("/productsmodel/")) === 200, "now on the home page, and /productsmodel/ renders");
  const pub = await (await fetch(`${BASE}/productsmodel/`)).text();
  check(pub.includes("Verified, simulation-ready CAD models.") && pub.includes("Coming soon") && pub.includes("/icon/"), "the page shows the tagline, coming-soon sections and the new icon");

  console.log("Reorder (keyboard)");
  await go("/admin/", `button[aria-label="Reorder ${NAME}"]`);
  const before = await page.$$eval("tbody tr td:nth-child(2)", (t) => t.map((x) => x.textContent.trim()));
  await page.focus(`button[aria-label="Reorder ${NAME}"]`);
  await page.keyboard.press("Space");
  await wait(150);
  for (let i = 0; i < before.length - 1; i++) {
    await page.keyboard.press("ArrowUp");
    await wait(120);
  }
    await page.keyboard.press("Space");
  await wait(200);
  const announced = await page.$eval('[id^="DndLiveRegion"]', (e) => e.textContent.trim()).catch(() => "");
  { const t = await toastIs("Order saved"); check(t === "Order saved", `${"Space, arrows, Space: Order saved"}${t === "Order saved" ? "" : ` (saw "${t}")`}`); }
  const home = await (await fetch(`${BASE}/`)).text();
  check(home.indexOf(`>${NAME}</h2>`) > -1 && home.indexOf(`>${NAME}</h2>`) < home.indexOf(">ParseLab</h2>"), "the home page shows it first");
  await go("/admin/", "tbody tr");
  check((await page.$eval("tbody tr td:nth-child(2)", (t) => t.textContent.trim())) === NAME, "and the order survives a reload");
  check(announced.startsWith(`${NAME} dropped at position 1 of`), `screen readers hear it: "${announced}"`);

  console.log("General tab");
  await go(`/admin/brands/${id}/`, 'input[name="name"]');
  const bar = () => page.$eval('[aria-label="Unsaved changes"]', (e) => getComputedStyle(e.parentElement).opacity);
  check((await bar()) === "0", "no save bar until something changes");
  await page.type('input[name="name"]', " X");
  await wait(300);
  check((await bar()) === "1", "editing shows the save bar");
  await page.click('[aria-label="Unsaved changes"] button[type="button"]');
  await wait(300);
  check((await page.$eval('input[name="name"]', (i) => i.value)) === NAME && (await bar()) === "0", "Discard restores the saved values");
  await page.click('input[name="slug"]', { count: 3 });
  await page.type('input[name="slug"]', "Bad Slug");
  check((await page.$eval("form", (f) => f.textContent)).includes("Use lowercase letters"), "invalid slug is flagged as you type");
  await page.click('input[name="slug"]', { count: 3 });
  await page.type('input[name="slug"]', "products-model");
  await page.waitForFunction(() => document.querySelector("form")?.textContent.includes("Changing the URL breaks links"));
  check(await page.$eval('input[name="keepRedirect"]', (c) => c.checked), "renaming warns about old links; keep-redirect is on by default");
    await page.click('[aria-label="Unsaved changes"] button[type="submit"]');
  { const t = await toastIs("Saved · /productsmodel/ now redirects to /products-model/"); check(t === "Saved · /productsmodel/ now redirects to /products-model/", `${"saved, with a redirect"}${t === "Saved · /productsmodel/ now redirects to /products-model/" ? "" : ` (saw "${t}")`}`); }
  const moved = await fetch(`${BASE}/productsmodel/`, { redirect: "manual" });
  check([307, 308].includes(moved.status) && moved.headers.get("location")?.endsWith("/products-model/") && (await status("/products-model/")) === 200, `old URL → ${moved.status} /products-model/`);
  await go(`/admin/brands/${id}/`, 'button[aria-label="Stop redirecting /productsmodel/"]');
    await page.click('button[aria-label="Stop redirecting /productsmodel/"]');
  check((await toastIs("/productsmodel/ no longer redirects")) === "/productsmodel/ no longer redirects" && (await status("/productsmodel/")) === 404, "the redirect can be removed");
  // Leave-page guard: an unsaved edit, then a link click asks first (auto-accepted here).
  await go(`/admin/brands/${id}/`, 'input[name="tagline"]');
  let asked = "";
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => { asked = d.message(); d.dismiss(); });
  await page.type('input[name="tagline"]', " edited");
  await page.click('nav[aria-label="Brand editor"] a[href$="/logos/"]');
  await wait(400);
  check(asked.includes("unsaved changes") && new URL(page.url()).pathname === `/admin/brands/${id}/`, "leaving with unsaved changes asks first (and staying works)");
  page.on("dialog", (d) => d.accept());

  console.log("Duplicate and delete");
  await go("/admin/", `button[aria-label="Actions for ${NAME}"]`);
    await page.click(`button[aria-label="Actions for ${NAME}"]`);
  await page.click("::-p-text(Duplicate)");
  { const t = await toastIs(`Duplicated as ${NAME} copy (Draft)`); check(t === `Duplicated as ${NAME} copy (Draft)`, `${"Duplicate makes a Draft copy"}${t === `Duplicated as ${NAME} copy (Draft)` ? "" : ` (saw "${t}")`}`); }
  await page.waitForSelector(`button[aria-label="Actions for ${NAME} copy"]`);
  const copyIcon = await page.$eval(`tr:has(button[aria-label="Actions for ${NAME} copy"]) img`, (i) => i.src);
  check(copyIcon !== iconUrl && (await fetch(copyIcon)).status === 200, "with its own copy of the icon in storage");
  await page.click(`button[aria-label="Actions for ${NAME} copy"]`);
  await page.click("::-p-text(Delete…)");
  await page.waitForSelector("dialog[open] input");
  check(await page.$eval("dialog[open] button[type=submit]", (b) => b.disabled), "Delete stays disabled until the name is typed");
  await page.type("dialog[open] input", `${NAME} cop`);
  check(await page.$eval("dialog[open] button[type=submit]", (b) => b.disabled), "a near-miss name doesn't count");
  await page.type("dialog[open] input", "y");
    await page.click("dialog[open] button[type=submit]");
  { const t = await toastIs("ProductsModel copy deleted · 1 file removed"); check(t === "ProductsModel copy deleted · 1 file removed", `${"deleting the copy removes its file"}${t === "ProductsModel copy deleted · 1 file removed" ? "" : ` (saw "${t}")`}`); }
  check(!(await inStorage(copyIcon)), "the copy's icon is gone from storage");

  await go(`/admin/brands/${id}/`, "#danger-h");
  await page.click("::-p-text(Delete ProductsModel…)");
  await page.waitForSelector("dialog[open] input");
  await page.type("dialog[open] input", NAME);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click("dialog[open] button[type=submit]")]);
  check(new URL(page.url()).pathname === "/admin/", "Danger zone delete returns to Brands");
  check(!(await homeHas(NAME)) && (await status("/products-model/")) === 404, "gone from the site");
  check(!(await inStorage(iconUrl)), "and its files from storage (the unattached API upload included)");
  const endOrder = await page.$$eval("tbody tr td:nth-child(2)", (t) => t.map((x) => x.textContent.trim()));
  check(JSON.stringify(endOrder) === JSON.stringify(startOrder), `the other brands keep their order (${endOrder.join(", ")})`);
} finally {
  await cleanup().catch(() => {});
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Brands list and General tab work");
