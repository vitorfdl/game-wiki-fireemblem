import { useSyncExternalStore } from "react";
import { BATTALIONS, CLASS_REF } from "virtual:refs";
import type { ClassRef } from "./refs.ts";
import { CHARACTERS } from "./data.ts";
import { growthRow, primaryClass } from "./growth.ts";
import { battalionRef, keyItemsOf } from "./refs.ts";
import { pos } from "./parts.ts";
import { activeStage, unitPlan } from "./walkthrough/builds.ts";
import { type RouteName, type Stat, STATS } from "./types.ts";

/*
 * Stat checkpoints (D-133): the player logs a unit's stat screen at fixed points and the page compares each entry with
 * what the growths predict from the previous one. The dev and preview servers save to
 * run-log/stat-checkpoints.json in the repo (vite.config.ts `statLog`), so Claude can read the same file. A static
 * copy of the site has no server: entries then stay in this browser and the page says so.
 */

export const CHECKPOINTS = [
  { id: "join", label: "Joined" },
  { id: "lv20", label: "Lv 20 exam" },
  { id: "lv35", label: "Lv 35 exam" },
  { id: "end-p1", label: "End of Part I" },
  { id: "p3-start", label: "Part III start" },
  { id: "lv45", label: "Lv 45 / Divine exam" },
  { id: "other", label: "Other" },
] as const;
export type CheckpointId = (typeof CHECKPOINTS)[number]["id"];
export const checkpointLabel = (id: string): string => CHECKPOINTS.find((c) => c.id === id)?.label ?? id;

export type StatEntry = {
  id: string;
  /** ISO time it was saved. */
  at: string;
  route: RouteName;
  unit: string;
  checkpoint: CheckpointId;
  /** Where in the game: "Ch 9", "War Ch 3", "Section 2". */
  when: string;
  level: number;
  cls: string;
  stats: Record<Stat, number>;
  /** Stat boosters, meals with stat gains, anything that isn't a level-up. */
  note?: string;
};

type LogFile = { v: 1; entries: StatEntry[] };
export type LogState = { entries: StatEntry[]; mode: "loading" | "file" | "browser"; error?: string };

const API = "/api/stat-log";
const LOCAL = "fw-stat-log-v1";

let state: LogState = { entries: [], mode: "loading" };
const subs = new Set<() => void>();
const set = (next: LogState) => {
  state = next;
  subs.forEach((f) => f());
};

function readLocal(): StatEntry[] {
  try {
    return (JSON.parse(localStorage.getItem(LOCAL) ?? "null") as LogFile | null)?.entries ?? [];
  } catch {
    return [];
  }
}
function writeLocal(entries: StatEntry[]) {
  try {
    localStorage.setItem(LOCAL, JSON.stringify({ v: 1, entries }));
  } catch {
    // Blocked storage: the in-memory list still works for this visit.
  }
}

let started = false;
function start() {
  if (started) return;
  started = true;
  fetch(API)
    .then((r) => (r.ok ? r.json() as Promise<LogFile> : Promise.reject(new Error(String(r.status)))))
    .then((f) => set({ entries: f.entries, mode: "file" }))
    .catch(() => set({ entries: readLocal(), mode: "browser" }));
}

