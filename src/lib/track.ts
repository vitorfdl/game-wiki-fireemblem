import { useSyncExternalStore } from "react";
import type { RouteName } from "./types.ts";
import type { Pin } from "./pins.ts";

/**
 * Everything the site remembers about a run (redesign/09-tracking.md): where you were, and the events that
 * decide whether the plan is on track. One versioned localStorage key; storage can be blocked or wiped,
 * so every read and write is guarded and the in-memory copy keeps the page working.
 */
export type Place = { ch: number; slot?: string; y?: number; at: number };
export type UnitView = { variant?: RouteName; stage?: number; section?: string; at: number };
export type Recent = { href: string; label: string; at: number };

export type TrackState = {
  v: 2;
  pin?: { route: RouteName; ch: number };
  lastRoute?: RouteName;
  place: Partial<Record<RouteName, Place>>;
  units: Record<string, UnitView>;
  recent: Recent[];
  /** Event id -> time it was ticked. Old Markdown checkbox ids live here too until their chapter migrates. */
  done: Record<string, number>;
  forks: Record<string, string>;
  /** Things shown once, like the Army cast intro: key -> when, plus what was seen (e.g. a roster signature). */
  seen?: Record<string, { at: number; sig?: string }>;
  /** Items pinned to the Field Kit's Pins tab, newest first (D-108). Logic in `pins.ts`. */
  pins?: Pin[];
  /** Reading place in Part II and III, keyed "<route>:war" / "<route>:salvation" (D-122). */
  parts?: Record<string, Place>;
  /** Skill ranks you reported in game, keyed "<route>:<unit>:<skill>" (D-140). The Arena plan reads them. */
  ranks?: Record<string, string>;
  /** The Part last viewed (1 Part I, 2 War, 3 Salvation): bare walkthrough and Army links open it. */
  part?: 1 | 2 | 3;
};

const KEY = "fw-state-v2";
const OLD_KEY = "fw-progress-v1";

function empty(): TrackState {
  return { v: 2, place: {}, units: {}, recent: [], done: {}, forks: {} };
}

function load(): TrackState {
  const base = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migratePin({ ...base, ...JSON.parse(raw) });
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const ticks = JSON.parse(old) as Record<string, boolean>;
      for (const [id, on] of Object.entries(ticks)) if (on) base.done[id] = 1;
    }
  } catch {
    // Private mode or blocked storage: start empty.
  }
  return base;
}

/**
 * The old manual "Playing Ch N" pin (D-92 retired it): chapters before it count as finished, once, then it's dropped.
 */
function migratePin(s: TrackState): TrackState {
  if (!s.pin) return s;
  const done = { ...s.done };
  for (let n = 1; n < s.pin.ch; n++) done[chapterDoneId(s.pin.route, n)] ??= Date.now();
  const { pin: _pin, ...rest } = s;
  return { ...rest, done };
}

let state: TrackState = load();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Several tabs share one run (D-141). Every change is an operation on the state, not a snapshot of it: when it is
 * written, the latest stored state is read back and the pending operations are replayed on top, so a tab never writes
 * over ticks made in another tab. Other tabs' writes arrive through the `storage` event and are merged the same way.
 */
type Op = (s: TrackState) => TrackState;
let pending: Op[] = [];

function readStored(): TrackState | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : undefined;
  } catch {
    return undefined;
  }
}

/** Everything but reading positions and recent pages, which change on every scroll. */
const marks = (s: TrackState) => JSON.stringify({ ...s, place: 0, units: 0, recent: 0, parts: 0, part: 0 });

function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (!pending.length) return;
  const ops = pending;
  pending = [];
  const base = readStored() ?? state;
  const next = ops.reduce((acc, op) => op(acc), base);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory value.
  }
  // Re-render only when something other than reading position changed (another tab ticked something).
  const changed = marks(next) !== marks(state);
  state = next;
  if (changed) subs.forEach((f) => f());
}

/** Apply a change here at once, and queue it for the merged write (scroll and view changes batch for 400 ms). */
function update(op: Op, quiet = false) {
  state = op(state);
  pending.push(op);
  if (!quiet) {
    flush();
    subs.forEach((f) => f());
    return;
  }
  // Quiet changes (scroll, last view) wait: one merged write per burst.
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

if (typeof globalThis.addEventListener === "function") {
  // Another tab saved: take its state, replay what this tab hasn't written yet, re-render.
  globalThis.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== KEY) return;
    const stored = readStored();
    if (!stored) return;
    const next = pending.reduce((acc, op) => op(acc), stored);
    const changed = marks(next) !== marks(state);
    state = next;
    if (changed) subs.forEach((f) => f());
  });
  // Write queued scroll and view changes before the tab closes or reloads.
  globalThis.addEventListener("pagehide", flush);
  globalThis.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const get = () => state;

