import { CHARACTERS, META } from "./data.ts";
import { QUESTS } from "./refs.ts";
import { examRanks } from "./refs.ts";
import type { ChapterFile, Filler, Missable, Quest, RouteName, StageKind } from "./types.ts";
import { type GearChange, newGear, type PlannedStage, routeUnits, type UnitPlan } from "./walkthrough/builds.ts";

/**
 * Chapter files (redesign/03-data-model.md §2) and everything a chapter derives from unit JSON, the quest
 * catalog and the route ledger. Chapters without a JSON file still render from Markdown.
 */
const modules = import.meta.glob<ChapterFile>("../data/walkthrough/*/ch*.json", { eager: true, import: "default" });

const BY_ROUTE = new Map<RouteName, Map<number, ChapterFile>>();
for (const c of Object.values(modules)) {
  if (!BY_ROUTE.has(c.route)) BY_ROUTE.set(c.route, new Map());
  BY_ROUTE.get(c.route)!.set(c.ch, c);
}

export function chapterFile(route: RouteName, ch: number): ChapterFile | undefined {
  return BY_ROUTE.get(route)?.get(ch);
}

export const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 48);

/** An item name without its refine suffix ("Iron Sword +2" -> "iron sword"): matches a build's gear to a give-out. */
export const itemKey = (s: string) => s.toLowerCase().replace(/\s*\+\d+$/, "").trim();

/* ------------------------------------------------------------ ids (03-data-model.md §8) */

export const ids = {
  recruit: (r: RouteName, unit: string) => `${slug(r)}-recruit-${slug(unit)}`,
  exam: (r: RouteName, unit: string, cls: string, i: number) => `${slug(r)}-exam-${slug(unit)}-${slug(cls)}-${i}`,
  quest: (r: RouteName, quest: string) => `${slug(r)}-quest-${quest}`,
  row: (r: RouteName, ch: number, slot: string, s: string) =>
    `${slug(r)}-ch${String(ch).padStart(2, "0")}-${slot}-${slug(s)}`,
  unique: (r: RouteName, item: string, unit: string) => `${slug(r)}-unique-${slug(item)}-${slug(unit)}`,
  /** A build stage's weapon or worn piece in hand (D-139). */
  kit: (r: RouteName, unit: string, item: string, stage: number) =>
    `${slug(r)}-kit-${slug(unit)}-${slug(item)}-${stage}`,
};

/* ------------------------------------------------------------ classes */

export type Exam = {
  unit: UnitPlan;
  stage: PlannedStage;
  index: number;
  from?: string;
  to: string;
  ranks: string[];
  kind: StageKind;
  /** First stage of a recruit: it arrives already classed; the exam is only needed if it arrives in another class. */
  onJoin: boolean;
  id: string;
};

/** Per-route derived data never changes at run time: compute once. */
function cached<T>(store: Map<string, T>, key: string, make: () => T): T {
  let v = store.get(key);
  if (v === undefined) {
    v = make();
    store.set(key, v);
  }
  return v;
}
const EXAMS = new Map<string, Exam[]>();
const KITS = new Map<string, { unit: UnitPlan; gear: GearChange[] }[]>();
const EVENTS = new WeakMap<ChapterFile, string[]>();

/** Class changes that start in this chapter, one row per unit and class. */
export function examsFor(route: RouteName, ch: number): Exam[] {
  return cached(EXAMS, `${route}:${ch}`, () => computeExams(route, ch));
}

