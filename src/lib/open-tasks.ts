import {
  chapterFile,
  chapterQuestIds,
  dayOf,
  effectiveDue,
  examsFor,
  expiring,
  ids,
  itemKey,
  missableId,
  quest,
  recruitGate,
  setAsideQuests,
} from "./chapter.ts";
import { markDone, markSeen, nowChapter, wasSeen } from "./track.ts";
import type { Missable, RouteName } from "./types.ts";
import { isClass } from "./refs.ts";
import { newGear, routeUnits } from "./walkthrough/builds.ts";

/**
 * Carry-forward (D-139, docs/specs/walkthrough-carry-forward.md): every tracked Part I task with the chapter that
 * plans it, its effective due date and the task it waits for. A task shows in its own chapter and in every later
 * chapter until ticked; a dated one stops after its due date and shows once as "missed?". The list is built once per
 * route; only the done filter runs on each tick.
 */
export type TaskKind = "exam" | "recruit" | "unique" | "kit" | "quest" | "missable" | "dungeon";

type Base = {
  id: string;
  /** The chapter that plans it. */
  start: number;
  /** Effective due date ("6/15"), for quests and dated missables. */
  due?: string;
  /** Undated missables: lost once their own chapter ends. */
  window?: "chapter";
  /** Task ids that must be done first: while any is open the task is a draft. */
  waits: string[];
};

export type Task =
  | Base & { kind: "exam"; unit: string; from?: string; to: string }
  | Base & { kind: "recruit"; unit: string; when?: string }
  | Base & { kind: "unique"; unit: string; item: string }
  | Base & { kind: "kit"; unit: string; item: string; gear: "Weapon" | "Equipment" }
  | Base & { kind: "quest"; quest: string }
  | Base & { kind: "missable"; m: Missable }
  | Base & { kind: "dungeon"; text: string };

const CACHE = new Map<RouteName, { list: Task[]; byId: Map<string, Task> }>();

function build(route: RouteName): { list: Task[]; byId: Map<string, Task> } {
  const list: Task[] = [];
  const byId = new Map<string, Task>();
  const add = (t: Task) => {
    if (byId.has(t.id)) return;
    byId.set(t.id, t);
    list.push(t);
  };
  const recruitId = (unit: string) =>
    recruitGate(route, unit)?.how === "recruit" ? ids.recruit(route, unit) : undefined;

  // Recruits: chapter rows first (fillers included), then army units with a recruit gate no row names.
  for (let ch = 1; ch <= 12; ch++) {
    for (const r of chapterFile(route, ch)?.recruits ?? []) {
      add({ kind: "recruit", id: ids.recruit(route, r.unit), start: ch, unit: r.unit, when: r.when, waits: [] });
    }
  }
  for (const u of routeUnits(route)) {
    if (u.lord || u.join > 12 || !recruitId(u.name)) continue;
    add({ kind: "recruit", id: ids.recruit(route, u.name), start: u.join, unit: u.name, waits: [] });
  }

  const givenOut = (unit: string, item: string, ch: number) =>
    (chapterFile(route, ch)?.gear.assign ?? []).some((a) => a.to === unit && itemKey(a.item) === itemKey(item));

  // Exams and kit, per unit in stage order: each waits for the latest gate before it (exam, else the recruit).
  for (const u of routeUnits(route)) {
    const rec = u.lord ? undefined : recruitId(u.name);
    let gate = rec;
    const examAt = new Map<number, string>();
    for (let ch = 1; ch <= 12; ch++) {
      for (const e of examsFor(route, ch)) {
        if (e.unit.name !== u.name || e.onJoin || !isClass(e.to)) continue;
        examAt.set(e.index, e.id);
      }
    }
    u.stages.forEach((ps, i) => {
      if (ps.pos > 12) return;
      const exam = examAt.get(i);
      if (exam) {
        const e = examsFor(route, ps.pos).find((x) => x.id === exam)!;
        add({
          kind: "exam",
          id: exam,
          start: ps.pos,
          unit: u.name,
          from: e.from,
          to: e.to,
          waits: gate ? [gate] : [],
        });
        gate = exam;
      }
      for (const x of newGear(ps)) {
        if (x.kind === "Item") continue;
        // A give-out of the same item in the same chapter is the one task for it (D-64): its tick, its row.
        if (givenOut(u.name, x.g.item, ps.pos)) continue;
        add({
          kind: "kit",
          id: ids.kit(route, u.name, x.g.item, i),
          start: ps.pos,
          unit: u.name,
          item: x.g.item,
          gear: x.kind,
          waits: gate ? [gate] : [],
        });
      }
    });
  }

  for (let ch = 1; ch <= 12; ch++) {
    const c = chapterFile(route, ch);
    if (!c) continue;
    for (const a of c.gear.assign ?? []) {
      const rec = recruitId(a.to);
      add({
        kind: "unique",
        id: ids.unique(route, a.item, a.to),
        start: ch,
        unit: a.to,
        item: a.item,
        waits: rec ? [rec] : [],
      });
    }
    // Missables first: a dated-quest missable shares the quest's id and keeps its missable row.
    for (const m of c.missables) {
      const id = missableId(route, m);
      const qDue = m.quest ? quest(m.quest)?.routes[route]?.due : undefined;
      const named = m.when?.match(/\d{1,2}\/\d{1,2}/g)?.at(-1);
      const due = qDue ? effectiveDue(route, qDue) : named ? effectiveDue(route, named) : undefined;
      add({ kind: "missable", id, start: ch, m, due, window: due ? undefined : "chapter", waits: [] });
    }
    for (const q of chapterQuestIds(c)) {
      const due = quest(q)?.routes[route]?.due;
      add({
        kind: "quest",
        id: ids.quest(route, q),
        start: ch,
        quest: q,
        due: due ? effectiveDue(route, due) : undefined,
        waits: [],
      });
    }
    for (const l of c.explore) {
      if (l.loot && l.id) add({ kind: "dungeon", id: l.id, start: ch, text: l.text, waits: [] });
    }
  }
  return { list, byId };
}

