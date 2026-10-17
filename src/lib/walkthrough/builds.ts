import { char, deployStatus, META } from "../data.ts";
import { primaryClass } from "../growth.ts";
import { kitChanges } from "../snapshot.ts";
import type { KitKind } from "../inventory.ts";
import type { Character, DeployStatus, Gear, RouteName, Stage } from "../types.ts";

export type PlannedStage = {
  stage: Stage;
  /** First Part I chapter of this stage, or null for Part II and III stages. */
  start: number | null;
  /** True when the start chapter is inferred, not written in the plan. */
  approx: boolean;
  prev?: Stage;
  cls: string;
  /**
   * Place on the campaign scale (lib/parts.ts `pos`): Part I chapter = 1–12, Part II Ch N = 12 + N, Part III Section N
   * = 18 + N. A Part III stage without a Section starts in Section 2, the first Free Time with Master exams.
   */
  pos: number;
};

export type UnitPlan = {
  name: string;
  character: Character;
  join: number;
  estimate: boolean;
  extra: boolean;
  lord: boolean;
  status?: DeployStatus;
  stages: PlannedStage[];
};

/** "Ch 6 to 7" -> 6 · "Join (Ch 8) to Lv 20" -> 8 · "Join to Ch 12" -> join chapter · "Part II ..." -> null. */
export function stageStart(when: string, join: number, prev: number | null): { start: number | null; approx: boolean } {
  if (/^Part\b/i.test(when)) return { start: null, approx: false };
  const lead = when.match(/^Ch (\d+)/);
  if (lead) return { start: Math.max(Number(lead[1]), join), approx: false };
  if (/^Join/i.test(when)) {
    const inner = when.match(/\(Ch (\d+)/);
    return { start: inner ? Number(inner[1]) : join, approx: !inner };
  }
  if (/^Lv/i.test(when) && prev !== null) return { start: Math.min(prev + 1, 12), approx: true };
  const any = when.match(/Ch (\d+)/);
  return { start: any ? Math.max(Number(any[1]), join) : prev, approx: true };
}

function plan(stages: Stage[] | undefined, join: number): PlannedStage[] {
  let prevStart: number | null = join;
  return (stages ?? []).map((stage, i, all) => {
    const { start, approx } = stage.from
      ? {
        start: stage.from.part === 1 ? Math.max(stage.from.ch ?? join, join) : null,
        approx: Boolean(stage.from.approx || stage.from.at),
      }
      : stageStart(stage.when, join, prevStart);
    if (start !== null) prevStart = start;
    const part = stage.from?.part ?? (/^Part III\b/i.test(stage.when) ? 3 : /^Part II\b/i.test(stage.when) ? 2 : 1);
    const p = start !== null ? start : part === 3 ? 18 + (stage.from?.ch ?? 2) : 12 + (stage.from?.ch ?? 1);
    return { stage, start, approx, prev: all[i - 1], cls: primaryClass(stage.class) || stage.class || "", pos: p };
  });
}

const cache = new Map<RouteName, UnitPlan[]>();

/** Lord, then the army in join order: home units and second copies (with their own copy plans). */
export function routeUnits(r: RouteName): UnitPlan[] {
  const hit = cache.get(r);
  if (hit) return hit;
  const info = META.routes[r];
  const units: UnitPlan[] = [];
  const lord = char(r);
  if (lord) {
    units.push({
      name: r,
      character: lord,
      join: 1,
      estimate: false,
      extra: false,
      lord: true,
      status: deployStatus(r, r)?.status,
      stages: plan(lord.guide?.stages, 1),
    });
  }
  for (const u of info.roster) {
    const c = char(u.name);
    if (!c) continue;
    units.push({
      name: u.name,
      character: c,
      join: u.chapter,
      estimate: u.estimate,
      extra: false,
      lord: false,
      status: deployStatus(u.name, r)?.status,
      stages: plan(c.guide?.stages, u.chapter),
    });
  }
  for (const n of info.extras) {
    const c = char(n);
    const copy = c?.copies?.find((x) => x.route === r);
    if (!c || !copy) continue;
    units.push({
      name: n,
      character: c,
      join: copy.chapter,
      estimate: true,
      extra: true,
      lord: false,
      status: deployStatus(n, r)?.status,
      stages: plan(copy.guide?.stages, copy.chapter),
    });
  }
  // One army in join order: second copies sit with the chapter they join in, not in a group of their own.
  units.sort((a, b) => Number(b.lord) - Number(a.lord) || a.join - b.join);
  cache.set(r, units);
  return units;
}

/** A unit outside every route's army (a Part III joiner): its own guide, joining at a campaign position. */
export function loosePlan(c: Character, join: number): UnitPlan {
  return {
    name: c.name,
    character: c,
    join,
    estimate: false,
    extra: false,
    lord: false,
    stages: plan(c.guide?.stages, join),
  };
}

/** Short start label for a stage: "Ch 6", "Part II Ch 3", "Part III". */
export const stageLabel = (ps: PlannedStage): string =>
  ps.start !== null
    ? `Ch ${ps.start}`
    : ps.stage.from?.part === 3
    ? "Part III"
    : ps.stage.from?.part === 2
    ? `Part II${ps.stage.from.ch ? ` Ch ${ps.stage.from.ch}` : ""}`
    : ps.stage.when;

export function unitPlan(r: RouteName, name: string): UnitPlan | undefined {
  return routeUnits(r).find((u) => u.name === name);
}

/**
 * The stage a unit is in at a point of the campaign: a Part I chapter (1–12) or a later position (lib/parts.ts `pos`).
 * Part I chapters never reach a Part II or III stage.
 */
export function activeStage(u: UnitPlan, chapter: number): PlannedStage | undefined {
  if (chapter < u.join) return undefined;
  let hit: PlannedStage | undefined;
  for (const s of u.stages) if (s.pos <= chapter) hit = s;
  return hit;
}

export type GearChange = { g: Gear; kind: KitKind; change: string };
export type Checkpoint = { unit: UnitPlan; stages: PlannedStage[]; gear: GearChange[] };

/**
 * Units that start a new build stage in this chapter, with the gear that is new or upgraded there.
 * A unit that passes through two classes in one chapter (Beginner, then Specialty) shows once.
 */
export function checkpoints(r: RouteName, chapter: number): Checkpoint[] {
  return routeUnits(r).flatMap((unit) => {
    const stages = unit.stages.filter((ps) => ps.pos === chapter);
    if (!stages.length) return [];
    const gear = new Map<string, GearChange>();
    for (const ps of stages) for (const x of newGear(ps)) gear.set(x.g.item, x);
    return [{ unit, stages, gear: [...gear.values()] }];
  });
}

export function newGear(ps: PlannedStage) {
  const ch = kitChanges(ps.stage, ps.prev);
  return [
    ...(ps.stage.weapons ?? []).map((g, i) => ({ g, kind: "Weapon" as const, change: ch.weapons?.[i] ?? "new" })),
    ...(ps.stage.equipment ?? []).map((g, i) => ({
      g,
      kind: "Equipment" as const,
      change: ch.equipment?.[i] ?? "new",
    })),
    ...(ps.stage.items ?? []).map((g, i) => ({ g, kind: "Item" as const, change: ch.items?.[i] ?? "new" })),
  ].filter((x) => x.change !== "kept");
}

/** Units who join the army in this chapter (roster and extras). */
export function joiners(r: RouteName, chapter: number): UnitPlan[] {
  return routeUnits(r).filter((u) => !u.lord && u.join === chapter);
}
