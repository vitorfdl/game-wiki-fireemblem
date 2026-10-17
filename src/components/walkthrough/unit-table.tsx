import { useState } from "react";
import type { Tokens } from "marked";
import { ChevronDown } from "lucide-react";
import { CHARACTERS } from "../../lib/data.ts";
import { isClassName } from "../../lib/growth.ts";
import { cx } from "../../lib/cx.ts";
import { lexInline } from "../../lib/walkthrough/sources.ts";
import { toggleTask, useProgress } from "../../lib/walkthrough/store.ts";
import { Check } from "lucide-react";
import { CharacterChip, decode, Inline } from "./inline.tsx";
import { Blocks } from "./blocks.tsx";

export type UnitLine = { name: string; cls: string; needs: string[]; extra: string; notes: string };

const RANK = /^[A-Z][A-Za-z ]+ [A-E][+]?$/;

/**
 * "**Cai** → **Armored Ornius Rider** (Rider D, Axe C, Spear C). Notes..." and "Catania: Ornius Rider (...)"
 * -> unit, class, rank requirements and the rest as notes. Returns null when the line is not a unit/class pair.
 */
export function parseUnitLine(raw: string): UnitLine | null {
  const src = decode(raw.split("\n")[0]).trim();
  const m = src.match(
    /^\*{0,2}([A-Z][\w' ]*?)\*{0,2}\s*(?:→|->|:)\s*\*{0,2}([A-Z][A-Za-z' ]+?)\*{0,2}(?:\s*\(([^)]*)\))?\s*(?:[.;:,]\s*|$)([\s\S]*)$/,
  );
  if (!m) return null;
  const [, name, cls, paren, rest] = m;
  if (!CHARACTERS[name.trim()] || !isClassName(cls)) return null;
  const bits = (paren ?? "").split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  const needs = bits.filter((b) => RANK.test(b));
  const extra = bits.filter((b) => !RANK.test(b)).join(", ");
  const notes = rest.trim();
  return {
    name: name.trim(),
    cls: cls.trim(),
    needs,
    extra,
    notes: notes ? notes[0].toUpperCase() + notes.slice(1) : "",
  };
}

type Item = Tokens.ListItem & { fwId?: string };

const firstText = (it: Item) =>
  it.tokens.find((t) => t.type === "text" || t.type === "paragraph") as Tokens.Text | undefined;

export type ListRun = { kind: "units"; items: Tokens.ListItem[]; rows: UnitLine[] } | {
  kind: "plain";
  items: Tokens.ListItem[];
};

/**
 * Splits a list into runs: two or more consecutive "unit → class" lines become a table run, everything else stays
 * a normal list run. Markdown merges lists separated by blank lines, so this cannot rely on whole lists.
 */
export function listRuns(list: Tokens.List): ListRun[] | null {
  const parsed = list.items.map((it) => {
    const t = firstText(it as Item);
    return t ? parseUnitLine(t.text) : null;
  });
  if (parsed.filter(Boolean).length < 2) return null;
  const runs: ListRun[] = [];
  let i = 0;
  while (i < parsed.length) {
    let j = i;
    while (j < parsed.length && parsed[j]) j++;
    if (j - i >= 2) {
      runs.push({ kind: "units", items: list.items.slice(i, j), rows: parsed.slice(i, j) as UnitLine[] });
      i = j;
      continue;
    }
    const start = i;
    i = Math.max(j, i + 1);
    while (i < parsed.length && !(parsed[i] && parsed[i + 1])) i++;
    const last = runs.at(-1);
    if (last?.kind === "plain") last.items.push(...list.items.slice(start, i));
    else runs.push({ kind: "plain", items: list.items.slice(start, i) });
  }
  return runs.some((r) => r.kind === "units") ? runs : null;
}

