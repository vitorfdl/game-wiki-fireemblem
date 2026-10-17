// Content validator (redesign/03-data-model.md §7). Checks chapter files, quests, route ledgers and unit builds.
//
//   node scripts/check-content.mjs [--route cai] [--strict]
//   deno run -A scripts/check-content.mjs [--route cai] [--strict]
//
// Exit code 1 when there are errors (or warnings with --strict). Notes (conf values) never fail.
import process from "node:process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DATA,
  loadChapters,
  loadCharacters,
  loadQuests,
  loadRoutes,
  makeResolver,
  rel,
  REPORTS,
  ROUTE_NAMES,
  routeFromArg,
  routeSlug,
  slug,
} from "./lib/content-data.mjs";

/* ------------------------------------------------------------ args */

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const strict = flag("--strict");
const checkNames = flag("--names") || Boolean(opt("--route"));
const routeArg = opt("--route");
const onlyRoute = routeArg ? routeFromArg(routeArg) : undefined;
if (routeArg && !onlyRoute) {
  console.error(`Unknown route "${routeArg}". Use one of: ${ROUTE_NAMES.map(routeSlug).join(", ")}`);
  process.exit(2);
}
const ROUTES = onlyRoute ? [onlyRoute] : ROUTE_NAMES;

/* ------------------------------------------------------------ limits (02-templates.md §8) */

const LIMIT = {
  text: 100,
  detail: 120,
  detailMax: 3,
  action: 100,
  calloutText: 100,
  bulletsMax: 3,
  tipsMax: 4,
  optionsMax: 3,
  keyDecision: 90,
  keyDecisionsMax: 5,
  // Unit JSON: warnings until the P3 build agents shorten text.
  goal: 110,
  exit: 90,
  when: 40,
  gate: 90,
  decisionWhy: 220,
  gearWhy: 70,
  whyMax: 3,
  // Route synergies (02-templates.md §8).
  synergyPayoff: 110,
  synergyTitleWords: 5,
  // Growth checks on build stages (build-standard.md §12).
  checkNeed: 90,
  checkWhy: 90,
  checkFix: 80,
  checksMax: 3,
  fixMax: 3,
  // Class finalists (guide.finalists, D-121).
  finalistNote: 80,
  finalistUse: 24,
};
const STAT_NAMES = ["HP", "Str", "Mag", "Spd", "Dex", "Def", "Res", "Lck", "Cha"];
const SYNERGY_KINDS = ["defense", "offense", "healing", "mobility", "support"];
const CONF = ["?", "community", "disputed"];
const MISSABLE_KINDS = ["scene", "choice", "support-chain", "recruit-window", "item", "timing"];
const CALLOUT_TYPES = ["timing-trap", "fork", "multi-copy", "route-system", "special-map", "bench-plan"];

/* ------------------------------------------------------------ output */

const errors = new Map();
const warnings = new Map();
const notes = new Map();
const push = (m, file, msg) => {
  const k = rel(file);
  if (!m.has(k)) m.set(k, []);
  m.get(k).push(msg);
};
const err = (file, msg) => push(errors, file, msg);
const warn = (file, msg) => push(warnings, file, msg);
const note = (file, msg) => push(notes, file, msg);

/* ------------------------------------------------------------ data */

const characters = loadCharacters();
const routes = loadRoutes();
const quests = loadQuests();
const { refsIn, questById, resolve, gifts, classMove } = makeResolver({ characters, quests });
const QUESTS_FILE = join(DATA, "quests.gen.json");

const len = (s) => [...String(s ?? "")].length;
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

/** Checks every string under `node` for `[[refs]]` that don't resolve. */
function checkRefs(file, node, path = "") {
  if (typeof node === "string") {
    for (const r of refsIn(node)) if (r.problem) err(file, `${path || "(root)"}: ${r.raw} ${r.problem}`);
  } else if (Array.isArray(node)) {
    node.forEach((x, i) => checkRefs(file, x, `${path}[${i}]`));
  } else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) if (!k.startsWith("_")) checkRefs(file, v, path ? `${path}.${k}` : k);
  }
}

const verbose = flag("--verbose");
/** Unit JSON text over its limit: counted per file and field unless --verbose (P3 shortens these). */
const unitLen = new Map();
function checkLen(file, path, s, limit, level = "error") {
  if (typeof s !== "string") return;
  const n = len(s);
  if (n <= limit) return;
  if (level === "unit" && !verbose) {
    const field = path.replace(/\[\d+\]/g, "[]").replace(/^copies\[\] \(\w+\)\./, "copies.");
    const k = rel(file);
    if (!unitLen.has(k)) unitLen.set(k, new Map());
    const m = unitLen.get(k);
    const o = m.get(field) ?? { n: 0, limit, worst: 0 };
    o.n++;
    o.worst = Math.max(o.worst, n);
    m.set(field, o);
    return;
  }
  (level === "error" ? err : warn)(file, `${path}: ${n} chars (limit ${limit}): "${s.slice(0, 60)}…"`);
}

function checkDetail(file, path, detail, level = "error") {
  if (detail === undefined) return;
  if (!Array.isArray(detail)) return err(file, `${path}: must be an array of strings`);
  if (detail.length > LIMIT.detailMax) {
    (level === "error" ? err : warn)(file, `${path}: ${detail.length} bullets (max ${LIMIT.detailMax})`);
  }
  detail.forEach((d, i) => checkLen(file, `${path}[${i}]`, d, LIMIT.detail, level));
}

function checkConf(file, path, conf) {
  if (conf === undefined) return;
  if (!CONF.includes(conf)) err(file, `${path}.conf: "${conf}" is not one of ${CONF.join(", ")}`);
  else note(file, `${path}.conf = "${conf}"`);
}

function checkCallout(file, path, c) {
  if (c === undefined) return;
  if (!isObj(c)) return err(file, `${path}: must be an object`);
  if (!CALLOUT_TYPES.includes(c.type)) err(file, `${path}.type: "${c.type}" is not a callout type`);
  if (typeof c.text !== "string" || !c.text) err(file, `${path}.text: missing`);
  checkLen(file, `${path}.text`, c.text, LIMIT.calloutText);
  if (c.bullets !== undefined) {
    if (c.bullets.length > LIMIT.bulletsMax) {
      err(file, `${path}.bullets: ${c.bullets.length} (max ${LIMIT.bulletsMax})`);
    }
    c.bullets.forEach((b, i) => checkLen(file, `${path}.bullets[${i}]`, b, LIMIT.detail));
  }
}

/* ------------------------------------------------------------ chapters */

const ID_SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const TRACKED_SLOTS = new Set(["missables", "explore"]);

/**
 * Checks one Line. `slot` is the id slot name (`missables`, `explore`, ...); `tracked` is true when the row
 * must carry an id (missables, `loot: true`).
 */
