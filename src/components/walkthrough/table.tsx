import { createContext, useContext } from "react";
import type { Token, Tokens } from "marked";
import { Ban, Heart } from "lucide-react";
import { CHARACTERS, META } from "../../lib/data.ts";
import { cx } from "../../lib/cx.ts";
import { plain } from "../../lib/walkthrough/sources.ts";
import { Medal } from "../ui/medal.tsx";
import { useWalk } from "./ctx.ts";
import { CharacterChip, Inline, type Seen, Tag } from "./inline.tsx";

const REACT = new Set(["L", "l", ".", "X", "Love", "like", "NO", "", "—", "-"]);
type Reaction = "love" | "like" | "none" | "no";
const reaction = (s: string): Reaction =>
  s === "L" || s === "Love" ? "love" : s === "l" || s === "like" ? "like" : s === "X" || s === "NO" ? "no" : "none";

/** Column heads in the dish tables are names or three-letter stubs ("Die", "Yang"). */
function headName(s: string): string | undefined {
  const t = s.trim();
  if (CHARACTERS[t]) return t;
  return Object.keys(CHARACTERS).find((n) => n.startsWith(t) && t.length >= 2);
}

export function ReactionIcon({ r }: { r: Reaction }) {
  if (r === "love") {
    return (
      <span className="inline-flex text-[#c2415f]" title="Loves">
        <Heart className="size-3.5 fill-current" />
        <Heart className="-ml-1.5 size-3.5 fill-current" />
      </span>
    );
  }
  if (r === "like") return <Heart className="size-3.5 text-[#c2415f]" aria-label="Likes" />;
  if (r === "no") return <Ban className="size-3.5 text-blood" aria-label="Dislikes" />;
  return <span className="text-faint" aria-label="Neutral">·</span>;
}

