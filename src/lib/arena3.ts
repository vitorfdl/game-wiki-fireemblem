import { P3, pos } from "./parts.ts";
import {
  battleSkills,
  type Course,
  COURSE_NAMES,
  inCourse,
  parseTargets,
  RANK_EXP,
  rankIdx,
  RANKS,
  ranksIn,
  skillName,
  START_RANK,
  weaponRank,
} from "./arena.ts";
import { examRanks } from "./refs.ts";
import { reportedRank3 } from "./track.ts";
import { notPlanned, p3Plan, salvationArmy, squadOf } from "./part-army.ts";
import type { PlannedStage, UnitPlan } from "./walkthrough/builds.ts";

/*
 * Part III Arena (D-159). Same courses and pairing rules as Part I (D-136, D-140), on the Salvation army and the
 * Section calendar: targets come from every Part III stage still ahead (class exams, Divine S, weapon ranks, rank
 * abilities, training rows), ranks held from what you set (or the best Part I report), else the classes the unit
 * has held. Only units inside Dagsion train, so the bench always can and squad members only on weeks their squad ends
 * in Dagsion.
 */

export const ARENA3_OPENS = 2;
const DIVINE = /^The (Trident|Eternal|Avatar|Godhand|Calamity|Blade|Cavalier|Apsara)$/;

/** Arena weeks per Section: Free Time plus Mission Time days, a week each (approximate). */
export function weeksIn(n: number): number {
  const s = P3.sections.find((x) => x.n === n);
  if (!s?.free_time) return 0;
  const day = (d: string) => {
    const [m, dd] = d.split("/").map(Number);
    return (m - 1) * 31 + dd;
  };
  const end = s.mission_time?.to ?? s.free_time.to;
  return Math.max(1, Math.floor((day(end) - day(s.free_time.from) + 1) / 7));
}
/** Arena weeks from the start of Section `from` to the end of Section `to`. */
const weeksBetween = (from: number, to: number) => {
  let w = 0;
  for (let n = from; n <= to; n++) w += weeksIn(n);
  return w;
};

export type P3Kind = "divine" | "exam" | "weapon" | "ability" | "training";
const KIND_WEIGHT: Record<P3Kind, number> = { divine: 1.6, exam: 1.3, weapon: 1, ability: 0.7, training: 0.8 };

export type P3Need = {
  skill: string;
  rank: string;
  own: string;
  /** "p3": set for Part III · "p1": best Part I report · undefined: estimate from classes held. */
  source?: "p3" | "p1";
  /** Section the rank is due by. */
  due: number;
  kind: P3Kind;
  for: string;
  later?: string;
  boon: boolean;
  bane: boolean;
  /** The unit fights with this skill in a squad this Section: battles add EXP too. */
  battle: boolean;
  /** Arena EXP still needed, and whether even the best Arena weeks left can't cover it (battle and Boons must). */
  exp: number;
  short: boolean;
};

export type P3Trainee = {
  unit: UnitPlan;
  cls: string;
  /** Squad letter this Section, "bench", or undefined (not seated yet). */
  squad?: string;
  needs: P3Need[];
};

export type P3Session = {
  course: Course;
  a: P3Trainee;
  b?: P3Trainee;
  partner?: { unit: UnitPlan; why: string };
  next?: P3Trainee[];
};

const has = (list: string[] | undefined, skill: string) => (list ?? []).some((x) => skillName(x) === skill);

/** EXP from one rank to another (RANK_EXP steps). */
function expBetween(from: string, to: string): number {
  let sum = 0;
  for (let i = rankIdx(from); i < rankIdx(to); i++) sum += RANK_EXP[i]?.[1] ?? 0;
  return sum;
}

const activeAt = (u: UnitPlan, p: number): PlannedStage | undefined => {
  let hit: PlannedStage | undefined;
  for (const s of u.stages) if (s.pos <= p) hit = s;
  return hit;
};
const sectionOf = (s: PlannedStage) => Math.max(ARENA3_OPENS, s.pos - 18);

/**
 * Rank a unit holds in a skill at Section n: what you set for Part III, else the best Part I report, else the highest
 * exam rank of a class it has held by then (classes need their ranks), never below D.
 */
export function held3(u: UnitPlan, skill: string, n: number): { rank: number; source?: "p3" | "p1" } {
  const told = reportedRank3(u.name, skill);
  let best = rankIdx(START_RANK);
  for (const s of u.stages) {
    if (s.pos >= pos(3, n)) break;
    for (const t of parseTargets(examRanks(s.cls).join(", "))) {
      if (t.skill === skill) best = Math.max(best, rankIdx(t.rank));
    }
  }
  if (told?.p3) return { rank: rankIdx(told.rank), source: "p3" };
  if (told && rankIdx(told.rank) >= best) return { rank: rankIdx(told.rank), source: "p1" };
  return { rank: best };
}