function checkLine(ctx, path, line, slot, { tracked = false } = {}) {
  const { file, route, ch } = ctx;
  if (!isObj(line)) return err(file, `${path}: must be an object with "text"`);
  if (typeof line.text !== "string" || !line.text.trim()) err(file, `${path}.text: missing`);
  checkLen(file, `${path}.text`, line.text, LIMIT.text);
  checkDetail(file, `${path}.detail`, line.detail);
  checkConf(file, path, line.conf);
  const needsId = tracked || line.task === true || line.loot === true;
  if (line.task === true && !TRACKED_SLOTS.has(slot)) {
    warn(file, `${path}: task: true outside missables/explore (09-tracking §2 keeps checkboxes off ${slot} rows)`);
  }
  if (needsId && !line.id) err(file, `${path}: tracked row needs an "id"`);
  if (line.id) {
    const nn = String(ch).padStart(2, "0");
    const re = new RegExp(`^${routeSlug(route)}-ch${nn}-${slot}-${ID_SLUG}$`);
    if (!re.test(line.id)) {
      err(file, `${path}.id: "${line.id}" should match ${routeSlug(route)}-ch${nn}-${slot}-<slug>`);
    }
    ctx.ids.push({ id: line.id, file, path });
  }
}

const REQUIRED = [
  "route",
  "ch",
  "name",
  "free",
  "routine",
  "missables",
  "classes",
  "gear",
  "recruits",
  "quests",
  "explore",
  "battle",
];

function checkChapter(route, entry, routeCtx) {
  const { file, n } = entry;
  if (entry.error) return err(file, `invalid JSON: ${entry.error}`);
  const c = entry.data;
  const ctx = { file, route, ch: c.ch ?? n, ids: routeCtx.ids };

  // 1. slot keys
  for (const k of REQUIRED) if (!(k in c)) err(file, `missing slot key "${k}"`);
  if (isObj(c.quests)) {
    for (const k of ["route", "sub", "paralogue"]) {
      if (!Array.isArray(c.quests[k])) err(file, `quests.${k}: missing (use [])`);
    }
  }
  if (isObj(c.battle)) {
    for (const k of ["title", "objective"]) if (typeof c.battle[k] !== "string") err(file, `battle.${k}: missing`);
    if (!Array.isArray(c.battle.tips)) err(file, `battle.tips: missing (use [])`);
  }
  if (c.route !== undefined && c.route !== route) {
    err(file, `route: "${c.route}" but the file is in ${routeSlug(route)}/`);
  }
  if (c.ch !== undefined && c.ch !== n) err(file, `ch: ${c.ch} but the file is ch${String(n).padStart(2, "0")}.json`);
  if (c.free !== null && c.free !== undefined && !(isObj(c.free) && c.free.from && c.free.to)) {
    err(file, `free: must be { from, to } or null`);
  }
  for (const k of ["missables", "recruits", "explore"]) {
    if (k in c && !Array.isArray(c[k])) err(file, `${k}: must be an array`);
  }

  // 2. text limits and row shapes

  if (isObj(c.routine)) {
    const r = c.routine;
    (r.weekly ?? []).forEach((l, i) => checkLine(ctx, `routine.weekly[${i}]`, l, "routine"));
    (r.meals ?? []).forEach((m, i) => {
      if (!Array.isArray(m.tables)) return err(file, `routine.meals[${i}].tables: missing`);
      m.tables.forEach((t, j) => {
        if (t.length !== 3) warn(file, `routine.meals[${i}].tables[${j}]: ${t.length} seats (a table has 3)`);
        for (const u of t) if (!characters[u]) warn(file, `routine.meals[${i}].tables[${j}]: "${u}" is not a unit`);
      });
    });
    (r.gifts ?? []).forEach((g, i) => {
      if (!characters[g.unit]) warn(file, `routine.gifts[${i}].unit: "${g.unit}" is not a unit`);
      // A gift row names a catalog gift (gifts.json), so price and shop come from the catalog. Free text needs `where`.
      for (const k of ["gift", "alt"]) {
        if (g[k] && !gifts.has(g[k].toLowerCase()) && !g.where) {
          warn(
            file,
            `routine.gifts[${i}].${k}: "${g[k]}" is not in gifts.json (add \`where\` or use the catalog name)`,
          );
        }
      }
    });
  } else if (c.routine !== null && c.routine !== undefined) err(file, `routine: must be an object or null`);

  (c.missables ?? []).forEach((m, i) => {
    const p = `missables[${i}]`;
    checkLine(ctx, p, m, "missables", { tracked: true });
    if (!MISSABLE_KINDS.includes(m.kind)) {
      err(file, `${p}.kind: "${m.kind}" is not one of ${MISSABLE_KINDS.join(", ")}`);
    }
    if (!m.lose) err(file, `${p}.lose: missing`);
    if (!m.recover) err(file, `${p}.recover: missing`);
    if (m.options && m.options.length > LIMIT.optionsMax) {
      err(file, `${p}.options: ${m.options.length} (max ${LIMIT.optionsMax})`);
    }
    if (m.kind === "choice" && !m.options?.length) warn(file, `${p}: a "choice" missable usually lists options`);
    // A missable that is a dated quest shares the quest's checkbox; fork options name the quests they lead to.
    const qids = [
      ...(m.quest ? [[`${p}.quest`, m.quest]] : []),
      ...(m.options ?? []).flatMap((o, j) => (o.quests ?? []).map((q) => [`${p}.options[${j}].quests`, q])),
    ];
    for (const [qp, q] of qids) {
      const hit = questById.get(q);
      if (!hit) err(file, `${qp}: "${q}" is not in quests.gen.json`);
      else if (!hit.routes?.[route]) err(file, `${qp}: "${q}" has no ${route} entry in quests.gen.json`);
    }
  });

  if (isObj(c.classes)) {
    if (c.classes.note) checkLine(ctx, "classes.note", c.classes.note, "classes");
    (c.classes.override ?? []).forEach((o, i) => {
      if (!characters[o.unit]) err(file, `classes.override[${i}].unit: "${o.unit}" is not a unit`);
      checkLen(file, `classes.override[${i}].text`, o.text, LIMIT.text);
    });
  }

  if (isObj(c.gear)) {
    (c.gear.buy ?? []).forEach((l, i) => checkLine(ctx, `gear.buy[${i}]`, l, "gear"));
    (c.gear.note ?? []).forEach((l, i) => checkLine(ctx, `gear.note[${i}]`, l, "gear"));
    (c.gear.assign ?? []).forEach((a, i) => {
      if (!characters[a.to]) err(file, `gear.assign[${i}].to: "${a.to}" is not a unit`);
      checkLen(file, `gear.assign[${i}].why`, a.why, LIMIT.gearWhy, "warn");
      routeCtx.assigns.push({ item: a.item, to: a.to, ch: n, file, path: `gear.assign[${i}]` });
    });
  }

  // recruits, rule 5
  const ri = routes[route];
  const onRoute = new Set([
    route,
    ...(ri?.roster ?? []).map((u) => u.name),
    ...(ri?.extras ?? []),
    ...(ri?.fillers ?? []).map((f) => f.name),
  ]);
  (c.recruits ?? []).forEach((r, i) => {
    const p = `recruits[${i}]`;
    const unit = characters[r.unit];
    if (!unit) err(file, `${p}.unit: "${r.unit}" is not a unit`);
    else if (!onRoute.has(r.unit)) warn(file, `${p}.unit: ${r.unit} is not in ${route}'s roster, extras or fillers`);
    if (typeof r.action !== "string" || !r.action) err(file, `${p}.action: missing`);
    checkLen(file, `${p}.action`, r.action, LIMIT.action);
    checkDetail(file, `${p}.detail`, r.detail);
    checkCallout(file, `${p}.callout`, r.callout);
    checkConf(file, p, r.conf);
    const how = unit?.recruitOn?.[route]?.how;
    if (how === "auto" || how === "lord") {
      err(
        file,
        `${p}: ${r.unit} joins automatically on ${route} (recruitOn.${route}.how = "${how}"); the join is derived (rule 5)`,
      );
    }
    if (unit) routeCtx.derived.push({ id: `${routeSlug(route)}-recruit-${slug(r.unit)}`, file, path: p });
  });
  (c.prep ?? []).forEach((l, i) => checkLine(ctx, `prep[${i}]`, l, "prep"));

  // 4. quest rows
  if (isObj(c.quests)) {
    for (const k of ["route", "sub", "paralogue"]) {
      (c.quests[k] ?? []).forEach((q, i) => {
        const p = `quests.${k}[${i}]`;
        const hit = questById.get(q.quest);
        if (!hit) err(file, `${p}.quest: "${q.quest}" is not in quests.gen.json`);
        else if (!hit.routes?.[route]) err(file, `${p}.quest: "${q.quest}" has no ${route} entry in quests.gen.json`);
        checkLen(file, `${p}.note`, q.note, LIMIT.text, "warn");
        checkDetail(file, `${p}.detail`, q.detail);
        if (q.offered !== undefined && !["always", "if-offered"].includes(q.offered)) {
          err(file, `${p}.offered: "${q.offered}" is not "always" or "if-offered"`);
        }
        routeCtx.derived.push({ id: `${routeSlug(route)}-quest-${q.quest}`, file, path: p });
      });
    }
  }

  (c.explore ?? []).forEach((l, i) => checkLine(ctx, `explore[${i}]`, l, "explore", { tracked: l?.loot === true }));

  if (isObj(c.battle)) {
    const tips = c.battle.tips ?? [];
    if (tips.length > LIMIT.tipsMax) err(file, `battle.tips: ${tips.length} rows (max ${LIMIT.tipsMax})`);
    tips.forEach((l, i) => checkLine(ctx, `battle.tips[${i}]`, l, "battle"));
    (c.battle.loot ?? []).forEach((l, i) => checkLine(ctx, `battle.loot[${i}]`, l, "battle"));
    checkCallout(file, "battle.callout", c.battle.callout);
    for (const g of c.battle.guests ?? []) if (!characters[g]) warn(file, `battle.guests: "${g}" is not a unit`);
  }
  (c.exitExtra ?? []).forEach((l, i) => checkLine(ctx, `exitExtra[${i}]`, l, "exit"));

  // 3. refs
  checkRefs(file, c);

  // 10. free dates agree with routes/<route>.json chapters[n].free
  const rf = ri?.chapters?.[String(n)]?.free;
  if (rf !== undefined || c.free) {
    const parts = rf ? rf.split(/\s*(?:[–—-]|\bto\b)\s*/).map((s) => s.trim()) : null;
    const mine = c.free ? [c.free.from, c.free.to] : null;
    if (JSON.stringify(parts) !== JSON.stringify(mine) && (rf !== undefined)) {
      warn(
        file,
        `free: ${mine ? mine.join(" to ") : "null"} but routes/${
          routeSlug(route)
        }.json chapters.${n}.free is "${rf}" (rule 10)`,
      );
    }
  }
}

