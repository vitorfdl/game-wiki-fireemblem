import type { Missable, RouteName, SalvationFile, SquadsFile, WarChapterFile } from "./types.ts";
import { examsFor, missableId, slug } from "./chapter.ts";
import { P3, pos, section } from "./parts.ts";
import { foldName, WORLD } from "./map.ts";
import type { LaterPart } from "./track.ts";

/*
 * Plan files for Part II and III (D-124): `walkthrough/<route>/war-chNN.json`, `salvation-sNN.json` and `squads.json`.
 * They hold choices only; facts come from lib/parts.ts and the build stages.
 */

const war = import.meta.glob<WarChapterFile>("../data/walkthrough/*/war-ch*.json", { eager: true, import: "default" });
const sal = import.meta.glob<SalvationFile>("../data/walkthrough/*/salvation-s*.json", {
  eager: true,
  import: "default",
});
const sq = import.meta.glob<SquadsFile>("../data/walkthrough/*/squads.json", { eager: true, import: "default" });

export const warFile = (r: RouteName, ch: number) => Object.values(war).find((f) => f.route === r && f.ch === ch);
export const salvationFile = (r: RouteName, n: number) => Object.values(sal).find((f) => f.route === r && f.n === n);
export const squadsFile = (r: RouteName) => Object.values(sq).find((f) => f.route === r);
export const squadsAt = (r: RouteName, n: number) => squadsFile(r)?.sections.find((s) => s.n === n);

/** Tracked ids in Part II and III. */
export const pids = {
  gate: (r: RouteName, n: number, battle: string) => `${slug(r)}-s${n}-gate-${slug(battle)}`,
  p3quest: (id: string) => `p3-quest-${id}`,
  merge: (r: RouteName, unit: string) => `${slug(r)}-merge-${slug(unit)}`,
  plan: (r: RouteName, part: LaterPart, n: number, text: string) => `${slug(r)}-${part}-${n}-plan-${slug(text)}`,
  join: (r: RouteName, unit: string) => `${slug(r)}-p3-join-${slug(unit)}`,
  license: (r: RouteName, unit: string, cls: string) => `${slug(r)}-p3-license-${slug(unit)}-${slug(cls)}`,
  key: (dungeon: string) => `p3-diadem-key-${slug(dungeon)}`,
  temple: (god: string, step: "repair" | "request" | "trial") => `p3-temple-${slug(god)}-${step}`,
  war: (r: RouteName, ch: number) => `${slug(r)}-war-ch${ch}-won`,
};

const mids = (r: RouteName, m: Missable[]) => m.map((x) => missableId(r, x));

/** Every tracked event of a War chapter or Section: the rail's progress ring. */
export function partEvents(r: RouteName, part: LaterPart, n: number): { ids: string[]; missables: Missable[] } {
  const p = pos(part === "war" ? 2 : 3, n);
  const exams = examsFor(r, p).filter((e) => !e.onJoin).map((e) => e.id);
  if (part === "war") {
    const f = warFile(r, n);
    return { ids: [...mids(r, f?.missables ?? []), ...exams, pids.war(r, n)], missables: f?.missables ?? [] };
  }
  const f = salvationFile(r, n);
  const gates = (section(n)?.battles ?? []).filter((b) => !b.kind || b.kind === "skirmish").map((b) =>
    pids.gate(r, n, b.name)
  );
  return {
    ids: [
      ...mids(r, f?.missables ?? []),
      ...exams,
      ...(f?.quests ?? []).map((q) => pids.p3quest(q.id)),
      ...(f?.merges ?? []).map((m) => pids.merge(r, m.unit)),
      ...(f?.licenses ?? []).map((l) => pids.license(r, l.unit, l.to)),
      ...gates,
    ],
    missables: f?.missables ?? [],
  };
}

const SECTION_PLACES = new Map<string, Set<string>>();

/**
 * Map places a Section mentions (slugs): its plan file (Free Time rows, quests, gates, missables) and its facts (flow,
 * overworld, battle locations, the quests it opens). The Map tab highlights them in Part III.
 */
export function sectionPlaces(r: RouteName, n: number): Set<string> {
  const k = `${r}:${n}`;
  const hit = SECTION_PLACES.get(k);
  if (hit) return hit;
  const s = section(n);
  const f = salvationFile(r, n);
  const quests = [...(s?.quests ?? []), ...(f?.quests ?? []).map((q) => q.id)];
  const text = foldName(
    JSON.stringify([
      f,
      s?.flow,
      s?.overworld,
      s?.battles.map((b) => [b.location, b.gate]),
      P3.quests.filter((q) => quests.includes(q.id) || quests.includes(q.name)).map((q) => [q.where, q.repair?.place]),
    ]),
  );
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out = new Set(
    WORLD.nodes.filter((nd) => nd.name.length >= 4 && new RegExp(`\\b${esc(foldName(nd.name))}\\b`).test(text))
      .map((nd) => nd.slug),
  );
  SECTION_PLACES.set(k, out);
  return out;
}