function computeExams(route: RouteName, ch: number): Exam[] {
  const out: Exam[] = [];
  for (const unit of routeUnits(route)) {
    unit.stages.forEach((ps, i) => {
      if (ps.pos !== ch) return;
      const prev = unit.stages.slice(0, i).at(-1);
      const to = ps.cls;
      if (!to || (prev && prev.cls === to)) return;
      if (unit.lord && i === 0) return;
      const onJoin = i === 0 && !unit.lord;
      // Joins and takes an exam in the same chapter: one card (join class → exam class), not two.
      if (onJoin && unit.stages.slice(1).some((x) => x.pos === ch && x.cls && x.cls !== to)) return;
      out.push({
        unit,
        stage: ps,
        index: i,
        from: prev?.cls,
        to,
        ranks: examRanks(to),
        kind: ps.stage.kind ?? "core",
        onJoin,
        id: ids.exam(route, unit.name, to, i),
      });
    });
  }
  return out;
}

/** Ranks the units should keep training in a chapter with no exams (from the current stages' `training`). */
export function trainingFor(route: RouteName, ch: number): { unit: string; ranks: string[] }[] {
  return routeUnits(route).flatMap((u) => {
    const ps = u.stages.filter((s) => s.pos <= ch).at(-1);
    if (!ps || u.join > ch) return [];
    const ranks = (ps.stage.training ?? []).map((t) => t.rank);
    return ranks.length ? [{ unit: u.name, ranks }] : [];
  });
}

/* ------------------------------------------------------------ gear */

export function kitFor(route: RouteName, ch: number): { unit: UnitPlan; gear: GearChange[] }[] {
  return cached(KITS, `${route}:${ch}`, () => computeKit(route, ch));
}

function computeKit(route: RouteName, ch: number): { unit: UnitPlan; gear: GearChange[] }[] {
  return routeUnits(route).flatMap((unit) => {
    const stages = unit.stages.filter((ps) => ps.pos === ch);
    if (!stages.length) return [];
    const gear = new Map<string, GearChange>();
    for (const ps of stages) for (const x of newGear(ps)) if (x.kind !== "Item") gear.set(x.g.item, x);
    return gear.size ? [{ unit, gear: [...gear.values()] }] : [];
  });
}

/* ------------------------------------------------------------ recruits */

export function joinsIn(route: RouteName, ch: number): UnitPlan[] {
  return routeUnits(route).filter((u) => !u.lord && u.join === ch);
}

/** A unit's recruit gate on a route: army units, extras and fillers alike (fillers aren't in routeUnits). */
export function recruitGate(route: RouteName, unit: string) {
  return (routeUnits(route).find((u) => u.name === unit)?.character ?? CHARACTERS[unit])?.recruitOn?.[route];
}

/**
 * The chapter a filler can be recruited: "Ch N" in its `when`, else the chapter whose recruit row names it, else the
 * first chapter whose Renown pace reaches its Renown gate.
 */
export function fillerChapter(route: RouteName, f: Filler): number {
  const named = f.when.match(/Ch (\d+)/)?.[1];
  if (named) return Number(named);
  for (const c of BY_ROUTE.get(route)?.values() ?? []) if (c.recruits.some((r) => r.unit === f.name)) return c.ch;
  const renown = recruitGate(route, f.name)?.renown ?? Number(f.when.match(/Renown (\d+)/)?.[1] ?? NaN);
  const pace = META.routes[route].ledger?.renownPace ?? [];
  const hit = Number.isFinite(renown) ? [...pace].sort((a, b) => a.ch - b.ch).find((p) => p.to >= renown) : undefined;
  return hit?.ch ?? 12;
}

/* ------------------------------------------------------------ deployment */

/**
 * Who deploys in a chapter's battle: the lineup holders whose span covers the chapter (D-33/D-49), else the phase's
 * list; never a unit before it joins. `slots` is the phase's slot count when known, else the holder count.
 */
export function deployFor(route: RouteName, ch: number): { units: string[]; slots: number } | undefined {
  const dep = META.routes[route].deployment;
  const joined = (n: string) => {
    const u = routeUnits(route).find((x) => x.name === n);
    return !u || u.lord || u.join <= ch;
  };
  const phase = phaseFor(route, ch);
  const lineup = dep?.lineup ?? [];
  if (lineup.length) {
    const units = [...new Set(lineup.flatMap((slot) =>
      slot.holders.filter((h) => h.from <= ch && (h.to ?? 12) >= ch).map((h) => h.unit)
    ))].filter(joined);
    if (units.length) return { units, slots: phase?.slots ?? units.length };
  }
  if (!phase) return undefined;
  return { units: phase.deploy.filter(joined), slots: phase.slots };
}

