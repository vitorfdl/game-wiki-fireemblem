import routesIndex from "../data/routes/index.json" with { type: "json" };
import classesJson from "../data/classes.json" with { type: "json" };
import itemTiersJson from "../data/item-tiers.json" with { type: "json" };
import type { Character, ClassRow, RouteInfo, RouteName, RoutesMeta } from "./types.ts";
import { ROUTE_NAMES } from "./types.ts";

const characterModules = import.meta.glob<Character>("../data/characters/*.json", { eager: true, import: "default" });

const routeModules = import.meta.glob<RouteInfo>("../data/routes/*.json", { eager: true, import: "default" });
const ROUTE_FILES = Object.fromEntries(
  Object.entries(routeModules).filter(([k]) => !k.endsWith("index.json")).map(([, v]) => [v.lord, v]),
) as Record<RouteName, RouteInfo>;

/** routes/index.json holds the cross-route fields; routes/<route>.json one route each. */
export const META = { ...(routesIndex as Omit<RoutesMeta, "routes">), routes: ROUTE_FILES } as RoutesMeta;
export const CLASSES = classesJson as Record<string, ClassRow>;
export const ITEM_TIERS = itemTiersJson as Record<string, string>;

export const CHARACTERS: Record<string, Character> = Object.fromEntries(
  Object.values(characterModules).map((c) => [c.name, c]),
);
const BY_SLUG: Record<string, Character> = Object.fromEntries(Object.values(CHARACTERS).map((c) => [c.slug, c]));

export const routeSlug = (r: RouteName): string => r.toLowerCase();

export function routeFromSlug(s: string | undefined): RouteName | undefined {
  return ROUTE_NAMES.find((r) => routeSlug(r) === s);
}

export function characterBySlug(s: string | undefined): Character | undefined {
  return s ? BY_SLUG[s] : undefined;
}

export function char(name: string): Character | undefined {
  return CHARACTERS[name];
}

/** Second copies that fight in Part I: they hold a lineup slot or deploy in a phase (D-74). */
export function fightingCopies(r: RouteName): Set<string> {
  const dep = META.routes[r].deployment;
  const fights = new Set([
    ...(dep?.lineup ?? []).flatMap((s) => s.holders.map((h) => h.unit)),
    ...(dep?.phases ?? []).flatMap((p) => p.deploy),
  ]);
  return new Set(META.routes[r].extras.filter((n) => fights.has(n)));
}

/**
 * Lord first, then the army in join order: home units and the second copies that fight (D-74, D-81). The order the
 * dossier arrows and the roster rail step through. Waiting copies and fillers are not in it.
 */
export function routeLineup(r: RouteName): string[] {
  const info = META.routes[r];
  const fight = fightingCopies(r);
  const units = [
    ...info.roster.map((u, i) => ({ name: u.name, join: u.chapter, i })),
    ...info.extras.filter((n) => fight.has(n)).map((n, i) => ({
      name: n,
      join: CHARACTERS[n]?.copies?.find((x) => x.route === r)?.chapter ?? 12,
      i: info.roster.length + i,
    })),
  ];
  units.sort((a, b) => a.join - b.join || a.i - b.i);
  return [r, ...units.map((u) => u.name)];
}

export function rosterEntry(name: string, r: RouteName) {
  return META.routes[r].roster.find((u) => u.name === name);
}

export const ordinal = (r: RouteName): string => ["1st", "2nd", "3rd", "4th"][META.order.indexOf(r)];

const TIER_SCORE: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 };

/** Up to four units per route with the best published tiers; a support with the lord breaks ties. */
export function champions(r: RouteName): Set<string> {
  const score = (n: string) => {
    const c = CHARACTERS[n];
    const tiers = (c?.tiers ?? []).reduce((s, t) => s + (TIER_SCORE[t.tier] ?? 0), 0);
    return tiers + (c?.supports?.some((s) => s.startsWith(r)) ? 1 : 0);
  };
  const ranked = META.routes[r].roster.map((u, i) => ({ n: u.name, s: score(u.name), i }));
  ranked.sort((a, b) => b.s - a.s || a.i - b.i);
  return new Set(ranked.slice(0, 4).map((x) => x.n));
}

/** Which wanted classes a route arrives with from earlier paths, and which it goes without. */
export function classCarry(r: RouteName): { gives: string[]; got: string[]; miss: string[] } {
  const i = META.order.indexOf(r);
  const earlier = META.order.slice(0, i).flatMap((x) => META.routes[x].unlocks.gives.map((g) => g.replace("*", "")));
  const { gives, wants } = META.routes[r].unlocks;
  return { gives, got: wants.filter((w) => earlier.includes(w)), miss: wants.filter((w) => !earlier.includes(w)) };
}

export const totalUnits = META.order.reduce((s, r) => s + META.routes[r].roster.length + 1, 0);

/** Part I class goal for a card: the build target, else the last class on the path. */
export function goalClass(c: Character | undefined): string {
  return c?.build?.part1Target ?? c?.build?.path?.at(-1) ?? "";
}

export type SupportLink = { name: string; rank?: string; character?: Character; sameArmy: boolean };

const parseSupport = (raw: string) => {
  const m = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return { name: (m?.[1] ?? raw).trim(), rank: m?.[2] };
};

/** Support is mutual: a pair listed on either unit's file counts for both. */
const SUPPORTED_BY = new Map<string, Set<string>>();
for (const c of Object.values(CHARACTERS)) {
  for (const raw of c.supports ?? []) {
    const { name } = parseSupport(raw);
    if (!SUPPORTED_BY.has(name)) SUPPORTED_BY.set(name, new Set());
    SUPPORTED_BY.get(name)!.add(c.name);
  }
}

/** Support partners, parsed from "Name" or "Name (A)" on either side of the pair, with partners in the given army first. */
export function supportLinks(c: Character, army: RouteName | null | undefined): SupportLink[] {
  const own = (c.supports ?? []).map(parseSupport);
  const back = [...(SUPPORTED_BY.get(c.name) ?? [])].filter((n) => !own.some((o) => o.name === n)).map((name) => ({
    name,
    rank: undefined as string | undefined,
  }));
  const links = [...own, ...back].map(({ name, rank }) => {
    const other = CHARACTERS[name];
    const inArmy = Boolean(
      army && other && (other.homeRoute === army || META.routes[army].extras.includes(name) ||
        Boolean(fillerEntry(name, army))),
    );
    return { name, rank, character: other, sameArmy: inArmy };
  });
  return links.sort((a, b) => Number(b.sameArmy) - Number(a.sameArmy));
}

export function fillers(r: RouteName) {
  return META.routes[r].fillers ?? [];
}

export function fillerEntry(name: string, r: RouteName | null | undefined) {
  return r ? fillers(r).find((f) => f.name === name) : undefined;
}

/** Support partners present in an army: its home units, Part II extras and fillers. */
export function partnersInArmy(c: Character, r: RouteName): string[] {
  return supportLinks(c, r).filter((l) => l.sameArmy).map((l) => l.name);
}

export function deployStatus(name: string, r: RouteName) {
  return META.routes[r].deployment?.units[name];
}

/** Dossier link for a character in their home army (or the later-joiners list). */
export function charHref(c: Character): string {
  return c.homeRoute ? `#/${routeSlug(c.homeRoute)}/${c.slug}` : `#/reserve/${c.slug}`;
}
