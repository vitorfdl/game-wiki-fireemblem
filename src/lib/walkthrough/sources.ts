import { Lexer, type Token } from "marked";

/** The walkthroughs and reference guides are the Markdown files at the library root (copied to research/), bundled as raw text. */
const FILES = import.meta.glob<string>(
  ["../../../research/walkthrough-*.md", "../../../research/bird-time-guide.md"],
  { query: "?raw", import: "default", eager: true },
);

export function markdown(name: string): string {
  return FILES[`../../../research/${name}`] ?? "";
}

export type Chunk = { title: string; tokens: Token[] };
export type MdDoc = { title: string; intro: Token[]; sections: Chunk[] };

/** Splits a Markdown file on its level-2 headings. Horizontal rules are dropped. */
export function splitDoc(name: string): MdDoc {
  const tokens = new Lexer({ gfm: true }).lex(markdown(name));
  const doc: MdDoc = { title: "", intro: [], sections: [] };
  let current: Chunk | null = null;
  for (const t of tokens) {
    if (t.type === "hr" || t.type === "space") continue;
    if (t.type === "heading" && t.depth === 1) {
      doc.title = t.text;
      continue;
    }
    if (t.type === "heading" && t.depth === 2) {
      current = { title: t.text, tokens: [] };
      doc.sections.push(current);
      continue;
    }
    (current ? current.tokens : doc.intro).push(t);
  }
  return doc;
}

/** Splits a chunk again on a deeper heading level (used for the reference guides). */
export function splitChunk(tokens: Token[], depth: number): { lead: Token[]; parts: Chunk[] } {
  const lead: Token[] = [];
  const parts: Chunk[] = [];
  let current: Chunk | null = null;
  for (const t of tokens) {
    if (t.type === "heading" && t.depth === depth) {
      current = { title: t.text, tokens: [] };
      parts.push(current);
      continue;
    }
    (current ? current.tokens : lead).push(t);
  }
  return { lead, parts };
}

export const lexInline = (src: string): Token[] => Lexer.lexInline(src, { gfm: true });

/** Plain text of inline or block tokens, for search, ids and length checks. */
export function plain(tokens: Token[] | undefined): string {
  if (!tokens) return "";
  return tokens.map((t) => {
    const anyT = t as Token & { tokens?: Token[]; text?: string; items?: { tokens: Token[] }[] };
    if (anyT.type === "list") return (anyT.items ?? []).map((i) => plain(i.tokens)).join(" ");
    if (anyT.tokens) return plain(anyT.tokens);
    if (anyT.type === "checkbox") return "";
    return anyT.text ?? "";
  }).join("");
}

export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
