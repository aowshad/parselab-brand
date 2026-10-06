// The interactive pieces still work on the database-backed site.
import { BASE, check, done, launch, open, wait } from "./lib.mjs";

const browser = await launch();

console.log("Theme");
{
  const page = await open(browser, `${BASE}/`, { os: "dark" });
  const attr = () => page.evaluate(() => [document.documentElement.dataset.themePref, document.documentElement.dataset.theme].join("/"));
  check((await attr()) === "system/dark", `no choice: System, following the OS (${await attr()})`);
  const seq = [];
  for (let i = 0; i < 3; i++) { await page.click("body > header button"); await wait(350); seq.push(await attr()); }
  check(seq.join(" → ") === "light/light → dark/dark → system/dark", `toggle cycles ${seq.join(" → ")}`);
  await page.click("body > header button"); await wait(350); await page.click("body > header button"); await wait(350); // → light → dark
  await page.reload({ waitUntil: "networkidle0" });
  check((await attr()) === "dark/dark", "Dark persists across reloads");
  await page.close();
}
for (const path of ["/", "/optionia/"]) {
  // All JavaScript files blocked: only the inline <head> script can set the theme.
  const c = await browser.createBrowserContext();
  const page = await c.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.evaluateOnNewDocument(() => localStorage.setItem("theme", "dark"));
  await page.setRequestInterception(true);
  page.on("request", (r) => (r.resourceType() === "script" ? r.abort() : r.continue()));
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg === "rgb(10, 10, 11)", `${path} stored Dark, OS light, no JS: dark before hydration (${bg})`);
  await c.close();
}
{
  const page = await open(browser, `${BASE}/no-such-brand/`, { theme: "dark" });
  await wait(300);
  const r = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.scrollWidth - innerWidth]);
  check(r[0] === "dark", `404 follows the stored theme (${r[0]})`);
  await page.close();
  const phone = await open(browser, `${BASE}/no-such-brand/`, { width: 375 });
  await phone.hover("body > header button"); await wait(250);
  check((await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0, "404 on a phone: no sideways scroll, even with the tooltip showing");
  await phone.close();
}

console.log("Logos");
{
  const page = await open(browser, `${BASE}/parselab/?logo=icon&variant=icon-white`);
  await wait(300);
  const sel = await page.evaluate(() => [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((t) => t.textContent.trim()));
  check(sel.includes("Icon") && sel.includes("White"), `deep link ?logo=icon&variant=icon-white selects ${sel.join(" + ")}`);
  await page.click("#logo-type-tab-full"); await wait(250);
  const img = await page.$eval('#logo-variant-panel img[aria-hidden="false"]', (i) => [i.alt, i.complete && i.naturalWidth > 0]);
  check(img[1] && /ParseLab Full logo/.test(img[0]), `switching to Full logo shows "${img[0]}"`);
  check((await page.evaluate(() => location.search)).includes("logo=full"), "URL follows the tab");
  await page.close();
}

console.log("Colors and downloads");
{
  const page = await open(browser, `${BASE}/optionia/`, { clipboard: true });
  await page.evaluate(() => document.getElementById("colors").scrollIntoView());
  await wait(500);
  await page.click('#colors button[aria-label="Copy hex #07004F"]');
  await wait(200);
  check((await page.evaluate(() => navigator.clipboard.readText())) === "#07004F", "clicking a swatch copies its hex");
  check((await page.$eval('[role="status"]', (e) => e.textContent)) === "Copied #07004F", "and toasts it");
  const kit = "body > header a[download]";
  await page.$eval(kit, (a) => a.addEventListener("click", (e) => e.preventDefault(), { once: true }));
  await page.click(kit); await wait(700);
  check((await page.$eval('[role="status"]', (e) => e.textContent)).startsWith("Downloading optionia-brand-kit.zip"), "Download kit toasts its file name");
  check(!page.errors.length, `no console errors${page.errors.length ? ": " + page.errors.join(" | ") : ""}`);
  await page.close();
}

await browser.close();
done("Interactions work");