export function useStatLog(): LogState {
  start();
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

async function post(body: unknown): Promise<StatEntry[]> {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Save failed (${r.status})`);
  return ((await r.json()) as LogFile).entries;
}

const byUnitLevel = (a: StatEntry, b: StatEntry) => a.unit.localeCompare(b.unit) || a.level - b.level;

/** Adds or replaces an entry (same id). Returns an error message, or null when it saved. */
export async function putEntry(e: StatEntry): Promise<string | null> {
  if (state.mode === "file") {
    try {
      set({ ...state, entries: await post({ op: "put", entry: e }), error: undefined });
      return null;
    } catch (err) {
      set({ ...state, error: String(err) });
      return String(err);
    }
  }
  const entries = [...state.entries.filter((x) => x.id !== e.id), e].sort(byUnitLevel);
  writeLocal(entries);
  set({ ...state, entries });
  return null;
}

export async function deleteEntry(id: string): Promise<void> {
  if (state.mode === "file") {
    try {
      set({ ...state, entries: await post({ op: "delete", id }), error: undefined });
    } catch (err) {
      set({ ...state, error: String(err) });
    }
    return;
  }
  const entries = state.entries.filter((x) => x.id !== id);
  writeLocal(entries);
  set({ ...state, entries });
}

export const exportLog = (entries: StatEntry[]): string => `${JSON.stringify({ v: 1, entries }, null, 2)}\n`;

/* ------------------------------------------------------------ expected values */

/** Class growth row for a class at a level (Charioteer and Elephant Rider change rows by level). */
function classGrowth(cls: string, level: number): Partial<Record<Stat, number>> {
  const g = growthRow({ when: "", class: cls, level: `Lv ${level}` }, null);
  return g?.row ?? {};
}
const flat = (cls: string, s: Stat): number => CLASS_REF[cls]?.flat?.[s] ?? 0;

export type Expect = {
  /** Expected value from the previous entry. */
  mean: number;
  /** Binomial spread of the level-ups in between. */
  sd: number;
  /** (actual − mean) / sd; 0 when sd is 0. */
  z: number;
};

const STAT_WORD = "hp|str|mag|spd|dex|def|res|lck|cha";
const canon = (w: string) => STATS.find((x) => x.toLowerCase() === w.toLowerCase())!;

/**
 * Campaign position of a logged "when" (lib/parts.ts `pos`): "Ch 9"; "War Ch 3", "Part II Ch 3", "Part2-Ch 3", "P2 Ch 3";
 * "Section 2", "S2", "Part III S2", "Part3-S2".
 */
export function whenPos(when: string): number | null {
  const s = when.trim();
  let m = s.match(/^(?:Part\s*(?:III|3)|P3|Salvation)?[\s-]*(?:Section|S)\s*(\d+)/i) ??
    s.match(/^(?:Part\s*(?:III|3)|P3|Salvation)[\s-]*(?:Ch\.?)?\s*(\d+)/i);
  if (m) return pos(3, Number(m[1]));
  m = s.match(/^(?:Part\s*(?:II|2)|P2|War)[\s-]*(?:Ch\.?)?\s*(\d+)/i);
  if (m) return pos(2, Number(m[1]));
  m = s.match(/^(?:Part\s*(?:I|1)[\s-]+)?Ch\.?\s*(\d+)/i);
  return m ? pos(1, Number(m[1])) : null;
}

/**
 * Battalion the build plans for the unit at the entry's chapter (D-142). A join is logged before anything is assigned,
 * so it has none.
 */
export function plannedBattalion(e: StatEntry): string | undefined {
  if (e.checkpoint === "join") return undefined;
  const u = unitPlan(e.route, e.unit);
  const at = whenPos(e.when);
  if (!u || at === null) return undefined;
  const name = activeStage(u, at)?.stage.battalion?.name;
  return name && battalionRef(name) ? name : undefined;
}

export type Bonus = {
  stats: Partial<Record<Stat, number>>;
  /** What was taken out, for the history row: "note", a battalion named in the note, or "Lions of Megaira (plan)". */
  from: string[];
};

const BATTALION_WORD = /\bbatt?all?ions?\b/i;
const BATTALION_NAMES = Object.keys(BATTALIONS).sort((a, b) => b.length - a.length);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Non-level-up bonuses on the stat screen, taken out of both ends so the check compares growth with growth.
 * - Numbers written in the note ("Battalion +1 str and dex. Ability +1 def", "Combat Basics +1 str/mag").
 * - The stat screen includes the battalion (player-confirmed): a battalion named in the note counts its stats; with
 *   none named, no numbers on a battalion clause and no "no battalion", the build's planned battalion counts (D-142).
 * Clauses naming the unit's key item are skipped: it is always on, so it sits in every entry alike (D-134).
 */
export function bonusDetail(e: StatEntry): Bonus {
  const out: Partial<Record<Stat, number>> = {};
  const from: string[] = [];
  const add1 = (st: Stat, n: number) => (out[st] = (out[st] ?? 0) + n);
  const keys = keyItemsOf(e.unit).map((k) => k.name.split(/[\s']/)[0].toLowerCase());
  const list = `(?:${STAT_WORD})(?:\\s*(?:\\/|,|and|&)\\s*(?:${STAT_WORD}))*`;
  const before = new RegExp(`([+-]\\d+)\\s*(${list})\\b`, "gi");
  const after = new RegExp(`\\b(${list})\\s*([+-]\\d+)`, "gi");
  const note = e.note ?? "";
  let numbered = false;
  let battalionSet = /\bno\s+batt?all?ion/i.test(note);
  // A comma ends a clause unless a stat word follows it ("+1 str, dex" stays one clause).
  const clauses = note.split(new RegExp(`[.;]|,(?!\\s*(?:${STAT_WORD})\\b)`, "i"));
  for (const clause of clauses) {
    const low = clause.toLowerCase();
    if (keys.some((k) => k && low.includes(k))) continue;
    const seen = new Set<string>();
    let hit = false;
    const add = (n: string, stats: string) => {
      hit = true;
      for (const w of stats.split(/\s*(?:\/|,|and|&)\s*/i)) {
        const st = w.trim() && canon(w.trim());
        if (st) add1(st, Number(n));
      }
    };
    for (const m of clause.matchAll(before)) {
      add(m[1], m[2]);
      seen.add(m[2].toLowerCase());
    }
    for (const m of clause.matchAll(after)) if (!seen.has(m[1].toLowerCase())) add(m[2], m[1]);
    if (hit) {
      numbered = true;
      if (BATTALION_WORD.test(clause)) battalionSet = true;
      continue;
    }
    const named = BATTALION_NAMES.find((n) => new RegExp(`\\b${escapeRe(n)}\\b`, "i").test(clause));
    if (named && !battalionSet) {
      for (const [st, n] of Object.entries(battalionRef(named)?.stats ?? {})) add1(st as Stat, n);
      from.push(named);
      battalionSet = true;
    }
  }
  if (numbered) from.unshift("note");
  const planned = battalionSet ? undefined : plannedBattalion(e);
  if (planned) {
    for (const [st, n] of Object.entries(battalionRef(planned)?.stats ?? {})) add1(st as Stat, n);
    from.push(`${planned} (plan)`);
  }
  return { stats: out, from };
}

export const bonusOf = (e: StatEntry): Partial<Record<Stat, number>> => bonusDetail(e).stats;

/** The planned class for a level-up from `level`, read from the build's stage level ranges ("Lv 20 to about 28"). */
function planClassAt(e: StatEntry, level: number): string | undefined {
  const c = CHARACTERS[e.unit];
  const stages = c?.copies?.find((x) => x.route === e.route)?.guide?.stages ?? c?.guide?.stages ?? [];
  for (const st of stages) {
    const txt = st.level ?? "";
    const nums = [...txt.matchAll(/\d+/g)].map((m) => Number(m[0]));
    if (!nums.length) continue;
    const lo = /^(up to|join|start)/i.test(txt) ? 0 : nums[0];
    const hi = nums.length > 1 && nums.at(-1)! > lo ? nums.at(-1)! : /\+/.test(txt) ? 99 : lo === 0 ? nums[0] : 99;
    if (level >= lo && level < hi) return primaryClass(st.class) || "Commoner";
  }
  return undefined;
}

/**
 * What `next` should show given `prev`: the previous value, the class flat change, and one roll per level at
 * personal + class growth. When the class changed in between, each level-up rolls in the class the build plans for
 * that level (stage level ranges); without a plan, levels below the new class's exam level roll in the old class.
 * Bonuses written in each note (battalion, abilities, boosters) are taken out of both ends. Mount growth and stat caps
 * are not counted.
 */
export function expected(prev: StatEntry, next: StatEntry): Record<Stat, Expect> | null {
  const c = CHARACTERS[next.unit];
  if (!c || next.level <= prev.level) return null;
  const gained = next.level - prev.level;
  const switchAt = prev.cls === next.cls ? next.level : (CLASS_REF[next.cls]?.level ?? prev.level);
  const inOld = Math.max(0, Math.min(gained, switchAt - prev.level));
  const rowAt = (i: number) => {
    const lv = prev.level + i;
    if (prev.cls !== next.cls) {
      const planned = planClassAt(next, lv);
      if (planned) return classGrowth(planned, lv + 1);
    }
    return i < inOld ? classGrowth(prev.cls, lv) : classGrowth(next.cls, lv + 1);
  };
  const bPrev = bonusOf(prev);
  const bNext = bonusOf(next);
  const out = {} as Record<Stat, Expect>;
  for (const s of STATS) {
    let mean = prev.stats[s] - (bPrev[s] ?? 0) - flat(prev.cls, s) + flat(next.cls, s);
    let v = 0;
    for (let i = 0; i < gained; i++) {
      const row = rowAt(i);
      const p = Math.max(0, Math.min(1, ((c.growths?.[s] ?? 0) + (row[s] ?? 0)) / 100));
      mean += p;
      v += p * (1 - p);
    }
    const sd = Math.sqrt(v);
    const actual = next.stats[s] - (bNext[s] ?? 0);
    out[s] = { mean: mean + (bNext[s] ?? 0), sd, z: sd > 0 ? (actual - mean) / sd : 0 };
  }
  return out;
}

export type Flag = "low" | "behind" | "ahead" | null;
/** Two spreads under: low (act on it if the build needs that stat); one under: behind; one over: ahead. */
export const flagOf = (e: Expect | undefined): Flag =>
  !e || e.sd === 0 ? null : e.z <= -2 ? "low" : e.z <= -1 ? "behind" : e.z >= 1 ? "ahead" : null;

/** A unit's entries, lowest level first. */
export const historyOf = (entries: StatEntry[], unit: string): StatEntry[] =>
  entries.filter((e) => e.unit === unit).sort((a, b) => a.level - b.level || a.at.localeCompare(b.at));

/** Class names for the picker: class-data.json in tier order, plus the starting Commoner/Noble. */
export const TIER_ORDER = ["Base", "Beginner", "Specialty", "Advanced", "Master", "Elephant", "Divine"];
export function classOptions(): { tier: string; names: string[] }[] {
  const groups = new Map<string, string[]>([["Base", ["Commoner", "Noble"]]]);
  for (const [name, r] of Object.entries(CLASS_REF as Record<string, ClassRef>)) {
    const t = r.tier ?? "Other";
    groups.set(t, [...(groups.get(t) ?? []), name]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b))
    .map(([tier, names]) => ({ tier, names: tier === "Base" ? names : names.sort() }));
}