export function useTrack(): TrackState {
  return useSyncExternalStore(subscribe, get);
}

/* ---------------------------------------------------------------- events */

export const isDone = (id: string): boolean => Boolean(state.done[id]);

/** Set one event: an explicit on/off, so replaying it over another tab's state can't flip it back. */
const doneOp = (id: string, on: boolean, at = Date.now()): Op => (s) => {
  if (Boolean(s.done[id]) === on) return s;
  const done = { ...s.done };
  if (on) done[id] = at;
  else delete done[id];
  return { ...s, done };
};

export function toggleDone(id: string): void {
  update(doneOp(id, !state.done[id]));
}

export function setDone(id: string, on: boolean): void {
  if (Boolean(state.done[id]) === on) return;
  toggleDone(id);
}

/** Tick many events in one write (one-time seeds). Already ticked ids keep their time. */
export function markDone(list: string[]): void {
  const now = Date.now();
  update((s) => {
    const done = { ...s.done };
    for (const id of list) done[id] ??= now;
    return { ...s, done };
  });
}

export function setFork(id: string, option: string | null): void {
  const at = Date.now();
  update((s) => {
    const forks = { ...s.forks };
    if (option === null) delete forks[id];
    else forks[id] = option;
    return doneOp(id, option !== null, at)({ ...s, forks });
  });
}

/* ---------------------------------------------------------------- position */

/** Last reading position on a route (chapter and offset inside it). */
export const loadPlace = (route: RouteName): Place | undefined => state.place[route];

export function savePlace(route: RouteName, place: Omit<Place, "at">): void {
  const prev = state.place[route];
  if (prev && prev.ch === place.ch && prev.slot === place.slot && Math.abs((prev.y ?? 0) - (place.y ?? 0)) < 40) {
    return;
  }
  const at = Date.now();
  update((s) => ({ ...s, lastRoute: route, place: { ...s.place, [route]: { ...place, at } } }), true);
}

export const unitKey = (route: RouteName | "reserve", unit: string) => `${route}:${unit}`;

export function saveUnitView(route: RouteName | "reserve", unit: string, view: Omit<UnitView, "at">): void {
  const k = unitKey(route, unit);
  const at = Date.now();
  update((s) => ({ ...s, units: { ...s.units, [k]: { ...s.units[k], ...view, at } } }), true);
}

export function pushRecent(href: string, label: string): void {
  if (state.recent[0]?.href === href) return;
  const at = Date.now();
  update(
    (s) => ({ ...s, recent: [{ href, label, at }, ...s.recent.filter((r) => r.href !== href)].slice(0, 8) }),
    true,
  );
}

/* ---------------------------------------------------------------- chapters (D-91) */

/** A chapter you marked finished. Manual only: reading or ticking never finishes a chapter. */
// A function declaration (hoisted): load() uses it during module init.
export function chapterDoneId(route: RouteName, ch: number): string {
  return `chapter:${route}:${ch}`;
}
export const isChapterDone = (route: RouteName, ch: number, s: TrackState = state) =>
  Boolean(s.done[chapterDoneId(route, ch)]);

/** Mark a chapter finished (or not). Your current chapter is the one after the latest finished. */
export function setChapterDone(route: RouteName, ch: number, on: boolean): void {
  update((s) => ({ ...doneOp(chapterDoneId(route, ch), on)(s), lastRoute: route }));
}

/** Latest chapter you marked finished on a route, or 0. */
export function lastFinished(route: RouteName, s: TrackState = state): number {
  for (let n = 12; n >= 1; n--) if (s.done[chapterDoneId(route, n)]) return n;
  return 0;
}

/**
 * The chapter you are playing on a route: the one after the latest finished (D-92). Scrolling never changes it, so
 * reading ahead is safe.
 */
export function nowChapter(route: RouteName, s: TrackState = state): number {
  return Math.min(12, lastFinished(route, s) + 1);
}

/* ---------------------------------------------------------------- Part II and III (D-122) */

export type LaterPart = "war" | "salvation";
const PART_SIZE: Record<LaterPart, number> = { war: 6, salvation: 6 };

/** A War chapter or Salvation Section you marked finished. */
export function partDoneId(route: RouteName, part: LaterPart, n: number): string {
  return `${part}:${route}:${n}`;
}
export const isPartDone = (route: RouteName, part: LaterPart, n: number, s: TrackState = state) =>
  Boolean(s.done[partDoneId(route, part, n)]);

export function setPartDone(route: RouteName, part: LaterPart, n: number, on: boolean): void {
  update((s) => ({ ...doneOp(partDoneId(route, part, n), on)(s), lastRoute: route }));
}

/** The War chapter or Section you are playing: the one after the latest you finished. */
export function nowIn(route: RouteName, part: LaterPart, s: TrackState = state): number {
  for (let n = PART_SIZE[part]; n >= 1; n--) {
    if (s.done[partDoneId(route, part, n)]) return Math.min(PART_SIZE[part], n + 1);
  }
  return 1;
}

