import { ABILITIES, ARTS, BATTALIONS, CLASS_REF, ITEMS, STATS } from "virtual:refs";
import questsJson from "../data/quests.gen.json" with { type: "json" };
import { CHARACTERS, CLASSES } from "./data.ts";
import { BREED_BY_NAME } from "./mounts.ts";
import { foldName, ITEM_BY_NAME, NODE_BY_NAME } from "./map.ts";
import { findGift } from "./gifts.ts";
import type { Quest } from "./types.ts";

export type ItemRef = {
  kind: "Weapon" | "Equipment" | "Item";
  type?: string;
  rank?: string;
  mt?: number;
  hit?: number;
  crit?: number;
  wt?: number;
  rng?: string;
  fx?: string;
  eff?: string[];
  uses?: number;
  price?: number;
  /** Weapon durability. */
  dur?: number;
  /** Curse value of cursed gear (D-103). */
  curse?: number;
  /** Key item always active on this unit: no weight, no inventory or equipment slot. Builds never list it as kit. */
  holder?: string;
  /** A catalog row that stands for several items ("Skill manuals (...)"); its members have their own rows. */
  group?: boolean;
  /** Max refine level and its effect at max (YT-FORGE), weapons only. */
  refine?: { lv?: string; fx?: string };
  /** Every way to get it, derived from the structured owners (D-110). Format with `src/lib/sources.ts`. */
  src?: import("./sources.ts").ItemSource[];
};
export type ClassRef = {
  tier?: string;
  part?: string;
  renown?: number;
  level?: number;
  ranks?: string[];
  /** Exam license; a Divine class names its Temple of the Diadem item. */
  license?: string;
  mov?: number;
  move?: string;
  weapons?: string[];
  growth?: Record<string, number>;
  /** Flat stat bonus while in the class (class-data.json `stats`). */
  flat?: Record<string, number>;
  mastery?: string;
  unlock?: string;
};
export type ArtRef = {
  weapon?: string;
  mt?: number;
  hit?: number;
  crit?: number;
  avo?: number;
  rng?: string;
  dur?: number;
  fx?: string;
};
/** A battalion (repo-root `battalions.json`): carrier stat bonuses, gambit, recruit towns. Infantry only, tier <= Authority. */
export type BattalionRef = {
  tier: string;
  auth?: string;
  kind?: string;
  stats: Record<string, number>;
  gambit?: {
    name?: string;
    kind?: string;
    mt?: number;
    hit?: number;
    rng?: string;
    area?: string;
    uses?: number;
    fx?: string;
  };
  towns: string[];
  notes?: string;
};
export const battalionRef = (name: string): BattalionRef | undefined => BATTALIONS[find(BATTALION_KEYS, name) ?? ""];
export type AbilityRef = { fx?: string; source?: string; from?: string; skill?: string };
/** A combat stat glossary entry (repo-root `combat-stats.json`), keyed by its abbreviation. */
export type StatRef = {
  name: string;
  group?: "base" | "derived" | "weapon" | "skill";
  what?: string;
  formula?: string;
  matters?: string;
  /** Source sites, short ("criticalhits.com.br", "local research"). */
  src?: string[];
};

export const QUESTS: Record<string, Quest> = Object.fromEntries((questsJson as Quest[]).map((q) => [q.id, q]));

export type RefType =
  | "unit"
  | "item"
  | "class"
  | "art"
  | "ability"
  | "quest"
  | "place"
  | "gather"
  | "mount"
  | "stat"
  | "gift"
  | "battalion";
export type Ref = { type: RefType; name: string; label: string; key: string };

const lower = (m: Record<string, unknown>) => new Map(Object.keys(m).map((k) => [k.toLowerCase(), k]));
const ITEM_KEYS = lower(ITEMS);
const CLASS_KEYS = lower(CLASS_REF);
/**
 * Class names spelled with or without a space ("Swordmaster" in classes.json and the plans, "Sword Master" in
 * class-data.json): both resolve to the same entry.
 */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z/]/g, "");
const CLASS_SQUASH = new Map(Object.keys(CLASS_REF).map((k) => [squash(k), k]));
const SITE_CLASS_SQUASH = new Map(Object.keys(CLASSES).map((k) => [squash(k), k]));
const findClass = (name: string) => find(CLASS_KEYS, name) ?? CLASS_SQUASH.get(squash(name));
const ART_KEYS = lower(ARTS);
const ABILITY_KEYS = lower(ABILITIES);
const BATTALION_KEYS = lower(BATTALIONS);
/** Stats resolve by abbreviation or full name ("Prt", "Protection"). */
const STAT_KEYS = new Map(
  Object.entries(STATS as Record<string, StatRef>).flatMap((
    [abbr, s],
  ) => [[abbr.toLowerCase(), abbr], [s.name.toLowerCase(), abbr]]),
);
const QUEST_BY_NAME = new Map(Object.values(QUESTS).map((q) => [q.name.toLowerCase(), q.id]));

/** Refines (+1, +2) and plurals still resolve to the base entry. */
function base(name: string): string[] {
  const n = name.trim();
  const out = [n, n.replace(/\s*\+\d$/, ""), n.replace(/s$/, ""), n.replace(/es$/, "")];
  return [...new Set(out)];
}

