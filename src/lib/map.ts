import mapJson from "../data/world-map.json" with { type: "json" };
import type { RouteName } from "./types.ts";
import { walkthrough } from "./walkthrough/model.ts";
import { plain } from "./walkthrough/sources.ts";

export type MapKind =
  | "settlement"
  | "posthouse"
  | "dungeon"
  | "stronghold"
  | "temple"
  | "field"
  | "feast"
  | "base"
  | "unconfirmed";

export type MapNode = {
  slug: string;
  name: string;
  kind: MapKind;
  x: number;
  y: number;
  region?: string;
  unlock?: string;
  gated?: boolean;
  links?: string[];
  items?: string[];
  post?: { name: string; via: string[] };
  dungeon?: boolean;
};

export type MapItem = {
  name: string;
  kind: string;
  neededBy: string[];
  places: string[];
  other: { where: string; detail: string }[];
};

type MapData = {
  width: number;
  height: number;
  nodes: MapNode[];
  items: Record<string, MapItem>;
  unplaced: { name: string; region?: string; kind: string }[];
};

/** World map nodes and gathering items, from fortunesweave.co.uk's map (pixel positions on the mosaic). */
export const WORLD = mapJson as unknown as MapData;
export const NODE: Record<string, MapNode> = Object.fromEntries(WORLD.nodes.map((n) => [n.slug, n]));

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’]/g, "'");

/** Lowercased, accent-free name -> node, for matching walkthrough text ("Mahon" finds "Mahón"). */
export const NODE_BY_NAME = new Map(WORLD.nodes.map((n) => [fold(n.name).toLowerCase(), n]));

/** Item names that are also everyday words never become map links. */
const ITEM_SKIP = new Set(["coin", "dates", "large coin"]);
export const ITEM_BY_NAME = new Map(
  Object.entries(WORLD.items)
    .filter(([, it]) => it.places.length && it.name.length >= 4 && !ITEM_SKIP.has(it.name.toLowerCase()))
    .map(([key, it]) => [fold(it.name).toLowerCase(), key]),
);

export const foldName = (s: string) => fold(s).toLowerCase();

/** Every place and item name, longest first, for one regex alternative (accent-insensitive). */
/**
 * Place names that are also people or weapon names ("Da Mina Spear", Hannibal, Fina): never auto-linked in text.
 * `[[place:...]]` refs still work for them.
 */
const NO_AUTOLINK = new Set(["da mina", "hannibal", "fina"]);

export function mapNamePattern(): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = [
    ...WORLD.nodes.map((n) => n.name).filter((n) => n.length >= 4 && !NO_AUTOLINK.has(foldName(n))),
    ...[...ITEM_BY_NAME.keys()].map((k) => WORLD.items[ITEM_BY_NAME.get(k)!].name),
  ];
  const variants = new Set<string>();
  for (const n of names) {
    variants.add(n);
    variants.add(fold(n));
  }
  return [...variants].sort((a, b) => b.length - a.length).map(esc).join("|");
}

const mentionCache = new Map<RouteName, Map<string, number[]>>();

/** Which chapters of a route's walkthrough mention each place (slug -> chapter numbers). */
export function placeMentions(route: RouteName): Map<string, number[]> {
  const hit = mentionCache.get(route);
  if (hit) return hit;
  const out = new Map<string, number[]>();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nodes = WORLD.nodes.filter((n) => n.name.length >= 4).map((n) => ({
    n,
    re: new RegExp(`\\b${esc(foldName(n.name))}\\b`),
  }));
  for (const sec of walkthrough(route).sections) {
    if (!sec.chapter) continue;
    const text = foldName(sec.groups.map((g) => `${g.title ?? ""} ${plain(g.tokens)}`).join(" "));
    for (const { n, re } of nodes) {
      if (re.test(text)) out.set(n.slug, [...(out.get(n.slug) ?? []), sec.chapter]);
    }
  }
  mentionCache.set(route, out);
  return out;
}
