import { deployStatus } from "../../lib/data.ts";
import type { RouteName } from "../../lib/types.ts";
import { routeUnits } from "../../lib/walkthrough/builds.ts";

/**
 * A unit's place in the army as a left border (D-58, same marks as the Army page's Muster): core solid route colour,
 * early or late faded, bench dashed, a second copy with no deploy plan gold, filler dotted.
 */
export const STATUS_BORDER: Record<string, string> = {
  core: "border-l-(--c)",
  early: "border-l-(--c)/45",
  late: "border-l-(--c)/45",
  bench: "border-l-gold/60 border-dashed",
  extra: "border-l-gold-lo/60",
  filler: "border-l-gold/40 border-dotted",
};

export const STATUS_NAME: Record<string, string> = {
  core: "Core",
  early: "Early, then bench",
  late: "Late joiner",
  bench: "Bench",
  extra: "Second copy",
  filler: "Filler",
};

/** Status of a unit in this route's army: the deployment status, "extra" for a second copy, else bench. */
export function unitStatus(route: RouteName, name: string): string {
  const u = routeUnits(route).find((x) => x.name === name);
  if (u?.lord) return "core";
  const dep = deployStatus(name, route)?.status;
  if (dep) return dep;
  if (u?.extra) return "extra";
  return u ? "bench" : "filler";
}