/** Every Arena-trainable target a unit has open at Section n, nearest Section first; one per skill. */
function needs3(u: UnitPlan, n: number, squad?: string): P3Need[] {
  const here = pos(3, n);
  const cur = activeAt(u, here);
  const raw: { skill: string; rank: string; due: number; kind: P3Kind; for: string }[] = [];
  const add = (list: { skill: string; rank: string }[], due: number, kind: P3Kind, label: string) =>
    list.forEach((t) => raw.push({ ...t, due, kind, for: label }));
  for (const s of u.stages) {
    const future = s.pos >= here;
    if (!future && s !== cur) continue;
    if (s.pos < pos(3, 1) && s !== cur) continue;
    // Gear and abilities of the active stage are needed now; a later stage's at its start.
    const due = future ? sectionOf(s) : n;
    if (future && s.cls) {
      add(parseTargets(examRanks(s.cls).join(", ")), due, DIVINE.test(s.cls) ? "divine" : "exam", `${s.cls} exam`);
    }
    // Training rows aim at the stage's exit: due when the next stage starts (Section 6 if none).
    const after = u.stages.find((x) => x.pos > s.pos);
    const exitDue = Math.max(n, after ? sectionOf(after) : 6);
    for (const t of s.stage.training ?? []) add(parseTargets(t.rank), exitDue, "training", t.for ?? `${s.cls} stage`);
    for (const g of s.stage.weapons ?? []) {
      const w = weaponRank(g.item);
      if (w) raw.push({ ...w, due, kind: "weapon", for: g.item });
    }
    for (const a of [...(s.stage.abilities ?? []), ...(s.stage.arts ?? []), ...(s.stage.spells ?? [])]) {
      const m = (a.why ?? "").match(/^([A-Za-z ]+?)\s+([EDCBAS]\+?)\s*[:(,]/);
      const t = m && parseTargets(`${m[1]} ${m[2]}`)[0];
      if (t) raw.push({ ...t, due, kind: "ability", for: a.name });
      else add(ranksIn((a.why ?? "").split(":")[0]), due, "ability", a.name);
    }
    if (s.stage.exit && future) add(ranksIn(s.stage.exit), due, "exam", s.stage.exit);
  }
  const fights = squad && squad !== "bench" && cur ? battleSkills(cur.stage) : new Set<string>();
  const by = new Map<string, (typeof raw)[number] & { later?: string }>();
  for (const r of raw.sort((a, b) => a.due - b.due || KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind])) {
    if (!COURSE_NAMES.some((c) => inCourse(c, r.skill))) continue;
    const prev = by.get(r.skill);
    if (!prev) by.set(r.skill, { ...r });
    else if (rankIdx(r.rank) > rankIdx(prev.rank)) {
      if (r.due === prev.due) Object.assign(prev, { rank: r.rank, kind: r.kind, for: r.for });
      else if (!prev.later || rankIdx(r.rank) > rankIdx(prev.later)) prev.later = r.rank;
    }
  }
  const out: P3Need[] = [];
  for (const r of by.values()) {
    const h = held3(u, r.skill, n);
    let target = r;
    if (h.rank >= rankIdx(r.rank)) {
      if (!r.later || h.rank >= rankIdx(r.later)) continue;
      target = { ...r, rank: r.later, due: 6, later: undefined };
    }
    if (rankIdx(target.rank) <= rankIdx(START_RANK)) continue;
    const own = RANKS[h.rank];
    const exp = expBetween(own, target.rank);
    const boon = has(u.character.preferred, r.skill);
    // Best case per week: a Perfect session (37.5) with the boon bonus and a full rank-gap bonus (+50) in every course
    // that trains the skill. Past that, only battles and skill Boons close the gap.
    const courses = COURSE_NAMES.filter((c) => inCourse(c, r.skill)).length * 0.8;
    const perWeek = (37.5 + (boon ? 17.5 : 0) + 50) * courses;
    out.push({
      skill: target.skill,
      rank: target.rank,
      own,
      source: h.source,
      due: target.due,
      kind: target.kind,
      for: target.for,
      later: target.later,
      boon,
      bane: has(u.character.avoid, r.skill),
      battle: fights.has(r.skill),
      exp,
      short: exp > perWeek * weeksBetween(n, Math.max(n, target.due)),
    });
  }
  return out.sort((a, b) => a.due - b.due || KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind]);
}

/** Every unit of the Salvation army with Arena targets at Section n (the rank board), most urgent first. */
export function rankBoard3(n: number): P3Trainee[] {
  if (n < ARENA3_OPENS) return [];
  const out: P3Trainee[] = [];
  for (const su of salvationArmy()) {
    if (notPlanned(su)) continue;
    const x = p3Plan(su.name);
    if (!x || x.plan.join > pos(3, n)) continue;
    const squad = squadOf(n, su.name);
    const needs = needs3(x.plan, n, squad);
    if (!needs.length) continue;
    out.push({ unit: x.plan, cls: activeAt(x.plan, pos(3, n))?.cls ?? "", squad, needs });
  }
  return out.sort((a, b) => urgency(b, n) - urgency(a, n));
}

