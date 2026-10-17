import type { Token, Tokens } from "marked";
import type { RouteName } from "../types.ts";
import { type Chunk, hash, lexInline, plain, splitDoc } from "./sources.ts";

export type SectionKind = "plan" | "chapter" | "supports" | "exit" | "later" | "notes";
export type GroupKind =
  | "battle"
  | "moveon"
  | "recruit"
  | "class"
  | "paralogue"
  | "quest"
  | "shop"
  | "explore"
  | "support"
  | "checklist"
  | "plan";

/** `fold`: the label ended in [FOLD], so the group renders collapsed. */
export type Group = { id: string; title?: string; kind: GroupKind; tokens: Token[]; fold?: boolean };

export type FreeTime = { from: string; to: string; days: number };

export type Section = {
  id: string;
  kind: SectionKind;
  title: string;
  /** Chapter number for chapter sections. */
  chapter?: number;
  /** Chapter name without the "Chapter N:" prefix. */
  name?: string;
  free?: FreeTime;
  noFree?: boolean;
  /** Short note that sat next to the free-time dates ("Long. Good time for Renown"). */
  note?: string;
  groups: Group[];
  /** Ids of every checkbox in the section, nested ones included. */
  tasks: string[];
  /** Checkbox ids whose item is tagged [MISSABLE] (the chapter rail's red dot). */
  missables: string[];
};

export type Walkthrough = {
  route: RouteName;
  title: string;
  /** Text before the first chapter heading: assumptions and conventions. */
  about: Section | null;
  sections: Section[];
  supports?: Section;
};

type Pick = { file: string; match: RegExp };

/**
 * Dietrich's walkthrough lives in three files: the full Part I overview plus two detailed chapter ranges.
 * The detailed files win for Chapters 4 to 12.
 */
const DIETRICH: Pick[] = [
  { file: "walkthrough-part1-dietrich.md", match: /^The army at a glance/ },
  { file: "walkthrough-dietrich-ch4-9.md", match: /^Our route decisions/ },
  { file: "walkthrough-dietrich-ch4-9.md", match: /^Every week/ },
  { file: "walkthrough-dietrich-ch10-12.md", match: /^The three goals/ },
  { file: "walkthrough-dietrich-ch10-12.md", match: /^Every week/ },
  { file: "walkthrough-dietrich-ch10-12.md", match: /^Class changes now/ },
  { file: "walkthrough-dietrich-ch4-9.md", match: /^Deadline calendar/ },
  { file: "walkthrough-dietrich-ch10-12.md", match: /^Deadline calendar/ },
  { file: "walkthrough-dietrich-ch4-9.md", match: /^Supports/ },
  { file: "walkthrough-part1-dietrich.md", match: /^Chapter [123]:/ },
  { file: "walkthrough-dietrich-ch4-9.md", match: /^Chapter \d+:/ },
  { file: "walkthrough-dietrich-ch10-12.md", match: /^Chapter \d+:/ },
  { file: "walkthrough-part1-dietrich.md", match: /^Part I exit checklist/ },
  { file: "walkthrough-dietrich-ch10-12.md", match: /^\[PART II\]/ },
  { file: "walkthrough-dietrich-ch4-9.md", match: /^Next: Chapters 10 to 12/ },
  { file: "walkthrough-part1-dietrich.md", match: /^Open questions/ },
  { file: "walkthrough-dietrich-ch4-9.md", match: /^What the sources/ },
  { file: "walkthrough-dietrich-ch10-12.md", match: /^Open questions/ },
];

const SINGLE: Record<Exclude<RouteName, "Dietrich">, string> = {
  Cai: "walkthrough-part1-cai.md",
  Theodora: "walkthrough-part1-theodora.md",
  Leda: "walkthrough-part1-leda.md",
};

function chunksFor(route: RouteName): { title: string; intro: Token[]; chunks: Chunk[] } {
  if (route !== "Dietrich") {
    const doc = splitDoc(SINGLE[route]);
    return { title: doc.title, intro: doc.intro, chunks: doc.sections };
  }
  const docs = new Map<string, ReturnType<typeof splitDoc>>();
  const doc = (f: string) => {
    if (!docs.has(f)) docs.set(f, splitDoc(f));
    return docs.get(f)!;
  };
  const chunks = DIETRICH.flatMap((p) => doc(p.file).sections.filter((s) => p.match.test(s.title)));
  const main = doc("walkthrough-part1-dietrich.md");
  return { title: main.title, intro: main.intro, chunks };
}

