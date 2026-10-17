import { fillerEntry } from "../../lib/data.ts";
import { activeStage, unitPlan } from "../../lib/walkthrough/builds.ts";
import type { RouteName } from "../../lib/types.ts";

/** Where a unit of an army stands at a chapter: its planned class, or why it has none yet. */
export type UnitNow = { cls?: string; note?: string; bench: boolean; filler: boolean; later: boolean };

/** Class a unit holds at `ch` on `route` (derived from its stage plan), for roster tiles and partner rows. */
export function unitNow(route: RouteName, name: string, ch: number): UnitNow {
  const f = fillerEntry(name, route);
  if (f) return { note: f.item ? `Filler · ${f.item}` : "Filler · supports", bench: true, filler: true, later: false };
  const plan = unitPlan(route, name);
  if (!plan) return { bench: false, filler: false, later: false };
  const bench = plan.status === "bench";
  if (ch < plan.join) {
    return { note: `Joins ${plan.estimate ? "~" : ""}Ch ${plan.join}`, bench, filler: false, later: true };
  }
  const hit = activeStage(plan, ch);
  if (!hit) return { note: plan.extra ? "Part II" : undefined, bench, filler: false, later: plan.extra };
  return { cls: hit.cls, bench, filler: false, later: false };
}
