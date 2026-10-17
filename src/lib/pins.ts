import { createContext } from "react";
import { foldName, NODE, WORLD } from "./map.ts";
import { itemRef, type Ref, resolve } from "./refs.ts";
import { itemSources, sourceText } from "./sources.ts";
import { gift, giftShop, roadShops, stallLabel } from "./gifts.ts";
import { getPins, updatePins } from "./track.ts";
import type { RouteName } from "./types.ts";

/*
 * Pinned items (D-108): an item, gift or gathering material you want to get, with the places on the site you pinned
 * it from (a unit's build stage, a chapter slot, a map place). Stored in the run state (`track.ts`, key `pins`), so
 * the run menu's export carries them. Where to get each pin is derived from the item data, never stored.
 */

export type PinKind = "item" | "gift" | "gather";

/** Where a pin was made. Containers fill it through `PinScope`; the most specific field wins the label. */
export type PinFrom = {
  route?: RouteName;
  /** The unit it is for (build page, a unit's row in a chapter). */
  unit?: string;
  /** Build stage label: "Wyvern Rider · Ch 8–10". */
  stage?: string;
  ch?: number;
  /** Chapter slot title ("Gear", "Explore"). */
  slot?: string;
  /** World Map place (place panel, place card). */
  place?: string;
  /** Authored line that came with it: the build's "where" note, "Barter for X". */
  note?: string;
};
export type PinWhy = PinFrom & { at: number };
export type Pin = { kind: PinKind; name: string; at: number; done?: number; why: PinWhy[] };

/** Origin set by the nearest `PinScope`; merged with the page's route and chapter when a pin is made. */
export const PinFromCtx = createContext<PinFrom>({});

/** One reason per unit, else per chapter, else per place: pinning again from there updates it. */
export const fromKey = (f: PinFrom): string =>
  f.unit
    ? `u:${f.route ?? ""}:${f.unit}`
    : f.ch
    ? `c:${f.route ?? ""}:${f.ch}`
    : f.place
    ? `p:${f.place}`
    : `r:${f.route ?? ""}`;

/** Fills the page scope in: route always, chapter when nothing more specific says where. */
export function resolveFrom(from: PinFrom, scope: { route: RouteName | null; chapter: number | null }): PinFrom {
  const out: PinFrom = { ...from, route: from.route ?? scope.route ?? undefined };
  if (!out.unit && !out.place && !out.ch && scope.chapter) out.ch = scope.chapter;
  return out;
}

export const findPin = (pins: Pin[], kind: PinKind, name: string) =>
  pins.find((p) => p.kind === kind && p.name === name);

/** Pin (or re-pin) an item from an origin. A finished pin reopens; the pin moves to the top. */
export function addPin(kind: PinKind, name: string, from: PinFrom): void {
  const at = Date.now();
  updatePins((pins) => {
    const old = findPin(pins, kind, name);
    const k = fromKey(from);
    const why = old ? old.why.filter((w) => fromKey(w) !== k) : [];
    const prev = old?.why.find((w) => fromKey(w) === k);
    const next: Pin = { kind, name, at: old?.at ?? at, why: [...why, { ...prev, ...from, at }] };
    return [next, ...pins.filter((p) => p !== old)];
  });
}

/** Drops one origin; the pin goes when its last origin does. */
export function removeWhy(kind: PinKind, name: string, from: PinFrom): void {
  const k = fromKey(from);
  updatePins((pins) =>
    pins.flatMap((p) => {
      if (p.kind !== kind || p.name !== name) return [p];
      const why = p.why.filter((w) => fromKey(w) !== k);
      return why.length ? [{ ...p, why }] : [];
    })
  );
}

export const removePin = (kind: PinKind, name: string) =>
  updatePins((pins) => pins.filter((p) => p.kind !== kind || p.name !== name));

export function setPinDone(kind: PinKind, name: string, on: boolean): void {
  updatePins((pins) =>
    pins.map((p) => (p.kind === kind && p.name === name ? { ...p, done: on ? Date.now() : undefined } : p))
  );
}

export const clearDonePins = () => updatePins((pins) => pins.filter((p) => !p.done));

export const openPinCount = (): number => getPins().filter((p) => !p.done).length;

/** Pin kind for a resolved ref, or null when the type can't be pinned. */
export function pinKindOf(type: Ref["type"]): PinKind | null {
  return type === "item" || type === "gift" || type === "gather" ? type : null;
}

/* ---------------------------------------------------------------- where to get it */

