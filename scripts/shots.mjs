// Per-chapter screenshots of a running site, in Brief and Full mode (redesign/06-agent-playbook.md §5 "Visual").
// Builds nothing: serve a build first (for example `npx vite build --outDir /tmp/x && python3 -m http.server`).
//
//   node scripts/shots.mjs <route> --url http://localhost:PORT/ [--chapters 6,7] [--out dir] [--width 1440]
//   deno run -A scripts/shots.mjs <route> --url http://localhost:PORT/ ...
//
// Playwright is looked up in this order: the `playwright` package next to the script (node_modules),
// /opt/npm-tools/node_modules/playwright, then `npm:playwright` (Deno only). Under Deno, install the browser
// once with `deno run -A npm:playwright install chromium`. With no Playwright at all the script prints a
// notice and exits 0, so it never blocks a pipeline.
//
// Output: <out>/<route>-chNN-brief.png and <route>-chNN-full.png (default out: <repo>/redesign/shots/<route>/new).
// Each image is clipped from the top of #ch-N to the top of #ch-(N+1), or to the bottom of #ch-N when it is last.
import process from "node:process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { REPO, ROUTE_NAMES, routeFromArg, routeSlug } from "./lib/content-data.mjs";

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const WITH_VALUE = new Set(["--url", "--chapters", "--out", "--width"]);
const positional = args.filter((a, i) => !a.startsWith("--") && !WITH_VALUE.has(args[i - 1]));
const route = routeFromArg(positional[0]);
const url = opt("--url");
if (!route || !url) {
  console.error(`Usage: shots.mjs <${ROUTE_NAMES.map(routeSlug).join("|")}> --url http://localhost:PORT/ [--chapters 6,7] [--out dir]`);
  process.exit(2);
}
const chapters = opt("--chapters") ? opt("--chapters").split(",").map(Number) : Array.from({ length: 12 }, (_, i) => i + 1);
const out = opt("--out") ?? join(REPO, "redesign", "shots", routeSlug(route), "new");
const width = Number(opt("--width") ?? 1440);

async function loadPlaywright() {
  const tries = [
    () => import("playwright"),
    () => createRequire(import.meta.url)("/opt/npm-tools/node_modules/playwright"),
    () => import("npm:playwright"),
  ];
  for (const t of tries) {
    try {
      const m = await t();
      const pw = m.chromium ? m : m.default;
      if (pw?.chromium) return pw;
    } catch {
      // try the next location
    }
  }
  return null;
}

const pw = await loadPlaywright();
if (!pw) {
  console.log("shots: Playwright not found (npm i -D playwright, or run with Deno: npm:playwright). Skipped.");
  process.exit(0);
}

mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 1000 } });
const base = url.replace(/#.*$/, "");

/** Sets the Brief/Full toggle in the walkthrough header (a radiogroup labelled "Detail"). */
async function setDetail(mode) {
  const btn = page.locator('[role="radiogroup"][aria-label="Detail"] [role="radio"]', {
    hasText: mode === "full" ? "Full" : "Brief",
  }).first();
  if (!(await btn.count())) return false;
  if ((await btn.getAttribute("aria-checked")) !== "true") {
    await btn.click();
    await page.waitForTimeout(300);
  }
  return true;
}

/** Page-coordinate box from #ch-N to #ch-(N+1) (or the end of #ch-N). */
async function chapterBox(n) {
  return await page.evaluate((n) => {
    const el = document.getElementById(`ch-${n}`);
    if (!el) return null;
    el.scrollIntoView({ block: "start", behavior: "instant" });
    const y = (e) => e.getBoundingClientRect().top + globalThis.scrollY;
    const top = y(el);
    const next = document.getElementById(`ch-${n + 1}`);
    const bottom = next ? y(next) : top + el.getBoundingClientRect().height;
    return { top, height: Math.max(1, bottom - top), width: document.documentElement.scrollWidth };
  }, n);
}

let shot = 0;
const missing = [];
for (const n of chapters) {
  await page.goto(`${base}#/${routeSlug(route)}/ch/${n}`, { waitUntil: "networkidle" });
  try {
    await page.waitForSelector(`#ch-${n}`, { timeout: 10000 });
  } catch {
    missing.push(n);
    continue;
  }
  for (const mode of ["brief", "full"]) {
    const ok = await setDetail(mode);
    if (!ok && mode === "full") console.warn(`shots: no Brief/Full toggle found; Ch ${n} full = brief`);
    await page.waitForTimeout(200);
    const box = await chapterBox(n);
    if (!box) continue;
    const file = join(out, `${routeSlug(route)}-ch${String(n).padStart(2, "0")}-${mode}.png`);
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: box.top, width: Math.min(box.width, width), height: box.height } });
    shot++;
    console.log(`${file}  (${Math.round(box.height)} px)`);
  }
}
await setDetail("brief"); // leave the stored preference as it was by default
await browser.close();
console.log(`shots: ${shot} image(s) in ${out}${missing.length ? `; no #ch-N for chapter(s) ${missing.join(", ")}` : ""}`);
