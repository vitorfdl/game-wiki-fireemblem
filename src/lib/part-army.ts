import { CHARACTERS, META, routeSlug } from "./data.ts";
import { href } from "./router.ts";
import { phaseFor } from "./chapter.ts";
import { primaryClass } from "./growth.ts";
import { P3, PART_HOME, pos, section } from "./parts.ts";
import { salvationFile, squadsFile, warFile } from "./part-plan.ts";
import { activeStage, loosePlan, type PlannedStage, routeUnits, type UnitPlan } from "./walkthrough/builds.ts";
import type { RouteName, SalvationFile } from "./types.ts";

/*
 * Who is in the army in Part II and Part III (D-128). Part II: the route's `deployment.part2.core` (the 15 that play the
 * War Path), split into the Ch 12 lineup and the bench. Part III: Theodora's army as the base (D-118), then every other
 * route's Part II army and the Part III joiners, each unit once; a unit on several routes merges into its first copy.
 */

/** Part III joiners who belong to no route's army (part3-salvation.json Sections, Eshmel first). */
export const P3_JOINERS = [
  "Eshmel",
  "Bertrand",
  "Orchel",
  "Talimun",
  "Anatolia",
  "Troy",
  "Hong Hua",
  "Centurio",
  "Aswan",
  "Tahonia",
  "Klapka",
]
  .filter((n) => CHARACTERS[n]);

/** The Section a Part III joiner arrives in (part3-salvation.json joins and Section 1 allies). */
export function joinSection(name: string): number {
  if (name === "Eshmel") return 1;
  for (const s of P3.sections) {
    if (s.joins?.some((j) => j.unit === name)) return s.n;
    if (s.battles.some((b) => b.allies?.some((a) => a.units.some((u) => u.replace("?", "") === name)))) return s.n;
  }
  return 1;
}

/**
 * A unit's class at a campaign position: its plan on this route, else its home route, else its own guide. In Part III
 * without a route, the copy the plan recruits (D-145) decides.
 */
export function classAt(name: string, p: number, route?: RouteName): string | undefined {
  if (p > 18) {
    const x = p3Plan(name, route);
    const ps = x && activeStage(x.plan, Math.max(p, x.plan.join));
    if (ps?.cls) return ps.cls;
  }
  const routes = [route, PART_HOME, CHARACTERS[name]?.homeRoute, ...META.order].filter(Boolean) as RouteName[];
  for (const r of routes) {
    const u = routeUnits(r).find((x) => x.name === name);
    const ps = u ? activeStage(u, p) : undefined;
    if (ps?.cls) return ps.cls;
  }
  const stages = CHARACTERS[name]?.guide?.stages ?? [];
  const last = stages.filter((s) => (s.from?.part ?? 1) <= (p > 18 ? 3 : p > 12 ? 2 : 1)).at(-1);
  return last ? primaryClass(last.class) || last.class : undefined;
}

/* ------------------------------------------------------------ Part II */

export type WarUnit = { name: string; main: boolean; role?: string; note?: string };

/** The War Path army: Ch 12's deploy list first (the main lineup), then the rest of the 15. */
export function warArmy(route: RouteName): WarUnit[] {
  const dep = META.routes[route].deployment;
  const core = dep?.part2?.core ?? [];
  const main = new Set(phaseFor(route, 12)?.deploy ?? core.slice(0, 9));
  const list = [...core].sort((a, b) => Number(main.has(b)) - Number(main.has(a)));
  return list.map((name) => ({
    name,
    main: main.has(name),
    role: dep?.units[name]?.role,
    note: dep?.units[name]?.partII,
  }));
}

/** Deployed (true), benched (false) or absent (undefined) in War Ch N, from the chapter plan files. */
export function warSeat(route: RouteName, ch: number, name: string): boolean | undefined {
  const f = warFile(route, ch);
  if (!f) return undefined;
  if (f.deploy.units.includes(name)) return true;
  if (f.deploy.bench?.includes(name)) return false;
  return undefined;
}

