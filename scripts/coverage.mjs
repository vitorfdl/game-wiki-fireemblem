// Coverage checker (redesign/06-agent-playbook.md §4 and §5): proves every source block and sentence of a
// route's Markdown walkthrough landed somewhere, and that the facts in moved sentences survived.
//
//   node scripts/coverage.mjs <route> [--facts] [--chapters 6,7]
//   node scripts/coverage.mjs <route> --init [--agent P2-chapters] [--force]
//   deno run -A scripts/coverage.mjs <route> ...
//
// Reports live in <repo>/redesign/reports/<route>-*.coverage.json (all files for the route are merged).
// --init writes <route>-chapters.coverage.json (or <route>-<agent suffix>) listing every block and sentence
// with status "todo"; agents fill in status, dest and reason. Exit code 1 when any check fails.
import process from "node:process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, readJson, REPO, REPORTS, ROUTE_NAMES, routeFromArg, routeSlug, SITE } from "./lib/content-data.mjs";

/* ------------------------------------------------------------ args */

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const WITH_VALUE = new Set(["--agent", "--chapters"]);
const positional = args.filter((a, i) => !a.startsWith("--") && !WITH_VALUE.has(args[i - 1]));
const route = routeFromArg(positional[0]);
if (!route) {
  console.error(`Usage: coverage.mjs <${ROUTE_NAMES.map(routeSlug).join("|")}> [--init] [--facts] [--chapters 6,7]`);
  process.exit(2);
}
const chapterFilter = opt("--chapters") ? new Set(opt("--chapters").split(",").map(Number)) : null;

/* ------------------------------------------------------------ source blocks (mirrors /home/claude/migmap.py) */

const SOURCES = {
  Cai: ["walkthrough-part1-cai.md"],
  Theodora: ["walkthrough-part1-theodora.md"],
  Leda: ["walkthrough-part1-leda.md"],
  // The part1 file keeps Dietrich's route plan and Ch 1 to 3; Ch 4 to 12 live in the two detailed files.
  Dietrich: ["walkthrough-part1-dietrich.md", "walkthrough-dietrich-ch4-9.md", "walkthrough-dietrich-ch10-12.md"],
};

const SLOTS = [
  ["S8 Battle", /^(story battle|event\b|exhibition|the hunt|prep before the fight|after the fight|story dungeon|who to deploy)/],
  ["S9 Exit (derived)", /before you move on/],
  ["S2 Missables", /missable|optional scene|choice|sealed letter|scenes|catching sweetie/],
  ["S6 Quests", /paralogue|my late sister|legacy of|sculptor/],
  ["S5 Recruits", /recruit|who joins|joins|extras|leftovers/],
  ["S3 Classes", /exam|class|licen|detour|side trip|leaving a|bench check|no change|training|everyone else|specialty|advanced/],
  ["S1 Routine", /support|gift|meal|weekly|routine|shrine|bird|theater|thermae|songs|drink recipes|stable|bench and stable/],
  ["S4 Gear", /gear|shop|weapons|upgrades|barter|blacksmith|killing edges|giant|manual/],
  ["S6 Quests", /quest|subquest|mentor|challenge|perform|supplies|due|kindness|board|request|letter|first-day|do first|to-dos|dated/],
  ["S7 Explore", /dungeon|explor|desert|trip|spare turns|around dagsion|farming|leveling|clear the board|heretics|cave|free time/],
  ["Header: unlocks", /new system|systems that open|teach secrets/],
  ["Header: renown", /renown plan/],
];
const slotFor = (label) => SLOTS.find(([, rx]) => rx.test(label.toLowerCase()))?.[0] ?? "REVIEW";

const BLOCK_RE =
  /^\*\*([^*]{2,120}?)\*\*\s*(\[[A-Z ,]+\])?\s*[:.]?\s*(\[[A-Z ,]+\])?\s*$/;
const BLOCK_RE2 = /^\*\*(Story battle[^*]*|Before you move on[^*]*|Event[^*]*)\*\*/;