export const loadPartPlace = (route: RouteName, part: LaterPart): Place | undefined =>
  state.parts?.[`${route}:${part}`];

export function savePartPlace(route: RouteName, part: LaterPart, place: Omit<Place, "at">): void {
  const k = `${route}:${part}`;
  const prev = state.parts?.[k];
  if (prev && prev.ch === place.ch && Math.abs((prev.y ?? 0) - (place.y ?? 0)) < 40) return;
  const at = Date.now();
  update((s) => ({ ...s, lastRoute: route, parts: { ...s.parts, [k]: { ...place, at } } }), true);
}

/**
 * The Part the player is in: the one last viewed, else the furthest Part with progress (a finished Section or War
 * chapter, or a saved reading place). Bare `#/<route>` and `#/<route>/army` open it; explicit URLs never change.
 */
export function currentPart(s: TrackState = state): 1 | 2 | 3 {
  if (s.part) return s.part;
  const keys = [...Object.keys(s.done), ...Object.keys(s.parts ?? {}).map((k) => k.replace(/^(\w+):(\w+)$/, "$2:$1:"))];
  if (keys.some((k) => k.startsWith("salvation:"))) return 3;
  if (keys.some((k) => k.startsWith("war:"))) return 2;
  return 1;
}

/** Remember the Part on screen (a view change: batched with scroll writes, no re-render elsewhere). */
export function notePart(p: 1 | 2 | 3): void {
  if (state.part === p) return;
  update((s) => ({ ...s, part: p }), true);
}

export const wasSeen = (key: string): boolean => Boolean(state.seen?.[key]);

export function markSeen(key: string, sig?: string): void {
  const at = Date.now();
  update((s) => ({ ...s, seen: { ...s.seen, [key]: { at, sig } } }), true);
}

/* ---------------------------------------------------------------- skill ranks (D-140) */

const rankKey = (route: RouteName, unit: string, skill: string) => `${route}:${unit}:${skill}`;

/** The rank you reported for a unit's skill, or undefined (then the plan's estimate applies). */
export const reportedRank = (
  route: RouteName,
  unit: string,
  skill: string,
  s: TrackState = state,
): string | undefined => s.ranks?.[rankKey(route, unit, skill)];

/** Report a skill rank reached in game; null clears it. */
export function setRank(route: RouteName, unit: string, skill: string, rank: string | null): void {
  update((s) => {
    const ranks = { ...s.ranks };
    if (rank === null) delete ranks[rankKey(route, unit, skill)];
    else ranks[rankKey(route, unit, skill)] = rank;
    return { ...s, ranks };
  });
}

/**
 * Part III ranks (D-159): one rank per unit and skill for the whole Salvation army, keyed "p3:<unit>:<skill>" in the
 * same map. Unset, the best rank reported on any route's Part I counts (a merge keeps the higher skill levels).
 */
export function reportedRank3(
  unit: string,
  skill: string,
  s: TrackState = state,
): { rank: string; p3: boolean } | undefined {
  const own = s.ranks?.[`p3:${unit}:${skill}`];
  if (own) return { rank: own, p3: true };
  let best: string | undefined;
  const order = ["E", "E+", "D", "D+", "C", "C+", "B", "B+", "A", "A+", "S"];
  for (const [k, v] of Object.entries(s.ranks ?? {})) {
    if (!k.endsWith(`:${unit}:${skill}`) || k.startsWith("p3:")) continue;
    if (!best || order.indexOf(v) > order.indexOf(best)) best = v;
  }
  return best ? { rank: best, p3: false } : undefined;
}

/** Report a Part III skill rank; null clears it. */
export function setRank3(unit: string, skill: string, rank: string | null): void {
  update((s) => {
    const ranks = { ...s.ranks };
    if (rank === null) delete ranks[`p3:${unit}:${skill}`];
    else ranks[`p3:${unit}:${skill}`] = rank;
    return { ...s, ranks };
  });
}

/* ---------------------------------------------------------------- pins (D-108) */

export const getPins = (s: TrackState = state): Pin[] => s.pins ?? [];

export function updatePins(f: (pins: Pin[]) => Pin[]): void {
  update((s) => ({ ...s, pins: f(getPins(s)) }));
}

/* ---------------------------------------------------------------- backup */

export function exportState(): string {
  return JSON.stringify(state, null, 2);
}

/** Replaces the whole run with an exported file. Returns an error message, or null when it worked. */
export function importState(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as Partial<TrackState>;
    if (parsed.v !== 2 || typeof parsed.done !== "object") return "This file isn't a Muster Roll backup.";
    const next: TrackState = { ...empty(), ...parsed, v: 2 };
    pending = [];
    update(() => next);
    return null;
  } catch {
    return "The file couldn't be read as JSON.";
  }
}