export type SourceTag =
  | "shop"
  | "stall"
  | "barter"
  | "chest"
  | "quest"
  | "drop"
  | "story"
  | "crate"
  | "gather"
  | "other";
export type Mat = { name: string; qty?: number; ref?: Ref };
export type Source = {
  tag: SourceTag;
  /** Location text (places inside it auto-link). */
  text: string;
  /** Chapter or condition ("Ch 4, first playthrough only"). */
  when?: string;
  /** Map places to open directly. */
  places?: string[];
  /** Barter cost, one entry per material. */
  mats?: Mat[];
  /** Listed for other routes only. */
  offRoute?: boolean;
};

const TAG: Record<string, SourceTag> = {
  buy: "shop",
  barter: "barter",
  chest: "chest",
  map: "chest",
  quest: "quest",
  drop: "drop",
  story: "story",
  crate: "crate",
};

/** "Linaria x6, Carp x2 + Bakul x10" -> one entry per material. Notes in brackets are dropped. */
export function parseMats(text: string): Mat[] {
  return text.replace(/\([^)]*\)/g, "").split(/,|\s\+\s|\sand\s/).flatMap((part) => {
    const m = /^\s*(.+?)\s*[x×]\s*(\d+)\b/.exec(part) ?? /^\s*(\d+)\s*[x×]?\s+(.+?)\s*$/.exec(part);
    if (!m) return [];
    const [name, qty] = /^\d+$/.test(m[1]) ? [m[2], Number(m[1])] : [m[1], Number(m[2])];
    const ref = resolve(name, "gather") ?? resolve(name, "gift") ?? resolve(name, "item");
    return [{ name: name.trim(), qty, ref }];
  });
}

/** Every known way to get a pinned thing, this route's first. */
export function pinSources(kind: PinKind, name: string, route: RouteName | null): Source[] {
  if (kind === "item") {
    return itemSources(name, { route, all: true }).map((g): Source => ({
      tag: TAG[g.k] ?? "other",
      text: g.k === "barter" ? `Vandahl ${g.at}` : sourceText(g),
      when: g.ch,
      places: g.place ? [g.place] : undefined,
      mats: g.k === "barter" && g.cost ? parseMats(g.cost) : undefined,
      offRoute: g.offRoute,
    }));
  }
  if (kind === "gift") {
    const g = gift(name);
    const stalls = (g?.sold ?? []).filter((s) => giftShop(s.shop)?.dagsion).map((s): Source => ({
      tag: "stall",
      text: `Dagsion, ${stallLabel(s.shop)}${s.conf === "unconfirmed" ? " ?" : ""}`,
      when: s.from ? `from Ch ${s.from}` : undefined,
      places: ["Dagsion"],
    }));
    const road = roadShops(name, route).map((shop): Source => ({ tag: "shop", text: shop, places: [shop] }));
    const other = g?.other ? [{ tag: "other" as const, text: g.other }] : [];
    return [...stalls, ...road, ...other];
  }
  const it = Object.values(WORLD.items).find((x) => foldName(x.name) === foldName(name));
  if (!it) return [];
  const spots = it.places.map((p) => NODE[p]?.name ?? p);
  return [
    ...(spots.length ? [{ tag: "gather" as const, text: spots.join(", "), places: spots }] : []),
    ...it.other.map((o): Source => ({ tag: "other", text: o.where, when: o.detail || undefined })),
  ];
}

/** Kicker line for a pin card: type, rank, price. */
export function pinKicker(kind: PinKind, name: string): string {
  if (kind === "item") {
    const it = itemRef(name);
    if (!it) return "Item";
    return [it.kind, it.type, it.rank && `Rank ${it.rank}`, it.price ? `${it.price.toLocaleString("en-US")}G` : ""]
      .filter(Boolean).join(" · ");
  }
  if (kind === "gift") {
    const g = gift(name);
    return ["Gift", g?.likes, g?.price ? `${g.price.toLocaleString("en-US")}G` : ""].filter(Boolean).join(" · ");
  }
  const it = Object.values(WORLD.items).find((x) => foldName(x.name) === foldName(name));
  return ["Gathering", it?.kind].filter(Boolean).join(" · ");
}

/** Short label for an origin: "Theodora", "Ch 6 · Gear", "Dagsion". */
export function fromLabel(f: PinFrom): string {
  if (f.unit) return f.unit;
  if (f.ch) return `Ch ${f.ch}${f.slot ? ` · ${f.slot}` : ""}`;
  if (f.place) return f.place;
  return f.route ?? "Pinned";
}
