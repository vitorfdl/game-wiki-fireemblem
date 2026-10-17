// Shared loaders for the content scripts: repo paths, routes, characters and the `[[ref]]` resolver.
// Plain Node ESM with built-ins only, so it also runs under `deno run -A`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SITE = join(import.meta.dirname, "..", "..");
export const REPO = join(SITE, "..");
export const DATA = join(SITE, "src", "data");
export const REPORTS = join(REPO, "redesign", "reports");

export const ROUTE_NAMES = ["Cai", "Dietrich", "Leda", "Theodora"];
export const routeSlug = (r) => r.toLowerCase();
export const routeFromArg = (s) => ROUTE_NAMES.find((r) => routeSlug(r) === String(s ?? "").toLowerCase());

export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const rel = (p) => p.startsWith(SITE + "/") ? p.slice(SITE.length + 1) : p;

/** Same slug as `src/lib/chapter.ts`. */
export const slug = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 48);

/** Accent folding as in `src/lib/map.ts`. */
export const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’]/g, "'");
export const foldName = (s) => fold(s).toLowerCase();

export function loadCharacters() {
  const dir = join(DATA, "characters");
  const out = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const c = readJson(join(dir, f));
    out[c.name] = { ...c, _file: join(dir, f) };
  }
  return out;
}

export function loadRoutes() {
  const out = {};
  for (const r of ROUTE_NAMES) {
    const p = join(DATA, "routes", `${routeSlug(r)}.json`);
    if (existsSync(p)) out[r] = { ...readJson(p), _file: p };
  }
  return out;
}

export function loadQuests() {
  const p = join(DATA, "quests.gen.json");
  return existsSync(p) ? readJson(p) : [];
}

/** Chapter files of a route, sorted by chapter number. */
export function loadChapters(route) {
  const dir = join(DATA, "walkthrough", routeSlug(route));
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^ch\d+\.json$/.test(f))
    .sort()
    .map((f) => {
      const file = join(dir, f);
      try {
        return { file, n: Number(f.match(/\d+/)[0]), data: readJson(file) };
      } catch (e) {
        return { file, n: Number(f.match(/\d+/)[0]), error: String(e.message ?? e) };
      }
    });
}

/* ------------------------------------------------------------ refs (mirrors src/lib/refs.ts) */

const lowerMap = (names) => new Map(names.map((k) => [k.toLowerCase(), k]));

/** Refines (+1, +2) and plurals still resolve to the base entry. */
function base(name) {
  const n = name.trim();
  return [...new Set([n, n.replace(/\s*\+\d$/, ""), n.replace(/s$/, ""), n.replace(/es$/, "")])];
}
function find(keys, name) {
  for (const b of base(name)) {
    const hit = keys.get(b.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

export const REF_TYPES = [
  "unit",
  "item",
  "class",
  "art",
  "ability",
  "quest",
  "place",
  "gather",
  "mount",
  "stat",
  "gift",
  "battalion",
];
export const REF_RE =
  /\[\[(?:(unit|item|class|art|ability|quest|place|gather|mount|stat|gift|battalion):)?([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
/** Any `[[...]]`, including ones with an unknown type prefix, so typos are caught too. */
export const ANY_REF_RE = /\[\[([^\]]*)\]\]/g;

export function makeResolver({ characters, quests }) {
  const wi = readJson(join(REPO, "weapons-and-items.json"));
  const items = lowerMap([...wi.weapons, ...wi.equipment, ...wi.consumables].map((x) => x.name));
  const classList = readJson(join(REPO, "class-data.json")).classes;
  const classes = lowerMap(classList.map((c) => c.name));
  /** Class name (lower case) -> movement ("infantry", "armored", "mounted", "flier", "mounted (armored)"). */
  const classMove = new Map(classList.map((c) => [c.name.toLowerCase(), c.movement]));
  const battalionList = readJson(join(REPO, "battalions.json")).battalions;
  const battalions = lowerMap(battalionList.map((b) => b.name));
  const ca = readJson(join(REPO, "combat-arts-and-abilities.json"));
  const arts = lowerMap(ca.combat_arts.map((a) => a.name));
  const abilityNames = ca.abilities.map((a) => a.name);
  for (const k of ["skill_rank", "mount", "bloodmark"]) {
    for (const a of ca.other_abilities?.[k] ?? []) abilityNames.push(a.name);
  }
  const abilities = lowerMap(abilityNames);
  const questById = new Map(quests.map((q) => [q.id, q]));
  const questByName = new Map(quests.map((q) => [q.name.toLowerCase(), q.id]));
  const world = readJson(join(DATA, "world-map.json"));
  const nodes = new Set(world.nodes.map((n) => foldName(n.name)));
  const itemSkip = new Set(["coin", "dates", "large coin"]);
  const gather = new Set(
    Object.values(world.items)
      .filter((it) => it.places.length && it.name.length >= 4 && !itemSkip.has(it.name.toLowerCase()))
      .map((it) => foldName(it.name)),
  );
  const mg = readJson(join(DATA, "mount-guide.json"));
  const breeds = new Set(mg.breeds.map((b) => b.name.toLowerCase()));
  breeds.add("ferghanan");
  const statKeys = new Map(
    readJson(join(REPO, "combat-stats.json")).stats.flatMap((
      s,
    ) => [[s.abbr.toLowerCase(), s.abbr], [s.name.toLowerCase(), s.abbr]]),
  );

  const gifts = lowerMap(readJson(join(REPO, "gifts.json")).gifts.map((g) => g.name));

  const tryType = (t, name) => {
    switch (t) {
      case "unit":
        return characters[name] ? name : undefined;
      case "item":
        return find(items, name);
      case "class":
        return find(classes, name);
      case "art":
        return find(arts, name);
      case "ability":
        return find(abilities, name);
      case "quest":
        return questById.has(name) ? name : questByName.get(name.toLowerCase());
      case "place":
        return nodes.has(foldName(name)) ? name : undefined;
      case "gather":
        return gather.has(foldName(name)) ? name : undefined;
      case "mount":
        return breeds.has(name.toLowerCase()) ? name : undefined;
      case "stat":
        return statKeys.get(name.trim().toLowerCase());
      case "gift":
        return gifts.get(name.trim().toLowerCase());
      case "battalion":
        return find(battalions, name);
    }
  };
  const resolve = (name, type) => {
    const order = type
      ? [type]
      : ["unit", "class", "item", "art", "ability", "quest", "mount", "place", "gather", "stat", "gift", "battalion"];
    for (const t of order) {
      const key = tryType(t, name);
      if (key) return { type: t, key };
    }
    return undefined;
  };
  /** Every `[[...]]` in a string with its resolution, or the reason it fails. */
  const refsIn = (text) =>
    [...text.matchAll(ANY_REF_RE)].map((m) => {
      const raw = m[0];
      const inner = m[1];
      const typed = inner.match(/^([a-z]+):/);
      if (typed && !REF_TYPES.includes(typed[1])) return { raw, problem: `unknown ref type "${typed[1]}"` };
      const ok = [...raw.matchAll(REF_RE)][0];
      if (!ok || ok[0] !== raw) return { raw, problem: "malformed ref" };
      const r = resolve(ok[2].trim(), ok[1]);
      return r ? { raw, ref: r } : { raw, problem: `does not resolve${ok[1] ? ` as ${ok[1]}` : ""}` };
    });
  return { resolve, refsIn, questById, classes, classMove, gifts };
}
