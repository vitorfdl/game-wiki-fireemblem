import * as REFS from "virtual:refs";
import { char, META } from "./data.ts";
import type { RouteName } from "./types.ts";
import { routeUnits } from "./walkthrough/builds.ts";

/* Gift picks, derived from the catalog in repo-root gifts.json (one owner: price, shops, who likes what).
   Nothing here is authored per route: targets come from the army plan and each unit's recruit gate. */

export type GiftSale = { shop: string; from?: number; conf?: "player" | "unconfirmed"; note?: string };
export type Gift = {
  price?: number;
  rarity?: "Common" | "Rare";
  likes?: string;
  sold?: GiftSale[];
  other?: string;
  loved?: string[];
  really?: string[];
  /** Loved per one source only: counted as really liked until confirmed. */
  lovedQ?: string[];
};
export type GiftProfile = { bio?: string; categories?: string[]; not?: string[] };
export type GiftShop = { where: string; dagsion: boolean; restock?: string };

// Typed here: the virtual module's declaration refers back to these types, which leaves them `unknown` otherwise.
const GIFTS = REFS.GIFTS as Record<string, Gift>;
const GIFT_SHOPS = REFS.GIFT_SHOPS as Record<string, GiftShop>;
const GIFT_PLACES = REFS.GIFT_PLACES as Record<string, { note: string; routes?: string[] }>;

/** 2 = loved (two gold arrows), 1 = really liked, 0 = no gain worth a gift. */
export type Tier = 0 | 1 | 2;

export const giftNames = Object.keys(GIFTS);
export const gift = (name: string): Gift | undefined => GIFTS[name];
export const giftShop = (shop: string): GiftShop | undefined => GIFT_SHOPS[shop];
export const placeNote = (shop: string) => GIFT_PLACES[shop];
export const giftAvoid = REFS.GIFT_AVOID as { who: string[]; what: string; src?: string[] }[];

/** Dagsion stalls in display order: the cheap Lowtown stall first. */
export const STALLS = Object.entries(GIFT_SHOPS).filter(([, s]) => s.dagsion).map(([k]) => k);
const STALL_LABEL: Record<string, string> = { "Gift Vendor": "Lowtown Tavern", "Market Vendor": "Midtown Arcade" };
export const stallLabel = (shop: string) => STALL_LABEL[shop] ?? shop;

const GIFT_PROFILES = REFS.GIFT_PROFILES as Record<string, GiftProfile>;
export const giftProfile = (unit: string): GiftProfile | undefined => GIFT_PROFILES[unit];

/** Gifts a unit is reported to dislike: their own `not` list plus group avoid lines ("Coffee" covers every coffee). */
export function dislikes(unit: string, name: string): boolean {
  const n = name.toLowerCase();
  const hit = (w: string) => n === w.toLowerCase() || n.includes(w.toLowerCase());
  return (GIFT_PROFILES[unit]?.not ?? []).some(hit) ||
    (REFS.GIFT_AVOID as { who: string[]; what: string }[]).some((a) => a.who.includes(unit) && hit(a.what));
}

export function tierOf(unit: string, name: string): Tier {
  const g = GIFTS[name];
  if (!g || dislikes(unit, name)) return 0;
  return g.loved?.includes(unit) ? 2 : g.really?.includes(unit) || g.lovedQ?.includes(unit) ? 1 : 0;
}

/** The Dagsion sale that covers this chapter, if any. A confirmed sale wins over an unconfirmed one. */
export function dagsionSale(name: string, ch: number): GiftSale | undefined {
  const sales = (GIFTS[name]?.sold ?? []).filter((s) => GIFT_SHOPS[s.shop]?.dagsion && (s.from ?? 0) <= ch);
  return sales.find((s) => s.conf !== "unconfirmed") ?? sales[0];
}

/** Settlements and peddlers that sell it, minus places the route can't reach in Part I. */
export function roadShops(name: string, route?: RouteName | null): string[] {
  return (GIFTS[name]?.sold ?? [])
    .filter((s) => !GIFT_SHOPS[s.shop]?.dagsion)
    .filter((s) => !route || !GIFT_PLACES[s.shop]?.routes || GIFT_PLACES[s.shop].routes!.includes(route))
    .map((s) => s.shop);
}

