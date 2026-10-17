import type { RouteName } from "./types.ts";
import { META } from "./data.ts";
import { chapterFile } from "./chapter.ts";
import { activeStage, routeUnits, type UnitPlan } from "./walkthrough/builds.ts";
import { reportedRank } from "./track.ts";
import items from "../../research/weapons-and-items.json" with { type: "json" };

/**
 * Arena courses and the skills each one trains (Reddit test data, Arena Lv 3). Two units per session.
 * The in-game menu calls the Sword/Axe/Gauntlet course "Warrior".
 */
export const COURSES = {
  Warrior: ["Sword", "Axe", "Gauntlet"],
  Infantry: ["Sword", "Bow", "Infantry"],
  Heavy: ["Spear", "Axe", "Heavy", "Authority"],
  Mage: ["Black Magic", "White Magic", "Authority"],
  Mounted: ["Spear", "Rider", "Flier", "Authority"],
} as const;
export type Course = keyof typeof COURSES;
export const COURSE_NAMES = Object.keys(COURSES) as Course[];
export const inCourse = (c: Course, skill: string) => (COURSES[c] as readonly string[]).includes(skill);

const ALIAS: [RegExp, string][] = [
  [/^sword/i, "Sword"],
  [/^(spear|lance)/i, "Spear"],
  [/^axe/i, "Axe"],
  [/^bow/i, "Bow"],
  [/^(gauntlet|brawl|fist)/i, "Gauntlet"],
  [/^(black magic|black\b|reason)/i, "Black Magic"],
  [/^(white magic|white\b|faith)/i, "White Magic"],
  [/^authority/i, "Authority"],
  [/^infantry/i, "Infantry"],
  [/^(heavy|armou?r)/i, "Heavy"],
  [/^(rider|riding|mounted)/i, "Rider"],
  [/^(flier|flying|flyer)/i, "Flier"],
];
export const skillName = (s: string): string | undefined => ALIAS.find(([re]) => re.test(s.trim()))?.[1];

export const RANKS = ["E", "E+", "D", "D+", "C", "C+", "B", "B+", "A", "A+", "S"];
export const rankIdx = (r: string) => RANKS.indexOf(r.toUpperCase());
/** Every unit starts each skill at D (player-confirmed, D-140): targets at D or below need no Arena seat. */
export const START_RANK = "D";

/** "Flier D, Spear C, Sword C" / "Bow C, then B" -> [{skill, rank}] with the highest rank named per skill. */
export function parseTargets(text: string): { skill: string; rank: string }[] {
  const out = new Map<string, string>();
  let last: string | undefined;
  for (const part of text.split(/,|;|\band\b/)) {
    const m = part.trim().match(/^(?:then\s+)?([A-Za-z][A-Za-z ]*?)\s+([EDCBAS]\+?)\b/);
    const bare = part.trim().match(/^then\s+([EDCBAS]\+?)\b/);
    if (m) {
      const sk = skillName(m[1]);
      if (!sk) continue;
      last = sk;
      if (!out.has(sk) || rankIdx(m[2]) > rankIdx(out.get(sk)!)) out.set(sk, m[2].toUpperCase());
    } else if (bare && last && rankIdx(bare[1]) > rankIdx(out.get(last)!)) out.set(last, bare[1].toUpperCase());
  }
  return [...out].map(([skill, rank]) => ({ skill, rank }));
}

const SKILL_RE =
  /\b(Sword|Spear|Lance|Axe|Bow|Gauntlets?|Brawling|Black Magic|White Magic|Black|White|Authority|Infantry|Heavy|Riding|Rider|Flying|Flier)\s+([EDCBAS]\+?)(?![\w+])/g;
/** Every "Skill Rank" pair anywhere in free text ("Lv 20 with Gauntlet C: Pugilist exam"). */
export function ranksIn(text: string): { skill: string; rank: string }[] {
  const out: { skill: string; rank: string }[] = [];
  for (const m of text.matchAll(SKILL_RE)) {
    const skill = skillName(m[1]);
    if (skill) out.push({ skill, rank: m[2].toUpperCase() });
  }
  return out;
}