/**
 * Splits a file into blocks the way migmap.py does: a `##` heading opens a section; inside a section, a
 * `###` heading or a bold-only label line opens a block. Lines before the first `##` belong to no block.
 * `start` is the heading line, `end` the last line before the next heading (1-based, inclusive).
 */
function blocksOf(file) {
  const lines = readFileSync(join(REPO, file), "utf8").split("\n");
  const blocks = [];
  let sec = null;
  let cur = null;
  const close = (end) => {
    if (cur) {
      cur.end = end;
      blocks.push(cur);
    }
    cur = null;
  };
  lines.forEach((line, idx) => {
    const i = idx + 1;
    const h2 = line.match(/^## (.*)/);
    if (h2) {
      close(i - 1);
      sec = h2[1].trim();
      const ch = sec.match(/^Chapter (\d+)/);
      cur = {
        sec,
        label: ch ? "(chapter lead: free-time line, support focus, intro)" : "(section lead)",
        start: i,
        kind: ch ? "ch" : "plan",
        ch: ch ? Number(ch[1]) : null,
      };
      return;
    }
    if (sec === null) return;
    const m = line.trim().match(BLOCK_RE) ?? line.match(/^###+ (.*)/);
    const m2 = line.trim().match(BLOCK_RE2);
    if (m || m2) {
      close(i - 1);
      const ch = sec.match(/^Chapter (\d+)/);
      cur = {
        sec,
        label: (m ?? m2)[1].trim().replace(/[:.]+$/, ""),
        start: i,
        kind: ch ? "ch" : "plan",
        ch: ch ? Number(ch[1]) : null,
        // A "**Story battle: …** text" line carries content after the label.
        tail: m2 && !m ? line.trim().slice(m2[0].length).trim() : "",
      };
    }
  });
  close(lines.length);
  const dead = file === "walkthrough-part1-dietrich.md";
  return blocks
    .filter((b) => !(dead && b.kind === "ch" && b.ch >= 4))
    .map((b) => ({ ...b, file, src: `${file}:${b.start}-${b.end}`, lines }));
}

/* ------------------------------------------------------------ sentences */

const norm = (s) => s.replace(/\s+/g, " ").trim();
const sha = (s) => createHash("sha1").update(s).digest("hex").slice(0, 10);
const ABBREV = /\b(?:vs|e\.g|i\.e|etc|approx|Lv|Ch|No|St|Mt|Wt|Mr|Mrs|Dr|cf)\.$/i;

/**
 * Items: a list item (with its continuation lines), a table row, or a paragraph. Each item is then split on
 * ". " boundaries (a period, whitespace, then a capital, digit, quote, bracket or bold marker).
 */
function sentencesOf(block) {
  const out = [];
  const body = [];
  if (block.tail) body.push({ n: block.start, text: block.tail });
  for (let n = block.start + 1; n <= block.end; n++) body.push({ n, text: block.lines[n - 1] });
  const items = [];
  let cur = null;
  const flush = () => {
    if (cur) items.push(cur);
    cur = null;
  };
  for (let k = 0; k < body.length; k++) {
    const { n, text } = body[k];
    const t = text.replace(/^\s*>\s?/, "");
    if (!t.trim() || /^\s*(-{3,}|\*{3,}|<\/?details>|<\/?summary>)\s*$/.test(t)) {
      flush();
      continue;
    }
    if (/^\s*\|/.test(t)) {
      flush();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(t)) continue; // separator row
      const next = body[k + 1]?.text ?? "";
      if (/^\s*\|[\s:|-]+\|\s*$/.test(next)) continue; // header row
      const cells = t.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter((c) => c && c !== "—");
      items.push({ parts: [{ n, text: cells.join(" | ") }] });
      continue;
    }
    const li = t.match(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (li) {
      flush();
      cur = { parts: [{ n, text: li[1] }] };
      continue;
    }
    if (!cur) cur = { parts: [] };
    cur.parts.push({ n, text: t.trim() });
  }
  flush();
  for (const it of items) {
    // Join the lines, remembering where each line starts so a sentence keeps its own line number.
    let joined = "";
    const starts = [];
    for (const p of it.parts) {
      if (joined) joined += " ";
      starts.push({ at: joined.length, n: p.n });
      joined += p.text.trim();
    }
    const lineAt = (pos) => starts.filter((s) => s.at <= pos).at(-1)?.n ?? it.parts[0].n;
    let from = 0;
    const re = /\.\s+(?=[A-Z0-9"'(\[*_])/g;
    const cuts = [];
    for (const m of joined.matchAll(re)) {
      if (ABBREV.test(joined.slice(Math.max(0, m.index - 8), m.index + 1))) continue;
      cuts.push(m.index + 1);
    }
    cuts.push(joined.length);
    for (const cut of cuts) {
      const raw = joined.slice(from, cut);
      const text = norm(raw);
      const at = from + (raw.length - raw.trimStart().length);
      from = cut;
      if (!/[A-Za-z0-9]/.test(text)) continue;
      out.push({ src: `${block.file}:${lineAt(at)}`, hash: sha(text), text });
    }
  }
  return out;
}

/* ------------------------------------------------------------ load */

const files = SOURCES[route];
for (const f of files) {
  if (!existsSync(join(REPO, f))) {
    console.error(`Missing source ${f}`);
    process.exit(2);
  }
}
let blocks = files.flatMap(blocksOf);
if (chapterFilter) blocks = blocks.filter((b) => b.kind === "ch" && chapterFilter.has(b.ch));
const srcSentences = blocks.map((b) => ({ block: b, sentences: sentencesOf(b) }));

/* ------------------------------------------------------------ --init */

if (flag("--init")) {
  mkdirSync(REPORTS, { recursive: true });
  const agent = opt("--agent") ?? "P2-chapters";
  const suffix = agent.replace(/^P\d+[a-z]?-/, "") || "chapters";
  const out = join(REPORTS, `${routeSlug(route)}-${suffix}.coverage.json`);
  if (existsSync(out) && !flag("--force")) {
    console.error(`${out} exists; pass --force to overwrite (you would lose the filled-in entries).`);
    process.exit(1);
  }
  const report = {
    route,
    agent,
    blocks: srcSentences.map(({ block: b }) => ({
      src: b.src,
      section: b.sec,
      label: b.label,
      proposed: b.kind === "ch" ? (b.label.startsWith("(") ? "S0 Header" : slotFor(b.label)) : "see 05-migration-map.md",
      dest: [],
      status: "todo",
      decisions: [],
    })),
    sentences: srcSentences.flatMap(({ sentences }) =>
      sentences.map((s) => ({ src: s.src, hash: s.hash, text: s.text, dest: "", status: "todo" }))
    ),
    checkboxIds: {},
    factFixes: [],
    needsUnitJson: [],
    openQuestions: [],
  };
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(`Wrote ${out}: ${report.blocks.length} blocks, ${report.sentences.length} sentences (status "todo").`);
  process.exit(0);
}

/* ------------------------------------------------------------ check */

const reportFiles = existsSync(REPORTS)
  ? readdirSync(REPORTS).filter((f) => f.startsWith(`${routeSlug(route)}-`) && f.endsWith(".coverage.json")).sort()
  : [];
if (!reportFiles.length) {
  console.error(`No reports in ${REPORTS} for ${route}. Start one with: coverage.mjs ${routeSlug(route)} --init`);
  process.exit(1);
}
const reports = reportFiles.map((f) => ({ f, r: readJson(join(REPORTS, f)) }));
const repBlocks = reports.flatMap(({ f, r }) => (r.blocks ?? []).map((b) => ({ ...b, _f: f })));
const repSentences = reports.flatMap(({ f, r }) => (r.sentences ?? []).map((s) => ({ ...s, _f: f })));
const fileOf = (src) => String(src ?? "").split(":")[0];

const STATUSES = ["moved", "derived", "merged", "dropped"];
const failures = [];
const warnings = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// Block coverage: matched by exact src, or by file and start line (the end can drift when a block is split).
let blocksOk = 0;
for (const { block: b } of srcSentences) {
  const hit = repBlocks.find((x) => x.src === b.src) ??
    repBlocks.find((x) => fileOf(x.src) === b.file && Number(String(x.src).split(":")[1]?.split("-")[0]) === b.start);
  if (!hit) {
    fail(b.src, `block "${b.label}" has no report entry`);
    continue;
  }
  if (!STATUSES.includes(hit.status) || /REVIEW/.test(JSON.stringify(hit))) {
    fail(b.src, `block "${b.label}" is "${hit.status}"${/REVIEW/.test(JSON.stringify(hit)) ? " (REVIEW left)" : ""}`);
    continue;
  }
  if (hit.status === "dropped" && !hit.reason) {
    fail(b.src, `block "${b.label}" dropped without a reason`);
    continue;
  }
  if (hit.status !== "dropped" && !(Array.isArray(hit.dest) ? hit.dest.length : hit.dest)) {
    fail(b.src, `block "${b.label}" has no dest`);
    continue;
  }
  blocksOk++;
}

// Sentence coverage: matched by hash within the same source file (line numbers may shift).
// The same sentence can occur in several chapters: prefer the entry for this exact line, then any filled one.
const byHash = new Map();
for (const s of repSentences) {
  const k = `${fileOf(s.src)}#${s.hash}`;
  if (!byHash.has(k)) byHash.set(k, []);
  byHash.get(k).push(s);
}
const entryFor = (s) => {
  const list = byHash.get(`${fileOf(s.src)}#${s.hash}`) ?? [];
  return list.find((x) => x.src === s.src && x.status !== "todo") ?? list.find((x) => STATUSES.includes(x.status)) ??
    list[0];
};
const DATE = /\b\d{1,2}\/\d{1,2}\b/g;
const GATE = /\b(?:Support \d|Renown \d+|S\d\s*R\d+|R\d+\b)/;
const CONDITION = /\b(only if|unless|as long as)\b/i;

/** Resolves a dest like "walkthrough/cai/ch06.json#recruits" to a readable file, or null. */
function destFile(dest) {
  const p = String(dest).split("#")[0].trim();
  if (!p) return null;
  for (const base of [DATA, SITE, REPO, join(REPO, "redesign")]) {
    const f = join(base, p);
    if (existsSync(f)) return f;
  }
  return null;
}
const fileCache = new Map();
const readDest = (f) => {
  if (!fileCache.has(f)) fileCache.set(f, readFileSync(f, "utf8"));
  return fileCache.get(f);
};

/** Facts from a sentence (06 §5), each with the patterns that count as "present" in a JSON destination. */
function factsIn(text) {
  const out = [];
  for (const m of text.matchAll(DATE)) out.push({ fact: m[0], any: [m[0]] });
  for (const m of text.matchAll(/\b([\d,]+)G\b/g)) {
    const n = m[1].replace(/,/g, "");
    if (n) out.push({ fact: m[0], any: [m[0], `${Number(n).toLocaleString("en-US")}G`, `"gold": ${n}`, `${n}G`] });
  }
  for (const m of text.matchAll(/\bSupport (\d)\b/g)) out.push({ fact: m[0], any: [m[0], `"support": ${m[1]}`, `S${m[1]}`] });
  for (const m of text.matchAll(/\bRenown (\d+)\b/g)) out.push({ fact: m[0], any: [m[0], `"renown": ${m[1]}`, `R${m[1]}`] });
  for (const m of text.matchAll(/\bLv (\d+)\b/g)) out.push({ fact: m[0], any: [m[0], `"lv": ${m[1]}`, `Lv ${m[1]}`] });
  for (const m of text.matchAll(/\b([A-E])\+? rank\b/g)) out.push({ fact: m[0], re: new RegExp(`\\b${m[1]}\\+? rank\\b|\\b[A-Z][a-z]+(?: Magic)? ${m[1]}\\b`) });
  return out;
}
const lower = (s) => s.toLowerCase();

let sentOk = 0;
let total = 0;
let factChecked = 0;
const factMisses = [];
for (const { block: b, sentences } of srcSentences) {
  let dropped = 0;
  for (const s of sentences) {
    total++;
    const hit = entryFor(s);
    if (!hit) {
      fail(s.src, `no entry for "${s.text.slice(0, 70)}" (${s.hash})`);
      continue;
    }
    if (!STATUSES.includes(hit.status)) {
      fail(s.src, `"${hit.status}": "${s.text.slice(0, 70)}"`);
      continue;
    }
    if (hit.status === "dropped") {
      dropped++;
      if (!hit.reason) fail(s.src, `dropped without a reason: "${s.text.slice(0, 70)}"`);
      if (s.text.match(DATE) || GATE.test(s.text)) fail(s.src, `dropped but holds a date or gate (move or derive it): "${s.text.slice(0, 70)}"`);
    } else if (!hit.dest || (Array.isArray(hit.dest) && !hit.dest.length)) {
      fail(s.src, `${hit.status} without a dest: "${s.text.slice(0, 70)}"`);
      continue;
    }
    if (hit.status === "derived" && CONDITION.test(s.text) && !/exit|why|gates/.test(JSON.stringify(hit.dest))) {
      fail(s.src, `derived with a condition: dest must name the stage exit, stage why or gates[] entry`);
    }
    if (flag("--facts") && (hit.status === "moved" || hit.status === "derived")) {
      const dests = Array.isArray(hit.dest) ? hit.dest : [hit.dest];
      const texts = dests.map(destFile).filter(Boolean).map(readDest);
      if (!texts.length) {
        warnings.push(`${s.src}: can't open dest ${JSON.stringify(hit.dest)} for the fact check`);
      } else {
        const hay = lower(texts.join("\n"));
        for (const f of factsIn(s.text)) {
          factChecked++;
          const ok = f.re ? f.re.test(texts.join("\n")) : f.any.some((a) => hay.includes(lower(a)));
          if (!ok) factMisses.push(`${s.src}: "${f.fact}" not found in ${dests.join(", ")}`);
        }
      }
    }
    sentOk++;
  }
  if (sentences.length && dropped / sentences.length > 0.15) {
    fail(b.src, `${dropped} of ${sentences.length} sentences dropped (${Math.round((dropped / sentences.length) * 100)}% > 15%)`);
  }
}
for (const m of factMisses) failures.push(m);

// Report entries that point at nothing (stale hashes after a source edit).
const live = new Set(srcSentences.flatMap(({ sentences }) => sentences.map((s) => `${fileOf(s.src)}#${s.hash}`)));
const stale = repSentences.filter((s) => files.includes(fileOf(s.src)) && !live.has(`${fileOf(s.src)}#${s.hash}`));
if (stale.length && !chapterFilter) warnings.push(`${stale.length} report sentence(s) match no source sentence (source edited?)`);

/* ------------------------------------------------------------ print */

const cap = (list, n = 60) => list.length > n ? [...list.slice(0, n), `… and ${list.length - n} more`] : list;
console.log(`coverage ${route}${chapterFilter ? ` (chapters ${[...chapterFilter].join(", ")})` : ""} · reports: ${reportFiles.join(", ")}`);
console.log(`  blocks covered    ${blocksOk}/${srcSentences.length}`);
console.log(`  sentences covered ${sentOk}/${total}`);
if (flag("--facts")) console.log(`  facts checked     ${factChecked - factMisses.length}/${factChecked} found in their dest`);
if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length})`);
  for (const w of cap(warnings)) console.log(`  - ${w}`);
}
if (failures.length) {
  console.log(`\nFAILURES (${failures.length})`);
  for (const f of cap(failures, flag("--all") ? Infinity : 60)) console.log(`  - ${f}`);
}
console.log(`\n${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