/* ------------------------------------------------------------ builds */

/** -1, 0 or 1; chapters compare only when both points name one. */
function cmpPt(a, b) {
  if (a.part !== b.part) return a.part < b.part ? -1 : 1;
  if (a.ch === undefined || b.ch === undefined) return 0;
  return a.ch === b.ch ? 0 : a.ch < b.ch ? -1 : 1;
}
const fmtPt = (p) => p ? `Part ${p.part}${p.ch !== undefined ? ` Ch ${p.ch}` : ""}` : "?";

/* Class finalists (D-121): every class and mount must pick a classes.json row, as growth.ts does. */
const CLASS_ROWS = Object.keys(JSON.parse(readFileSync(join(DATA, "classes.json"), "utf8")));
const CLASS_ALIAS = {
  "Commoner": "Commoner/Noble",
  "Noble": "Commoner/Noble",
  "Sword Master": "Swordmaster",
  "Wise Man": "Wiseman",
};

function checkFinalists(file, label, f) {
  if (f === undefined) return;
  const p = `${label}.finalists`;
  if (!isObj(f) || !Array.isArray(f.stats) || !Array.isArray(f.options)) {
    return err(file, `${p}: needs stats and options lists`);
  }
  f.stats.forEach((s, i) => {
    if (!STAT_NAMES.includes(s)) err(file, `${p}.stats[${i}]: "${s}" is not one of ${STAT_NAMES.join(", ")}`);
  });
  f.options.forEach((o, i) => {
    const q = `${p}.options[${i}]`;
    const cls = CLASS_ALIAS[o.class] ?? o.class;
    if (!CLASS_ROWS.includes(cls)) err(file, `${q}.class: "${o.class}" has no row in classes.json`);
    else if (o.mount) {
      const want = `${cls}(${o.mount}`.toLowerCase();
      if (!CLASS_ROWS.some((k) => k.toLowerCase().startsWith(want))) {
        err(file, `${q}.mount: no "${cls}(${o.mount}…)" row in classes.json`);
      }
    }
    if (!o.note) err(file, `${q}.note: missing`);
    checkLen(file, `${q}.note`, o.note, LIMIT.finalistNote, "warn");
    checkLen(file, `${q}.use`, o.use, LIMIT.finalistUse, "warn");
  });
}

/** Routes the player has finished (D-42): their builds are frozen, so new authoring rules skip them. */
const FINISHED = new Set(["Cai", "Dietrich"]);