/** Weapon rank requirements from the local item list ("Dodge Gauntlets" -> Gauntlet C). */
const WEAPON_RANK = new Map<string, { skill: string; rank: string }>();
for (
  const r of (Array.isArray(items.weapons) ? items.weapons : Object.values(items.weapons).flat()) as {
    name: string;
    type?: string;
    rank?: string | null;
  }[]
) {
  const skill = r.type ? skillName(r.type) : undefined;
  if (skill && r.rank && /^[EDCBAS]\+?$/.test(r.rank)) WEAPON_RANK.set(r.name.toLowerCase(), { skill, rank: r.rank });
}
export const weaponRank = (name: string) => WEAPON_RANK.get(name.replace(/\s*\+\d+$/, "").trim().toLowerCase());

/**
 * Battle use covers a deployed unit's own weapon and magic skills (D-113, player data from the Leda run with the
 * skill-EXP Boons of two cleared Paths: core units reach B+ in the skills they fight with by Ch 9). Estimated ramp
 * before that. Bench units fight too little to count.
 */
const BATTLE_RAMP: [number, string][] = [[9, "B+"], [7, "C+"], [5, "C"], [1, "D"]];
export const battleRank = (chapter: number): string => BATTLE_RAMP.find(([ch]) => chapter >= ch)![1];
/**
 * Whether a unit fights in this chapter: it holds a lineup slot then (route `deployment.lineup`), or, with no lineup
 * entry, it isn't marked bench. A recruit waiting for its first slot or an early unit past its last slot is bench.
 */
export function fighting(route: RouteName, u: UnitPlan, chapter: number): boolean {
  const lineup = META.routes[route].deployment?.lineup ?? [];
  const spans = lineup.flatMap((sl) => sl.holders.filter((h) => h.unit === u.name));
  if (spans.length) {
    return spans.some((h) => h.from <= chapter && (h.to === undefined || h.to === null || h.to >= chapter));
  }
  return u.status !== "bench";
}
/** Skills a stage trains in battle: the types of the weapons it carries and the schools of its spells. */
export function battleSkills(
  st: { weapons?: { item: string }[]; spells?: { name: string; why?: string }[] },
): Set<string> {
  const out = new Set<string>();
  for (const g of st.weapons ?? []) {
    const w = weaponRank(g.item);
    if (w) out.add(w.skill);
  }
  for (const n of st.spells ?? []) {
    const m = (n.why ?? "").match(/^(White Magic|Black Magic|White|Black)\b/i);
    const sk = m && skillName(m[1]);
    if (sk) out.add(sk);
  }
  return out;
}

/**
 * `due`: the Part I chapter the rank must be in by (13 = Part II). `later`: a higher target past the first one.
 * `src`: where the target comes from (plan, gate, gear the next stage carries, exam on the stage exit).
 */
export type Need = {
  skill: string;
  rank: string;
  /** Rank held now: the one you reported, else the plan's estimate (D floor). */
  own: string;
  /** True when `own` is a rank you reported in game. */
  reported?: boolean;
  for?: string;
  due: number;
  later?: string;
  boon: boolean;
  bane: boolean;
};
/** `weekly`: a gate of this unit asks for the Arena every week in this chapter. */
export type Trainee = {
  unit: UnitPlan;
  /** Not in the lineup this chapter: Arena is its only rank EXP (D-113). */
  bench?: boolean;
  cls: string;
  needs: Need[];
  course: Course;
  other: Need[];
  weekly?: boolean;
  status?: string;
};
/** One course's booking: the pair, and who is next in line for it (alternate weeks, or once a pair's target is met). */
export type Session = {
  course: Course;
  a: Trainee;
  b?: Trainee;
  partner?: { unit: UnitPlan; why: string };
  next?: Trainee[];
};

const has = (list: string[] | undefined, skill: string) => (list ?? []).some((x) => skillName(x) === skill);
const PART2 = 13;
const chOf = (p?: { part: number; ch?: number }) => (!p ? PART2 : p.part === 1 ? p.ch ?? 12 : PART2);

/** "Ch 6", "Part II" or "11/27" style label for a due chapter. */
export const dueLabel = (due: number) => (due >= PART2 ? "Part II" : `Ch ${due}`);

/**
 * Every Arena-trainable rank target a unit has open in this chapter, read from its whole journey:
 * the active stage's training, rank gates still open, the exam named on the stage exit, and the ranks the next
 * stages' weapons, arts, spells and abilities need (Dodge Gauntlets need Gauntlet C before the stage that carries
 * them). One entry per skill: the nearest deadline leads, a higher later target rides along.
 */
