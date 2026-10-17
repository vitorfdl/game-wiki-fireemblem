import { ITEMS } from "virtual:refs";
import { META } from "./data.ts";
import { itemTier } from "./growth.ts";
import type { ItemRef } from "./refs.ts";
import { itemSources } from "./sources.ts";
import type { RouteName } from "./types.ts";
import { routeUnits, stageLabel } from "./walkthrough/builds.ts";

/*
 * Field Kit > Items (D-114): every weapon, equipment piece and consumable in `weapons-and-items.json` (shipped as
 * `ITEMS`), with who plans it. Sources come from `sources.ts` (D-110); users from the unit builds. Nothing is stored.
 */

export type ItemCat = "Weapon" | "Equipment" | "Item";
export const CATS: { id: ItemCat; label: string }[] = [
  { id: "Weapon", label: "Weapons" },
  { id: "Equipment", label: "Equipment" },
  { id: "Item", label: "Consumables" },
];

/** One unit whose build carries the item: first stage that lists it, and the refine it names. */
export type ItemUser = { name: string; route: RouteName; when: string; cls: string; plus?: number; stages: number };

export type CatalogItem = ItemRef & { name: string; tier: string; order: number };

/** Group rows ("Skill manuals (...)") stand for their members, which have rows of their own. */
export const CATALOG: CatalogItem[] = Object.entries(ITEMS as Record<string, ItemRef>)
  .filter(([, it]) => !it.group)
  .map(([name, it], order) => ({ ...it, name, tier: it.kind === "Weapon" ? itemTier(name) : "", order }));

const base = (n: string) => n.replace(/\s*\+\d+$/, "").trim().toLowerCase();

let usersCache: Map<string, ItemUser[]> | null = null;

/** Every route's planned carriers per item (weapons, equipment and consumables of any stage). */
export function itemUsers(): Map<string, ItemUser[]> {
  if (usersCache) return usersCache;
  const out = new Map<string, ItemUser[]>();
  for (const route of META.order) {
    for (const u of routeUnits(route)) {
      const seen = new Map<string, ItemUser>();
      for (const ps of u.stages) {
        const gear = [...(ps.stage.weapons ?? []), ...(ps.stage.equipment ?? []), ...(ps.stage.items ?? [])];
        for (const g of gear) {
          const k = base(g.item);
          const plus = Number(g.item.match(/\+(\d+)$/)?.[1] ?? 0) || undefined;
          const hit = seen.get(k);
          if (hit) {
            hit.stages++;
            if (plus && (!hit.plus || plus > hit.plus)) hit.plus = plus;
          } else seen.set(k, { name: u.name, route, when: stageLabel(ps), cls: ps.cls, plus, stages: 1 });
        }
      }
      for (const [k, user] of seen) (out.get(k) ?? out.set(k, []).get(k)!).push(user);
    }
  }
  usersCache = out;
  return out;
}

export const usersOf = (name: string): ItemUser[] => itemUsers().get(base(name)) ?? [];

/** Source kinds the filter offers; `other` folds story, drop, crate and recruit. */
export type SrcKind = "buy" | "barter" | "chest" | "quest" | "other";
export const SRC_KINDS: { id: SrcKind; label: string }[] = [
  { id: "buy", label: "Shop" },
  { id: "barter", label: "Barter" },
  { id: "chest", label: "Chest" },
  { id: "quest", label: "Quest" },
  { id: "other", label: "Drop · story" },
];

export function srcKinds(name: string, route: RouteName): Set<SrcKind> {
  return new Set(
    itemSources(name, { route }).map((s): SrcKind =>
      s.k === "buy" || s.k === "barter" || s.k === "quest" ? s.k : s.k === "chest" || s.k === "map" ? "chest" : "other"
    ),
  );
}

export type SortKey = "default" | "name" | "mt" | "hit" | "wt" | "price" | "tier" | "users";
export const SORTS: { id: SortKey; label: string }[] = [
  { id: "default", label: "Catalog order" },
  { id: "tier", label: "Tier" },
  { id: "mt", label: "Might" },
  { id: "hit", label: "Hit" },
  { id: "wt", label: "Lightest" },
  { id: "price", label: "Price" },
  { id: "users", label: "Most planned" },
  { id: "name", label: "Name" },
];

const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };

export function sortItems(list: CatalogItem[], key: SortKey, route: RouteName): CatalogItem[] {
  const num = (v: number | undefined, desc: boolean) => (v === undefined ? Infinity : desc ? -v : v);
  const users = (it: CatalogItem) => usersOf(it.name).filter((u) => u.route === route).length;
  const by: Record<SortKey, (a: CatalogItem, b: CatalogItem) => number> = {
    default: (a, b) => a.order - b.order,
    name: (a, b) => a.name.localeCompare(b.name),
    mt: (a, b) => num(a.mt, true) - num(b.mt, true),
    hit: (a, b) => num(a.hit, true) - num(b.hit, true),
    wt: (a, b) => num(a.wt, false) - num(b.wt, false),
    price: (a, b) => num(a.price, true) - num(b.price, true),
    tier: (a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9),
    users: (a, b) => users(b) - users(a),
  };
  return [...list].sort((a, b) => by[key](a, b) || a.order - b.order);
}
