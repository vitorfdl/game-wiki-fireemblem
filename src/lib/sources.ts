import { itemRef } from "./refs.ts";
import type { RouteName } from "./types.ts";

/**
 * Where to get an item (D-110). The only owner is weapons-and-items.json: `shops` (shops and Vandahl counters),
 * `dungeon_chests` (per Part) and each item's own `where` rows (quests, drops, story, crates, battle-map chests).
 * vite.config.ts merges them into `ItemRef.src`; builds, walkthrough, map cards and pins all read it from here.
 */
export type ItemSource = {
  /** buy | barter | chest (dungeon, by Part) | map (battle-map chest) | quest | drop | story | crate | recruit */
  k: string;
  at: string;
  /** World Map node, when the source sits on one. */
  place?: string;
  shop?: string;
  price?: number;
  /** Barter materials ("Paradise Fish x1"). */
  cost?: string;
  part?: 1 | 3;
  /** Refine level of a chest copy ("Longbow +3"). */
  plus?: number;
  ch?: string;
  route?: string;
  note?: string;
};

export const SOURCE_TAG: Record<string, string> = {
  buy: "Buy",
  barter: "Barter",
  chest: "Chest",
  map: "Map chest",
  quest: "Quest",
  drop: "Drop",
  story: "Story",
  crate: "Crate",
  recruit: "Recruit",
};

const routeOk = (s: ItemSource, route?: RouteName | null) =>
  !route || !s.route || s.route.toLowerCase().includes(route) || /\ball\b/i.test(s.route);

/**
 * Home base first: Dagsion shops and its Vandahl counter are open every week at no Turn cost, so they lead; then Part
 * I chests and quests; road shops and counters (a trip) after; Part III chests last.
 */
const rank = (s: ItemSource): number => {
  const home = s.place === "Dagsion";
  if (s.k === "buy") return home ? 0 : 5;
  if (s.k === "barter") return home ? 1 : 6;
  if (s.k === "chest") return s.part === 3 ? 8 : 2;
  return { quest: 3, map: 3, story: 4, drop: 4, crate: 7 }[s.k] ?? 9;
};

/**
 * Sources for an item, best first: this route's, then by `rank` (Dagsion, Part I chests and quests, trips, Part III).
 * `part` 1 hides Part III chests; `all` keeps other routes' sources (flagged by `offRoute`).
 */
export function itemSources(
  name: string,
  opts: { route?: RouteName | null; part?: 1 | 3; all?: boolean } = {},
): (ItemSource & { offRoute?: boolean })[] {
  const plus = Number(name.match(/\+(\d+)$/)?.[1] ?? 0);
  const list = (itemRef(name.replace(/\s+\+\d+$/, ""))?.src ?? [])
    .filter((s) => !opts.part || !s.part || s.part <= opts.part)
    // A "+3" copy only comes from chests that hold that refine; a plain name skips refined chest copies.
    .filter((s) => (plus ? s.plus === plus : !s.plus))
    .map((s) => ({ ...s, offRoute: !routeOk(s, opts.route) }));
  return list
    .filter((s) => opts.all || !s.offRoute)
    .sort((a, b) => Number(a.offRoute ?? 0) - Number(b.offRoute ?? 0) || rank(a) - rank(b));
}

/** One short line: "Dagsion Armorer 1500G", "Vandahl Alecto: Paradise Fish x1", "Cougar Woodlands (Part III)". */
export function sourceText(s: ItemSource): string {
  if (s.k === "buy") return `${s.at} ${s.shop ?? ""}${s.price ? ` ${s.price.toLocaleString("en-US")}G` : ""}`.trim();
  if (s.k === "barter") return `Vandahl ${s.at}${s.cost ? `: ${s.cost}` : ""}`;
  if (s.k === "chest") return `${s.at} (Part ${s.part === 3 ? "III" : "I"})`;
  return [s.at, s.ch].filter(Boolean).join(" · ");
}

/** Compact "Buy Dagsion Armorer 1500G · Barter Vandahl Alecto: Paradise Fish x1", capped at `max` sources. */
export function sourcesLine(name: string, opts: Parameters<typeof itemSources>[1] & { max?: number } = {}): string {
  const list = itemSources(name, opts);
  const max = opts.max ?? 3;
  const shown = list.slice(0, max).map((s) => `${SOURCE_TAG[s.k] ?? s.k} ${sourceText(s)}`);
  return shown.join(" · ") + (list.length > max ? ` · +${list.length - max} more` : "");
}

/** A planned barter's counter and materials, from the catalog: the named counter, else the first one on this route. */
export function barterAt(
  item: string,
  at?: string,
  route?: RouteName | null,
): { at: string; cost?: string } | undefined {
  const list = itemSources(item, { route, all: true }).filter((s) => s.k === "barter");
  const hit = (at && list.find((s) => s.at === at || s.place === at)) || list[0];
  return hit ? { at: hit.at, cost: hit.cost } : at ? { at } : undefined;
}

/** "Paradise Fish x1 · Vandahl Alecto (Second Paradise Fish)" for a planned barter row. */
export function barterText(b: { item: string; at?: string; note?: string }, route?: RouteName | null): string {
  const s = barterAt(b.item, b.at, route);
  const where = s ? `Vandahl [[place:${s.at}]]` : "Vandahl";
  return [s?.cost ?? "cost ?", where].join(" · ") + (b.note ? ` (${b.note})` : "");
}
