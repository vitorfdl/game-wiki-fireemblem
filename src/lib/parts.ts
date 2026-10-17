import { GODS, ITEMS, PART2, PART3 } from "virtual:refs";
import type { ItemSource } from "./sources.ts";
import type { RouteName } from "./types.ts";

/*
 * Part II (War) and Part III (Salvation): the facts from repo-root part2-war.json and part3-salvation.json (D-117),
 * the gods' Blessings (gods.json), and the one position scale the build plans use across Parts (D-122).
 */

export type PartKey = "war" | "salvation";
export type PartNo = 1 | 2 | 3;

export const PART_OF: Record<PartKey, PartNo> = { war: 2, salvation: 3 };
export const PART_LABEL: Record<PartNo, string> = { 1: "Part I", 2: "War", 3: "Salvation" };
export const PART_LONG: Record<PartNo, string> = {
  1: "Part I · Heroic Games",
  2: "Part II · War",
  3: "Part III · Salvation",
};

/* ------------------------------------------------------------ positions */

/**
 * One scale for the whole campaign: Part I Ch 1–12 = 1–12, Part II Ch 1–6 = 13–18, Part III Sections 1–6 = 19–24.
 * Build stages, exams and kit changes are placed on it, so a chapter view of any Part reads the same functions.
 */
export const pos = (part: PartNo, n: number): number => (part === 1 ? n : part === 2 ? 12 + n : 18 + n);

export function fromPos(p: number): { part: PartNo; n: number } {
  if (p <= 12) return { part: 1, n: p };
  if (p <= 18) return { part: 2, n: p - 12 };
  return { part: 3, n: p - 18 };
}

/** "Ch 7" · "War Ch 3" · "Section 2". */
export function posLabel(p: number): string {
  const { part, n } = fromPos(p);
  return part === 1 ? `Ch ${n}` : part === 2 ? `War Ch ${n}` : `Section ${n}`;
}

/** The item-catalog tag for drops placed in a chapter of Part II or a Section of Part III (D-117). */
export const dropTag = (part: 2 | 3, n: number) => (part === 2 ? `Part II Ch ${n}` : `Part III S${n}`);

/* ------------------------------------------------------------ Part II facts */

export type Battle = {
  name: string;
  kind?: "skirmish" | "dungeon";
  gate?: string;
  location: string;
  max_units?: number;
  squads_needed?: number;
  victory?: string;
  ideal_tier?: string;
  suggested?: { classes?: string[]; items?: string[] };
  enemies?: string[];
  reinforcements?: string;
  mechanics?: string[];
  tips?: string[];
  guests?: string[];
  recruits?: { unit: string; how: string; missable?: boolean }[];
  allies?: { turn: number; units: string[] }[];
  allies_note?: string;
  flow?: string;
  formation?: string;
  after?: string;
  sources?: string[];
};

export type WarChapter = { ch: number; name: string; prep?: string; battles: Battle[] };

export type Part2Data = {
  sources: { key: string; name: string; url: string }[];
  overview: Record<string, string | string[]>;
  carryover: Record<string, string | string[]>;
  prep: {
    licenses: string;
    divine_sand: string;
    facilities: { name: string; does: string }[];
    lord_facilities: { lord: string; does: string }[];
    facilities_until: string;
    army_actions: { name: string; does: string; levels?: Record<string, string> }[];
  };
  chapters: WarChapter[];
  missables: { when: string; text: string }[];
  open_questions: string[];
};

/* ------------------------------------------------------------ Part III facts */

export type P3Quest = {
  id: string;
  name: string;
  kind: string;
  giver?: string;
  task: string;
  where?: string;
  requires?: string;
  how?: string;
  reward: { gold?: number; relief?: number; items?: string[]; unlocks?: string[]; trial_items?: string[] };
  stops?: { at: string; items: string[]; gold: number }[];
  from_section: number;
  due: string;
  missable?: boolean;
  /** God requests: the temple to repair first and its material. */
  repair?: { place: string; material: string | null; note?: string };
  master_class?: string;
  sources?: string[];
};

export type Section = {
  n: number;
  name: string;
  free_time: { from: string; to: string } | null;
  mission_time: { from: string; to: string } | null;
  squads: number;
  turns: number | null;
  intro?: string;
  unlocks?: string[];
  scenes?: string[];
  scenes_note?: string;
  quests?: string[];
  overworld?: string[];
  /** What happens this Section, in order (facts). */
  flow?: string[];
  flow_sources?: string[];
  battles: Battle[];
  joins?: { unit: string; how: string }[];
  after?: string;
};

