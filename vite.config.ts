import { type Connect, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// @ts-types="./scripts/research.d.ts"
import { isResearchFile, LIBRARY, RESEARCH, syncResearch } from "./scripts/research.mjs";

const IMG = join(import.meta.dirname ?? ".", "public", "img");
const VIRTUAL = "virtual:portraits";

/** Lists the art on disk and flags portraits without an alpha channel, which the UI frames differently. */
function portraits(): Plugin {
  const webpHasAlpha = (buf: Buffer): boolean => {
    const chunk = buf.subarray(12, 16).toString();
    if (chunk === "VP8X") return (buf[20] & 0x10) !== 0;
    if (chunk === "VP8L") return ((buf.readUInt32LE(21) >> 28) & 1) === 1;
    return false;
  };
  const names = (dir: string) =>
    readdirSync(join(IMG, dir)).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
  return {
    name: "portraits",
    resolveId: (id) => (id === VIRTUAL ? `\0${VIRTUAL}` : undefined),
    load(id) {
      if (id !== `\0${VIRTUAL}`) return;
      const portrait = names("portrait");
      const opaque = portrait.filter((n) => !webpHasAlpha(readFileSync(join(IMG, "portrait", `${n}.webp`))));
      return `export const PORTRAITS = ${JSON.stringify(portrait)};
export const OPAQUE = ${JSON.stringify(opaque)};
export const ART = ${JSON.stringify(names("art"))};`;
    },
  };
}

const REPO = join(import.meta.dirname ?? ".", "..");
const REFS = "virtual:refs";

type Src = Record<string, unknown> & { name: string };
const pick = (o: Record<string, unknown>, keys: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(keys).map(([to, from]) => [to, o[from]]).filter(([, v]) =>
      v !== null && v !== undefined && v !== ""
    ),
  );
/** One way to get an item (see `src/lib/sources.ts`). Built only from structured owners (D-110). */
type ItemSource = {
  k: string;
  at: string;
  place?: string;
  shop?: string;
  price?: number;
  cost?: string;
  part?: 1 | 3;
  plus?: number;
  ch?: string;
  route?: string;
  note?: string;
};
/** "Archive B (Beta, Β)" and "Archive B" share a key; "Longbow +3" keys as Longbow with plus 3. */
const itemKey = (n: string) => n.replace(/\s*\(.*\)$/, "").replace(/\s+\+\d+$/, "").toLowerCase().trim();
/**
 * Every item's sources from the three owners in weapons-and-items.json: `shops` (shops and Vandahl counters),
 * `dungeon_chests` (per Part) and each item's own `where` (quests, drops, story, crates, battle-map chests).
 */
function itemSources(
  wi: Record<string, unknown>,
  nodes: string[],
  quests: unknown[],
  partThree: unknown[],
): Map<string, ItemSource[]> {
  const out = new Map<string, ItemSource[]>();
  const add = (name: string, src: ItemSource) => {
    const k = itemKey(name);
    const list = out.get(k) ?? out.set(k, []).get(k)!;
    if (!list.some((x) => JSON.stringify(x) === JSON.stringify(src))) list.push(src);
  };
  const canon = new Map(nodes.map((n) => [n.toLowerCase(), n]));
  const placeOf = (loc: string) =>
    loc.split(",").map((p) => canon.get(p.replace(/\s*\(.*\)$/, "").trim().toLowerCase())).find(Boolean);
  for (
    const sh of wi.shops as {
      shop: string;
      location: string;
      opens?: string | null;
      items: { name: string; price?: number | string | null; from_chapter?: number | null; note?: string }[];
    }[]
  ) {
    const place = placeOf(sh.location);
    const barter = /vandahl/i.test(sh.shop);
    const shop = barter ? "Vandahl" : sh.shop.replace(/\s*\(.*\)$/, "");
    for (const x of sh.items) {
      add(x.name, {
        k: barter ? "barter" : "buy",
        at: place ?? sh.location,
        ...(place ? { place } : {}),
        shop,
        ...(typeof x.price === "number" && !barter ? { price: x.price } : {}),
        ...(typeof x.price === "string" && barter ? { cost: x.price } : {}),
        ...(x.from_chapter ? { ch: `from Ch ${x.from_chapter}` } : {}),
        ...(x.note ? { note: x.note } : {}),
      });
    }
  }
  for (const d of wi.dungeon_chests as { dungeon: string; part1: string[]; part3: string[]; note?: string | null }[]) {
    const place = canon.get(d.dungeon.toLowerCase());
    for (const [part, list] of [[1, d.part1], [3, d.part3]] as const) {
      for (const n of list) {
        const plus = Number(n.match(/\+(\d+)$/)?.[1] ?? 0);
        add(n, {
          k: "chest",
          at: d.dungeon,
          ...(place ? { place } : {}),
          part,
          ...(plus ? { plus } : {}),
          ...(part === 1 && d.note ? { note: d.note } : {}),
        });
      }
    }
  }
  // Quest rewards: owned by the quest catalog (site/src/data/quests -> quests.gen.json).
  for (
    const q of quests as {
      name: string;
      reward?: { items?: string[] };
      routes: Record<string, { ch: number }>;
    }[]
  ) {
    const routes = Object.entries(q.routes);
    if (!routes.length) continue;
    const ch = Math.min(...routes.map(([, r]) => r.ch));
    for (const n of q.reward?.items ?? []) {
      add(n.replace(/\s*×\d+$/, ""), {
        k: "quest",
        at: q.name,
        ch: `Ch ${ch}`,
        ...(routes.length < 4 ? { route: routes.map(([r]) => r).join(", ") } : {}),
      });
    }
  }
  // Part III quest rewards: owned by repo-root part3-salvation.json (quests, trial items, dance stops).
  for (
    const q of partThree as {
      name: string;
      from_section?: number;
      reward?: { items?: string[]; trial_items?: string[] };
      stops?: { at: string; items?: string[] }[];
    }[]
  ) {
    const ch = q.from_section ? `Part III S${q.from_section}` : "Part III";
    for (const n of q.reward?.items ?? []) add(n.replace(/\s*×\d+$/, ""), { k: "quest", at: q.name, ch });
    for (const n of q.reward?.trial_items ?? []) add(n, { k: "quest", at: `${q.name} (Trial)`, ch });
    for (const st of q.stops ?? []) {
      for (const n of st.items ?? []) add(n, { k: "quest", at: `${q.name} (${st.at})`, ch });
    }
  }
  for (const group of ["weapons", "equipment", "consumables"]) {
    for (const it of wi[group] as Src[]) {
      for (
        const w of (it.where ?? []) as {
          source?: string;
          location?: string;
          chapter?: string | null;
          route?: string | null;
        }[]
      ) {
        add(it.name, {
          k: w.source === "chest" ? "map" : w.source ?? "other",
          at: w.location ?? "",
          ...(w.chapter ? { ch: w.chapter } : {}),
          ...(w.route ? { route: w.route } : {}),
        });
      }
      // Group rows ("Skill manuals (...)") gather their members' sources.
      for (const m of (it.members ?? []) as string[]) for (const x of out.get(itemKey(m)) ?? []) add(it.name, x);
    }
  }
  return out;
}

/**
 * Slim lookup tables for hover cards, built from the repo-root reference JSON (items, classes, arts, abilities,
 * the combat stat glossary).
 * Only the fields a card shows are shipped.
 */
function refs(): Plugin {
  const read = (f: string) => JSON.parse(readFileSync(join(RESEARCH, f), "utf8"));
  return {
    name: "refs",
    resolveId: (id) => (id === REFS ? `\0${REFS}` : undefined),
    load(id) {
      if (id !== `\0${REFS}`) return;
      const wi = read("weapons-and-items.json");
      const mapNodes = (JSON.parse(readFileSync(join(import.meta.dirname ?? ".", "src/data/world-map.json"), "utf8"))
        .nodes as { name: string }[]).map((n) => n.name);
      const SOURCES = itemSources(
        wi,
        mapNodes,
        JSON.parse(readFileSync(join(import.meta.dirname ?? ".", "src/data/quests.gen.json"), "utf8")),
        read("part3-salvation.json").quests,
      );
      const srcOf = (n: string) => SOURCES.get(itemKey(n));
      const items: Record<string, unknown> = {};
      for (const w of wi.weapons as Src[]) {
        items[w.name] = {
          kind: "Weapon",
          ...pick(w, { type: "type", rank: "rank", mt: "might", hit: "hit", crit: "crit", wt: "weight" }),
          ...pick(w, { rng: "range", fx: "effects", price: "price" }),
          eff: (w.effective as string[] | undefined)?.length ? w.effective : undefined,
          ...pick(w, { dur: "durability", curse: "curse" }),
          refine: w.refine
            ? pick(w.refine as Record<string, unknown>, { lv: "max_level", fx: "max_effect" })
            : undefined,
          src: srcOf(w.name),
        };
      }
      for (const group of ["equipment", "consumables"]) {
        for (const e of wi[group] as Src[]) {
          items[e.name] = {
            kind: group === "equipment" ? "Equipment" : "Item",
            ...pick(e, { type: "kind", fx: "effect", wt: "weight", uses: "uses", price: "price", curse: "curse" }),
            // A lord's key item (Mahadu's Arm, Red Jewel...): always on for its holder, never in a kit slot.
            ...pick(e, { holder: "holder" }),
            ...(e.members ? { group: true } : {}),
            src: srcOf(e.name),
          };
        }
      }
      const classes: Record<string, unknown> = {};
      for (const c of read("class-data.json").classes as Src[]) {
        const req = (c.requirements ?? {}) as Record<string, unknown>;
        const mods = Object.entries((c.growth_mods ?? {}) as Record<string, number>).filter(([, v]) => v);
        const mastery = c.mastery as { ability?: string; description?: string } | undefined;
        classes[c.name] = {
          tier: c.tier,
          part: c.part,
          renown: req.renown,
          level: req.level,
          ranks: req.ranks,
          license: req.license ?? undefined,
          mov: c.mov,
          move: c.movement,
          weapons: c.weapons,
          growth: Object.fromEntries(mods),
          flat: Object.fromEntries(
            Object.entries((c.stats ?? {}) as Record<string, number>).filter(([, v]) => v),
          ),
          mastery: mastery?.ability ? `${mastery.ability}: ${mastery.description ?? ""}` : undefined,
          unlock: c.unlock ?? undefined,
        };
      }
      const ca = read("combat-arts-and-abilities.json");
      const arts: Record<string, unknown> = {};
      for (const a of ca.combat_arts as Src[]) {
        arts[a.name] = pick(a, {
          weapon: "weapon",
          mt: "might",
          hit: "hit",
          crit: "crit",
          avo: "avoid",
          rng: "range",
          dur: "durability",
          fx: "effects",
        });
      }
      const abilities: Record<string, unknown> = {};
      const addAbility = (a: Src) => {
        abilities[a.name] ??= pick(a, { fx: "effect", source: "source", from: "from", skill: "skill" });
      };
      for (const a of ca.abilities as Src[]) addAbility(a);
      for (const k of ["skill_rank", "mount", "bloodmark"]) {
        for (const a of (ca.other_abilities?.[k] ?? []) as Src[]) addAbility(a);
      }
      // Stat glossary: one entry per abbreviation, with source names shortened to their site.
      const cs = read("combat-stats.json");
      const srcName = new Map<string, string>(
        (cs.sources as { key: string; url: string }[]).map((s) => [
          s.key,
          s.url.startsWith("local:") ? "local research" : new URL(s.url).hostname.replace(/^www\./, ""),
        ]),
      );
      const stats: Record<string, unknown> = {};
      for (const s of cs.stats as (Src & { abbr: string; source: string[] })[]) {
        stats[s.abbr] = {
          ...pick(s, { name: "name", group: "group", what: "what", formula: "formula", matters: "matters" }),
          src: [...new Set(s.source.map((k) => srcName.get(k) ?? k))],
        };
      }
      // Meal dish reactions (repo-root dishes.json): per character, every route; table picks in src/lib/dishes.ts.
      const dj = read("dishes.json");
      const dishes = { list: (dj.dishes as { name: string }[]).map((x) => x.name), reactions: dj.reactions };
      // Gifts: the whole catalog (repo-root gifts.json) minus source keys; picks are derived in src/lib/gifts.ts.
      const gj = read("gifts.json");
      const gifts: Record<string, unknown> = {};
      for (const g of gj.gifts as Src[]) {
        gifts[g.name as string] = pick(g, {
          price: "price",
          rarity: "rarity",
          likes: "likes",
          sold: "sold",
          other: "other",
          loved: "loved",
          really: "really",
          lovedUnconfirmed: "lovedQ",
        });
      }
      // Per-unit taste profile (Polygon categories plus player reports): what they like by type and what flopped.
      const giftProfiles: Record<string, unknown> = {};
      for (const [u, c] of Object.entries(gj.characters as Record<string, Src>)) {
        giftProfiles[u] = pick(c, { bio: "bio", categories: "categories", not: "not" });
      }
      // Place loot (D-101, D-109): structured owners only, never place names found inside free text.
      // Chests: weapons-and-items.json `dungeon_chests` (RPG Site, split by Part). Shops and Vandahl barter
      // counters: `shops`, keyed by the place before the comma in `location`. Quest/story rewards stay on quests.
      const nodes = (JSON.parse(readFileSync(join(import.meta.dirname ?? ".", "src/data/world-map.json"), "utf8"))
        .nodes as { name: string }[]).map((n) => n.name);
      const canon = new Map(nodes.map((n) => [n.toLowerCase(), n]));
      // "Peluza Cape, Elektra" -> Peluza Cape; "Dagsion (Port)" and "Shopping Arcade, Dagsion" -> Dagsion.
      const placeOf = (loc: string) =>
        loc.split(",").map((p) => canon.get(p.replace(/\s*\(.*\)$/, "").trim().toLowerCase())).find(Boolean);
      type Loot = {
        buy: { item: string; price?: number }[];
        barter: { item: string; cost?: string }[];
        chests?: { p1: string[]; p3: string[]; note?: string };
      };
      const loot: Record<string, Loot> = {};
      const at = (place: string) => (loot[place] ??= { buy: [], barter: [] });
      for (
        const d of wi.dungeon_chests as { dungeon: string; part1: string[]; part3: string[]; note?: string | null }[]
      ) {
        const place = canon.get(d.dungeon.toLowerCase());
        if (place) at(place).chests = { p1: d.part1, p3: d.part3, ...(d.note ? { note: d.note } : {}) };
      }
      for (
        const sh of wi.shops as {
          location?: string;
          shop?: string;
          items?: { name: string; price?: number | string | null }[];
        }[]
      ) {
        const place = placeOf(sh.location ?? "");
        if (!place) continue;
        const barter = /vandahl/i.test(sh.shop ?? "");
        for (const x of sh.items ?? []) {
          if (barter) {
            if (!at(place).barter.some((y) => y.item === x.name)) {
              at(place).barter.push({ item: x.name, ...(typeof x.price === "string" ? { cost: x.price } : {}) });
            }
          } else if (!at(place).buy.some((y) => y.item === x.name)) {
            at(place).buy.push({ item: x.name, ...(typeof x.price === "number" ? { price: x.price } : {}) });
          }
        }
      }
      for (const g of gj.gifts as { name: string; price?: number; sold?: { shop: string }[] }[]) {
        for (const s of g.sold ?? []) {
          const place = gj.shops[s.shop]?.dagsion
            ? "Dagsion"
            : canon.get(s.shop.replace(/ Peddler$/, "").toLowerCase());
          if (place && !at(place).buy.some((y) => y.item === g.name)) {
            at(place).buy.push({ item: g.name, price: g.price });
          }
        }
      }
      // Battalions (repo-root battalions.json, Theodora's route system): stats without zeros, gambit, recruit towns.
      const bj = read("battalions.json");
      const battalions: Record<string, unknown> = {};
      for (const b of bj.battalions as Src[]) {
        const stats = Object.fromEntries(
          Object.entries((b.stats ?? {}) as Record<string, number | null>).filter(([, v]) =>
            typeof v === "number" && v !== 0
          ),
        );
        const g = (b.gambit ?? null) as Src | null;
        battalions[b.name as string] = {
          tier: b.tier,
          auth: b.authority,
          kind: b.type ?? undefined,
          stats,
          gambit: g
            ? pick(g, {
              name: "name",
              kind: "kind",
              mt: "might",
              hit: "hit",
              rng: "range",
              area: "area",
              uses: "uses",
              fx: "effect",
            })
            : undefined,
          towns: [...new Set(((b.where ?? []) as { location?: string }[]).map((w) => w.location).filter(Boolean))],
          notes: b.notes ?? undefined,
        };
      }
      // Part II and Part III facts (D-117) and the gods' Blessings: shipped whole, the pages derive their views.
      const part2 = read("part2-war.json");
      const part3 = read("part3-salvation.json");
      const gods = read("gods.json");
      return `export const ITEMS = ${JSON.stringify(items)};
export const PART2 = ${JSON.stringify(part2)};
export const PART3 = ${JSON.stringify(part3)};
export const GODS = ${JSON.stringify(gods)};
export const BATTALIONS = ${JSON.stringify(battalions)};
export const PLACE_LOOT = ${JSON.stringify(loot)};
export const GIFTS = ${JSON.stringify(gifts)};
export const DISHES = ${JSON.stringify(dishes)};
export const GIFT_SHOPS = ${JSON.stringify(gj.shops)};
export const GIFT_PLACES = ${JSON.stringify(gj.places)};
export const GIFT_AVOID = ${JSON.stringify(gj.avoid)};
export const GIFT_PROFILES = ${JSON.stringify(giftProfiles)};
export const CLASS_REF = ${JSON.stringify(classes)};
export const ARTS = ${JSON.stringify(arts)};
export const ABILITIES = ${JSON.stringify(abilities)};
export const STATS = ${JSON.stringify(stats)};`;
    },
  };
}

/*
 * Stat checkpoints the player logs while playing (D-133). The file sits in the repo so Claude can read it:
 * GET returns it, POST `{ op: "put", entry }` adds or replaces one entry by id, `{ op: "delete", id }` removes one.
 * Works under `deno task dev` and `deno task preview`; a static copy of dist/ falls back to browser storage.
 */
const STAT_LOG = join(REPO, "run-log", "stat-checkpoints.json");
const STAT_KEYS = ["HP", "Str", "Mag", "Spd", "Dex", "Def", "Res", "Lck", "Cha"];
type LogEntry = { id: string; unit: string; level: number; stats: Record<string, number> } & Record<string, unknown>;

function statLog(): Plugin {
  const load = (): { v: 1; entries: LogEntry[] } =>
    existsSync(STAT_LOG) ? JSON.parse(readFileSync(STAT_LOG, "utf8")) : { v: 1, entries: [] };
  const valid = (e: LogEntry | undefined): e is LogEntry =>
    Boolean(e) && typeof e!.id === "string" && typeof e!.unit === "string" && Number.isFinite(e!.level) &&
    STAT_KEYS.every((k) => Number.isFinite(e!.stats?.[k]));
  const handler: Connect.NextHandleFunction = (req, res) => {
    const send = (code: number, body: unknown) => {
      res.statusCode = code;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET") return send(200, load());
    if (req.method !== "POST") return send(405, { error: "GET or POST" });
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        const { op, entry, id } = JSON.parse(raw) as { op: string; entry?: LogEntry; id?: string };
        const file = load();
        if (op === "put" && valid(entry)) {
          const i = file.entries.findIndex((x) => x.id === entry.id);
          if (i >= 0) file.entries[i] = entry;
          else file.entries.push(entry);
        } else if (op === "delete" && id) {
          file.entries = file.entries.filter((x) => x.id !== id);
        } else return send(400, { error: "bad request" });
        // Grouped by unit, then by level, so the file reads as each unit's history.
        file.entries.sort((a, b) => a.unit.localeCompare(b.unit) || a.level - b.level);
        mkdirSync(join(REPO, "run-log"), { recursive: true });
        writeFileSync(`${STAT_LOG}.tmp`, `${JSON.stringify(file, null, 2)}\n`);
        renameSync(`${STAT_LOG}.tmp`, STAT_LOG);
        send(200, file);
      } catch (e) {
        send(500, { error: String(e) });
      }
    });
  };
  return {
    name: "stat-log",
    configureServer: (server) => void server.middlewares.use("/api/stat-log", handler),
    configurePreviewServer: (server) => void server.middlewares.use("/api/stat-log", handler),
  };
}

/*
 * Keeps research/ in step with the library one level up (scripts/research.mjs). Syncs at startup; under
 * `deno task dev` it also watches the library, so editing a root JSON or walkthrough reloads the page.
 */
function research(): Plugin {
  return {
    name: "research",
    buildStart: () => void syncResearch(),
    configureServer(server) {
      server.watcher.add(LIBRARY);
      server.watcher.on("change", (file) => {
        const name = file.replace(/\\/g, "/").split("/").pop() ?? "";
        if (join(LIBRARY, name) === file && isResearchFile(name)) syncResearch([name]);
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [research(), react(), tailwindcss(), portraits(), refs(), statLog()],
  // The walkthroughs are the Markdown files one level up, imported raw at build time.
  server: { fs: { allow: [".."] } },
  // All guide data ships in one bundle on purpose: the site is a local reference with no lazy routes.
  build: { chunkSizeWarningLimit: 1600 },
});