/* ------------------------------------------------------------ Part III */

export type Origin = RouteName | "joiner";
export type SalvationUnit = { name: string; origin: Origin; copies: RouteName[]; join: number };

let ARMY: SalvationUnit[] | undefined;

/** Every army that reaches Part III, each unit once, grouped by origin (Theodora's first, joiners last). */
export function salvationArmy(): SalvationUnit[] {
  ARMY ??= buildArmy();
  return ARMY;
}

function buildArmy(): SalvationUnit[] {
  const out = new Map<string, SalvationUnit>();
  const order: RouteName[] = [PART_HOME, ...META.order.filter((r) => r !== PART_HOME)];
  for (const r of order) {
    for (const name of META.routes[r].deployment?.part2?.core ?? []) {
      const hit = out.get(name);
      if (hit) hit.copies.push(r);
      else out.set(name, { name, origin: r, copies: [r], join: r === PART_HOME ? 1 : 2 });
    }
  }
  // The copy the plan recruits (D-145) becomes the unit's origin; the others merge into it.
  // A pick outside every Part II army (Jasmine sat out Leda's) still wins: the plan recruits that copy.
  for (const c of salvationFile(PART_HOME, 2)?.copies ?? []) {
    const u = out.get(c.unit);
    if (u) {
      u.origin = c.pick;
      u.copies = [c.pick, ...u.copies.filter((r) => r !== c.pick)];
    }
  }
  for (const name of P3_JOINERS) {
    if (!out.has(name)) out.set(name, { name, origin: "joiner", copies: [], join: joinSection(name) });
  }
  // Anyone the squad plan seats who isn't listed yet (a filler brought along): every route army waits in Dagsion
  // from Section 2 (Theodora's from Section 1), so a late first listing isn't a late join.
  for (const s of squadsFile(PART_HOME)?.sections ?? []) {
    for (const n of [...s.squads.flatMap((q) => q.units), ...s.bench]) {
      const home = CHARACTERS[n]?.homeRoute;
      if (!out.has(n) && CHARACTERS[n]) {
        out.set(n, {
          name: n,
          origin: home ?? "joiner",
          copies: home ? [home] : [],
          join: home ? Math.min(s.n, home === PART_HOME ? 1 : 2) : s.n,
        });
      }
    }
  }
  return [...out.values()];
}

/** First Section a unit is listed in squads.json (a squad or the bench), or undefined when the plan never lists it. */
export function firstListed(name: string): number | undefined {
  return squadsFile(PART_HOME)?.sections.find((s) =>
    s.squads.some((q) => q.units.includes(name)) || s.bench.includes(name)
  )?.n;
}

/** Units the Part III plan never lists (no squad, no bench seat in any Section). Eshmel stays apart. */
export const notPlanned = (u: SalvationUnit) => u.name !== "Eshmel" && firstListed(u.name) === undefined;

/** The route whose copy the plan recruits in Part III (D-145), or null for a Part III joiner. */
export function p3Route(name: string): RouteName | null {
  const u = salvationArmy().find((x) => x.name === name);
  if (u) return u.origin === "joiner" ? null : u.origin;
  return CHARACTERS[name]?.homeRoute ?? null;
}

const PLANS = new Map<string, { route: RouteName | null; plan: UnitPlan } | null>();

/**
 * A unit's Part III build: the picked copy's stages (D-145), else the first route that plans it, else (Part III joiners)
 * its own guide. `route` forces a copy.
 */
