// Crawls every public page: each linked or embedded file must load, assets must come from
// Supabase Storage, and downloads must save under their real file name.
import { BASE, BRANDS, check, done, launch, open, revealAll } from "./lib.mjs";

const STORAGE = process.env.STORAGE_ORIGIN ?? "https://gthtvjnxmfsgitvnsvor.supabase.co";
const browser = await launch();
const refs = new Map(); // url -> "download" | "inline"
const failed = new Set();

for (const path of ["/", ...BRANDS.map((b) => `/${b}/`)]) {
  const page = await open(browser, BASE + path);
  page.on("requestfailed", (r) => failed.add(r.url()));
  page.on("response", (r) => r.status() >= 400 && failed.add(`${r.status()} ${r.url()}`));
  await revealAll(page);
  // Open every download menu so its PNG links are in the DOM too.
  const found = await page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll("a[download]")) out.push([a.href, "download", a.getAttribute("download")]);
    for (const e of document.querySelectorAll("img[src], link[rel=icon], meta[property='og:image']")) out.push([e.src || e.href || e.content, "inline", null]);
    return { out, images: [...document.querySelectorAll("img")].filter((i) => i.getClientRects().length).every((i) => i.complete && i.naturalWidth > 0) };
  });
  for (const [u, kind, name] of found.out) refs.set(u, { kind, name });
  check(page.status === 200 && found.images && !page.errors.length, `${path.padEnd(12)} 200, every visible image loaded${page.errors.length ? ` · ${page.errors.join(" | ")}` : ""}`);
  await page.close();
}

// Variant PNGs live in the download menu; collect them for one brand to cover the menu path.
{
  const page = await open(browser, `${BASE}/parselab/`);
  await page.click('button[aria-haspopup="menu"]');
  await page.waitForSelector('[role="menu"]');
  for (const [u, name] of await page.$$eval('[role="menu"] a', (as) => as.map((a) => [a.href, a.getAttribute("download")]))) refs.set(u, { kind: "download", name });
  await page.close();
}

const assets = [...refs.keys()].filter((u) => !u.startsWith(BASE));
check(assets.length > 0 && assets.every((u) => u.startsWith(`${STORAGE}/storage/v1/object/public/brand-assets/`)), `${assets.length} asset URLs, all from Supabase Storage`);
check(assets.every((u) => /\/[0-9a-f-]{36}\/[A-Za-z0-9._%@-]+\.(svg|png|zip|css|json)(\?|$)/.test(u)), "every storage key is <server-generated UUID>/<clean file name>");

const bad = [];
for (const [u, { kind, name }] of refs) {
  const res = await fetch(u);
  await res.arrayBuffer();
  if (res.status !== 200) { bad.push(`${res.status} ${u}`); continue; }
  if (kind === "download") {
    // The name the browser will use: the header's filename*, else filename, else the URL's last segment.
    const cd = res.headers.get("content-disposition") ?? "";
    const m = cd.match(/filename\*=UTF-8''([^;]+)/) ?? cd.match(/filename="?([^";]+)"?/);
    const saved = decodeURIComponent(m ? m[1] : new URL(u).pathname.split("/").pop());
    if (!cd.includes("attachment") || saved !== name) bad.push(`saves as ${saved}, not ${name} (${cd || "no Content-Disposition"})`);
  }
}
check(!bad.length, `${refs.size} files fetched: all 200, downloads save under their own names${bad.length ? "\n      " + bad.slice(0, 8).join("\n      ") : ""}`);
check(failed.size === 0, `no failed requests${failed.size ? ": " + [...failed].slice(0, 5).join(", ") : ""}`);

// Unknown and draft slugs are a 404 with the real "Brand not found" page.
{
  const page = await open(browser, `${BASE}/no-such-brand/`);
  const text = await page.evaluate(() => document.body.innerText);
  check(page.status === 404 && text.includes("Brand not found"), `unknown brand → ${page.status}, "Brand not found"`);
  await page.close();
}

await browser.close();
done("Every page, file and download works");