function checkBuild(file, label, guide, route) {
  checkFinalists(file, label, guide?.finalists);
  const stages = guide?.stages ?? [];
  if (!stages.length) return;
  let prev;
  stages.forEach((s, i) => {
    const p = `${label}.stages[${i}]`;
    if (!isObj(s.from) || ![1, 2, 3].includes(s.from.part)) {
      err(file, `${p}: no valid "from" (rule 7)`);
    } else {
      if (prev && cmpPt(prev, s.from) > 0) {
        err(file, `${p}.from: ${fmtPt(s.from)} comes before the previous stage's ${fmtPt(prev)}`);
      }
      prev = s.from;
    }
    if (isObj(s.to) && s.to.part && isObj(s.from) && cmpPt(s.from, s.to) > 0) {
      err(file, `${p}.to: ${fmtPt(s.to)} is before its from ${fmtPt(s.from)}`);
    }
    const next = stages[i + 1];
    if (isObj(s.to) && s.to.part && next?.from && cmpPt(s.to, next.from) > 0) {
      warn(file, `${p}.to: ${fmtPt(s.to)} overlaps the next stage's from ${fmtPt(next.from)} (rule 7)`);
    }
    checkLen(file, `${p}.goal`, s.goal, LIMIT.goal, "unit");
    checkLen(file, `${p}.exit`, s.exit, LIMIT.exit, "unit");
    checkLen(file, `${p}.when`, s.when, LIMIT.when, "unit");
    if (s.why && s.why.length > LIMIT.whyMax) warn(file, `${p}.why: ${s.why.length} bullets (max ${LIMIT.whyMax})`);
    for (const k of ["weapons", "equipment", "items"]) {
      (s[k] ?? []).forEach((g, j) => checkLen(file, `${p}.${k}[${j}].why`, g.why, LIMIT.gearWhy, "unit"));
    }
    checkChecks(file, p, s.checks);
    if (checkNames) checkStageNames(file, p, s, route);
    if (checkNames) checkRefines(file, p, s, route);
  });
  const parts = new Set(stages.map((s) => s.from?.part).filter(Boolean));
  if (!parts.has(3)) err(file, `${label}: the build doesn't reach Part III (rule 11)`);
  // A Part III joiner (first stage in Part III) has no Part I or II to cover.
  if (!parts.has(2) && stages[0]?.from?.part !== 3) {
    warn(file, `${label}: no Part II stage (rule 11 wants Part I, II and III covered)`);
  }
  (guide.gates ?? []).forEach((g, i) => {
    checkLen(file, `${label}.gates[${i}].text`, g.text, LIMIT.gate, "unit");
    if (!isObj(g.from)) err(file, `${label}.gates[${i}].from: missing`);
  });
  (guide.decisions ?? []).forEach((d, i) =>
    checkLen(file, `${label}.decisions[${i}].why`, d.why, LIMIT.decisionWhy, "unit")
  );
  (guide.callouts ?? []).forEach((c, i) => checkCallout(file, `${label}.callouts[${i}]`, c));
}

function checkChecks(file, p, checks) {
  if (!checks) return;
  if (!Array.isArray(checks)) return err(file, `${p}.checks: not a list`);
  if (checks.length > LIMIT.checksMax) warn(file, `${p}.checks: ${checks.length} (max ${LIMIT.checksMax})`);
  checks.forEach((c, i) => {
    const q = `${p}.checks[${i}]`;
    if (!STAT_NAMES.includes(c.stat)) err(file, `${q}.stat: "${c.stat}" is not one of ${STAT_NAMES.join(", ")}`);
    if (!c.need) err(file, `${q}.need: missing`);
    if (!Array.isArray(c.fix) || !c.fix.length) err(file, `${q}.fix: needs 1 to ${LIMIT.fixMax} patches`);
    else if (c.fix.length > LIMIT.fixMax) warn(file, `${q}.fix: ${c.fix.length} (max ${LIMIT.fixMax})`);
    checkLen(file, `${q}.need`, c.need, LIMIT.checkNeed, "warn");
    checkLen(file, `${q}.why`, c.why, LIMIT.checkWhy, "warn");
    (c.fix ?? []).forEach((f, j) => checkLen(file, `${q}.fix[${j}]`, f, LIMIT.checkFix, "warn"));
  });
}

/** Gear, arts, spells and abilities named in a stage must exist in the repo-root data (--names, or with --route). */
/*
 * D-138: legal refine level for a stage. The Blacksmith gives +1 at Renown 7 and +2 at Renown 10 (the Part I and II
 * ceiling, every weapon); +3 to +5 open in Part III Section 1 up to the weapon's own cap (Wooden +9, player-confirmed
 * Oct 16). A Part I stage is checked at its start chapter, with the Renown its route's pace has then.
 */
const TIER_CAP = { Wooden: 9, Bronze: 5, Iron: 5 };
function refineCap(route, from, item) {
  const tier = TIER_CAP[String(item).split(" ")[0]] ?? 3;
  if (!from || from.part === 3) return tier;
  if (from.part === 2) return Math.min(2, tier);
  const pace = routes[route]?.ledger?.renownPace ?? [];
  const row = pace.find((r) => r.ch === from.ch) ?? pace.filter((r) => r.ch <= (from.ch ?? 1)).at(-1);
  const renown = row?.from ?? 0;
  return Math.min(renown >= 10 ? 2 : renown >= 7 ? 1 : 0, tier);
}
function checkRefines(file, p, s, route) {
  if (FINISHED.has(route)) return;
  for (const k of ["weapons", "equipment"]) {
    (s[k] ?? []).forEach((g, j) => {
      const m = String(g.item).match(/^(.+?)\s+\+(\d+)$/);
      if (!m) return;
      const cap = refineCap(route, s.from, m[1]);
      if (Number(m[2]) > cap) {
        warn(file, `${p}.${k}[${j}]: "${g.item}" is past the refine cap here (+${cap}, D-138)`);
      }
    });
  }
}

