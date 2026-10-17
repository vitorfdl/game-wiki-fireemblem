import { Fragment, type ReactNode, useLayoutEffect, useRef } from "react";
import type { Deployment } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Hover } from "../ui/hover.tsx";
import { HoverText } from "./bits.tsx";

/*
 * Chapter board: the shared frame of both Lineup views (by slot, by unit). A label column, then one column per
 * Part I chapter (and an optional Part II column). Phase spans sit on top with their slot counts; the pinned
 * chapter is a tinted band through every row. Rows hold segments that span chapters, Gantt style.
 */

export const CHAPTERS = Array.from({ length: 12 }, (_, i) => i + 1);
const LAST = 12;

export type Phase = Deployment["phases"][number];

/** Phase chapter range: `from`/`to` when written, else read from "Ch 6 to 9". */
export function phaseRange(p: Phase): [number, number] | null {
  if (p.from !== undefined) return [p.from, p.to ?? p.from];
  const m = p.chapters.match(/Ch (\d+)(?:\s*(?:to|-|–)\s*(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
}

export type Seg = { key: string; from: number; to: number; node: ReactNode };
export type BoardRow =
  | { kind: "group"; key: string; label: ReactNode }
  | { kind: "row"; key: string; head: ReactNode; segs: Seg[]; part2?: ReactNode };

type Props = {
  label: string;
  phases: Phase[];
  now: number;
  rows: BoardRow[];
  /** Part II column: header text and its hover note. */
  part2?: { label: string; sub: string; note?: string };
};

export function Board({ label, phases, now, rows, part2 }: Props) {
  const cols = `var(--lw) repeat(${LAST}, minmax(26px, 1fr))${part2 ? " 72px" : ""}`;
  const total = rows.length + 2;
  const nowCol = Math.min(Math.max(now, 1), LAST) + 1;
  const scroller = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  // When the board is wider than its panel (Ledger open, small window) it scrolls sideways: keep the pinned chapter
  // in view, right of the label column, on load and whenever the panel width changes.
  useLayoutEffect(() => {
    const el = scroller.current, b = band.current, h = head.current;
    if (!el || !b || !h) return;
    const fit = () => {
      if (el.scrollWidth <= el.clientWidth) return;
      const lw = h.offsetWidth;
      el.scrollLeft = Math.max(0, b.offsetLeft + b.offsetWidth / 2 - (lw + (el.clientWidth - lw) / 2));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [now]);
  const ranged = phases.map((p) => ({ p, r: phaseRange(p) })).filter((x): x is { p: Phase; r: [number, number] } =>
    Boolean(x.r)
  );
  return (
    <div ref={scroller} className="@container -mx-1 overflow-x-auto px-1 pb-1">
      <div
        className="relative grid [--lw:112px] @3xl:[--lw:220px]"
        style={{ gridTemplateColumns: cols, gridTemplateRows: `auto auto repeat(${rows.length}, auto)` }}
      >
        {/* pinned chapter band */}
        <div
          ref={band}
          aria-hidden="true"
          className="rounded-md bg-(--c)/[0.04] shadow-[inset_1px_0_0_color-mix(in_srgb,var(--c)_18%,transparent),inset_-1px_0_0_color-mix(in_srgb,var(--c)_18%,transparent)]"
          style={{ gridColumn: nowCol, gridRow: `2 / ${total + 1}` }}
        />
        {/* phase boundaries */}
        {ranged.slice(1).map(({ r }) => (
          <div
            key={`b${r[0]}`}
            aria-hidden="true"
            className="border-l border-dashed border-gold/45"
            style={{ gridColumn: r[0] + 1, gridRow: `1 / ${total + 1}` }}
          />
        ))}
        {part2 && (
          <div
            aria-hidden="true"
            className="border-l-2 border-gold/40"
            style={{ gridColumn: LAST + 2, gridRow: `1 / ${total + 1}` }}
          />
        )}

        {/* row 1: phases */}
        <div
          ref={head}
          className="sticky left-0 z-20 flex items-end bg-card pr-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase"
          style={{ gridColumn: 1, gridRow: "1 / 3" }}
        >
          {label}
        </div>
        {ranged.map(({ p, r }) => (
          <div key={p.chapters} className="min-w-0 px-1.5 pb-1" style={{ gridColumn: `${r[0] + 1} / ${r[1] + 2}`, gridRow: 1 }}>
            <Hover
              label={`${p.chapters}: phase note`}
              card={() => <HoverText title={`${p.chapters} · about ${p.slots} slots`} rows={[["", p.note]]} />}
              className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 rounded px-1 py-0.5 hover:bg-paper-2"
            >
              <b className="text-[12.5px] font-semibold whitespace-nowrap text-ink-soft">{p.chapters.replace(/ to /, "–")}</b>
              <span className="shrink-0 rounded-sm bg-paper-2 px-1 text-[11.5px] font-semibold text-gold-lo tabular-nums">
                {p.slots} slots
              </span>
            </Hover>
          </div>
        ))}
        {part2 && (
          <div className="min-w-0 px-1.5 pb-1" style={{ gridColumn: LAST + 2, gridRow: 1 }}>
            <Hover
              label="Part II: note"
              card={() => <HoverText title={`${part2.label} · ${part2.sub}`} rows={[["", part2.note]]} />}
              className="block rounded px-1 py-0.5 hover:bg-paper-2"
            >
              <b className="block text-[12.5px] font-semibold whitespace-nowrap text-ink-soft">{part2.label}</b>
            </Hover>
          </div>
        )}

        {/* row 2: chapter numbers */}
        {CHAPTERS.map((ch) => (
          <div
            key={ch}
            className="flex flex-col items-center justify-end pb-1.5 text-[12px] font-semibold text-muted tabular-nums"
            style={{ gridColumn: ch + 1, gridRow: 2 }}
          >
            {ch === now
              ? (
                <>
                  <span className="text-[9px] font-semibold tracking-[0.12em] text-(--c)/70 uppercase">Now</span>
                  <span className="rounded-full px-1.5 text-(--c) underline decoration-(--c)/50 underline-offset-2">{ch}</span>
                </>
              )
              : ch}
          </div>
        ))}
        {part2 && (
          <div
            className="flex items-end justify-center pb-1.5 text-[11.5px] font-semibold whitespace-nowrap text-muted"
            style={{ gridColumn: LAST + 2, gridRow: 2 }}
          >
            {part2.sub}
          </div>
        )}

        {/* rows */}
        {rows.map((row, i) => {
          const gr = i + 3;
          if (row.kind === "group") {
            return (
              <div key={row.key} className="relative z-20 pt-3 pb-1" style={{ gridColumn: "1 / -1", gridRow: gr }}>
                <span className="sticky left-0 inline-flex items-center gap-2 bg-card pr-2 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-gold-lo uppercase">
                  {row.label}
                </span>
              </div>
            );
          }
          const sep = rows[i - 1]?.kind === "row" && "border-t border-gold/15";
          return (
            <Fragment key={row.key}>
              <div aria-hidden="true" className={cx(sep)} style={{ gridColumn: "1 / -1", gridRow: gr }} />
              <div
                aria-hidden="true"
                className="self-center border-t border-dotted border-faint/50"
                style={{ gridColumn: `2 / ${LAST + 2}`, gridRow: gr }}
              />
              <div
                className={cx("sticky left-0 z-20 flex min-w-0 items-center bg-card py-1 pr-2", sep)}
                style={{ gridColumn: 1, gridRow: gr }}
              >
                {row.head}
              </div>
              {row.segs.map((s) => (
                <div
                  key={s.key}
                  className="relative z-10 flex min-w-0 items-center py-1"
                  style={{ gridColumn: `${s.from + 1} / ${Math.min(s.to, LAST) + 2}`, gridRow: gr }}
                >
                  {s.node}
                </div>
              ))}
              {part2 && row.part2 && (
                <div className="relative z-10 flex min-w-0 items-center py-1 pl-1.5" style={{ gridColumn: LAST + 2, gridRow: gr }}>
                  {row.part2}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