function Heatmap({ table }: { table: Tokens.Table }) {
  const heads = table.header.slice(1).map((h) => plain(h.tokens));
  return (
    <div className="my-3 overflow-x-auto rounded-md border border-gold/60">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] bg-card px-2 py-1.5 text-left font-semibold">
              {plain(table.header[0].tokens)}
            </th>
            {heads.map((h, i) => {
              const n = headName(h);
              return (
                <th key={i} className="bg-card px-1 py-1.5 text-center font-semibold" title={n ?? h}>
                  {n ? <Medal name={n} route={CHARACTERS[n]?.homeRoute} size={26} ring="var(--color-card)" /> : h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="odd:bg-paper/50">
              <th className="sticky left-0 z-[1] bg-card px-2 py-1 text-left font-semibold whitespace-nowrap">
                {plain(row[0].tokens)}
              </th>
              {row.slice(1).map((c, ci) => (
                <td key={ci} className="px-1 py-1 text-center">
                  <ReactionIcon r={reaction(plain(c.tokens).replace(/\*/g, "").trim())} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Cai + **Seteth** + Ninae, if short" -> the three names (bold ones are priority) and the trailing note. */
export function trioOf(
  cell: Tokens.TableCell | { tokens: Token[] },
): { names: string[]; bold: Set<string>; note: string } | null {
  const text = plain(cell.tokens).trim();
  const m = text.match(
    /^([A-Z][\w' ]*?(?:\s\+\s[A-Z][\w' ]*?){1,2})(?=$|[,.;:(]|\s(?:if|until|when|once|then|otherwise)\b)/,
  );
  if (!m) return null;
  // Some plans shorten the lord to an initial ("T + Loretta + Dante").
  const names = m[1].split(/\s\+\s/).map((s) => s.trim()).map((n) =>
    n.length === 1 ? META.order.find((r) => r.startsWith(n)) ?? n : n
  );
  if (!names.every((n) => CHARACTERS[n])) return null;
  const bold = new Set(
    cell.tokens.filter((t) => t.type === "strong").map((t) => (t as Tokens.Strong).text.trim()),
  );
  return { names, bold, note: text.slice(m[1].length).replace(/^[\s,.;:]+/, "") };
}

export function Trio({ names, bold, note }: { names: string[]; bold: Set<string>; note?: string }) {
  const { route } = useWalk();
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="flex items-center">
        {names.map((n) => (
          <span key={n} className={cx("-mr-1.5", bold.has(n) && "z-[1]")} title={n}>
            <Medal
              name={n}
              route={CHARACTERS[n]?.homeRoute}
              size={bold.has(n) ? 32 : 26}
              ring={bold.has(n) ? "#c2415f" : "var(--color-card)"}
            />
          </span>
        ))}
      </span>
      <span className="text-[12.5px] leading-snug">
        {names.filter((n) => n !== route).map((n, i) => (
          <span key={n}>
            {i > 0 && " · "}
            <span className={bold.has(n) ? "font-bold" : ""}>{n}</span>
          </span>
        ))}
      </span>
      {note && <span className="text-[12px] leading-snug text-muted">{note}</span>}
    </span>
  );
}

function Cell({ cell, first }: { cell: Tokens.TableCell; first: boolean }) {
  const seen: Seen = new Set();
  const trio = trioOf(cell);
  if (trio) return <Trio {...trio} />;
  if (first) {
    const text = plain(cell.tokens).trim();
    const name = text.replace(/\s*\[[^\]]*\]\s*/g, "").replace(/\*/g, "").trim();
    if (CHARACTERS[name]) {
      const tag = text.match(/\[[^\]]*\]/)?.[0];
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <CharacterChip name={name} />
          {tag && <Tag raw={tag} />}
        </span>
      );
    }
  }
  if (!plain(cell.tokens).trim()) return <span className="text-faint">—</span>;
  return <Inline tokens={cell.tokens} seen={seen} />;
}

/** Narrow panels (the Field Kit) draw tables as one card per row. */
export const TableMode = createContext<"table" | "cards">("table");

function Cards({ table }: { table: Tokens.Table }) {
  const heads = table.header.map((h) => plain(h.tokens));
  return (
    <ul className="my-3 grid list-none gap-2 p-0">
      {table.rows.map((row, ri) => (
        <li
          key={ri}
          className="rounded-md bg-card p-3 text-[14px] leading-snug shadow-[inset_0_0_0_1px_rgba(176,144,90,.4)]"
        >
          {row.map((c, ci) => {
            if (!plain(c.tokens).trim()) return null;
            const never = /never|avoid|dislike/i.test(heads[ci]);
            return (
              <div key={ci} className={cx(ci > 0 && "mt-1.5", never && "text-blood")}>
                {ci > 0 && <div className="label text-[10.5px] text-gold-lo">{heads[ci]}</div>}
                <div className={cx(ci === 0 && "font-semibold")}>
                  <Cell cell={c} first={ci === 0} />
                </div>
              </div>
            );
          })}
        </li>
      ))}
    </ul>
  );
}

/** Markdown table with portraits in the name column and seat trios drawn as avatars. */
export function Table(
  { table: raw, highlight }: { table: Tokens.Table; highlight?: (row: Tokens.TableCell[]) => boolean },
) {
  const mode = useContext(TableMode);
  // Drop columns that are empty (or only "—") in every row.
  const blank = (c?: Tokens.TableCell) => !c || /^[\s—-]*$/.test(plain(c.tokens));
  const keep = raw.header.map((_, i) => i === 0 || !raw.rows.every((r) => blank(r[i])));
  const table = keep.every(Boolean) ? raw : {
    ...raw,
    header: raw.header.filter((_, i) => keep[i]),
    rows: raw.rows.map((r) => r.filter((_, i) => keep[i])),
  };
  const body = table.rows.flatMap((r) => r.slice(1).map((c) => plain(c.tokens).replace(/\*/g, "").trim()));
  if (table.header.length > 5 && body.filter((c) => REACT.has(c)).length >= body.length * 0.9) {
    return <Heatmap table={table} />;
  }
  if (mode === "cards") return <Cards table={table} />;
  const wide = table.header.length > 4;
  return (
    <div className="my-3 overflow-x-auto rounded-md border border-gold/55 bg-card">
      <table className={cx("w-full border-collapse text-left text-[14.5px] leading-snug", wide && "min-w-[720px]")}>
        <thead>
          <tr className="border-b border-gold/60">
            {table.header.map((h, i) => (
              <th
                key={i}
                className={cx(
                  "bg-paper-2/70 px-3 py-2 align-bottom text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase",
                  i === 0 && "sticky left-0 z-[1]",
                )}
              >
                <Inline tokens={h.tokens} seen={new Set()} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr
              key={ri}
              data-here={highlight?.(row) || undefined}
              className={cx("border-b border-gold/25 last:border-0", highlight?.(row) && "bg-(--c2)")}
            >
              {row.map((c, ci) => (
                <td
                  key={ci}
                  className={cx(
                    "px-3 py-2 align-top",
                    ci === 0 && "sticky left-0 z-[1] font-semibold",
                    ci === 0 && (highlight?.(row) ? "bg-(--c2)" : "bg-card"),
                  )}
                >
                  <Cell cell={c} first={ci === 0} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
