import { CHARACTERS, fillers, supportLinks } from "./data.ts";
import { chapterFile, freeDays, recruitGate } from "./chapter.ts";
import { type GiftTarget, giftTargets } from "./gifts.ts";
import type { RouteName } from "./types.ts";
import { routeUnits } from "./walkthrough/builds.ts";

/* Field Kit › Meals (D-115). Everything is derived: the queue from the recruit gates (giftTargets), the time left
   from the chapter files' free-time dates, and the pairings from each unit's `supports` list (mutual, D-79). */

export type MealStatus = "now" | "soon" | "later" | "done";

export type MealTarget = GiftTarget & {
  rank: number;
  status: MealStatus;
  /** Free-time days left before the recruit chapter, summed from chapter files; undefined when a chapter has no file. */
  days?: number;
  renown?: number;
  /** "~5/29" when the unit only shows up in Dagsion later. */
  from?: string;
  /** Support partners who are also open targets: one meal grows both recruit Supports and their pair. */
  targets: string[];
  /** Support partners already in the army (or fillers that aren't targets). */
  army: string[];
};

/** Free-time days in chapters [from, to). Undefined if any of those chapters has no file. */
function daysBetween(route: RouteName, from: number, to: number): number | undefined {
  let sum = 0;
  for (let c = from; c < to; c++) {
    const f = chapterFile(route, c);
    if (!f) return undefined;
    sum += freeDays(f.free);
  }
  return sum;
}

/** Everyone on the route: lord, army plan (roster and extras), fillers. */
export function routeCast(route: RouteName): string[] {
  return [...new Set([...routeUnits(route).map((u) => u.name), ...fillers(route).map((f) => f.name)])];
}

/** Partners of a unit (both directions), by name. */
export const partnersOf = (name: string): string[] => {
  const c = CHARACTERS[name];
  return c ? supportLinks(c, null).map((l) => l.name) : [];
};

/** Recruit-Support queue: earliest recruit chapter first, then the higher Support need, fillers last (giftTargets). */
export function mealQueue(route: RouteName, ch: number): MealTarget[] {
  const all = giftTargets(route);
  const open = new Set(all.filter((t) => t.join >= ch).map((t) => t.name));
  const cast = new Set(routeCast(route));
  let rank = 0;
  return all.map((t) => {
    const done = t.join < ch;
    const days = done ? 0 : daysBetween(route, ch, t.join);
    const status: MealStatus = done ? "done" : t.join === ch ? "now" : t.join - ch <= 2 ? "soon" : "later";
    const gate = recruitGate(route, t.name);
    const from = gate?.task?.match(/Dagsion\s*~?\s*(\d{1,2}\/\d{1,2})/)?.[1];
    const partners = partnersOf(t.name).filter((p) => p !== route);
    return {
      ...t,
      rank: done ? 0 : ++rank,
      status,
      days,
      renown: gate?.renown,
      from,
      targets: partners.filter((p) => open.has(p)),
      army: partners.filter((p) => !open.has(p) && cast.has(p)),
    };
  });
}

/* ------------------------------------------------------------ support graph */

export type GraphNode = { name: string; x: number; y: number; lord: boolean };
export type GraphEdge = { a: string; b: string };
export type SupportGraph = { nodes: GraphNode[]; edges: GraphEdge[]; loners: string[]; w: number; h: number };

/**
 * Support pairs among a set of characters, laid out by a small deterministic force simulation (springs on pairs,
 * repulsion between all, the lord pinned in the middle). Characters with no partner in the set are returned as
 * `loners` instead of floating in the picture.
 */
export function supportGraph(route: RouteName, names: string[], w = 860, h = 540): SupportGraph {
  const set = new Set(names);
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const a of names) {
    for (const b of partnersOf(a)) {
      if (!set.has(b) || a === b) continue;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push({ a, b });
    }
  }
  const linked = new Set(edges.flatMap((e) => [e.a, e.b]));
  const placed = names.filter((n) => linked.has(n) || n === route);
  const loners = names.filter((n) => !linked.has(n) && n !== route);

  const idx = new Map(placed.map((n, i) => [n, i]));
  const n = placed.length;
  const pos = placed.map((name, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    return name === route
      ? { x: w / 2, y: h / 2 }
      : { x: w / 2 + Math.cos(a) * w * 0.38, y: h / 2 + Math.sin(a) * h * 0.38 };
  });
  const k = Math.sqrt((w * h) / Math.max(1, n)) * 0.62;
  const pad = 34;
  for (let it = 0; it < 600; it++) {
    const t = 18 * (1 - it / 600) + 0.6;
    const d = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const f = (k * k) / dist;
        d[i].x += (dx / dist) * f, d[i].y += (dy / dist) * f;
        d[j].x -= (dx / dist) * f, d[j].y -= (dy / dist) * f;
      }
    }
    for (const e of edges) {
      const i = idx.get(e.a), j = idx.get(e.b);
      if (i === undefined || j === undefined) continue;
      const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const f = (dist * dist) / k;
      d[i].x -= (dx / dist) * f, d[i].y -= (dy / dist) * f;
      d[j].x += (dx / dist) * f, d[j].y += (dy / dist) * f;
    }
    // keep portraits off lines they aren't on, so a pair never reads as passing through a third unit
    if (it > 150) {
      for (const e of edges) {
        const i = idx.get(e.a), j = idx.get(e.b);
        if (i === undefined || j === undefined) continue;
        const ax = pos[i].x, ay = pos[i].y, bx = pos[j].x, by = pos[j].y;
        const len2 = Math.max(1, (bx - ax) ** 2 + (by - ay) ** 2);
        for (let m = 0; m < n; m++) {
          if (m === i || m === j) continue;
          const u = Math.max(0, Math.min(1, ((pos[m].x - ax) * (bx - ax) + (pos[m].y - ay) * (by - ay)) / len2));
          const px = ax + u * (bx - ax), py = ay + u * (by - ay);
          const dx = pos[m].x - px, dy = pos[m].y - py;
          const dist = Math.max(0.5, Math.hypot(dx, dy));
          if (dist > 40 || u <= 0 || u >= 1) continue;
          const f = (40 - dist) * 3;
          d[m].x += (dx / dist) * f, d[m].y += (dy / dist) * f;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (placed[i] === route) continue;
      // gravity keeps small clusters from drifting to the frame
      d[i].x += (w / 2 - pos[i].x) * 0.06;
      d[i].y += (h / 2 - pos[i].y) * 0.09;
      const len = Math.max(1, Math.hypot(d[i].x, d[i].y));
      pos[i].x = Math.min(w - pad, Math.max(pad, pos[i].x + (d[i].x / len) * Math.min(len, t)));
      pos[i].y = Math.min(h - pad - 10, Math.max(pad, pos[i].y + (d[i].y / len) * Math.min(len, t)));
    }
  }
  return {
    nodes: placed.map((name, i) => ({ name, x: pos[i].x, y: pos[i].y, lord: name === route })),
    edges,
    loners,
    w,
    h,
  };
}

/** Every character with a support list, for the "Everyone" view. */
export const everyone = (): string[] =>
  Object.values(CHARACTERS).filter((c) => (c.supports?.length ?? 0) > 0 || partnersOf(c.name).length).map((c) =>
    c.name
  );
