import type { Token, Tokens } from "marked";
import type { RouteName } from "../types.ts";
import { plain, splitChunk, splitDoc } from "./sources.ts";

export type RavenLine = { line: string; answer: string };
export type RavenGuide = {
  rules: Token[];
  why: Token[];
  lords: Partial<Record<RouteName, RavenLine[]>>;
  others: Token[];
};

let raven: RavenGuide | undefined;

/** Pale Raven (Bird Time) answers from bird-time-guide.md. */
export function ravenGuide(): RavenGuide {
  if (raven) return raven;
  const doc = splitDoc("bird-time-guide.md");
  const find = (re: RegExp) => doc.sections.find((s) => re.test(s.title))?.tokens ?? [];
  const lords: RavenGuide["lords"] = {};
  for (const part of splitChunk(find(/^Answers/), 3).parts) {
    const table = part.tokens.find((t) => t.type === "table") as Tokens.Table | undefined;
    if (!table) continue;
    lords[part.title.trim() as RouteName] = table.rows.map((r) => ({
      line: plain(r[0].tokens).replace(/^"|"$/g, ""),
      answer: plain(r[1].tokens),
    }));
  }
  raven = { rules: find(/^How it works/), why: find(/^Why it matters/), lords, others: find(/^Other characters/) };
  return raven;
}