function checkStageNames(file, p, s, route) {
  const bare = (n) => String(n ?? "").replace(/\s*\(.*$/, "").trim();
  for (const k of ["weapons", "equipment", "items"]) {
    (s[k] ?? []).forEach((g, j) => {
      if (!resolve(bare(g.item), "item")) warn(file, `${p}.${k}[${j}]: "${g.item}" is not in weapons-and-items.json`);
    });
  }
  // D-135: every worn piece names a fallback, and every fallback is a catalog item.
  (FINISHED.has(route) ? [] : s.equipment ?? []).forEach((g, j) => {
    const alts = (g.alts ?? []).filter((a) => String(a).trim());
    if (!alts.length) warn(file, `${p}.equipment[${j}]: "${g.item}" has no alternative in "alts" (D-135)`);
    alts.forEach((a) => {
      if (!resolve(bare(a), "item")) warn(file, `${p}.equipment[${j}].alts: "${a}" is not in weapons-and-items.json`);
    });
  });
  (s.arts ?? []).forEach((a, j) => {
    if (!resolve(bare(a.name), "art")) {
      warn(file, `${p}.arts[${j}]: "${a.name}" is not in combat-arts-and-abilities.json`);
    }
  });
  (s.abilities ?? []).forEach((a, j) => {
    if (!resolve(bare(a.name), "ability")) {
      warn(file, `${p}.abilities[${j}]: "${a.name}" is not an ability in combat-arts-and-abilities.json`);
    }
  });
  // Battalions (D-112): the name must exist, and only infantry or armored classes can carry one.
  if (s.battalion) {
    if (!resolve(bare(s.battalion.name), "battalion")) {
      warn(file, `${p}.battalion: "${s.battalion.name}" is not in battalions.json`);
    }
    const mv = classMove.get(String(s.class ?? "").toLowerCase());
    if (mv && !["infantry", "armored"].includes(mv)) {
      err(file, `${p}.battalion: ${s.class} is ${mv}; battalions need infantry or armored`);
    }
  }
  // Every class has 5 ability slots (D-102): more is an error, fewer needs a reason in the stage.
  const nAb = (s.abilities ?? []).length;
  if (nAb > 5) err(file, `${p}.abilities: ${nAb} (5 slots)`);
  else if (nAb < 5 && !s.openSlots) {
    warn(
      file,
      `${p}.abilities: ${nAb}/5 filled; fill from level, mastery and skill-rank pools or say why in openSlots`,
    );
  }
}

/* ------------------------------------------------------------ ledger */

const stripParens = (s) => String(s ?? "").replace(/\([^)]*\)/g, " ");
const classParts = (raw) =>
  stripParens(raw).split(/,\s*then\s+|\s+then\s+|\s+or\s+|\s*>\s*|\s*,\s*/).map((p) => p.trim().toLowerCase()).filter(
    Boolean,
  );

/** The stage list a unit uses on a route: its copy for that route if it has one, else its home guide. */
function stagesOn(unit, route) {
  const copy = unit.copies?.find((x) => x.route === route);
  return { stages: (copy?.guide?.stages ?? unit.guide?.stages) ?? [], copy: Boolean(copy?.guide?.stages) };
}
function joinOn(unit, route) {
  if (unit.name === route) return 1;
  const r = routes[route]?.roster?.find((u) => u.name === unit.name);
  if (r) return r.chapter;
  return unit.copies?.find((x) => x.route === route)?.chapter ?? 1;
}

/** Army page synergy cards: shape errors, text limits as warnings. */
function checkSynergies(route) {
  const ri = routes[route];
  if (!ri) return;
  const file = ri._file;
  (ri.deployment?.synergies ?? []).forEach((sy, i) => {
    const p = `deployment.synergies[${i}]`;
    if (!Array.isArray(sy.units) || !sy.units.length) err(file, `${p}.units: missing`);
    if (typeof sy.how !== "string" || !sy.how) err(file, `${p}.how: missing`);
    for (const u of sy.units ?? []) if (!characters[u]) warn(file, `${p}.units: "${u}" has no character file`);
    if (sy.kind !== undefined && !SYNERGY_KINDS.includes(sy.kind)) {
      err(file, `${p}.kind: "${sy.kind}" (expected ${SYNERGY_KINDS.join(" | ")})`);
    }
    if (sy.title !== undefined) {
      const words = String(sy.title).trim().split(/\s+/).filter(Boolean).length;
      if (!words) err(file, `${p}.title: empty`);
      else if (words > LIMIT.synergyTitleWords) {
        warn(file, `${p}.title: ${words} words (limit ${LIMIT.synergyTitleWords}): "${sy.title}"`);
      }
    }
    checkLen(file, `${p}.payoff`, sy.payoff, LIMIT.synergyPayoff, "warn");
  });
}

function checkLedger(route) {
  const ri = routes[route];
  if (!ri) return;
  const file = ri._file;
  const L = ri.ledger;
  checkRefs(file, L ?? {}, "ledger");
  if (!L) return warn(file, "no ledger yet");
  const kd = L.keyDecisions ?? [];
  if (kd.length > LIMIT.keyDecisionsMax) err(file, `ledger.keyDecisions: ${kd.length} (max ${LIMIT.keyDecisionsMax})`);
  kd.forEach((k, i) => checkLen(file, `ledger.keyDecisions[${i}].text`, k.text, LIMIT.keyDecision));

  // 6. license rows match a stage
  const lic = L.licenses;
  if (lic) {
    for (const tier of ["beginner", "specialty", "advanced"]) {
      (lic[tier] ?? []).forEach((row, i) => {
        const p = `ledger.licenses.${tier}[${i}] (${row.unit} → ${row.class})`;
        const unit = characters[row.unit];
        if (!unit) return err(file, `${p}: "${row.unit}" is not a unit`);
        const { stages } = stagesOn(unit, route);
        const join = joinOn(unit, route);
        const want = row.class.toLowerCase();
        const hits = stages
          .map((s, idx) => ({ s, idx, next: stages[idx + 1] }))
          .filter(({ s }) => classParts(s.class).includes(want));
        if (!hits.length) return err(file, `${p}: no stage of ${row.unit} on ${route} has class ${row.class} (rule 6)`);
        if (typeof row.ch === "number") {
          const inCh = hits.some(({ s, next }) => {
            if (s.from?.part !== 1) return false;
            const start = Math.max(s.from.ch ?? join, join);
            const end = s.to?.part === 1 && s.to.ch !== undefined
              ? s.to.ch
              : next?.from?.part === 1 && next.from.ch !== undefined
              ? next.from.ch
              : 12;
            return row.ch >= start && row.ch <= end;
          });
          if (!inCh) {
            const at = hits.map(({ s }) => fmtPt(s.from)).join(", ");
            warn(file, `${p}: ledger says Ch ${row.ch}, the matching stage starts at ${at}`);
          }
        } else if (!hits.some(({ s }) => (s.from?.part ?? 1) >= 2) && /part\s*ii/i.test(String(row.ch))) {
          warn(file, `${p}: ledger says "${row.ch}", but the matching stage is in Part I`);
        }
      });
    }
    const p1 = (lic.advanced ?? []).filter((r) => typeof r.ch === "number");
    if (typeof lic.advancedCap === "number" && p1.length > lic.advancedCap) {
      err(
        file,
        `ledger.licenses.advanced: ${p1.length} Part I rows (numeric ch) exceed advancedCap ${lic.advancedCap} (rule 6)`,
      );
    }
  }

  // 9. one unique, one unit at a time
  const byItem = new Map();
  for (const u of L.uniques ?? []) {
    if (!byItem.has(u.item)) byItem.set(u.item, []);
    byItem.get(u.item).push(u);
  }
  // Rows with a different `from` are different copies (two Flying Manuals from two chests).
  for (const [item, rows] of byItem) {
    for (let a = 0; a < rows.length; a++) {
      for (let b = a + 1; b < rows.length; b++) {
        if (rows[a].to !== rows[b].to && rows[a].from === rows[b].from && rows[a].ch === rows[b].ch) {
          err(file, `ledger.uniques: ${item} goes to ${rows[a].to} and ${rows[b].to} in the same chapter (rule 9)`);
        }
      }
    }
  }
}