export function phaseFor(route: RouteName, ch: number) {
  return META.routes[route].deployment?.phases.find((p) =>
    p.from !== undefined && p.to !== undefined && ch >= p.from && ch <= p.to
  );
}

/* ------------------------------------------------------------ dates */

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const dayOf = (d: string): number => {
  const [m, day] = d.split("/").map(Number);
  return DAYS.slice(0, m - 1).reduce((a, b) => a + b, 0) + day;
};

export function freeDays(free: ChapterFile["free"]): number {
  if (!free) return 0;
  return dayOf(free.to) - dayOf(free.from) + 1;
}

/* ------------------------------------------------------------ quests */

export function quest(id: string): Quest | undefined {
  return QUESTS[id];
}

/** Quest ids referenced by a chapter, in slot order. */
export function chapterQuestIds(c: ChapterFile): string[] {
  return [...c.quests.route, ...c.quests.sub, ...c.quests.paralogue].map((q) => q.quest);
}

/**
 * Deadlines that land between this chapter's free time and the next one's: what slot 9 lists while unticked.
 * Covers every quest the chapters up to this one list, so a quest from an earlier chapter still shows in the chapter
 * where it expires; catalog quests no chapter plans for stay out.
 * Uses the effective due date (calendar gaps, Part I end) and leaves out skipped quests and unpicked fork branches.
 */
export function expiring(
  c: ChapterFile,
  forks: Record<string, string> = {},
): { id: string; quest: string; label: string; due: string; kind: Quest["kind"] }[] {
  const next = chapterFile(c.route, c.ch + 1);
  const start = c.free ? dayOf(c.free.from) : 0;
  const limit = next?.free ? dayOf(next.free.from) : c.free ? dayOf(c.free.to) + 1 : 0;
  const prevFree = chapterFile(c.route, c.ch - 1)?.free;
  const prevEnd = prevFree ? dayOf(prevFree.to) : undefined;
  const aside = setAsideQuests(c.route, forks);
  const planned = plannedQuests(c.route, c.ch);
  return Object.values(QUESTS).flatMap((q) => {
    const r = q.routes[c.route];
    if (!r?.due || r.ch > c.ch || aside.has(q.id) || !planned.has(q.id)) return [];
    const due = effectiveDue(c.route, r.due);
    const d = dayOf(due);
    // A date shared by two free times (Ch 7 ends 6/15, Ch 8 starts 6/15) belongs to the earlier one.
    const inside = c.free ? d <= dayOf(c.free.to) : false;
    if (d < start || (!inside && d >= limit) || (prevEnd !== undefined && d <= prevEnd)) return [];
    return [{ id: ids.quest(c.route, q.id), quest: q.id, label: q.name, due, kind: q.kind }];
  }).sort((a, b) => dayOf(a.due) - dayOf(b.due));
}

/* ------------------------------------------------------------ header index */

export function chapterIndex(c: ChapterFile) {
  const exams = examsFor(c.route, c.ch);
  return {
    missables: c.missables.length,
    deadlines: expiring(c).length,
    recruits: c.recruits.length + joinsIn(c.route, c.ch).length,
    exams: exams.filter((e) => !e.onJoin).length,
  };
}

