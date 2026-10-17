import { CLASSES, ITEM_TIERS } from "./data.ts";
import type { ClassRow, Finalists, Stage, Stat, StatLine } from "./types.ts";

const CLASS_ALIAS: Record<string, string> = {
  "Commoner": "Commoner/Noble",
  "Noble": "Commoner/Noble",
  "Sword Master": "Swordmaster",
  "Wise Man": "Wiseman",
};
const BASE_CLASSES = new Set(Object.keys(CLASSES).filter((k) => !k.includes("(")));
const TIER_OF: Record<string, string> = Object.fromEntries(
  Object.entries(CLASSES).map(([k, v]) => [k.replace(/\(.*$/, ""), v.tier]),
);

export function stripParens(s: string | undefined): string {
  let out = s ?? "";
  let prev;
  do {
    prev = out;
    out = out.replace(/\([^()]*\)/g, "");
  } while (out !== prev);
  return out.replace(/\s+/g, " ").trim();
}

/** "Commoner, then Ornius Rider (automatic in Ch 5)" -> "Ornius Rider". Falls back to the raw text. */
export function primaryClass(raw: string | undefined): string {
  const parts = stripParens(raw)
    .split(/,\s*then\s+|\s+then\s+|\s+or\s+|\s*>\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const known = parts.map((p) => CLASS_ALIAS[p] ?? p).filter((p) => BASE_CLASSES.has(p));
  const real = known.filter((p) => p !== "Commoner/Noble");
  const pick = real[0] ?? known[0] ?? parts[0] ?? "";
  return pick === "Commoner/Noble" ? "Commoner" : pick;
}

/** Short mount name from a free-text mount note; "same ..." keeps the previous stage's mount. */
export function mountOf(raw: string | undefined, prev: string | null): string | null {
  const s = raw ?? "";
  if (!s || /^(default|no )/i.test(s)) return null;
  if (/^same/i.test(s)) return prev;
  return stripParens(s).split(/,|\s+or\s+|:/)[0].trim() || null;
}

export type GrowthRow = { key: string; row: ClassRow; mounted: boolean; tier: string };

/** Class growth row for a stage, including the Charioteer/Elephant level steps and the ridden mount. */
export function growthRow(stage: Stage, mount: string | null): GrowthRow | null {
  const cls = CLASS_ALIAS[primaryClass(stage.class)] ?? primaryClass(stage.class);
  let key = cls;
  if (cls === "Charioteer" || cls === "Elephant Rider") {
    const level = stage.level ?? "";
    const first = Number(level.match(/\d+/)?.[0] ?? 0);
    const at = /Lv 45/.test(level) ? 45 : first;
    if (at >= 45) key += "(Master)";
    else if (at >= 35 && cls === "Charioteer") key += "(Advanced)";
  }
  if (mount) {
    const want = mount.toLowerCase();
    const hit = Object.keys(CLASSES).find((k) =>
      k.startsWith(`${key}(`) && k.slice(key.length + 1).toLowerCase().startsWith(want)
    );
    if (hit) return { key: hit, row: CLASSES[hit], mounted: true, tier: tierOf(hit) };
  }
  const row = CLASSES[key];
  return row ? { key, row, mounted: false, tier: tierOf(key) } : null;
}

function tierOf(key: string): string {
  return key.match(/\((Advanced|Master)\)/)?.[1] ?? CLASSES[key]?.tier ?? TIER_OF[key.replace(/\(.*$/, "")] ?? "";
}

export function classTier(name: string): string {
  return TIER_OF[CLASS_ALIAS[name] ?? name] ?? "";
}

/** "Charioteer(Advanced)(Rocinan (Io's mount))" -> "Charioteer · Advanced · Rocinan (Io's mount)" */
export function rowLabel(key: string): string {
  const base = key.replace(/\(.*$/, "");
  const rest = [...key.slice(base.length).matchAll(/\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1].trim());
  return [base, ...rest].join(" · ");
}

export function itemTier(name: string): string {
  const base = name.replace(/\s*\+\d.*$/, "").replace(/\s*\(.*$/, "").trim();
  return ITEM_TIERS[base] ?? "";
}

/** True for a class name as the walkthroughs write it ("Sword Master", "Armored Ornius Rider"). */
export function isClassName(name: string): boolean {
  const n = name.trim();
  return BASE_CLASSES.has(CLASS_ALIAS[n] ?? n);
}

/**
 * What a growth rate means over levels: expected gain per 5 levels, and the gain over 10 levels below which the unit
 * is behind (one standard deviation under the mean, binomial). Growth past 100% counts as a sure point.
 */
export function growthOdds(growth: number): { per5: number; behind10: number } {
  const p = Math.max(0, Math.min(1, growth / 100));
  const mean = 10 * p;
  const sd = Math.sqrt(10 * p * (1 - p));
  return { per5: Math.round(5 * p * 2) / 2, behind10: Math.max(0, Math.round(mean - sd)) };
}

/** Mount in effect at a stage: "same mount" notes carry the previous one forward. */
export function mountAt(stages: Stage[], index: number): string | null {
  let prev: string | null = null;
  for (let i = 0; i <= index; i++) prev = mountOf(stages[i].mount, prev);
  return prev;
}

export type FinalistRow = Finalists["options"][number] & {
  /** classes.json key used (mounted row when the mount matches), or null when the class has no row. */
  key: string | null;
  /** Effective growth per chosen stat: personal + class (+ mount) row. */
  growth: Partial<Record<Stat, number>>;
};

/** Effective growth % (personal + class row, mounted when `mount` matches) for the given stats. */
export function finalistGrowth(
  growths: StatLine,
  cls: string,
  mount: string | undefined,
  stats: Stat[],
): { key: string | null; growth: Partial<Record<Stat, number>> } {
  const g = growthRow({ when: "", class: cls, level: "" }, mount ?? null);
  const growth: Partial<Record<Stat, number>> = {};
  for (const s of stats) growth[s] = growths[s] + (g?.row[s] ?? 0);
  return { key: g?.key ?? null, growth };
}

/**
 * Finalist rows with their growths, plus the best value per stat across the rows (ties all count as best). A stat
 * where every row is equal has no best: nothing to pick between.
 */
export function finalistTable(
  growths: StatLine,
  f: Finalists,
): { rows: FinalistRow[]; best: Partial<Record<Stat, number>> } {
  const rows = f.options.map((o) => ({ ...o, ...finalistGrowth(growths, o.class, o.mount, f.stats) }));
  const best: Partial<Record<Stat, number>> = {};
  for (const s of f.stats) {
    const vals = rows.map((r) => r.growth[s] ?? -Infinity);
    const top = Math.max(...vals);
    if (vals.some((v) => v !== top)) best[s] = top;
  }
  return { rows, best };
}
