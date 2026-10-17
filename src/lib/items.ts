import items from "../../research/weapons-and-items.json" with { type: "json" };

type Row = { name: string; weight?: number | null; wt?: number | null; kind?: string };
const all = [
  ...((Array.isArray(items.weapons) ? items.weapons : Object.values(items.weapons).flat()) as Row[]),
  ...(items.equipment as Row[]),
];
const WEIGHT = new Map<string, number>();
for (const r of all) {
  const w = r.weight ?? r.wt;
  if (typeof w === "number") WEIGHT.set(r.name.toLowerCase(), w);
}

/** Item weight from the local item list ("Ji +3" counts as Ji); undefined when no source gives it. */
export function itemWeight(name: string): number | undefined {
  return WEIGHT.get(name.replace(/\s*\+\d+$/, "").trim().toLowerCase());
}
