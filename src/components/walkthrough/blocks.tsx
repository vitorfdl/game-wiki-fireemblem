import { type ReactNode, useState } from "react";
import type { Token, Tokens } from "marked";
import { Check, ChevronDown, Info, UtensilsCrossed } from "lucide-react";
import { CHARACTERS } from "../../lib/data.ts";
import { cx } from "../../lib/cx.ts";
import { lexInline, plain } from "../../lib/walkthrough/sources.ts";
import { toggleTask, useProgress } from "../../lib/walkthrough/store.ts";
import { Medal } from "../ui/medal.tsx";
import { useWalk } from "./ctx.ts";
import { CharacterChip, decode, Inline, type Seen } from "./inline.tsx";
import { Table } from "./table.tsx";
import { listRuns, UnitTable } from "./unit-table.tsx";

/** Finds the first sentence break that is not inside bold or parentheses. Returns null for short text. */
export function splitLead(src: string, min = 170): [string, string] | null {
  if (src.length < min) return null;
  let bold = false;
  let paren = 0;
  for (let i = 0; i < src.length - 1; i++) {
    if (src.startsWith("**", i)) {
      bold = !bold;
      i++;
      continue;
    }
    const c = src[i];
    if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    if (c === "." && src[i + 1] === " " && !bold && paren === 0 && i >= 28) {
      if (/\b(vs|e\.g|i\.e|Lv|Ch|St|approx|no)$/i.test(src.slice(Math.max(0, i - 6), i))) continue;
      const rest = src.slice(i + 2).trim();
      if (rest.length < 48) return null;
      return [src.slice(0, i + 1), rest];
    }
  }
  return null;
}

/** Shows the first sentence and hides the rest behind a "more" toggle. */
function Collapsible({ src, tokens, seen, k }: { src: string; tokens?: Token[]; seen: Seen; k: string }) {
  const [open, setOpen] = useState(false);
  const parts = splitLead(decodeMd(src));
  if (!parts) return <Inline tokens={tokens ?? lexInline(src)} seen={seen} k={k} />;
  return (
    <>
      <Inline tokens={lexInline(parts[0])} seen={seen} k={`${k}a`} />{" "}
      {open && <Inline tokens={lexInline(parts[1])} seen={seen} k={`${k}b`} />}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-paper-2 px-2 align-[0.08em] text-[0.78em] font-semibold text-ink-soft hover:bg-paper-3"
      >
        {open ? "less" : "more"}
        <ChevronDown aria-hidden="true" className={cx("size-[1em] transition-transform", open && "rotate-180")} />
      </button>
    </>
  );
}

const decodeMd = (s: string) => decode(s);

function TaskBox({ id }: { id: string }) {
  const done = Boolean(useProgress()[id]);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      onClick={() => toggleTask(id)}
      className={cx(
        "mt-[0.22em] grid size-[1.15em] shrink-0 place-items-center rounded-[4px] border-[1.5px] transition-colors",
        done ? "border-(--c) bg-(--c) text-white" : "border-gold-lo/60 bg-card hover:border-(--c)",
      )}
    >
      {done && <Check aria-hidden="true" strokeWidth={3} className="size-[0.85em]" />}
    </button>
  );
}

function ListItem({ item, k, inTasks }: { item: Tokens.ListItem & { fwId?: string }; k: string; inTasks: boolean }) {
  const done = Boolean(useProgress()[item.fwId ?? ""]);
  const seen: Seen = new Set();
  const body = item.tokens.filter((t) => t.type !== "checkbox");
  const [first, ...rest] = body;
  const firstText = first && (first.type === "text" || first.type === "paragraph") ? (first as Tokens.Text) : undefined;
  const content = (
    <div className={cx("min-w-0 flex-1", done && "text-muted [&_strong]:text-muted")}>
      {firstText
        ? <Collapsible src={firstText.text} tokens={firstText.tokens} seen={seen} k={k} />
        : first && <Blocks tokens={[first]} k={`${k}f`} />}
      {rest.length > 0 && <Blocks tokens={rest} k={`${k}r`} nested />}
    </div>
  );
  if (!item.task) {
    if (!inTasks) return <li className="my-1.5 pl-0.5">{content}</li>;
    return (
      <li className="my-2 flex list-none items-start gap-2.5">
        <span aria-hidden="true" className="grid h-[1.6em] w-[1.15em] shrink-0 place-items-center">
          <i className="block size-[0.42em] rotate-45 bg-gold" />
        </span>
        {content}
      </li>
    );
  }
  return (
    <li className="my-2 flex list-none items-start gap-2.5">
      <TaskBox id={item.fwId ?? ""} />
      {content}
    </li>
  );
}