function openNeeds(route: RouteName, u: UnitPlan, chapter: number): { needs: Need[]; weekly: boolean } | undefined {
  const ps = activeStage(u, chapter);
  if (!ps) return undefined;
  const idx = u.stages.indexOf(ps);
  const nextStart = (i: number) => {
    for (let j = i + 1; j < u.stages.length; j++) {
      const st = u.stages[j];
      if (st.start === null) return PART2;
      if (st.start > chapter) return st.start;
    }
    return PART2;
  };
  const raw: { skill: string; rank: string; for?: string; due: number }[] = [];
  const push = (list: { skill: string; rank: string }[], due: number, label?: string) => {
    for (const t of list) raw.push({ ...t, due, for: label });
  };
  const due0 = nextStart(idx);
  for (const t of ps.stage.training ?? []) push(parseTargets(t.rank), due0, t.for);
  // The stage began this chapter with an exam still to take: its entry ranks are due now.
  if (ps.start === chapter && idx > 0) {
    const prev = u.stages[idx - 1].stage;
    for (const t of prev.training ?? []) push(parseTargets(t.rank), chapter, t.for);
    if (prev.exit) push(ranksIn(prev.exit), chapter, prev.exit.replace(/\[\[\w+:([^\]]+)\]\]/g, "$1"));
  }
  if (ps.stage.exit) push(ranksIn(ps.stage.exit), due0, ps.stage.exit.replace(/\[\[\w+:([^\]]+)\]\]/g, "$1"));
  // Look ahead: stages that start after this chapter, up to the first Part II stage.
  for (let j = idx + 1; j < u.stages.length; j++) {
    const st = u.stages[j];
    const due = st.start ?? PART2;
    if (due <= chapter) continue;
    const label = st.stage.class ? `${st.cls || st.stage.class} stage (${dueLabel(due)})` : dueLabel(due);
    for (const g of st.stage.weapons ?? []) {
      const w = weaponRank(g.item);
      if (w) raw.push({ ...w, due, for: `${g.item} (${dueLabel(due)})` });
    }
    for (const n of [...(st.stage.arts ?? []), ...(st.stage.spells ?? []), ...(st.stage.abilities ?? [])]) {
      const m = (n.why ?? "").match(/^([A-Za-z ]+?)\s+([EDCBAS]\+?)\s*[:(]/);
      const sk = m && skillName(m[1]);
      if (sk) raw.push({ skill: sk, rank: m![2].toUpperCase(), due, for: `${n.name} (${dueLabel(due)})` });
    }
    for (const t of st.stage.training ?? []) push(parseTargets(t.rank), PART2, t.for ?? label);
    if (st.start === null) {
      // Part II has no Arena: a bench unit banks every later rank target now; a fighting unit only its S pushes
      // (Divine classes), since battle in Parts II and III brings the A ranks (D-113).
      for (let k = j + 1; k < u.stages.length; k++) {
        for (const t of u.stages[k].stage.training ?? []) {
          const ts = parseTargets(t.rank).filter((x) => !fighting(route, u, chapter) || x.rank === "S");
          push(ts, PART2, t.for ?? "Part III");
        }
      }
      break;
    }
  }
  let weekly = false;
  for (const g of u.character.guide?.gates ?? []) {
    if (g.route && g.route !== route) continue;
    if (g.from.part !== 1 || (g.from.ch ?? 1) > chapter) continue;
    const by = chOf(g.by);
    if (by < chapter) continue;
    const isRank = g.kind === "rank" || /\barena\b/i.test(g.text);
    if (!isRank) continue;
    if (/\barena\b[^:]*\bevery week/i.test(g.text)) weekly = true;
    push([...parseTargets(g.text.replace(/^.*?\bneeds\s+/i, "")), ...ranksIn(g.text)], by, g.text);
  }
  // Skills this unit fights with now or in a later Part I stage: battle covers them up to the ramp (D-113).
  const fights = new Set<string>();
  if (fighting(route, u, chapter)) {
    for (let j = idx; j < u.stages.length && u.stages[j].start !== null; j++) {
      for (const sk of battleSkills(u.stages[j].stage)) fights.add(sk);
    }
  }
  const bySkill = new Map<string, Need>();
  for (const r of raw.sort((a, b) => a.due - b.due)) {
    if (!COURSE_NAMES.some((c) => inCourse(c, r.skill))) continue;
    // A rank you reported replaces the battle estimate: the target stays if the unit is really behind.
    const told = reportedRank(route, u.name, r.skill) !== undefined;
    if (!told && fights.has(r.skill) && rankIdx(r.rank) <= rankIdx(battleRank(Math.min(r.due, 12)))) continue;
    // A and A+ in a skill the unit fights with come from Part II and III battles; only S (Divine) earns a seat.
    if (fights.has(r.skill) && (r.rank === "A" || r.rank === "A+")) continue;
    const cur = bySkill.get(r.skill);
    if (!cur) {
      bySkill.set(r.skill, {
        ...r,
        own: START_RANK,
        boon: has(u.character.preferred, r.skill),
        bane: has(u.character.avoid, r.skill),
      });
    } else if (rankIdx(r.rank) > rankIdx(cur.rank) && (!cur.later || rankIdx(r.rank) > rankIdx(cur.later))) {
      if (r.due === cur.due) {
        cur.rank = r.rank;
        cur.for = r.for ?? cur.for;
      } else cur.later = r.rank;
    }
  }
  // Ranks already held (reported, exams, battle ramp; D at least) close a target or move it to the later one.
  const needs = [...bySkill.values()].flatMap((n): Need[] => {
    const own = heldRank(route, u, n.skill, chapter);
    const told = reportedRank(route, u.name, n.skill);
    const base = { ...n, own: RANKS[own], reported: told !== undefined };
    if (own < rankIdx(n.rank)) return [base];
    if (n.later && own < rankIdx(n.later)) return [{ ...base, rank: n.later, due: PART2, later: undefined }];
    return [];
  }).filter((n) => rankIdx(n.rank) > rankIdx(START_RANK)).sort((a, b) => a.due - b.due);
  return needs.length ? { needs, weekly } : undefined;
}