/* ------------------------------------------------------------ Part II and III plan files (D-124, D-126) */

const P3 = JSON.parse(readFileSync(join(DATA, "..", "..", "..", "part3-salvation.json"), "utf8"));
const P3_BATTLES = new Set(P3.sections.flatMap((s) => s.battles.map((b) => b.name)));
const P3_QUESTS = new Set(P3.quests.map((q) => q.id));
const SQUAD_CAP = Object.fromEntries(P3.sections.map((s) => [s.n, s.squads]));
const BLESSINGS = ["Aurora", "Mars", "Smyrnos", "Jurah", "Kalla", "Credna"];

function checkLaterParts(route) {
  const dir = join(DATA, "walkthrough", routeSlug(route));
  if (!existsSync(dir)) return;
  const files = readdirSync(dir);
  const salvationPlans = new Map();
  const unit = (file, path, n) => {
    if (!characters[n]) err(file, `${path}: "${n}" is not a unit`);
  };
  for (const f of files.filter((x) => /^war-ch\d+\.json$/.test(x))) {
    const file = join(dir, f);
    let c;
    try {
      c = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      err(file, `invalid JSON: ${e.message}`);
      continue;
    }
    if (c.route !== route) err(file, `route: "${c.route}" but the file is in ${routeSlug(route)}/`);
    for (const b of c.blessings ?? []) if (!BLESSINGS.includes(b.god)) err(file, `blessings: "${b.god}" is not a god`);
    (c.deploy?.units ?? []).forEach((n, i) => unit(file, `deploy.units[${i}]`, n));
    (c.deploy?.bench ?? []).forEach((n, i) => unit(file, `deploy.bench[${i}]`, n));
    const dup = (c.deploy?.units ?? []).filter((n) => (c.deploy?.bench ?? []).includes(n));
    if (dup.length) err(file, `deploy: ${dup.join(", ")} both deployed and benched`);
    for (const [i, m] of (c.missables ?? []).entries()) {
      if (!MISSABLE_KINDS.includes(m.kind)) err(file, `missables[${i}].kind: "${m.kind}" is not a missable kind`);
      if (!m.id || !m.lose || !m.recover) err(file, `missables[${i}]: needs id, lose and recover`);
    }
    checkRefs(file, c);
  }
  for (const f of files.filter((x) => /^salvation-s\d+\.json$/.test(x))) {
    const file = join(dir, f);
    let c;
    try {
      c = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      err(file, `invalid JSON: ${e.message}`);
      continue;
    }
    for (const [i, q] of (c.quests ?? []).entries()) {
      if (!P3_QUESTS.has(q.id)) err(file, `quests[${i}].id: "${q.id}" is not in part3-salvation.json`);
    }
    for (const [i, g] of (c.gates ?? []).entries()) {
      if (!P3_BATTLES.has(g.battle)) err(file, `gates[${i}].battle: "${g.battle}" is not in part3-salvation.json`);
      for (const [j, b] of (g.blessings ?? []).entries()) {
        if (!BLESSINGS.includes(b.god)) err(file, `gates[${i}].blessings[${j}]: "${b.god}" is not a god`);
        if (!b.why) err(file, `gates[${i}].blessings[${j}]: needs why`);
      }
    }
    for (const [i, a] of (c.gear?.assign ?? []).entries()) unit(file, `gear.assign[${i}].to`, a.to);
    for (const [i, m] of (c.merges ?? []).entries()) unit(file, `merges[${i}].unit`, m.unit);
    for (const [i, x] of (c.copies ?? []).entries()) {
      unit(file, `copies[${i}].unit`, x.unit);
      if (!ROUTE_NAMES.includes(x.pick)) err(file, `copies[${i}].pick: "${x.pick}" is not a route`);
    }
    for (const [i, l] of (c.licenses ?? []).entries()) {
      unit(file, `licenses[${i}].unit`, l.unit);
      if (!l.to || !l.why) err(file, `licenses[${i}]: needs to and why`);
      else if (!CLASS_ROWS.includes(l.to)) err(file, `licenses[${i}].to: "${l.to}" has no row in classes.json`);
    }
    for (const [i, d] of (c.decisions ?? []).entries()) {
      if (!d.topic || !d.pick || !d.why) err(file, `decisions[${i}]: needs topic, pick and why`);
      else if (d.why.length > 220) warn(file, `decisions[${i}].why: ${d.why.length} chars (limit 220)`);
    }
    salvationPlans.set(c.n, { file, c });
    checkRefs(file, c);
  }
  if (files.includes("squads.json")) {
    const file = join(dir, "squads.json");
    const sq = JSON.parse(readFileSync(file, "utf8"));
    // Gate deploys (D-143): units from squads standing at that gate, under the cap with Eshmel, launcher among them.
    for (const [n, { file: pf, c }] of salvationPlans) {
      const at = (sq.sections ?? []).find((s) => s.n === n);
      for (const [i, g] of (c.gates ?? []).entries()) {
        const there = (at?.squads ?? []).filter((q) => (q.gates ?? []).includes(g.battle));
        const b = P3.sections.find((s) => s.n === n)?.battles.find((x) => x.name === g.battle);
        if (g.launch && !there.some((q) => q.id === g.launch)) {
          err(pf, `gates[${i}].launch: squad ${g.launch} is not at ${g.battle} in squads.json`);
        }
        if (!g.deploy) continue;
        const dupes = g.deploy.filter((u, j) => g.deploy.indexOf(u) !== j);
        if (dupes.length) err(pf, `gates[${i}].deploy: ${dupes.join(", ")} twice`);
        if (b?.max_units && g.deploy.length + (b.kind ? 0 : 1) > b.max_units) {
          err(pf, `gates[${i}].deploy: ${g.deploy.length}${b.kind ? "" : " + Eshmel"} over the cap of ${b.max_units}`);
        }
        for (const u of g.deploy) {
          unit(pf, `gates[${i}].deploy`, u);
          if (!there.some((q) => q.units.includes(u))) {
            err(pf, `gates[${i}].deploy: ${u} rides in no squad at ${g.battle}`);
          }
        }
      }
    }
    // License holders and hand-over targets the squad plan never lists: the Units tab and roster can't show them.
    const listed = new Set(
      (sq.sections ?? []).flatMap((s) => [...(s.squads ?? []).flatMap((q) => q.units), ...(s.bench ?? [])]),
    );
    for (const [, { file: pf, c }] of salvationPlans) {
      for (const [i, l] of (c.licenses ?? []).entries()) {
        if (!listed.has(l.unit)) warn(pf, `licenses[${i}].unit: ${l.unit} is in no squads.json list`);
      }
      for (const [i, a] of (c.gear?.assign ?? []).entries()) {
        if (!listed.has(a.to)) warn(pf, `gear.assign[${i}].to: ${a.to} is in no squads.json list`);
      }
    }
    for (const s of sq.sections ?? []) {
      const p = `sections[n=${s.n}]`;
      const cap = SQUAD_CAP[s.n];
      if (cap === undefined) err(file, `${p}: no Section ${s.n} in part3-salvation.json`);
      else if ((s.squads ?? []).length > cap) err(file, `${p}: ${s.squads.length} squads (Section cap ${cap})`);
      const seen = new Map();
      for (const q of s.squads ?? []) {
        if (!/^[A-E]$/.test(q.id)) err(file, `${p}.squads: id "${q.id}" must be A to E`);
        if ((q.units ?? []).length > 8) err(file, `${p}.squads[${q.id}]: ${q.units.length} units (max 8)`);
        for (const n of q.units ?? []) {
          unit(file, `${p}.squads[${q.id}]`, n);
          if (seen.has(n)) err(file, `${p}: ${n} is in squads ${seen.get(n)} and ${q.id}`);
          seen.set(n, q.id);
        }
        for (const g of q.gates ?? []) {
          if (!P3_BATTLES.has(g)) err(file, `${p}.squads[${q.id}].gates: "${g}" is not in part3-salvation.json`);
        }
      }
      for (const n of s.bench ?? []) {
        unit(file, `${p}.bench`, n);
        if (seen.has(n)) err(file, `${p}: ${n} is benched and in squad ${seen.get(n)}`);
      }
    }
  }
}