export function p3Plan(name: string, route?: RouteName): { route: RouteName | null; plan: UnitPlan } | undefined {
  const k = `${route ?? ""}:${name}`;
  if (PLANS.has(k)) return PLANS.get(k) ?? undefined;
  const pick = route ?? p3Route(name);
  const c = CHARACTERS[name];
  let hit: { route: RouteName | null; plan: UnitPlan } | null = null;
  for (const r of [pick, PART_HOME, c?.homeRoute, ...META.order].filter(Boolean) as RouteName[]) {
    const plan = routeUnits(r).find((x) => x.name === name);
    if (plan) {
      hit = { route: r, plan };
      break;
    }
  }
  if (!hit && c?.guide?.stages?.length) hit = { route: null, plan: loosePlan(c, pos(3, joinSection(name))) };
  PLANS.set(k, hit);
  return hit ?? undefined;
}

/** A unit's Part III stage at a Section (its picked copy), and the stage after it. */
export function p3Stage(name: string, n: number): { now?: PlannedStage; next?: PlannedStage; plan?: UnitPlan } {
  const x = p3Plan(name);
  if (!x) return {};
  const now = activeStage(x.plan, Math.max(pos(3, n), x.plan.join));
  const i = now ? x.plan.stages.indexOf(now) : -1;
  return { now, next: x.plan.stages[i + 1], plan: x.plan };
}

/* ------------------------------------------------------------ Section plans */

const salvationFiles = (): SalvationFile[] =>
  [1, 2, 3, 4, 5, 6].map((n) => salvationFile(PART_HOME, n)).filter((f): f is SalvationFile => Boolean(f));

const squashCls = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** License rows across Sections (D-149), each with its Section; Elephant License rows carry `license` (D-156). */
export function licenseRows(): { n: number; unit: string; to: string; why: string; license?: "Elephant" }[] {
  return salvationFiles().flatMap((f) => (f.licenses ?? []).map((l) => ({ n: f.n, ...l })));
}

/** Who takes a Master class: License rows for it, plus joiners who arrive in it (Troy joins a War Monk). */
export function licenseHolders(cls: string): { unit: string; n: number; join?: boolean }[] {
  const k = squashCls(cls);
  const out: { unit: string; n: number; join?: boolean }[] = licenseRows()
    .filter((l) => squashCls(l.to) === k)
    .map((l) => ({ unit: l.unit, n: l.n }));
  for (const u of salvationArmy().filter((x) => x.origin === "joiner")) {
    if (out.some((o) => o.unit === u.name) || notPlanned(u)) continue;
    const first = p3Plan(u.name)?.plan.stages[0];
    if (first && squashCls(first.cls) === k) out.push({ unit: u.name, n: u.join, join: true });
  }
  return out;
}

/** Hand-overs across Sections (`gear.assign`), each with its Section. */
export function assignRows(): { n: number; item: string; to: string; why?: string }[] {
  return salvationFiles().flatMap((f) => (f.gear?.assign ?? []).map((a) => ({ n: f.n, ...a })));
}

/** Who the plan hands a one-copy item to (Trial items, Anna's boosters), and in which Section. */
export const assignOf = (item: string) => assignRows().filter((a) => a.item === item);

/** Units whose picked Part III build reaches a Divine class, with the Section of the exam. */
export function divineHolders(cls: string): { unit: string; n: number; route: RouteName | null }[] {
  const out: { unit: string; n: number; route: RouteName | null }[] = [];
  for (const u of salvationArmy()) {
    if (notPlanned(u)) continue;
    const x = p3Plan(u.name);
    const ps = x?.plan.stages.find((s) => s.cls === cls);
    if (x && ps) out.push({ unit: u.name, n: Math.max(1, ps.pos - 18), route: x.route });
  }
  return out;
}

/** Fallback holders the Section decisions name ("Blade → Loretta"), keyed by the Divine class. */
export function divineFallbacks(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of salvationFiles()) {
    for (const d of f.decisions ?? []) {
      if (!/shortfall|fallback/i.test(`${d.topic} ${d.pick}`)) continue;
      for (const m of d.pick.matchAll(/(?:The )?([A-Z][a-z]+) → ([A-Z][\w ]*?)(?=,|;|\.|$)/g)) {
        if (CHARACTERS[m[2].trim()]) out[`The ${m[1]}`] = m[2].trim();
      }
    }
  }
  return out;
}

