/**
 * `pnpm dev`: build assets, start `next dev`, and rebuild assets whenever
 * anything under content/ changes. Each rebuild runs in a fresh process so
 * nothing is cached between runs. Refresh the browser to see the result.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const bin = (name: string) => path.join(root, "node_modules", ".bin", name);
const buildAssets = () => spawnSync(bin("tsx"), ["scripts/build-assets.ts"], { stdio: "inherit" }).status === 0;

if (!buildAssets()) process.exit(1);

const next = spawn(bin("next"), ["dev", ...process.argv.slice(2)], { stdio: "inherit" });
next.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => next.kill(sig));

let timer: NodeJS.Timeout | undefined;
fs.watch(path.join(root, "content"), { recursive: true }, (_event, file) => {
  clearTimeout(timer);
  // Debounce: editors often write a file in several steps.
  timer = setTimeout(() => {
    console.log(`\n↻ content changed (${file}), rebuilding assets…`);
    if (!buildAssets()) console.log("  Assets not rebuilt. Fix the errors above; the last good build is still served.");
  }, 300);
});
