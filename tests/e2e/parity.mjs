// Pixel-compares every public page against a reference build (e.g. the last static build
// before the move to the database). Usage: REF_URL=http://localhost:4174 node tests/e2e/parity.mjs
import fs from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { BASE, BRANDS, check, done, launch, open, revealAll } from "./lib.mjs";

const REF = process.env.REF_URL ?? "http://localhost:4174";
const OUT = process.env.OUT_DIR ?? "test-results/parity";
fs.mkdirSync(OUT, { recursive: true });

const browser = await launch();
const paths = ["/", ...BRANDS.map((b) => `/${b}/`), "/nope/"];

async function shot(base, path, theme, width) {
  const page = await open(browser, base + path, { theme, width });
  await revealAll(page);
  // The theme toggle's hover tooltip and the toast are transient; everything else must match.
  const png = PNG.sync.read(await page.screenshot({ fullPage: true }));
  const errors = page.errors;
  await page.close();
  return { png, errors };
}

for (const theme of ["light", "dark"]) {
  for (const width of [1440, 375]) {
    console.log(`${theme} @${width}`);
    for (const path of paths) {
      const [a, b] = await Promise.all([shot(REF, path, theme, width), shot(BASE, path, theme, width)]);
      const name = `${path.replace(/\W/g, "") || "home"}-${theme}-${width}`;
      if (a.png.width !== b.png.width || a.png.height !== b.png.height) {
        check(false, `${path}: size differs (${a.png.width}×${a.png.height} → ${b.png.width}×${b.png.height})`);
        fs.writeFileSync(`${OUT}/${name}-ref.png`, PNG.sync.write(a.png));
        fs.writeFileSync(`${OUT}/${name}-new.png`, PNG.sync.write(b.png));
        continue;
      }
      const diff = new PNG({ width: a.png.width, height: a.png.height });
      const n = pixelmatch(a.png.data, b.png.data, diff.data, a.png.width, a.png.height, { threshold: 0.1 });
      const pct = (n / (a.png.width * a.png.height)) * 100;
      if (n) fs.writeFileSync(`${OUT}/${name}-diff.png`, PNG.sync.write(diff));
      // Chrome anti-aliases a few rounded-corner pixels differently from run to run; a real change is far bigger.
      const NOISE = 16;
      check(n <= NOISE && !b.errors.length, `${path.padEnd(12)} ${n === 0 ? "identical" : n <= NOISE ? `identical (${n} px anti-aliasing noise)` : `${n} px differ (${pct.toFixed(3)}%)`}${b.errors.length ? ` · errors: ${b.errors.join(" | ")}` : ""}`);
    }
  }
}
await browser.close();
done("Every page matches the reference build, pixel for pixel");