/** What a stall sells in a chapter, cheapest first. Unconfirmed lines come last. */
export function stallStock(shop: string, ch: number): { name: string; sale: GiftSale }[] {
  return giftNames
    .flatMap((name) => {
      const sale = (GIFTS[name].sold ?? []).find((s) => s.shop === shop);
      return sale ? [{ name, sale }] : [];
    })
    .sort((a, b) =>
      Number((a.sale.from ?? 0) > ch) - Number((b.sale.from ?? 0) > ch) ||
      Number(a.sale.conf === "unconfirmed") - Number(b.sale.conf === "unconfirmed") ||
      (GIFTS[a.name].price ?? 1e9) - (GIFTS[b.name].price ?? 1e9)
    );
}

export type Pick = { name: string; tier: Tier; price?: number; sale?: GiftSale; road?: string[] };

const byValue = (a: Pick, b: Pick) =>
  b.tier - a.tier ||
  Number(a.sale?.conf === "unconfirmed") - Number(b.sale?.conf === "unconfirmed") ||
  (a.price ?? 1e9) - (b.price ?? 1e9);

/**
 * A unit's gift picks for a chapter: the best Dagsion buy (no Turn cost), then up to two settlement buys that beat it
 * (loved first). Ties go to the cheaper item.
 */
export function giftPicks(unit: string, ch: number, route?: RouteName | null): { dagsion: Pick[]; road: Pick[] } {
  const all = giftNames.map((name) => ({ name, tier: tierOf(unit, name), price: GIFTS[name].price })).filter((p) =>
    p.tier
  );
  const dagsion = all
    .map((p) => ({ ...p, sale: dagsionSale(p.name, ch) }))
    .filter((p) => p.sale)
    .sort(byValue);
  const best = dagsion.find((p) => p.sale!.conf !== "unconfirmed")?.tier ?? 0;
  const road = all
    .filter((p) => !dagsion.some((d) => d.name === p.name && d.sale!.conf !== "unconfirmed"))
    .map((p) => ({ ...p, road: roadShops(p.name, route) }))
    .filter((p) => p.road.length && p.tier > best)
    .sort(byValue);
  return { dagsion: dagsion.slice(0, 2), road: road.slice(0, 2) };
}

export type GiftTarget = {
  name: string;
  support: number;
  join: number;
  estimate: boolean;
  extra: boolean;
  filler: boolean;
};

/** Units that join through Support: the army plan (roster and extras) plus the route's fillers, by join chapter. */
export function giftTargets(route: RouteName): GiftTarget[] {
  const gate = (n: string) => {
    const g = char(n)?.recruitOn?.[route];
    return g?.how === "recruit" && (g.support ?? 0) > 1 ? g.support! : 0;
  };
  const army = routeUnits(route)
    .filter((u) => !u.lord && gate(u.name))
    .map((u) => ({
      name: u.name,
      support: gate(u.name),
      join: u.join,
      estimate: u.estimate,
      extra: u.extra,
      filler: false,
    }));
  const fillers = (META.routes[route].fillers ?? [])
    .filter((f) => gate(f.name) && !army.some((a) => a.name === f.name))
    .map((f) => ({
      name: f.name,
      support: gate(f.name),
      join: Number(f.when.match(/Ch (\d+)/)?.[1] ?? 10),
      estimate: true,
      extra: false,
      filler: true,
    }));
  return [...army, ...fillers].sort((a, b) =>
    a.join - b.join || Number(a.filler) - Number(b.filler) || b.support - a.support || a.name.localeCompare(b.name)
  );
}

/** Who on a list loves or really likes a gift: loved first. */
export function fansOf(name: string, among?: string[]): { loved: string[]; really: string[] } {
  const g = GIFTS[name];
  const keep = (xs?: string[]) => (xs ?? []).filter((n) => !among || among.includes(n));
  return { loved: keep(g?.loved), really: keep([...(g?.really ?? []), ...(g?.lovedQ ?? [])]) };
}

/** Case-insensitive catalog lookup ("volcano ghosh" -> "Volcano Ghosh"). */
const LOWER = new Map(giftNames.map((n) => [n.toLowerCase(), n]));
export const findGift = (name: string): string | undefined => LOWER.get(name.trim().toLowerCase());
