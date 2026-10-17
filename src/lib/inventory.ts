import type { Gear, Stage } from "./types.ts";

/** Every unit carries at most 6 items: weapons, consumables and equipped shields, accessories and masks all count. */
export const INVENTORY_CAP = 6;

export type KitKind = "Weapon" | "Equipment" | "Item";

/** A stage's carried kit in display order: weapons, equipment, then consumables. */
export function kitRows(st: Stage): { g: Gear; kind: KitKind }[] {
  return [
    ...(st.weapons ?? []).map((g) => ({ g, kind: "Weapon" as const })),
    ...(st.equipment ?? []).map((g) => ({ g, kind: "Equipment" as const })),
    ...(st.items ?? []).map((g) => ({ g, kind: "Item" as const })),
  ];
}

/** Core items count toward the 6; situational ones are swaps that replace a core item on the maps that need them. */
export function inventory(st: Stage) {
  const rows = kitRows(st);
  const core = rows.filter((r) => !r.g.situational).length;
  return { core, swaps: rows.length - core, cap: INVENTORY_CAP };
}