export type Part3Data = {
  sources: { key: string; name: string; url: string }[];
  overview: {
    unlock: string;
    point_of_no_return: string;
    storage: string;
    recruits_in_dagsion: string;
    structure: string;
    path_functions: { lord: string; functions: string[] }[];
    new_in_part3: string[];
    dungeons: string;
  };
  systems: {
    squads: string[];
    repairs: string[];
    relief: string;
    mission_time: string[];
    merge_causality: string;
    trials: string;
    facilities?: string[];
    shops?: string[];
    farming?: string[];
    mounts?: string[];
  };
  diadem: { opens: string; rules: string[]; keys: { dungeon: string; region: string; spot: string }[] };
  sections: Section[];
  quests: P3Quest[];
  missables: { when: string; text: string }[];
  open_questions: string[];
};

export type GodsData = {
  rules: string[];
  gods: { name: string; day: string; levels: { lv: number; effect: string }[] }[];
};

export const P2 = PART2 as Part2Data;
export const P3 = PART3 as Part3Data;
export const GOD_LIST = (GODS as GodsData).gods;
export const GOD_RULES = (GODS as GodsData).rules;

export const warChapter = (ch: number) => P2.chapters.find((c) => c.ch === ch);
export const section = (n: number) => P3.sections.find((s) => s.n === n);
export const p3Quest = (id: string) => P3.quests.find((q) => q.id === id);
/** Every gate battle of Part III (skirmishes and dungeons left out). */
export const gateBattles = (n: number) => section(n)?.battles.filter((b) => !b.kind) ?? [];
export const allBattleNames = () => new Set(P3.sections.flatMap((s) => s.battles.map((b) => b.name)));
export const godRequest = (god: string) => P3.quests.find((q) => q.kind === "god-request" && q.giver === god);

/** "Battle vs. Hanno" → "Hanno"; "Showdown vs. Lyrah" → "Lyrah"; "Balor's Last Stand" stays. */
export const shortBattle = (name: string) => name.replace(/^(Battle|Showdown) vs\.\s*/, "");

/** Map cap with Eshmel counted (Part III) as a meter label. */
export const capOf = (b: Battle) => b.max_units ?? 0;

/* ------------------------------------------------------------ drops (owned by weapons-and-items.json) */

export type Drop = { item: string; src: ItemSource };

const DROPS = new Map<string, Drop[]>();

/** Items whose catalog sources are tagged with this chapter or Section ("Part II Ch 5", "Part III S3"). */
export function dropsAt(tag: string): Drop[] {
  const hit = DROPS.get(tag);
  if (hit) return hit;
  const out: Drop[] = [];
  for (const [name, ref] of Object.entries(ITEMS) as [string, { src?: ItemSource[] }][]) {
    for (const s of ref.src ?? []) {
      if (s.ch === tag && s.k !== "quest" && s.k !== "buy") out.push({ item: name, src: s });
    }
  }
  DROPS.set(tag, out);
  return out;
}

/** Plus level written in a drop's location ("Levin Sword +1 from Creek") so the chip shows the refined copy. */
export function dropName(d: Drop): string {
  const plus = d.src.at.match(new RegExp(`${d.item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\+\\d)`))?.[1];
  return plus ? `${d.item} ${plus}` : d.item;
}

/* ------------------------------------------------------------ routes */

/** Theodora's army plays Part II and is the Part III base (D-118, D-123). */
export const PART_HOME: RouteName = "Theodora";
export const playsWar = (r: RouteName) => r === PART_HOME;

/* ------------------------------------------------------------ squads */

/** Fixed squad colors (D-127): a squad keeps its letter and color across Sections while its job changes. */
export const SQUAD_TONE: Record<string, { bg: string; fg: string; soft: string; ring: string }> = {
  A: { bg: "#8a2e2a", fg: "#fff4e8", soft: "#f6e1dc", ring: "#c1574f" },
  B: { bg: "#24467f", fg: "#eef3ff", soft: "#dfe7f6", ring: "#5d80bd" },
  C: { bg: "#2f6b45", fg: "#eefaf1", soft: "#dcefe3", ring: "#5fa279" },
  D: { bg: "#7d5a17", fg: "#fff8e6", soft: "#f3e7cf", ring: "#c39a43" },
  E: { bg: "#5a3a86", fg: "#f6f0ff", soft: "#e9e2f5", ring: "#8f6ec2" },
};

/** Squad cap per Section (S1 has no world map). */
export const squadCap = (n: number) => section(n)?.squads ?? 0;
export const SQUAD_SIZE = 8;
