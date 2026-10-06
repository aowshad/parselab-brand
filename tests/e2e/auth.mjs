// Admin auth, end to end: guards, login, lockout, account changes, sessions and the reset CLI.
// Needs ADMIN_EMAIL / ADMIN_PASSWORD in .env.local (the seeded admin). Always restores them.
// Waits for "load", not network idle: a server action's response keeps streaming briefly after
// the page has moved on, so the network is rarely idle right after a form submit.
import { execFileSync } from "node:child_process";
import { BASE, check, done, launch, wait } from "./lib.mjs";

process.loadEnvFile(".env.local");
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const TEMP_EMAIL = "brand-admin-test@parselab.com";
const TEMP_PASSWORD = `Temp-${Math.random().toString(36).slice(2)}-Pass42`;
const runIp = () => `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;

const browser = await launch();
const errors = [];

/** A browser "device": own cookies, own IP (x-forwarded-for), so lockouts don't collide. */
async function device(ip = runIp()) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  page.done = () => ctx.close();
  return page;
}

/** Waits until React has hydrated the element (it carries React's internal keys), so clicks reach handlers. */
const hydrated = (page, selector) =>
  page.waitForFunction((sel) => { const el = document.querySelector(sel); return !!el && Object.keys(el).some((k) => k.startsWith("__react")); }, {}, selector);

async function signIn(page, email, password, next = "") {
  await page.goto(`${BASE}/admin/login/${next ? `?next=${encodeURIComponent(next)}` : ""}`, { waitUntil: "load" });
  await hydrated(page, 'button[type="submit"]');
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }).catch(() => {}), page.click('button[type="submit"]')]);
  await wait(300);
}
const alertText = (page) => page.$eval('[role="alert"]', (e) => e.textContent.trim()).catch(() => "");
const toastText = (page) => page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.trim(), { timeout: 4000 }).then((h) => h.jsonValue()).catch(() => "");
const reset = (email, password) =>
  execFileSync("node_modules/.bin/tsx", ["scripts/admin-reset.ts", "--email", email], { input: `${password}\n${password}\n`, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();

try {
  console.log("Guards");
  for (const [path, cookie, want] of [
    ["/admin/", null, 307],
    ["/admin/account/", null, 307],
    ["/admin/", "forged", 307],
    ["/api/admin/me/", null, 401],
    ["/api/admin/me/", "forged", 401],
  ]) {
    const res = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie: `__Host-bp_session=${cookie}` } : {} });
    const to = res.headers.get("location") ?? "";
    check(res.status === want && (want !== 307 || to.includes(`/admin/login/?next=${encodeURIComponent(path)}`)), `${path} ${cookie ? "forged cookie" : "no cookie"} → ${res.status}${to ? ` ${new URL(to, BASE).pathname}${new URL(to, BASE).search}` : ""}`);
  }
  const signup = await fetch(`${BASE}/admin/signup/`, { redirect: "manual" });
  check([307, 404].includes(signup.status), `no sign-up page (/admin/signup/ → ${signup.status})`);
  const login = await fetch(`${BASE}/admin/login/`);
  const html = await login.text();
  check(login.headers.get("x-robots-tag") === "noindex, nofollow" && /<meta name="robots" content="noindex, nofollow"/.test(html), "admin pages: X-Robots-Tag and <meta robots> noindex");
  check(/Disallow: \/admin/.test(await (await fetch(`${BASE}/robots.txt`)).text()), "robots.txt disallows /admin");
  check(!/forgot|sign up|create account/i.test(html), "login page has no sign-up or forgot-password link");

  console.log("Login");
  {
    const page = await device();
    await page.goto(`${BASE}/admin/login/`, { waitUntil: "load" });
    await hydrated(page, 'button[aria-label="Show password"]');
    const type0 = await page.$eval('input[name="password"]', (i) => i.type);
    await page.click('button[aria-label="Show password"]');
    check(type0 === "password" && (await page.$eval('input[name="password"]', (i) => i.type)) === "text", "Show password reveals it");
    await signIn(page, EMAIL, "definitely-wrong-password");
    const wrongPw = await alertText(page);
    await signIn(page, "nobody@example.com", "definitely-wrong-password");
    const noUser = await alertText(page);
    check(wrongPw === "Email or password is incorrect." && noUser === wrongPw, `wrong password and unknown email get the same message ("${wrongPw}")`);
    await page.done();
  }
  {
    const ip = runIp();
    const page = await device(ip);
    const msgs = [];
    for (let i = 0; i < 5; i++) {
      await signIn(page, EMAIL, `wrong-password-${i}`);
      msgs.push(await alertText(page));
    }
    check(msgs.slice(0, 4).every((m) => m === "Email or password is incorrect.") && msgs[4] === "Too many attempts. Try again in 15 minutes.", `5th failure locks out: "${msgs[4]}"`);
    await signIn(page, EMAIL, PASSWORD);
    check((await alertText(page)).startsWith("Too many attempts") && page.url().includes("/admin/login"), "while locked, even the right password is refused");
    await page.done();
    const other = await device();
    await signIn(other, EMAIL, PASSWORD);
    check(new URL(other.url()).pathname === "/admin/", "the lockout is per IP + email: another IP still signs in");
    await other.done();
  }

  console.log("Session");
  const a = await device();
  await signIn(a, EMAIL.toUpperCase(), PASSWORD, "/admin/account/");
  check(new URL(a.url()).pathname === "/admin/account/", `email is case-insensitive, and ?next= returns you to ${new URL(a.url()).pathname}`);
  const cookies = await a.browserContext().cookies();
  const c = cookies.find((x) => x.name.endsWith("bp_session"));
  const days = c ? (c.expires * 1000 - Date.now()) / 86_400_000 : 0;
  check(c?.name === "__Host-bp_session" && c.httpOnly && c.secure && c.sameSite === "Lax" && c.path === "/" && days > 6.9 && days <= 7, `cookie __Host-bp_session: httpOnly, Secure, SameSite=Lax, 7 days (${days.toFixed(2)})`);
  check(c && c.value.length >= 43 && !/[+/=]/.test(c.value), "token is 32 random bytes (base64url)");
  await a.goto(`${BASE}/admin/`, { waitUntil: "load" });
  const rows = await a.$$eval("tbody tr", (r) => r.length);
  check(rows === 5, `Brands lists all ${rows} brands`);
  await a.goto(`${BASE}/admin/login/`, { waitUntil: "load" });
  check(new URL(a.url()).pathname === "/admin/", "signed in: the login page sends you to the panel");
  const me = await a.evaluate(async () => (await fetch("/api/admin/me/")).json());
  check(me.email === EMAIL, `/api/admin/me with a session → ${me.email}`);

  console.log("Account: email");
  await a.goto(`${BASE}/admin/account/`, { waitUntil: "load" });
  await hydrated(a, 'form:has(input[name="email"]) button');
  await a.type('form input[name="email"]', TEMP_EMAIL);
  await a.type('form:has(input[name="email"]) input[name="currentPassword"]', PASSWORD);
  await a.click("::-p-text(Update email)");
  await a.waitForSelector('[aria-label="Confirm email change"]');
  check((await a.$eval('[aria-label="Confirm email change"]', (e) => e.textContent)).includes(TEMP_EMAIL), "asks to confirm the new email first");
  await a.click("::-p-text(Change email)");
  check((await toastText(a)) === "Email updated", "toast: Email updated");
  // Log out from the account menu, then sign in with the new email.
  await hydrated(a, 'button[aria-haspopup="menu"]');
  await a.click('button[aria-haspopup="menu"]');
  await a.waitForSelector('[role="menu"] button[type="submit"]');
  await Promise.all([a.waitForNavigation({ waitUntil: "load" }), a.click('[role="menu"] button[type="submit"]')]);
  check(new URL(a.url()).pathname === "/admin/login/", "Log out (account menu) returns to the login page");
  const afterLogout = await fetch(`${BASE}/api/admin/me/`, { headers: { cookie: (await a.browserContext().cookies()).map((x) => `${x.name}=${x.value}`).join("; ") } });
  check(afterLogout.status === 401, "and the old session no longer works");
  await signIn(a, TEMP_EMAIL, PASSWORD);
  check(new URL(a.url()).pathname === "/admin/", "signs in with the new email");
  // Put it back.
  await a.goto(`${BASE}/admin/account/`, { waitUntil: "load" });
  await hydrated(a, 'form:has(input[name="email"]) button');
  await a.type('form input[name="email"]', EMAIL);
  await a.type('form:has(input[name="email"]) input[name="currentPassword"]', PASSWORD);
  await a.click("::-p-text(Update email)");
  await a.waitForSelector('[aria-label="Confirm email change"]');
  await a.click("::-p-text(Change email)");
  check((await toastText(a)) === "Email updated", `email restored to ${EMAIL}`);

  console.log("Account: password and sessions");
  const b = await device();
  await signIn(b, EMAIL, PASSWORD);
  check(new URL(b.url()).pathname === "/admin/", "a second browser signs in");
  await a.goto(`${BASE}/admin/account/`, { waitUntil: "load" });
  const listed = await a.$$eval("section ul li", (l) => l.map((x) => x.textContent));
  check(listed.length >= 2 && listed.filter((t) => t.includes("This browser")).length === 1, `Active sessions lists ${listed.length}, one marked "This browser"`);

  const pwForm = 'form:has(input[name="newPassword"])';
  const fillPw = async (cur, next, confirm) => {
    await a.goto(`${BASE}/admin/account/`, { waitUntil: "load" });
    await hydrated(a, `${pwForm} button[type="submit"]`);
    await a.type(`${pwForm} input[name="currentPassword"]`, cur);
    await a.type(`${pwForm} input[name="newPassword"]`, next);
    await a.type(`${pwForm} input[name="confirmPassword"]`, confirm);
  };
  await fillPw(PASSWORD, PASSWORD, PASSWORD);
  const meter = await a.$eval(`${pwForm} [aria-live="polite"] p`, (p) => p.textContent);
  await a.click(`${pwForm} button[type="submit"]`);
  await a.waitForSelector(`${pwForm} [role="alert"]`);
  check((await a.$eval(`${pwForm} [role="alert"]`, (e) => e.textContent)) === "New password must be different from the current one.", "the new password must differ");
  check(/At least 12 characters/.test(meter), `strength meter: "${meter}"`);
  await fillPw(PASSWORD, "short-pw", "short-pw");
  check(await a.$eval(`${pwForm} input[name="newPassword"]`, (i) => !i.checkValidity()), "the browser blocks a short password (minLength 12)");
  // Bypass the browser's check: the server must refuse it on its own.
  await a.$eval(pwForm, (f) => (f.noValidate = true));
  await a.click(`${pwForm} button[type="submit"]`);
  await a.waitForSelector(`${pwForm} [role="alert"]`);
  check((await a.$eval(`${pwForm} [role="alert"]`, (e) => e.textContent)).includes("at least 12"), "minimum 12 characters");
  await fillPw(PASSWORD, TEMP_PASSWORD, TEMP_PASSWORD);
  await a.click(`${pwForm} button[type="submit"]`);
  const pwToast = await toastText(a);
  check(/^Password changed · \d+ other sessions? signed out$/.test(pwToast), `toast: ${pwToast}`);
  await b.goto(`${BASE}/admin/`, { waitUntil: "load" });
  check(new URL(b.url()).pathname === "/admin/login/", "the other browser is signed out");
  await a.goto(`${BASE}/admin/`, { waitUntil: "load" });
  check(new URL(a.url()).pathname === "/admin/", "this browser stays signed in");
  await signIn(b, EMAIL, TEMP_PASSWORD);
  check(new URL(b.url()).pathname === "/admin/", "the new password works");
  await a.goto(`${BASE}/admin/account/`, { waitUntil: "load" });
  await hydrated(a, "section ul");
  await a.click("::-p-text(Sign out all other sessions)");
  check(/other sessions? signed out/.test(await toastText(a)), "Sign out all other sessions");
  await b.goto(`${BASE}/admin/`, { waitUntil: "load" });
  check(new URL(b.url()).pathname === "/admin/login/", "and that browser is signed out");
  await b.done();

  console.log("Reset from the terminal");
  const out = reset(EMAIL, PASSWORD);
  check(/^✓ Password reset for .+\. \d+ sessions? signed out\.$/.test(out), `pnpm admin:reset: ${out}`);
  await a.goto(`${BASE}/admin/`, { waitUntil: "load" });
  check(new URL(a.url()).pathname === "/admin/login/", "every session is signed out");
  await signIn(a, EMAIL, PASSWORD);
  check(new URL(a.url()).pathname === "/admin/", "the reset password works");
  let refused = "";
  try {
    reset(EMAIL, "too-short");
  } catch (e) {
    refused = e.stderr.toString().trim();
  }
  check(refused.includes("at least 12"), `reset refuses a short password (${refused})`);
  await a.done();
} finally {
  // Whatever happened above, leave the admin as it was.
  try {
    reset(EMAIL, PASSWORD);
  } catch {
    try {
      reset(TEMP_EMAIL, PASSWORD);
      console.log("  ! email was left as the test email; change it back on the Account page");
    } catch {}
  }
  await browser.close();
}
check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
done("Admin auth works");
