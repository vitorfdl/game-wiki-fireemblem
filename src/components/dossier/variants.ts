import { fillerEntry, rosterEntry } from "../../lib/data.ts";
import { primaryClass, stripParens } from "../../lib/growth.ts";
import type { Character, Copy, Filler, Guide, Pt, RecruitOn, RouteName, Stage } from "../../lib/types.ts";
import { ROUTE_NAMES } from "../../lib/types.ts";

/** One build of a unit: the home build, or the extra copy recruited on another route (02-templates §5). */
export type Variant = {
  route: RouteName;
  home: boolean;
  guide?: Guide;
  copy?: Copy;
  /** Join chapter on this route (roster entry for the home build, the copy's chapter for an extra). */
  join?: number;
  joinEstimate: boolean;
  part1?: string;
  part3?: string;
};

/** Every route where the unit has a build: home first, then the copies in route order. */
export function variantsOf(c: Character): Variant[] {
  const out: Variant[] = [];
  if (c.homeRoute && (c.guide || c.build)) {
    const entry = rosterEntry(c.name, c.homeRoute);
    out.push({
      route: c.homeRoute,
      home: true,
      guide: c.guide,
      join: c.isLord ? 1 : entry?.chapter,
      joinEstimate: Boolean(entry?.estimate),
      part1: c.build?.part1Target ?? lastClass(c.guide?.stages, 1),
      part3: c.build?.part3Target ?? lastClass(c.guide?.stages, 3),
    });
  }
  // Part III joiners (Orchel, Eshmel...) have no home army: one guide, shown on every route that lists them in recruitOn.
  if (!c.homeRoute && c.guide?.stages?.length) {
    for (const r of ROUTE_NAMES) {
      if (!c.recruitOn?.[r] || c.copies?.some((x) => x.route === r)) continue;
      out.push({
        route: r,
        home: true,
        guide: c.guide,
        joinEstimate: false,
        part3: c.build?.part3Target ?? lastClass(c.guide.stages, 3),
      });
    }
  }
  const copies = [...(c.copies ?? [])].sort((a, b) => ROUTE_NAMES.indexOf(a.route) - ROUTE_NAMES.indexOf(b.route));
  for (const cp of copies) {
    out.push({
      route: cp.route,
      home: false,
      guide: cp.guide,
      copy: cp,
      join: cp.chapter,
      joinEstimate: true,
      part1: cp.part1 ?? lastClass(cp.guide?.stages, 1),
      part3: lastClass(cp.guide?.stages, 3),
    });
  }
  return out;
}

/** Class names of a part's stages, the last one (Part I) or all distinct ones joined (Part III: "Druid → The Avatar"). */
function lastClass(stages: Stage[] | undefined, part: 1 | 3): string | undefined {
  const own = (stages ?? []).filter((s) => partOf(s) === part).map((s) => primaryClass(s.class) || s.class || "");
  const names = [...new Set(own.filter(Boolean))];
  if (!names.length) return undefined;
  return part === 1 ? names.at(-1) : names.join(" → ");
}

export function partOf(s: Stage): 1 | 2 | 3 {
  if (s.from) return s.from.part;
  if (/^Part III/i.test(s.when)) return 3;
  if (/^Part II/i.test(s.when)) return 2;
  return 1;
}

export type Placement =
  | { kind: "build"; variant: Variant }
  | { kind: "filler"; filler: Filler }
  | { kind: "none" };

/** What the unit is on one route: a build, a filler recruited for an item or supports, or nothing. */
export function placementOn(c: Character, route: RouteName): Placement {
  const v = variantsOf(c).find((x) => x.route === route);
  if (v) return { kind: "build", variant: v };
  const f = fillerEntry(c.name, route);
  if (f) return { kind: "filler", filler: f };
  return { kind: "none" };
}

/* ------------------------------------------------------------ labels */

const ROMAN = ["", "I", "II", "III"];

function ptLabel(p: Pt, withPart: boolean): string {
  if (p.part === 1) {
    const at = p.at ? `${p.at} ` : "";
    return `${p.approx ? "~" : ""}${at}Ch ${p.ch ?? "?"}`;
  }
  const head = withPart ? `Part ${ROMAN[p.part]}` : "";
  if (p.ch === undefined) return head || `Part ${ROMAN[p.part]}`;
  const unit = p.part === 3 ? "Sec" : "Ch";
  return [head, `${unit} ${p.ch}${p.part === 3 ? "+" : ""}`].filter(Boolean).join(" ");
}

/** "Ch 3–5", "late Ch 10–12", "Part II Ch 1–2", "Ch 7 → Lv 20", "Part III Sec 4+". Falls back to `when`. */
export function rangeLabel(s: Stage): string {
  const f = s.from;
  if (!f) return stripParens(s.when) || s.when;
  const t = s.to;
  if (!t) return ptLabel(f, true);
  if (!("part" in t)) return `${ptLabel(f, true)} → Lv ${t.lv}`;
  if (t.part === f.part && t.ch !== undefined && t.ch !== f.ch) {
    return `${ptLabel(f, true)}–${t.ch}`;
  }
  if (t.part === f.part) return ptLabel(f, true);
  return `${ptLabel(f, true)} → ${ptLabel(t, true)}`;
}

/**
 * Compact level span: "Lv 1 to 20" -> "Lv 1–20", "Lv 20 to about 34" -> "~Lv 20–34", "About Lv 25 on join" -> "~Lv 25".
 * Parenthesized asides and anything after ";" stay in the full text (title).
 */
export function levelLabel(s: Stage): string {
  const t = stripParens(s.level).split(";")[0].trim();
  if (!t) return "";
  const to = t.match(/\bto\s+(about\s+)?(?:Lv\s*)?(\d+)/i);
  const end = to?.[2] ?? "";
  if (/^base level/i.test(t)) return end ? `Base–Lv ${end}` : "Base level";
  const from = t.match(/^(about\s+)?Lv\s*(\d+)/i);
  if (!from) return t;
  const approx = from[1] || to?.[1] ? "~" : "";
  return `${approx}Lv ${from[2]}${end && end !== from[2] ? `–${end}` : ""}`;
}

/** Chips for a route's recruit gate: how, support, renown, gold, item, task, window. */
export function gateChips(g: RecruitOn | undefined): string[] {
  if (!g) return [];
  const out: string[] = [];
  if (g.how === "auto") out.push("Joins automatically");
  if (g.how === "lord") out.push("Lord");
  if (g.how === "paralogue") out.push("Paralogue");
  if (g.how === "story") out.push("Story join");
  if (g.support !== undefined && g.support > 1) out.push(`Support ${g.support}`);
  if (g.renown !== undefined) out.push(`Renown ${g.renown}`);
  if (g.gold !== undefined) out.push(`${g.gold.toLocaleString("en-US")}G`);
  if (g.item) out.push(g.item);
  if (g.task) out.push(g.task);
  if (g.window) out.push(g.window);
  return out;
}

/** First sentence of a text, and the rest. Keeps "Lv. 3" and "x1.5" inside the sentence. */
export function firstSentence(text: string): [string, string] {
  const m = text.match(/^(.+?[.!?])\s+(?=[A-Z(])/);
  if (!m) return [text, ""];
  return [m[1], text.slice(m[0].length)];
}