function data(route: RouteName) {
  let d = CACHE.get(route);
  if (!d) {
    d = build(route);
    CACHE.set(route, d);
  }
  return d;
}

export const tasks = (route: RouteName): Task[] => data(route).list;
export const taskById = (route: RouteName, id: string): Task | undefined => data(route).byId.get(id);

/** The kit task for a unit's item in the chapter that plans it (for the Gear slot's own cards). */
export function kitTask(route: RouteName, unit: string, item: string, ch: number): Task | undefined {
  return tasks(route).find((t) => t.kind === "kit" && t.unit === unit && t.item === item && t.start === ch);
}

type Done = Record<string, number>;
type Forks = Record<string, string>;

export function isTaskDone(t: Task, done: Done, forks: Forks): boolean {
  if (t.kind === "missable" && t.m.kind === "choice") return Boolean(forks[t.m.id]);
  return Boolean(done[t.id]);
}

/** Open tasks this one waits for (empty: it's live). */
export function waitingOn(route: RouteName, t: Task, done: Done): Task[] {
  return t.waits.filter((w) => !done[w]).flatMap((w) => taskById(route, w) ?? []);
}

/** First day of the free time in force at a chapter (the latest chapter at or before it with free time). */
function dayAt(route: RouteName, ch: number): number | undefined {
  for (let n = ch; n >= 1; n--) {
    const f = chapterFile(route, n)?.free;
    if (f) return dayOf(f.from);
  }
  return undefined;
}

/** "open": still doable in this chapter; "missed": first chapter after its window; "gone": later than that. */
function stateIn(route: RouteName, t: Task, ch: number): "open" | "missed" | "gone" {
  if (t.window === "chapter") return ch === t.start + 1 ? "missed" : ch > t.start + 1 ? "gone" : "open";
  if (!t.due) return "open";
  const d = dayOf(t.due);
  const today = dayAt(route, ch);
  if (today === undefined || today <= d) return "open";
  // Missed in the first chapter whose free time starts after the due date.
  const prev = ch > 1 ? dayAt(route, ch - 1) : undefined;
  return prev === undefined || prev <= d ? "missed" : "gone";
}

export type Carried = { task: Task; missed: boolean; draft: boolean; waits: Task[] };

/**
 * Tasks planned before this chapter that are still open here: not ticked, not set aside by the plan (skipped quests,
 * unpicked fork branches), and inside their window or in the one chapter that flags them "missed?".
 */
export function carriedInto(route: RouteName, ch: number, done: Done, forks: Forks = {}): Carried[] {
  if (ch > 12) return [];
  const aside = setAsideQuests(route, forks);
  return tasks(route).flatMap((t) => {
    if (t.start >= ch || isTaskDone(t, done, forks)) return [];
    if (t.kind === "quest" && aside.has(t.quest)) return [];
    if (t.kind === "missable" && t.m.quest && aside.has(t.m.quest)) return [];
    const s = stateIn(route, t, ch);
    if (s === "gone") return [];
    const waits = waitingOn(route, t, done);
    return [{ task: t, missed: s === "missed", draft: waits.length > 0, waits }];
  });
}

/**
 * The Exit slot (slot 9): this chapter's open missables, earlier missables still in their window or just missed, and
 * the quests whose effective due date falls before the next chapter's free time (`expiring`).
 */
export function exitTasks(route: RouteName, ch: number, done: Done, forks: Forks): { task: Task; missed: boolean }[] {
  const c = chapterFile(route, ch);
  if (!c) return [];
  const own = tasks(route).filter((t) => t.kind === "missable" && t.start === ch && !isTaskDone(t, done, forks));
  const earlier = carriedInto(route, ch, done, forks).filter((x) => x.task.kind === "missable");
  const missQuests = new Set([...own, ...earlier.map((x) => x.task)].map((t) => t.id));
  const quests = expiring(c, forks).flatMap((q) => {
    const t = taskById(route, q.id);
    return t && !done[q.id] && !missQuests.has(q.id) ? [t] : [];
  });
  return [
    ...own.map((task) => ({ task, missed: false })),
    ...earlier.map((x) => ({ task: x.task, missed: x.missed })),
    ...quests.map((task) => ({ task, missed: false })),
  ];
}

/**
 * Gear ticks are new (D-139): the first time a route opens, gear planned before the chapter you are playing counts
 * as in hand, so the carried list starts with what is really open, not every past chapter's kit. Runs once per route.
 */
export function seedKit(route: RouteName): void {
  const key = `kit-seed:${route}`;
  if (wasSeen(key)) return;
  const now = nowChapter(route);
  markDone(tasks(route).filter((t) => t.kind === "kit" && t.start < now).map((t) => t.id));
  markSeen(key);
}
