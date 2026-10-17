import type { Stage } from "./types.ts";

export type Change = "new" | "upgraded" | "kept";

const baseName = (s: string) =>
  s.replace(/\([^)]*\)/g, "").replace(/\s*\+\d+.*$/, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Compares one list of a stage's kit with the previous stage's list of the same kind. */
export function changesFor(current: string[], previous: string[] | undefined): Change[] | undefined {
  if (!previous) return undefined;
  const exact = new Set(previous.map((p) => p.trim().toLowerCase()));
  const bases = new Set(previous.map(baseName));
  return current.map((n) => {
    if (exact.has(n.trim().toLowerCase())) return "kept";
    return bases.has(baseName(n)) ? "upgraded" : "new";
  });
}

const KIT = ["weapons", "equipment", "items", "arts", "spells", "abilities"] as const;

const names = (st: Stage | undefined, key: (typeof KIT)[number]): string[] =>
  ((st?.[key] ?? []) as { item?: string; name?: string }[]).map((x) => x.item ?? x.name ?? "");

/** Everything in the previous stage's kit that's gone now: the stage's own `drop` reasons first, then any unexplained removals. */
export function leftBehind(stage: Stage, previous: Stage | undefined): { item: string; why?: string }[] {
  if (!previous) return stage.drop ?? [];
  const listed = new Map((stage.drop ?? []).map((d) => [baseName(d.item), d]));
  const out = [...(stage.drop ?? [])];
  for (const key of KIT) {
    const now = new Set(names(stage, key).map(baseName));
    for (const n of names(previous, key)) {
      const b = baseName(n);
      if (!now.has(b) && !listed.has(b)) {
        out.push({ item: n });
        listed.set(b, { item: n });
      }
    }
  }
  return out;
}

export function kitChanges(stage: Stage, previous: Stage | undefined) {
  return Object.fromEntries(
    KIT.map((k) => [k, changesFor(names(stage, k), previous ? names(previous, k) : undefined)]),
  ) as Record<
    (typeof KIT)[number],
    Change[] | undefined
  >;
}