function List({ list, k, nested }: { list: Tokens.List; k: string; nested?: boolean }) {
  const runs = listRuns(list);
  if (runs) {
    return (
      <>
        {runs.map((r, i) =>
          r.kind === "units"
            ? <UnitTable key={i} items={r.items} rows={r.rows} k={`${k}u${i}`} />
            : <List key={i} list={{ ...list, items: r.items }} k={`${k}p${i}`} nested={nested} />
        )}
      </>
    );
  }
  const tasks = list.items.some((i) => i.task);
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag
      start={list.ordered && list.start !== "" ? Number(list.start) : undefined}
      className={cx(
        "my-2",
        tasks
          ? "pl-0"
          : list.ordered
          ? "list-decimal pl-6 marker:font-bold marker:text-gold-lo"
          : "list-disc pl-5 marker:text-gold",
        nested && "mt-1 mb-0 text-[0.96em]",
      )}
    >
      {list.items.map((it, i) => <ListItem key={i} item={it} k={`${k}.${i}`} inTasks={tasks} />)}
    </Tag>
  );
}

/** Names mentioned in a callout, for the avatar strip on its collapsed header. */
function namesIn(text: string, skip: string): string[] {
  const out: string[] = [];
  for (const n of Object.keys(CHARACTERS)) {
    if (n === skip || n === "Long") continue;
    if (new RegExp(`\\b${n}\\b`).test(text)) out.push(n);
  }
  return out.sort((a, b) => text.indexOf(a) - text.indexOf(b));
}

function Callout({ quote, k }: { quote: Tokens.Blockquote; k: string }) {
  const { route, openKit } = useWalk();
  const text = plain(quote.tokens);
  const support = /^support focus/i.test(text.trim());
  const [open, setOpen] = useState(false);
  const label = support ? "Support focus" : (text.match(/^(\w[\w ]{0,18}):/)?.[1] ?? "Note");
  const names = support ? namesIn(text, route).slice(0, 8) : [];
  return (
    <div
      className={cx(
        "my-3 rounded-md",
        support ? "bg-[#f6dfe3]/60 shadow-[inset_0_0_0_1px_rgba(194,65,95,.25)]" : "bg-paper-2/70",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {support
            ? <UtensilsCrossed aria-hidden="true" className="size-4 shrink-0 text-[#c2415f]" />
            : <Info aria-hidden="true" className="size-4 shrink-0 text-gold-lo" />}
          <span className="label text-ink-soft">{label}</span>
          {names.length > 0 && (
            <span className="flex items-center pl-1">
              {names.map((n) => (
                <span key={n} className="-mr-1.5" title={n}>
                  <Medal name={n} route={CHARACTERS[n]?.homeRoute} size={24} ring="#fbeef0" />
                </span>
              ))}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cx("ml-auto size-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          />
        </button>
        {support && (
          <button
            type="button"
            onClick={() => openKit("meals")}
            className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-[13px] font-semibold text-[#8c2a43] shadow-[inset_0_0_0_1px_rgba(194,65,95,.35)] hover:bg-white"
          >
            Meal plan
          </button>
        )}
      </div>
      {open && (
        <div className="px-3 pb-2.5 text-[0.95em] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <Blocks tokens={quote.tokens} k={k} />
        </div>
      )}
    </div>
  );
}

export function Paragraph({ p, k }: { p: Tokens.Paragraph; k: string }) {
  const seen: Seen = new Set();
  return (
    <p className="my-2.5">
      <Collapsible src={p.text} tokens={p.tokens} seen={seen} k={k} />
    </p>
  );
}

/** Block renderer for marked tokens with the walkthrough's visual treatments. */
export function Blocks({ tokens, k = "b", nested }: { tokens: Token[]; k?: string; nested?: boolean }) {
  const out: ReactNode[] = [];
  tokens.forEach((t, i) => {
    const key = `${k}-${i}`;
    switch (t.type) {
      case "paragraph":
        out.push(<Paragraph key={key} p={t as Tokens.Paragraph} k={key} />);
        break;
      case "text": {
        const tt = t as Tokens.Text;
        out.push(
          <span key={key} className="block">
            <Collapsible src={tt.text} tokens={tt.tokens} seen={new Set()} k={key} />
          </span>,
        );
        break;
      }
      case "list":
        out.push(<List key={key} list={t as Tokens.List} k={key} nested={nested} />);
        break;
      case "table":
        out.push(<Table key={key} table={t as Tokens.Table} />);
        break;
      case "blockquote":
        out.push(<Callout key={key} quote={t as Tokens.Blockquote} k={key} />);
        break;
      case "heading": {
        const h = t as Tokens.Heading;
        out.push(
          <h5 key={key} className="mt-5 mb-1 text-[15px] font-bold tracking-[0.02em] text-ink">
            <Inline tokens={h.tokens} seen={new Set()} />
          </h5>,
        );
        break;
      }
      case "code":
        out.push(
          <pre key={key} className="my-3 overflow-x-auto rounded bg-paper-2 p-3 text-[13px]">
            {(t as Tokens.Code).text}
          </pre>,
        );
        break;
      default:
        break;
    }
  });
  return <>{out}</>;
}

export { CharacterChip };