/**
 * Rank a unit holds by this chapter: the rank you reported, else the highest rank named on the exams it has passed
 * (License rows before this chapter) or the battle ramp, never below D (every skill starts there).
 */
function heldRank(route: RouteName, u: UnitPlan, skill: string, chapter: number): number {
  // What you reported in game wins over every estimate (D-140).
  const told = reportedRank(route, u.name, skill);
  if (told !== undefined) return rankIdx(told);
  let best = rankIdx(START_RANK);
  const lic = META.routes[route].ledger?.licenses;
  for (const row of [...(lic?.beginner ?? []), ...(lic?.specialty ?? []), ...(lic?.advanced ?? [])]) {
    if (row.unit !== u.name || !row.ranks?.length) continue;
    const ch = typeof row.ch === "number" ? row.ch : /part/i.test(row.ch) ? NaN : Number(row.ch.match(/\d+/)?.[0]);
    if (!(ch < chapter)) continue;
    for (const t of parseTargets(row.ranks.join(", "))) if (t.skill === skill) best = Math.max(best, rankIdx(t.rank));
  }
  // A fighting unit holds the battle ramp in the skills its stage fights with (D-113): the mentor seat for the bench.
  const ps = activeStage(u, chapter);
  if (ps && fighting(route, u, chapter) && battleSkills(ps.stage).has(skill)) {
    best = Math.max(best, rankIdx(battleRank(chapter)));
  }
  return best;
}

/**
 * EXP a session gives, as a multiple of a plain Good result (Arena Lv 3 ratios: boon +17.5, +12.5 per half rank
 * below the partner up to 4, on a base of 25). Only the lower-ranked unit of the pair gets the gap bonus.
 */
function expFactor(n: Need, own: number, partner?: number) {
  const gap = partner === undefined ? 0 : Math.min(Math.max(partner - own, 0), 4);
  return 1 + (n.boon ? 0.7 : 0) + gap * 0.5;
}

/**
 * How much a session in this course is worth to the unit: an exam this chapter counts most, then near deadlines,
 * scaled by the EXP the session gives (boon, rank gap below the partner).
 */