function find(keys: Map<string, string>, name: string): string | undefined {
  for (const b of base(name)) {
    const hit = keys.get(b.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

/** Resolves a ref to a known entity, or undefined. `type` narrows the lookup. */
export function resolve(name: string, type?: RefType): Ref | undefined {
  const label = name;
  const tryType = (t: RefType): string | undefined => {
    switch (t) {
      case "unit":
        return CHARACTERS[name] ? name : undefined;
      case "item":
        return find(ITEM_KEYS, name);
      case "class":
        return findClass(name);
      case "art":
        return find(ART_KEYS, name);
      case "ability":
        return find(ABILITY_KEYS, name);
      case "quest":
        return QUESTS[name] ? name : QUEST_BY_NAME.get(name.toLowerCase());
      case "place":
        return NODE_BY_NAME.get(foldName(name)) ? name : undefined;
      case "gather":
        return ITEM_BY_NAME.get(foldName(name)) ? name : undefined;
      case "mount":
        return BREED_BY_NAME.get(name.toLowerCase()) ? name : undefined;
      case "stat":
        return STAT_KEYS.get(name.trim().toLowerCase());
      case "gift":
        return findGift(name);
      case "battalion":
        return find(BATTALION_KEYS, name);
    }
  };
  const order: RefType[] = type
    ? [type]
    : ["unit", "class", "item", "art", "ability", "quest", "mount", "place", "gather", "stat", "gift", "battalion"];
  for (const t of order) {
    const key = tryType(t);
    if (key) {
      return {
        type: t,
        name: key,
        label: t === "quest" && QUESTS[key] && label === key ? QUESTS[key].name : label,
        key: `${t}:${key}`,
      };
    }
  }
  return undefined;
}

export const itemRef = (name: string): ItemRef | undefined => {
  const k = find(ITEM_KEYS, name);
  return k ? ITEMS[k] : undefined;
};
export const classRef = (name: string): ClassRef | undefined => {
  const k = findClass(name);
  return k ? CLASS_REF[k] : undefined;
};
export const artRef = (name: string): ArtRef | undefined => {
  const k = find(ART_KEYS, name);
  return k ? ARTS[k] : undefined;
};
export const abilityRef = (name: string): AbilityRef | undefined => {
  const k = find(ABILITY_KEYS, name);
  return k ? ABILITIES[k] : undefined;
};

export const statRef = (name: string): StatRef | undefined => {
  const k = STAT_KEYS.get(name.trim().toLowerCase());
  return k ? STATS[k] : undefined;
};

/** Exam ranks for a class, from class-data.json. */
export const examRanks = (cls: string): string[] => classRef(cls)?.ranks ?? [];

export type Segment = string | Ref | { unresolved: string };

const REF_RE =
  /\[\[(?:(unit|item|class|art|ability|quest|place|gather|mount|stat|gift|battalion):)?([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

/** Splits authored text into plain strings and `[[type:Name|label]]` refs. */
export function splitRefs(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(REF_RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const r = resolve(m[2].trim(), m[1] as RefType | undefined);
    // Without an explicit label, keep resolve()'s label: a quest written as its id shows the quest's name.
    if (r) out.push({ ...r, label: m[3]?.trim() ?? r.label });
    else out.push({ unresolved: m[3]?.trim() ?? m[2].trim() });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Every `[[ref]]` in a string, resolved or not (used by the content validator). */
export function refsIn(text: string): { raw: string; ref?: Ref }[] {
  return [...text.matchAll(REF_RE)].map((m) => ({
    raw: m[0],
    ref: resolve(m[2].trim(), m[1] as RefType | undefined),
  }));
}

/* ------------------------------------------------------------ stat deltas ("Prt +10", "Str/Mag +7") */

/** Stat abbreviations as a regex alternation ("Str|Mag|..."), shared by the stat badges and the build page. */
export const STAT_ABBR = "Str|Mag|Dex|Spd|Def|Res|Lck|Cha|HP|Mov|Bld|Hit|Avo|Crit|Atk|AS|Prt|Rsl|Ddg|Shld|Mt|Wt";
const STAT_DELTA_RE = new RegExp(`\\b((?:${STAT_ABBR})(?:/(?:${STAT_ABBR}))*) ?([+\u2212-]\\d+%?)(?![\\d.])`, "g");

export type StatDelta = { stats: string[]; delta: string; raw: string };

/** Splits plain text into strings and stat deltas, for `Rich stats`. The minus sign is normalised to U+2212. */
export function splitStats(text: string): (string | StatDelta)[] {
  const out: (string | StatDelta)[] = [];
  let last = 0;
  for (const m of text.matchAll(STAT_DELTA_RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ stats: m[1].split("/"), delta: m[2].replace("-", "\u2212"), raw: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A unit's key items (D-134): always-on bonuses that never sit in the kit, derived from the catalog's `holder`. */
export function keyItemsOf(unit: string): { name: string; fx?: string }[] {
  return Object.entries(ITEMS as Record<string, ItemRef>)
    .filter(([, r]) => r.holder === unit)
    .map(([name, r]) => ({ name, fx: r.fx }));
}

/* ------------------------------------------------------------ class names */

const SPLIT = Object.keys(CLASSES).filter((k) => k.includes("/"));

/** The classes.json key for a class name ("Commoner" is stored as "Commoner/Noble"), or undefined for prose. */
export function classKey(name: string): string | undefined {
  if (CLASSES[name]) return name;
  const k = SPLIT.find((x) => x.split("/").includes(name));
  if (k) return k;
  const spelled = SITE_CLASS_SQUASH.get(squash(name));
  if (spelled) return spelled;
  return resolve(name, "class") ? name : undefined;
}

/** A stage class that names a real class. Stage text like "Specialty class on join; Wing Soldier exam ..." doesn't. */
export const isClass = (name: string | undefined): name is string => Boolean(name && classKey(name));