/** Every tracked event of a chapter, for its progress ring and "chapter done". */
export function chapterEvents(c: ChapterFile): string[] {
  const hit = EVENTS.get(c);
  if (hit) return hit;
  const r = c.route;
  const out = [...new Set([
    ...c.missables.map((m) => missableId(r, m)),
    ...examsFor(r, c.ch).filter((e) => !e.onJoin).map((e) => e.id),
    ...c.recruits.map((x) => ids.recruit(r, x.unit)),
    ...chapterQuestIds(c).map((q) => ids.quest(r, q)),
    ...c.explore.filter((l) => l.loot && l.id).map((l) => l.id!),
  ])];
  EVENTS.set(c, out);
  return out;
}

/* ------------------------------------------------------------ text */

/**
 * A stage's exit condition under a "Leave when" label: drops the leading "Leave", "Leave when/once/at" the label
 * already says, and stray " ." left by authored text. Empty when nothing is left.
 */
export function exitText(t: string | undefined): string {
  if (!t) return "";
  const s = t.replace(/^\s*leave(?:\s+(?:when|once|at|after))?\s*[:,–-]?\s*/i, "").replace(/\s+\./g, ".").trim();
  if (!s || s === ".") return "";
  return s[0].toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------ missables and exit lists */

/** A missable's checkbox: the quest's when the missable is a dated quest (one checkbox for both rows). */
export const missableId = (route: RouteName, m: Missable): string => (m.quest ? ids.quest(route, m.quest) : m.id);

type Calendar = { gaps: { from: number; to: number; cap: string }[]; end?: string };
const CAL = new Map<RouteName, Calendar>();

/** Stretches without free time between chapters, and the last free day of Part I. */
function calendar(route: RouteName): Calendar {
  return cached(CAL, route, () => {
    const free = [...(BY_ROUTE.get(route)?.values() ?? [])].sort((a, b) => a.ch - b.ch).flatMap((c) => (c.free ? [c.free] : []));
    const gaps = free.slice(1).map((f, i) => ({ from: dayOf(free[i].to), to: dayOf(f.from), cap: free[i].to }))
      .filter((g) => g.to - g.from > 1);
    return { gaps, end: free.at(-1)?.to };
  });
}

/**
 * The day a quest really has to be done by on a route: a due date inside a stretch without free time (Leda 9/1 to
 * 9/28) means the last free day before it; nothing is due after the last free day of Part I.
 */
export function effectiveDue(route: RouteName, due: string): string {
  const cal = calendar(route);
  const d = dayOf(due);
  for (const g of cal.gaps) if (d > g.from && d < g.to) return g.cap;
  if (cal.end && d > dayOf(cal.end)) return cal.end;
  return due;
}

/**
 * Quests no exit list should ask for: the plan's `skip` rows, and the quests of a choice's options other than the
 * picked one (the pick you ticked, else the option the missable's text names after "pick").
 */
export function setAsideQuests(route: RouteName, forks: Record<string, string>): Set<string> {
  const out = new Set<string>();
  for (const c of BY_ROUTE.get(route)?.values() ?? []) {
    for (const q of [...c.quests.route, ...c.quests.sub, ...c.quests.paralogue]) if (q.skip) out.add(q.quest);
    for (const m of c.missables) {
      if (!m.options?.length) continue;
      const pick = forks[m.id] ?? m.options.find((o) => new RegExp(`\\bpick ${o.pick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(m.text))?.pick;
      if (!pick) continue;
      for (const o of m.options) {
        if (o.pick === pick) continue;
        for (const q of o.quests ?? []) out.add(q);
        const byName = Object.values(QUESTS).find((q) => q.name.toLowerCase() === o.pick.toLowerCase() && q.routes[route]);
        if (byName) out.add(byName.id);
      }
    }
  }
  return out;
}

const PLANNED = new Map<string, Set<string>>();
/** Quest ids that the chapter files up to `ch` list in their Quests slot. */
function plannedQuests(route: RouteName, ch: number): Set<string> {
  return cached(PLANNED, `${route}:${ch}`, () =>
    new Set([...(BY_ROUTE.get(route)?.values() ?? [])].filter((c) => c.ch <= ch).flatMap(chapterQuestIds)));
}