function value(
  t: { needs: Need[]; weekly?: boolean; unit: UnitPlan; bench?: boolean },
  c: Course,
  chapter: number,
  bench: boolean,
  ctx?: { route: RouteName; partner?: UnitPlan },
) {
  // The nearest need leads; extra skills in the same course add a third each, so one exam-critical rank beats
  // three far-off ones.
  const parts: number[] = [];
  for (let n of t.needs) {
    if (!inCourse(c, n.skill)) continue;
    const own = ctx ? heldRank(ctx.route, t.unit, n.skill, chapter) : 0;
    // Target met: train toward the later one (a bench unit's Part III A), counted as a Part II deadline.
    if (ctx && own >= rankIdx(n.rank)) {
      if (!n.later || own >= rankIdx(n.later)) continue;
      n = { ...n, rank: n.later, due: PART2, later: undefined };
    }
    const left = Math.max(n.due - chapter, 0);
    const urgency = left === 0 ? 8 : left <= 1 ? 6 : left <= 2 ? 4 : left <= 4 ? 2 : 1;
    const partner = ctx?.partner ? heldRank(ctx.route, ctx.partner, n.skill, chapter) : undefined;
    // D and D+ are one or two sessions (35 to 80 EXP) for an ability slot; C and B gate exams; S is a Divine push.
    const weight = rankIdx(n.rank) >= rankIdx("C") ? 1 : 0.5;
    parts.push(weight * urgency * (ctx ? expFactor(n, own, partner) : n.boon ? 1.2 : 1) + rankIdx(n.rank) * 0.1);
  }
  parts.sort((a, b) => b - a);
  let v = parts.reduce((sum, x, i) => sum + (i ? x / 3 : x), 0);
  if (v && t.weekly) v += 3;
  // Bench first (D-113): Part II has no Arena, so the bench banks its Part II and III ranks now; core units only
  // take seats for S pushes and skills they don't fight with.
  if (v && t.bench) v = v * 2 + (bench ? 2 : 0);
  return v;
}

function aim(t: Omit<Trainee, "course" | "needs" | "other"> & { needs: Need[] }, c: Course): Trainee {
  return {
    ...t,
    course: c,
    needs: t.needs.filter((n) => inCourse(c, n.skill)),
    other: t.needs.filter((n) => !inCourse(c, n.skill)),
  };
}

export type Base = Omit<Trainee, "course" | "other">;

/** Units with Arena-trainable rank targets in this chapter, with every open need (not yet aimed at a course). */
function bases(route: RouteName, chapter: number): Base[] {
  const out: Base[] = [];
  for (const u of routeUnits(route)) {
    const ps = activeStage(u, chapter);
    const open = openNeeds(route, u, chapter);
    if (!ps || !open) continue;
    out.push({
      unit: u,
      cls: ps.cls,
      needs: open.needs,
      weekly: open.weekly,
      status: u.status,
      bench: !fighting(route, u, chapter),
    });
  }
  return out;
}

/** Every unit with a rank still to reach in this chapter, all its targets, nearest deadline first (the rank board). */
export function rankBoard(route: RouteName, chapter: number): Base[] {
  if (chapter < arenaOpens(route)) return [];
  return bases(route, chapter).sort((x, y) =>
    Math.min(...x.needs.map((n) => n.due)) - Math.min(...y.needs.map((n) => n.due)) ||
    Number(Boolean(y.bench)) - Number(Boolean(x.bench))
  );
}

/** The route's rules say Arena seats go to the bench first (bench units earn no battle EXP). */
const benchFirst = (route: RouteName) => {
  const info = META.routes[route];
  const text = [
    ...(info.ledger?.rules ?? []),
    ...(info.mechanics ?? []).flatMap((m) => [m.what, m.impact]),
  ].join(" ");
  return /arena seats go to the bench/i.test(text);
};

/** First chapter with the Arena open on a route: the first whose `unlocks` name the Arena, else Ch 4. */
export function arenaOpens(route: RouteName): number {
  for (let ch = 1; ch <= 12; ch++) if (chapterFile(route, ch)?.unlocks?.some((u) => /arena/i.test(u))) return ch;
  return 4;
}

/**
 * One week of Arena (D-136; `week` 0 = A, 1 = B, 2 = C): the game offers 4 of the 5 courses a week and every course
 * takes exactly two units, and one unit may sit in several courses that week. So each course is booked on its own:
 * the pair worth most to it (an exam this chapter first, then near deadlines, scaled by the EXP the pair gives: boon
 * skills, and the rank-gap bonus the lower unit gets from a higher-ranked partner). With one trainee, the partner is
 * the free unit that gives it the most EXP (a mentor), else a bench unit. Whatever 4 courses show up, book their
 * rows. Weeks B and C rest each course's last pair (40%) so the next in line gets a turn.
 */