/** How much one session in this course is worth to a trainee (deadline, kind, EXP left, bench first). */
function worth(t: P3Trainee, c: Course | undefined, n: number, partner?: UnitPlan): number {
  const parts: number[] = [];
  for (const x of t.needs) {
    if (c && !inCourse(c, x.skill)) continue;
    const left = Math.max(x.due - n, 0);
    const urg = left === 0 ? 8 : left === 1 ? 5 : left === 2 ? 3 : 1.5;
    const gap = partner ? Math.min(Math.max(held3(partner, x.skill, n).rank - rankIdx(x.own), 0), 4) : 0;
    const exp = 1 + (x.boon ? 0.7 : 0) + gap * 0.5;
    parts.push(urg * KIND_WEIGHT[x.kind] * exp * (x.battle ? 0.6 : 1) * (x.short ? 1.25 : 1) + rankIdx(x.rank) * 0.05);
  }
  parts.sort((a, b) => b - a);
  const v = parts.reduce((s, p, i) => s + (i ? p / 3 : p), 0);
  // The bench is always in Dagsion and has no battle EXP; squad members train only on weeks home.
  return v && t.squad === "bench" ? v * 1.3 : v;
}
const urgency = (t: P3Trainee, n: number) => worth(t, undefined, n);

/**
 * One Arena week in Section n: each course booked on its own with the pair worth most to it, a mentor
 * when only one trainee needs the course. Later weeks rest the previous pair (40%) so the next in line gets a turn.
 */
function book(n: number, list: P3Trainee[], prev: P3Session[]): P3Session[] {
  const army = salvationArmy().filter((u) => !notPlanned(u)).map((u) => p3Plan(u.name)?.plan).filter(
    (u): u is UnitPlan => Boolean(u && u.join <= pos(3, n)),
  );
  const out: P3Session[] = [];
  for (const c of COURSE_NAMES) {
    const rested = new Set(prev.filter((x) => x.course === c).flatMap((x) => [x.a.unit.name, x.b?.unit.name ?? ""]));
    const v = (t: P3Trainee, p?: UnitPlan) => worth(t, c, n, p) * (rested.has(t.unit.name) ? 0.4 : 1);
    const scored = list.map((t) => ({ t, v: v(t) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    if (!scored.length) continue;
    const top = scored.slice(0, 6);
    const taken = new Set(scored.map((x) => x.t.unit.name));
    const mentors = army.filter((u) => !taken.has(u.name) && squadOf(n, u.name) === "bench");
    let best: { a: P3Trainee; b?: P3Trainee; m?: UnitPlan; v: number } | undefined;
    for (const { t: a } of top) {
      for (const { t: b } of top) {
        if (a === b) continue;
        const pv = v(a, b.unit) + v(b, a.unit);
        if (!best || pv > best.v) best = { a, b, v: pv };
      }
      for (const m of mentors) {
        const pv = v(a, m) + 0.01;
        if (!best || pv > best.v) best = { a, m, v: pv };
      }
    }
    if (!best) continue;
    const aim = (t: P3Trainee): P3Trainee => ({ ...t, needs: t.needs.filter((x) => inCourse(c, x.skill)) });
    const seated = new Set([best.a.unit.name, best.b?.unit.name ?? ""]);
    const next = scored.filter((x) => !seated.has(x.t.unit.name)).slice(0, 3).map((x) => aim(x.t));
    if (best.b) {
      out.push({ course: c, a: aim(best.a), b: aim(best.b), next });
      continue;
    }
    const skill = best.a.needs.find((x) => inCourse(c, x.skill))?.skill;
    const pick = best.m ?? mentors[0];
    const ahead = pick && skill ? held3(pick, skill, n).rank - held3(best.a.unit, skill, n).rank : 0;
    out.push({
      course: c,
      a: aim(best.a),
      next,
      partner: pick
        ? {
          unit: pick,
          why: ahead > 0
            ? `holds ${skill} ${RANKS[held3(pick, skill!, n).rank]}: rank-gap bonus`
            : "bench, always home",
        }
        : undefined,
    });
  }
  return out;
}

/** The Section's Arena weeks, each with its bookings (the rank board computed once). */
export function rotation3(n: number): P3Session[][] {
  if (n < ARENA3_OPENS) return [];
  const list = rankBoard3(n);
  const out: P3Session[][] = [];
  for (let w = 0; w < weeksIn(n); w++) out.push(book(n, list, out[w - 1] ?? []));
  return out;
}
