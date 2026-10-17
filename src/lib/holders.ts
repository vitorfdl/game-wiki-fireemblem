import { CHARACTERS } from "./data.ts";
import { joinSection, P3_JOINERS, salvationArmy } from "./part-army.ts";
import { PART_HOME } from "./parts.ts";
import { routeUnits } from "./walkthrough/builds.ts";
import type { RouteName, Stage } from "./types.ts";

/*
 * Who carries which item, and when, on one route (D-135): every build stage's weapons and equipment as a window on
 * the campaign scale (Part I 1–12, War 13–18, Sections 19–24). The kit cards use it to tag each alternative as spare
 * or "held by" another unit at the same time, so a missing item never leaves you without a known fallback.
 */

export type Hold = { unit: string; from: number; to: number; situational: boolean };

/** "Hexlock Shield +2" and "Hexlock Shield" are the same copy for this purpose. */
const itemKey = (n: string) => n.replace(/\s*\(.*\)$/, "").replace(/\s+\+\d+$/, "").trim().toLowerCase();

const cache = new Map<RouteName, Map<string, Hold[]>>();

function add(out: Map<string, Hold[]>, unit: string, stage: Stage, from: number, to: number) {
  for (const g of [...(stage.weapons ?? []), ...(stage.equipment ?? [])]) {
    const k = itemKey(g.item);
    const list = out.get(k) ?? out.set(k, []).get(k)!;
    list.push({ unit, from, to, situational: Boolean(g.situational) });
  }
}

export function holders(route: RouteName): Map<string, Hold[]> {
  const hit = cache.get(route);
  if (hit) return hit;
  const out = new Map<string, Hold[]>();
  const named = new Set<string>();
  for (const u of routeUnits(route)) {
    named.add(u.name);
    u.stages.forEach((ps, i) => {
      const next = u.stages[i + 1]?.pos ?? 99;
      add(out, u.name, ps.stage, ps.pos, Math.max(next, ps.pos + 1));
    });
  }
  // Part III joiners belong to the Salvation army, which lives on Theodora's route (D-118).
  if (route === PART_HOME) {
    const joiners = [...P3_JOINERS, ...salvationArmy().filter((u) => u.origin === "joiner").map((u) => u.name)];
    for (const n of new Set(joiners)) {
      if (named.has(n)) continue;
      const stages = CHARACTERS[n]?.guide?.stages ?? [];
      const at = stages.map((s) => 18 + (s.from?.part === 3 && s.from.ch ? s.from.ch : joinSection(n)));
      stages.forEach((s, i) => add(out, n, s, at[i], Math.max(at[i + 1] ?? 99, at[i] + 1)));
    }
  }
  cache.set(route, out);
  return out;
}

/** Other units carrying `item` while `unit` is in the window [from, to). */
export function heldBy(route: RouteName, item: string, unit: string, from: number, to: number): Hold[] {
  return (holders(route).get(itemKey(item)) ?? []).filter((h) => h.unit !== unit && h.from < to && from < h.to);
}

/** The window of stage `index` in `unit`'s plan on `route`, or null when the unit has no plan there. */
export function stageWindow(route: RouteName, unit: string, index: number): { from: number; to: number } | null {
  const u = routeUnits(route).find((x) => x.name === unit);
  if (u) {
    const ps = u.stages[index];
    if (!ps) return null;
    return { from: ps.pos, to: Math.max(u.stages[index + 1]?.pos ?? 99, ps.pos + 1) };
  }
  const stages = CHARACTERS[unit]?.guide?.stages;
  const s = stages?.[index];
  if (!s || route !== PART_HOME) return null;
  const at = (
    x: Stage | undefined,
  ) => (x ? 18 + (x.from?.part === 3 && x.from.ch ? x.from.ch : joinSection(unit)) : 99);
  return { from: at(s), to: Math.max(at(stages[index + 1]), at(s) + 1) };
}