/* ------------------------------------------------------------ run */

let chapterCount = 0;
const unitsChecked = new Set();
for (const route of ROUTES) {
  checkLaterParts(route);
  const routeCtx = { ids: [], derived: [], assigns: [] };
  for (const entry of loadChapters(route)) {
    chapterCount++;
    checkChapter(route, entry, routeCtx);
  }
  // 8. duplicate ids within a route
  const seen = new Map();
  for (const x of routeCtx.ids) {
    if (seen.has(x.id)) {
      const o = seen.get(x.id);
      err(x.file, `${x.path}.id: "${x.id}" duplicates ${rel(o.file)} ${o.path} (rule 8)`);
    } else seen.set(x.id, x);
  }
  const seenD = new Map();
  for (const x of routeCtx.derived) {
    if (seen.has(x.id)) err(x.file, `${x.path}: derived id "${x.id}" collides with an authored id (rule 8)`);
    const o = seenD.get(x.id);
    if (o && o.file === x.file) err(x.file, `${x.path}: "${x.id}" appears twice in this chapter (rule 8)`);
    else if (o) warn(x.file, `${x.path}: "${x.id}" is also a row in ${rel(o.file)}; both share one checkbox`);
    else seenD.set(x.id, x);
  }
  // Two units may get the same item when the ledger lists them as different copies (different `from`).
  const copies = new Map();
  for (const u of routes[route]?.ledger?.uniques ?? []) {
    if (!copies.has(u.item)) copies.set(u.item, new Map());
    copies.get(u.item).set(u.to, u.from ?? "");
  }
  const separateCopies = (item, x, y) => {
    const m = copies.get(item);
    return Boolean(m?.has(x) && m.has(y) && m.get(x) !== m.get(y));
  };
  const byItem = new Map();
  for (const a of routeCtx.assigns) {
    const o = byItem.get(a.item);
    if (o && o.to !== a.to && !separateCopies(a.item, a.to, o.to)) {
      warn(a.file, `${a.path}: ${a.item} also goes to ${o.to} in Ch ${o.ch} (rule 9)`);
    } else if (!o) byItem.set(a.item, a);
  }
  checkLedger(route);
  checkSynergies(route);
  // Builds of every unit on this route (all units when no --route).
  const ri = routes[route];
  const names = new Set([
    route,
    ...(ri?.roster ?? []).map((u) => u.name),
    ...(ri?.extras ?? []),
    ...(ri?.fillers ?? []).map((f) => f.name),
  ]);
  for (const n of names) if (characters[n]) unitsChecked.add(n);
  // Part III joiners with no home army are shown on every route their recruitOn names (D-104).
  for (const c of Object.values(characters)) if (!c.homeRoute && c.recruitOn?.[route]) unitsChecked.add(c.name);
}
if (!onlyRoute) { for (const n of Object.keys(characters)) unitsChecked.add(n); }

for (const n of [...unitsChecked].sort()) {
  const c = characters[n];
  checkBuild(c._file, "guide", c.guide, c.homeRoute);
  (c.copies ?? []).forEach((cp, i) => {
    if (onlyRoute && cp.route !== onlyRoute && c.homeRoute !== onlyRoute && n !== onlyRoute) return;
    checkBuild(c._file, `copies[${i}] (${cp.route}).guide`, cp.guide, cp.route);
  });
  checkRefs(c._file, c);
  for (const [r, v] of Object.entries(c.recruitOn ?? {})) {
    if (!["auto", "recruit", "lord", "paralogue", "story"].includes(v.how)) {
      err(c._file, `recruitOn.${r}.how: "${v.how}"`);
    }
  }
}

// Quest catalog: refs and limits.
quests.forEach((q, i) => {
  if (onlyRoute && !q.routes?.[onlyRoute]) return;
  checkRefs(QUESTS_FILE, q, `[${i}] ${q.id}`);
  checkLen(QUESTS_FILE, `${q.id}.task`, q.task, 80, "warn");
});

// REVIEW leftovers in coverage reports.
if (existsSync(REPORTS)) {
  for (const f of readdirSync(REPORTS).filter((f) => f.endsWith(".coverage.json"))) {
    if (onlyRoute && !f.startsWith(`${routeSlug(onlyRoute)}-`)) continue;
    const text = readFileSync(join(REPORTS, f), "utf8");
    const n = (text.match(/REVIEW/g) ?? []).length;
    if (n) warn(join(REPORTS, f), `${n} REVIEW leftover(s)`);
  }
}

/* ------------------------------------------------------------ item sources (D-110) */