export function sessions(route: RouteName, chapter: number, week = 0): Session[] {
  if (chapter < arenaOpens(route)) return [];
  const list = bases(route, chapter);
  const prev = week > 0 ? sessions(route, chapter, week - 1) : [];
  const bench = benchFirst(route);
  const active = routeUnits(route).filter((u) => activeStage(u, chapter));
  const out: Session[] = [];
  for (const c of COURSE_NAMES) {
    const rested = new Set(
      prev.filter((x) => x.course === c).flatMap((x) => [x.a.unit.name, x.b?.unit.name ?? x.partner?.unit.name ?? ""]),
    );
    const v = (t: Base, partner?: UnitPlan) =>
      value(t, c, chapter, bench, { route, partner }) * (rested.has(t.unit.name) ? 0.4 : 1);
    const scored = list.map((t) => ({ t, v: v(t) })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
    if (!scored.length) continue;
    const top = scored.slice(0, 6);
    const inCourseNames = new Set(scored.map((x) => x.t.unit.name));
    const mentors = active.filter((u) => !inCourseNames.has(u.name));
    let best: { a: Base; b?: Base; mentor?: UnitPlan; v: number } | undefined;
    for (const { t: a } of top) {
      for (const { t: b } of top) {
        if (b === a) continue;
        const pv = v(a, b.unit) + v(b, a.unit);
        if (!best || pv > best.v) best = { a, b, v: pv };
      }
      for (const m of mentors) {
        const pv = v(a, m) + 0.01;
        if (!best || pv > best.v) best = { a, mentor: m, v: pv };
      }
    }
    if (!best) continue;
    const a = aim(best.a, c);
    const seated = new Set([best.a.unit.name, best.b?.unit.name ?? ""]);
    const next = scored.filter((x) => !seated.has(x.t.unit.name)).slice(0, 3).map((x) => aim(x.t, c));
    if (best.b) {
      out.push({ course: c, a, b: aim(best.b, c), next });
      continue;
    }
    // Two units are required: a mentor, else a boon holder, else a bench unit, else anyone free.
    const skill = a.needs[0]?.skill;
    const pick = best.mentor ??
      mentors.find((u) => has(u.character.preferred, skill)) ??
      mentors.find((u) => !fighting(route, u, chapter)) ??
      mentors[0];
    const ahead = pick && skill ? heldRank(route, pick, skill, chapter) - heldRank(route, a.unit, skill, chapter) : 0;
    out.push({
      course: c,
      a,
      next,
      partner: pick
        ? {
          unit: pick,
          why: ahead > 0
            ? `holds ${skill} ${RANKS[heldRank(route, pick, skill, chapter)]}: rank-gap bonus`
            : has(pick.character.preferred, skill)
            ? `${skill} is a boon: likely ahead`
            : "second seat",
        }
        : undefined,
    });
  }
  return out;
}

/** Courses with no rank target this chapter: skip them, or seat any two units (the EXP still counts). */
export function idleCourses(route: RouteName, chapter: number): Course[] {
  if (chapter < arenaOpens(route)) return [];
  const booked = new Set(sessions(route, chapter, 0).map((x) => x.course));
  return COURSE_NAMES.filter((c) => !booked.has(c));
}

/** Rotation weeks worth showing: A, then B and C while they seat someone new. */
export function rotation(route: RouteName, chapter: number): Session[][] {
  const out = [sessions(route, chapter, 0)];
  const seen = new Set(out[0].flatMap((x) => [x.a.unit.name, x.b?.unit.name ?? ""]));
  for (let w = 1; w < 3; w++) {
    const next = sessions(route, chapter, w);
    const names = next.flatMap((x) => [x.a.unit.name, x.b?.unit.name ?? ""]);
    if (!names.some((n) => n && !seen.has(n))) break;
    names.forEach((n) => seen.add(n));
    out.push(next);
  }
  return out;
}

export const ARENA_LEVELS = [
  { lv: 1, when: "From Ch 5", good: 10, great: 12, perfect: 15, boon: 7, gap: 5 },
  { lv: 2, when: "Renown 4 (Ch 6)", good: 18, great: 21, perfect: 27, boon: 12, gap: 9 },
  { lv: 3, when: "Renown 7 (late Ch 8)", good: 25, great: 30, perfect: 37.5, boon: 17.5, gap: 12.5 },
];
/** Arena level you can count on in a chapter, following the Renown pace tables. */
export const arenaLevel = (chapter: number) => (chapter >= 9 ? 3 : chapter >= 6 ? 2 : 1);

export const RANK_EXP: [string, number][] = [
  ["E → E+", 20],
  ["E+ → D", 15],
  ["D → D+", 45],
  ["D+ → C", 140],
  ["C → C+", 220],
  ["C+ → B", 250],
  ["B → B+", 220],
  ["B+ → A", 305],
  ["A → A+", 220],
  ["A+ → S", 445],
];
