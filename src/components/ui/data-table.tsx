import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";

/*
 * The one table style (redesign/10-visual-language.md V-4): small-caps header, hairline rows, no fills.
 * A leading `tick` column keeps checkboxes in a fixed gutter (V-5).
 */

export type Col = { label?: ReactNode; className?: string };

/**
 * `card` (D-100): the framed look of the Gifts table: rounded gold border, tinted header, column hairlines,
 * zebra rows and tinted group bands. Used by the Ledger; plain tables keep V-4.
 */
const CARD = cx(
  "overflow-hidden rounded-lg border border-gold/55 bg-card shadow-[0_1px_3px_rgba(90,60,20,.08)]",
  "[&_thead_tr]:border-b-2 [&_thead_tr]:border-gold/50 [&_thead]:bg-paper-2/80",
  "[&_th]:px-3 [&_th]:py-1.5 [&_th]:align-middle [&_th]:text-ink-soft [&_th+th]:border-l [&_th+th]:border-gold/20",
  "[&_td]:px-3 [&_td+td]:border-l [&_td+td]:border-gold/15 [&_tbody_tr]:border-gold/25",
  "[&_tbody_tr:nth-child(even):not(.tgroup)]:bg-paper-2/45",
  "[&_tr.tgroup_td]:border-t [&_tr.tgroup_td]:border-gold/40 [&_tr.tgroup_td]:bg-gold/10 [&_tr.tgroup_td]:py-1",
);

export function DataTable(
  { cols, children, minW, className, card }: {
    cols: (Col | string)[];
    children: ReactNode;
    minW?: number;
    className?: string;
    card?: boolean;
  },
) {
  return (
    <div className={cx("overflow-x-auto", card && CARD, className)}>
      <table className="w-full border-collapse text-[14px] leading-snug" style={minW ? { minWidth: minW } : undefined}>
        <thead>
          <tr>
            {cols.map((c, i) => {
              const col = typeof c === "string" ? { label: c } : c;
              return (
                <th
                  key={i}
                  className={cx(
                    "pr-2 pb-1 text-left align-bottom text-[11px] font-semibold tracking-[0.06em] text-muted uppercase",
                    col.className,
                  )}
                >
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** A table row: hairline on top, dimmed when done. */
export function TR({ children, done, className }: { children: ReactNode; done?: boolean; className?: string }) {
  return <tr className={cx("border-t border-gold/15 align-top", done && "text-muted", className)}>{children}</tr>;
}

export function TD({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cx("py-1.5 pr-2", className)}>{children}</td>;
}

/** A full-width divider row inside a table: a group title or a cap line. */
export function TGroup({ children, cols, tone }: { children: ReactNode; cols: number; tone?: "red" }) {
  return (
    <tr className="tgroup">
      <td
        colSpan={cols}
        className={cx(
          "pt-3 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase",
          tone === "red" ? "text-blood-2" : "text-gold-lo",
        )}
      >
        {children}
      </td>
    </tr>
  );
}

/** A section title inside a panel. */
export function PanelHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mt-6 mb-1.5 flex items-baseline gap-2 first:mt-1">
      <h4 className="m-0 text-[13px] font-semibold text-ink">{children}</h4>
      <span className="flex-1" />
      {aside}
    </div>
  );
}