// weapons-and-items.json owns where to get items: `shops` (shops, Vandahl counters), `dungeon_chests` (per Part),
// item `where` rows (map chests, drops, story, crates, quests the quest catalog doesn't list). Builds and walkthrough
// rows only carry plan notes; the site derives the rest.
{
  const wi = JSON.parse(readFileSync(join(DATA, "..", "..", "..", "weapons-and-items.json"), "utf8"));
  const wiFile = "weapons-and-items.json";
  const key = (n) => String(n).replace(/\s*\(.*\)$/, "").replace(/\s+\+\d+$/, "").toLowerCase().trim();
  const catalog = new Set(["weapons", "equipment", "consumables"].flatMap((g) => wi[g].map((it) => key(it.name))));
  const counters = new Map();
  for (const sh of wi.shops) {
    if (!/vandahl/i.test(sh.shop)) continue;
    const place = sh.location.split(",")[0].replace(/\s*\(.*\)$/, "").trim();
    for (const x of sh.items) counters.set(key(x.name), [...(counters.get(key(x.name)) ?? []), place]);
  }
  const dungeons = wi.dungeon_chests.map((d) => d.dungeon);
  for (const g of ["weapons", "equipment", "consumables"]) {
    for (const it of wi[g]) {
      (it.where ?? []).forEach((w, i) => {
        const path = `${g}/${it.name}.where[${i}]`;
        if (w.source === "shop" || w.source === "exchange") {
          err(wiFile, `${path}: ${w.source} rows belong in \`shops\``);
        }
        if (w.source === "chest" && dungeons.some((d) => (w.location ?? "").startsWith(d))) {
          err(wiFile, `${path}: dungeon chests belong in \`dungeon_chests\``);
        }
      });
    }
  }
  // Authored copy notes may name a source ("Coris Mine chest", "Vandahl (Ladon Pike x3)"); they must agree with it.
  const chestsOf = new Map(wi.dungeon_chests.map((d) => [d.dungeon.toLowerCase(), [...d.part1, ...d.part3].map(key)]));
  const costs = new Map();
  for (const sh of wi.shops) {
    if (!/vandahl/i.test(sh.shop)) continue;
    for (const x of sh.items) {
      if (typeof x.price === "string") costs.set(key(x.name), [...(costs.get(key(x.name)) ?? []), x.price]);
    }
  }
  const tokens = (t) =>
    t.toLowerCase().replace(/×/g, "x").replace(/x\s+(\d)/g, "x$1").split(/[^a-z0-9']+/).filter(Boolean);
  const checkClaims = (file, at, item, text) => {
    if (!catalog.has(key(item)) || typeof text !== "string") return;
    for (const m of text.matchAll(/([A-Z][\w'-]*(?: [A-Z][\w'-]*)*) chest/g)) {
      const list = chestsOf.get(m[1].toLowerCase());
      if (list && !list.includes(key(item))) err(file, `${at}: "${m[1]}" has no ${item} chest (dungeon_chests)`);
    }
    const mats = text.match(/Vandahl[^()]*\(([^)]*\bx\s?\d[^)]*)\)/i)?.[1];
    const known = costs.get(key(item));
    if (mats && known && !known.some((c) => tokens(c).every((t) => tokens(mats).includes(t)))) {
      err(file, `${at}: barter cost "${mats}" doesn't match the catalog (${known.join(" | ")})`);
    }
  };
  const LOCATION = /\bvandahl\b[^.;]*:\s*\w+ x\d|\barmou?ry\b[^.;]*\d+G|\b\d[\d,]*G\b/i;
  const scanGear = (file, node, path) => {
    if (Array.isArray(node)) return node.forEach((x, i) => scanGear(file, x, `${path}[${i}]`));
    if (!isObj(node)) return;
    for (const [k, v] of Object.entries(node)) {
      if (["weapons", "equipment", "items"].includes(k) && Array.isArray(v)) {
        v.forEach((gr, i) => {
          if (!isObj(gr) || typeof gr.item !== "string") return;
          const at = `${path}.${k}[${i}]`;
          if (gr.where && catalog.has(key(gr.item))) {
            err(file, `${at}.where: "${gr.item}" is in the item catalog; use \`plan\` for plan notes only`);
          }
          if (gr.plan && LOCATION.test(gr.plan)) {
            warn(file, `${at}.plan: restates a shop/barter/chest (the catalog owns it): "${gr.plan}"`);
          }
        });
      } else if (["barter", "barters"].includes(k) && Array.isArray(v)) {
        v.forEach((b, i) => {
          const at = `${path}.${k}[${i}]`;
          if (!isObj(b)) return;
          if (b.mats || b.where) err(file, `${at}: mats/where come from the catalog; set \`at\` (counter) instead`);
          const list = counters.get(key(b.item));
          if (!list) err(file, `${at}: no Vandahl counter trades "${b.item}" in weapons-and-items.json`);
          else if (b.at && !list.includes(b.at)) {
            err(file, `${at}.at: "${b.at}" doesn't trade "${b.item}" (${list.join(", ")})`);
          }
        });
      } else scanGear(file, v, `${path}.${k}`);
    }
    if (typeof node.item === "string") {
      for (const f of ["from", "why", "fallback", "plan", "note"]) {
        checkClaims(file, `${path}.${f}`, node.item, node[f]);
      }
    }
  };
  const walkDir = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walkDir(join(dir, e.name)) : e.name.endsWith(".json") ? [join(dir, e.name)] : []
    );
  for (const sub of ["characters", "routes", "walkthrough"]) {
    for (const f of walkDir(join(DATA, sub))) scanGear(rel(f), JSON.parse(readFileSync(f, "utf8")), "");
  }
}

/* ------------------------------------------------------------ print */

let folded = 0; // over-long unit fields summarised into one line per file; each still counts as a warning
for (const [f, m] of unitLen) {
  const parts = [...m].map(([field, o]) => `${o.n}× ${field} (limit ${o.limit}, longest ${o.worst})`);
  warnings.set(f, [
    ...(warnings.get(f) ?? []),
    `text over limit (P3 shortens; --verbose lists each): ${parts.join("; ")}`,
  ]);
  folded += [...m.values()].reduce((s, o) => s + o.n, 0) - 1;
}

const count = (m) => [...m.values()].reduce((s, l) => s + l.length, 0);
const dump = (title, m) => {
  if (!m.size) return;
  console.log(`\n${title} (${count(m) + (m === warnings ? folded : 0)})`);
  for (const [f, list] of [...m].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${f}`);
    for (const x of list) console.log(`    - ${x}`);
  }
};
const showNotes = flag("--notes");
console.log(
  `check-content: ${
    ROUTES.join(", ")
  } · ${chapterCount} chapter file(s) · ${unitsChecked.size} unit(s) · ${quests.length} quest(s)`,
);
dump("ERRORS", errors);
dump("WARNINGS", warnings);
if (showNotes) dump("NOTES (conf values, never fail)", notes);
else if (notes.size) console.log(`\nNOTES: ${count(notes)} conf value(s); list them with --notes`);
const nE = count(errors);
const nW = count(warnings) + folded;
console.log(`\n${nE} error(s), ${nW} warning(s)${strict ? " (--strict: warnings fail)" : ""}`);
process.exit(nE || (strict && nW) ? 1 : 0);
