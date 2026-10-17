/*
 * The research library lives one level up, outside this repo. The build reads it from research/, a copy of the
 * files below. When the library is present (local checkout), syncResearch() refreshes the copy; in CI it is absent
 * and the committed copy is used. The root files stay the owner: never edit research/ by hand.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LIBRARY = join(SITE, "..");
export const RESEARCH = join(SITE, "research");

const JSON_FILES = [
  "weapons-and-items.json",
  "class-data.json",
  "combat-arts-and-abilities.json",
  "combat-stats.json",
  "dishes.json",
  "gifts.json",
  "battalions.json",
  "part2-war.json",
  "part3-salvation.json",
  "gods.json",
];
const isMarkdown = (f) => (f.startsWith("walkthrough-") && f.endsWith(".md")) || f === "bird-time-guide.md";

export const hasLibrary = () => existsSync(join(LIBRARY, "weapons-and-items.json"));

/** The research files the build reads, by name. */
export const researchFiles = () => [...JSON_FILES, ...readdirSync(LIBRARY).filter(isMarkdown).sort()];

/** True when a file name is one the site reads (used by the dev watcher). */
export const isResearchFile = (f) => JSON_FILES.includes(f) || isMarkdown(f);

/** Copies changed research files into research/. Returns the names copied. */
export function syncResearch(only) {
  if (!hasLibrary()) return [];
  mkdirSync(RESEARCH, { recursive: true });
  const copied = [];
  for (const f of only ?? researchFiles()) {
    const src = join(LIBRARY, f);
    const dst = join(RESEARCH, f);
    if (!existsSync(src)) continue;
    if (existsSync(dst) && readFileSync(src).equals(readFileSync(dst))) continue;
    copyFileSync(src, dst);
    copied.push(f);
  }
  return copied;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("research.mjs")) {
  if (!hasLibrary()) console.log("research: library not found one level up, keeping the committed copy");
  else {
    const c = syncResearch();
    console.log(c.length ? `research: synced ${c.join(", ")}` : "research: up to date");
  }
}