function classify(title: string): SectionKind {
  if (/^Chapter \d+/.test(title)) return "chapter";
  if (/^Supports/i.test(title)) return "supports";
  if (/exit checklist|^\[PART II\]/i.test(title)) return "exit";
  if (/Part II changes|^Next:/i.test(title)) return "later";
  if (/conflicts|unknowns|open questions|sources don't/i.test(title)) return "notes";
  return "plan";
}

const KINDS: [GroupKind, RegExp][] = [
  ["battle", /^(story battle|event\b|exhibition|the hunt)/i],
  ["moveon", /before you move on|^missable|^(everything )?due\b/i],
  ["recruit", /recruit/i],
  ["paralogue", /paralogue/i],
  ["class", /class|exam|training|build|license/i],
  ["support", /support|gift|meal|bird/i],
  ["quest", /quest|subquest|mentor|challenge|perform|supplies|letter|choice|request/i],
  ["shop", /shop|gear|farm|stable|blacksmith|thermae|barter|buy/i],
  ["explore", /dungeon|explor|desert/i],
  ["checklist", /checklist|do first|other|free time|to-do|clear the board|plan/i],
];

export function groupKind(title: string | undefined): GroupKind {
  if (!title) return "plan";
  return KINDS.find(([, re]) => re.test(title))?.[0] ?? "plan";
}

const strip = (s: string) => s.replace(/[:.]\s*$/, "").trim();

/** A paragraph that is only a bold phrase works as a sub-heading in these files. */
function labelOf(t: Token): string | null {
  if (t.type !== "paragraph") return null;
  const p = t as Tokens.Paragraph;
  const [first, ...rest] = p.tokens;
  if (first?.type !== "strong") return null;
  if (rest.length === 0) return strip((first as Tokens.Strong).text);
  if (rest.length === 1 && rest[0].type === "text" && /^[:.]?\s*(\[FOLD\])?\s*$/.test((rest[0] as Tokens.Text).text)) {
    if (/\[FOLD\]/.test((rest[0] as Tokens.Text).text)) return strip((first as Tokens.Strong).text) + " [FOLD]";
    return strip((first as Tokens.Strong).text);
  }
  return null;
}

/** "**Subquests** (semi-random, all due 11/27):" right before a list is a label with a note. */
function leadLabel(t: Token, next: Token | undefined): string | null {
  if (t.type !== "paragraph" || !next || (next.type !== "list" && next.type !== "table")) return null;
  const p = t as Tokens.Paragraph;
  if (p.tokens[0]?.type !== "strong") return null;
  const text = plain(p.tokens).trim();
  if (text.length > 140 || /^(story battle|before you move on)/i.test(text)) return null;
  return strip(text);
}

/** "**Story battle: X.** Defeat Y." -> a title plus the rest as the group's first paragraph. */
function leadingLabel(t: Token, re: RegExp): { title: string; rest: Token } | null {
  if (t.type !== "paragraph") return null;
  const p = t as Tokens.Paragraph;
  const [first, ...rest] = p.tokens;
  if (first?.type !== "strong" || !re.test((first as Tokens.Strong).text) || !rest.length) return null;
  const tail = [...rest];
  if (tail[0].type === "text") {
    const cut = (tail[0] as Tokens.Text).text.replace(/^[\s:.]+/, "");
    const txt = cut ? cut[0].toUpperCase() + cut.slice(1) : "";
    if (txt) tail[0] = { ...tail[0], text: txt, raw: txt } as Token;
    else tail.shift();
  }
  const raw = tail.map((x) => x.raw).join("");
  const body = { type: "paragraph", raw, text: raw, tokens: tail } as Tokens.Paragraph;
  return { title: strip((first as Tokens.Strong).text), rest: body };
}

function groupTokens(tokens: Token[], sectionId: string): Group[] {
  const groups: Group[] = [];
  let current: Group = { id: `${sectionId}-lead`, kind: "plan", tokens: [] };
  const open = (raw: string, kind?: GroupKind) => {
    if (current.tokens.length || current.title) groups.push(current);
    const fold = /\s*\[FOLD\]\s*/.test(raw);
    const title = strip(raw.replace(/\s*\[FOLD\]\s*/, " ").trim());
    current = { id: `${sectionId}-${groups.length + 1}`, title, kind: kind ?? groupKind(title), tokens: [], fold };
  };
  tokens.forEach((t, i) => {
    handle(t, tokens[i + 1]);
  });
  function handle(t: Token, next: Token | undefined) {
    if (t.type === "heading" && (t as Tokens.Heading).depth >= 3) {
      open(strip((t as Tokens.Heading).text));
      return;
    }
    const label = labelOf(t) ?? leadLabel(t, next);
    if (label) {
      open(label);
      return;
    }
    const battle = leadingLabel(t, /^(story battle|event)\b/i);
    if (battle) {
      open(/^story battle$/i.test(battle.title) ? "Story battle" : battle.title, "battle");
      current.tokens.push(battle.rest);
      return;
    }
    const moveOn = leadingLabel(t, /^before you move on/i);
    if (moveOn) {
      open("Before you move on", "moveon");
      current.tokens.push(moveOn.rest);
      return;
    }
    current.tokens.push(t);
  }
  if (current.tokens.length || current.title) groups.push(current);
  return groups;
}

const DATE = String.raw`(\d{1,2}\/\d{1,2})`;
const FREE = new RegExp(String.raw`free time(?:\s*\d+)?\s*:?\s*${DATE}\s*(?:to|-|–)\s*${DATE}`, "i");
const MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dayOfYear = (d: string) => {
  const [m, day] = d.split("/").map(Number);
  return MONTH.slice(0, m - 1).reduce((a, b) => a + b, 0) + day;
};

function freeTime(text: string): FreeTime | undefined {
  const m = text.match(FREE);
  if (!m) return undefined;
  let days = dayOfYear(m[2]) - dayOfYear(m[1]) + 1;
  if (days <= 0) days += 365;
  return { from: m[1], to: m[2], days };
}

/** Collects checkbox ids and stamps them on the list items so the renderer can find them. */
function stampTasks(tokens: Token[], prefix: string, out: string[], miss: string[] = []) {
  for (const t of tokens) {
    if (t.type === "list") {
      for (const item of (t as Tokens.List).items) {
        if (item.task) {
          let id = `${prefix}:${hash(item.text.split("\n")[0].trim())}`;
          while (out.includes(id)) id += "+";
          (item as Tokens.ListItem & { fwId?: string }).fwId = id;
          out.push(id);
          if (/\[MISSABLE\]/.test(item.text)) miss.push(id);
        }
        stampTasks(item.tokens, prefix, out, miss);
      }
    } else if (t.type === "blockquote") stampTasks((t as Tokens.Blockquote).tokens, prefix, out, miss);
  }
}

/** Checkbox ids stamped inside some tokens. */
function taskIds(tokens: Token[], out: string[] = []): string[] {
  for (const t of tokens) {
    if (t.type === "list") {
      for (const item of (t as Tokens.List).items) {
        const id = (item as Tokens.ListItem & { fwId?: string }).fwId;
        if (id) out.push(id);
        taskIds(item.tokens, out);
      }
    } else if (t.type === "blockquote") taskIds((t as Tokens.Blockquote).tokens, out);
  }
  return out;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function buildSection(route: RouteName, chunk: Chunk, used: Set<string>): Section {
  const kind = classify(chunk.title);
  const sec: Section = { id: "", kind, title: chunk.title, groups: [], tasks: [], missables: [] };
  let tokens = chunk.tokens;
  if (kind === "chapter") {
    const m = chunk.title.match(/^Chapter (\d+):\s*(.*)$/)!;
    sec.chapter = Number(m[1]);
    const paren = m[2].match(/\s*\(([^)]*)\)\s*$/);
    sec.name = paren ? m[2].slice(0, paren.index).trim() : m[2].trim();
    const headNote = paren?.[1] ?? "";
    sec.free = freeTime(headNote);
    if (/no free time/i.test(headNote)) sec.noFree = true;
    const first = tokens[0];
    if (first?.type === "paragraph") {
      const text = plain((first as Tokens.Paragraph).tokens);
      const ft = freeTime(text);
      if (ft || /^no free time/i.test(text) || /^limited exploration/i.test(text)) {
        sec.free ??= ft;
        if (/^no free time/i.test(text)) sec.noFree = true;
        const note = text
          .replace(/^\s*no free time\.?/i, "")
          .replace(FREE, "")
          .replace(/^[\s.:;,]+/, "")
          .replace(/^\((.*)\)\.?$/, "$1")
          .trim();
        if (note) sec.note = note[0].toUpperCase() + note.slice(1);
        tokens = tokens.slice(1);
      }
    }
  }
  let id = kind === "chapter" ? `ch-${sec.chapter}` : slug(chunk.title);
  while (used.has(id)) id += "-2";
  used.add(id);
  sec.id = id;
  stampTasks(tokens, `${route}:${id}`, sec.tasks, sec.missables);
  sec.groups = groupTokens(tokens, id);
  for (const g of sec.groups) {
    if (g.kind !== "moveon") continue;
    for (const t of taskIds(g.tokens)) if (!sec.missables.includes(t)) sec.missables.push(t);
  }
  return sec;
}

const cache = new Map<RouteName, Walkthrough>();

export function walkthrough(route: RouteName): Walkthrough {
  const hit = cache.get(route);
  if (hit) return hit;
  const { title, intro, chunks } = chunksFor(route);
  const used = new Set<string>();
  const sections = chunks.map((c) => buildSection(route, c, used));
  const about: Section | null = intro.length
    ? { id: "about", kind: "plan", title: "About this plan", groups: groupTokens(intro, "about"), tasks: [], missables: [] }
    : null;
  const wt: Walkthrough = {
    route,
    title,
    about,
    sections: sections.filter((s) => s.kind !== "supports"),
    supports: sections.find((s) => s.kind === "supports"),
  };
  cache.set(route, wt);
  return wt;
}

export type SupportPart = "rules" | "gifts" | "meals";

export function supportPart(title: string | undefined): SupportPart {
  if (!title) return "rules";
  if (/how it works|routine/i.test(title)) return "rules";
  if (/meal|dish|^chapter|week|menu|perfect/i.test(title)) return "meals";
  return "gifts";
}

export { lexInline, plain };