function Box({ id }: { id?: string }) {
  const done = Boolean(useProgress()[id ?? ""]);
  if (!id) return <span className="w-[18px]" />;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      onClick={() => toggleTask(id)}
      className={cx(
        "grid size-[18px] shrink-0 place-items-center rounded-[4px] border-[1.5px] transition-colors",
        done ? "border-(--c) bg-(--c) text-white" : "border-gold-lo/60 bg-card hover:border-(--c)",
      )}
    >
      {done && <Check aria-hidden="true" strokeWidth={3} className="size-3" />}
    </button>
  );
}

function Notes({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 110;
  return (
    <div className="text-[14px] leading-snug text-ink-soft">
      <span className={cx(long && !open && "line-clamp-2")}>
        <Inline tokens={lexInline(text)} seen={new Set()} />
      </span>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mt-0.5 inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-(--c) hover:underline"
        >
          {open ? "less" : "more"}
          <ChevronDown aria-hidden="true" className={cx("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

/** Unit, class to take, ranks the exam needs, and notes: one row per unit, checkbox first. */
export function UnitTable({ items, rows, k }: { items: Tokens.ListItem[]; rows: UnitLine[]; k: string }) {
  const done = useProgress();
  // One unit's own class path: the unit goes in the header instead of every row.
  const single = rows.every((r) => r.name === rows[0].name) ? rows[0].name : null;
  const cols = single
    ? "md:grid-cols-[28px_minmax(0,1fr)_minmax(0,1.6fr)]"
    : "md:grid-cols-[28px_150px_minmax(0,1fr)_minmax(0,1.6fr)]";
  return (
    <div className="my-3 overflow-hidden rounded-md bg-card shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]">
      {single && (
        <div className="border-b border-gold/40 px-3 py-2 font-semibold">
          <CharacterChip name={single} />
          <span className="ml-2 text-[13px] font-normal text-muted">class path</span>
        </div>
      )}
      <div
        className={cx(
          "hidden gap-x-3 border-b border-gold/40 bg-paper-2/70 px-3 py-1.5 text-[11.5px] font-semibold tracking-[0.08em] text-ink-soft uppercase md:grid",
          cols,
        )}
      >
        <span />
        {!single && <span>Unit</span>}
        <span>Class · ranks needed</span>
        <span>Notes</span>
      </div>
      {items.map((raw, i) => {
        const it = raw as Item;
        const row = rows[i];
        const off = Boolean(it.fwId && done[it.fwId]);
        const nested = it.tokens.filter((t) => t.type === "list");
        if (!row) {
          const t = firstText(it);
          return (
            <div
              key={i}
              className={cx("flex gap-3 border-b border-gold/25 px-3 py-2.5 last:border-0", off && "opacity-60")}
            >
              <span className="pt-0.5">
                <Box id={it.fwId} />
              </span>
              <div className="min-w-0 flex-1 text-[14.5px] leading-snug">
                {t && <Notes text={t.text} />}
                {nested.length > 0 && <Blocks tokens={nested} k={`${k}.${i}n`} nested />}
              </div>
            </div>
          );
        }
        return (
          <div
            key={i}
            className={cx(
              "grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-gold/25 px-3 py-2.5 last:border-0 md:items-start",
              cols,
              off && "opacity-60",
            )}
          >
            <span className="row-span-3 pt-1 md:row-span-1">
              <Box id={it.fwId} />
            </span>
            {!single && (
              <span className="font-semibold">
                <CharacterChip name={row.name} />
              </span>
            )}
            <span className="flex flex-col gap-1">
              <b className="text-[15px] leading-tight">{row.cls}</b>
              {(row.needs.length > 0 || row.extra) && (
                <span className="flex flex-wrap gap-1">
                  {row.needs.map((n) => (
                    <span key={n} className="rounded-[3px] bg-paper-2 px-1.5 text-[12px] font-semibold text-ink-soft">
                      {n}
                    </span>
                  ))}
                  {row.extra && <span className="text-[12.5px] text-muted">{row.extra}</span>}
                </span>
              )}
            </span>
            <span className="min-w-0">
              <Notes text={row.notes} />
              {nested.length > 0 && <Blocks tokens={nested} k={`${k}.${i}n`} nested />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