/**
 * The gates a unit deploys in during a Section. A gate whose plan has a `deploy` list counts only those units; a gate
 * without one counts every unit of the squads standing there.
 */
export function deploysIn(n: number, name: string): string[] {
  const at = squadsFile(PART_HOME)?.sections.find((x) => x.n === n);
  const f = salvationFile(PART_HOME, n);
  const out: string[] = [];
  for (const b of section(n)?.battles ?? []) {
    const plan = f?.gates.find((g) => g.battle === b.name);
    if (plan?.deploy) {
      if (plan.deploy.includes(name)) out.push(b.name);
    } else if (at?.squads.some((q) => q.gates.includes(b.name) && q.units.includes(name))) out.push(b.name);
  }
  return out;
}

/** True when a Section's gate plans name who deploys (then a squad at a gate can be present without deploying). */
export const hasDeployPlan = (n: number) => Boolean(salvationFile(PART_HOME, n)?.gates.some((g) => g.deploy));

/** The squad letter a unit rides in during a Section, "bench" when listed outside the squads, undefined otherwise. */
export function squadOf(n: number, name: string): string | undefined {
  const s = squadsFile(PART_HOME)?.sections.find((x) => x.n === n);
  if (!s) return undefined;
  const q = s.squads.find((x) => x.units.includes(name));
  if (q) return q.id;
  return s.bench.includes(name) ? "bench" : undefined;
}

export const P3_END = pos(3, 6);

/* ------------------------------------------------------------ Part III roster (build pages, Units tab) */

export type P3Group = { key: string; title: string; squad?: string; names: string[]; muted?: boolean };

/** The Section whose squads a roster shows: the one asked for, else the next Section that has squads. */
export function squadSection(n: number): number | undefined {
  const file = squadsFile(PART_HOME);
  return file?.sections.find((s) => s.n === n)?.n ?? file?.sections.find((s) => s.n >= n)?.n ??
    file?.sections.at(-1)?.n;
}

/**
 * The whole Part III army for a Section, grouped by squad letter (squads.json order), then everyone outside the squads,
 * then the units the plan never lists. Each unit once.
 */
export function p3Roster(n: number): P3Group[] {
  const at = squadsFile(PART_HOME)?.sections.find((s) => s.n === squadSection(n));
  const army = salvationArmy();
  const seated = new Set(at?.squads.flatMap((q) => q.units) ?? []);
  const groups: P3Group[] = (at?.squads ?? []).map((q) => ({
    key: q.id,
    title: `Squad ${q.id} · ${q.role}`,
    squad: q.id,
    names: q.units.filter((u) => CHARACTERS[u]),
  }));
  const benchOrder = at?.bench ?? [];
  const out = army.filter((u) => !seated.has(u.name) && !notPlanned(u)).map((u) => u.name)
    .sort((a, b) => rank(benchOrder, a) - rank(benchOrder, b));
  if (out.length) groups.push({ key: "out", title: "Outside the squads", names: out });
  const none = army.filter(notPlanned).map((u) => u.name);
  if (none.length) groups.push({ key: "none", title: "Not in the Part III plan", names: none, muted: true });
  return groups;
}

const rank = (list: string[], n: string) => {
  const i = list.indexOf(n);
  return i < 0 ? 999 : i;
};

/** Arrow order of the Part III roster. */
export const p3RosterList = (n: number) => p3Roster(n).flatMap((g) => g.names);

/** Build page of the copy the plan recruits (D-145); Part III joiners open the later-joiners page. */
export function p3BuildHref(name: string, tab?: string): string {
  const c = CHARACTERS[name];
  if (!c) return href();
  const r = p3Route(name);
  return href(r ? routeSlug(r) : "reserve", c.slug, tab);
}
