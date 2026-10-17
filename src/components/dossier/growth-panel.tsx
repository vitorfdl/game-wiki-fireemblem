import type { GrowthRow } from "../../lib/growth.ts";
import { rowLabel } from "../../lib/growth.ts";
import { cx } from "../../lib/cx.ts";
import type { Stat, StatLine } from "../../lib/types.ts";
import { STATS } from "../../lib/types.ts";

type Props = {
  personal: StatLine;
  row: GrowthRow | null;
  focus?: Stat[];
  title?: string;
  /** Column chart without a frame: the caller is already a panel (build page Growth panel). */
  bare?: boolean;
};

/**
 * Growth bars: personal rate plus the class (and mount) modifier. The bar is the total; a dark tick marks the personal
 * rate, so the class's share reads as the part of the bar past the tick. Focus stats use the route colour.
 */
export function GrowthPanel({ personal, row, focus = [], title = "Growth in this class", bare }: Props) {
  if (bare) return <GrowthColumns personal={personal} row={row} focus={focus} />;
  return (
    <div className="bg-paper p-3.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="label text-muted">{title}</h5>
        {row && <span className="text-[12.5px] text-ink-soft">{rowLabel(row.key)}</span>}
      </div>
      <div className="grid gap-y-1">
        {STATS.map((s) => {
          const mod = row?.row[s] ?? 0;
          const own = personal[s];
          const total = own + mod;
          const hot = focus.includes(s);
          return (
            <div key={s} className="grid grid-cols-[34px_1fr_30px_32px] items-center gap-2 text-[12.5px]" title={`${s}: personal ${own}%${row ? `, class ${mod >= 0 ? "+" : ""}${mod}` : ""}`}>
              <span className={cx("font-logo font-bold", hot && "text-(--c)")}>{s}</span>
              <span className="relative h-[9px] rounded-[2px] bg-paper-3">
                <span
                  className={cx(
                    "absolute inset-y-0 left-0 rounded-[2px]",
                    hot ? "bg-[linear-gradient(90deg,var(--c),color-mix(in_srgb,var(--c)_55%,#fff))]" : "bg-[#bba67a]",
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, total))}%` }}
                />
                {row && mod !== 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-y-[2px] w-[2px] rounded-full bg-ink/70"
                    style={{ left: `calc(${Math.max(0, Math.min(100, own))}% - 1px)` }}
                  />
                )}
              </span>
              <em className={cx("text-right font-bold not-italic tabular-nums", hot && "text-(--c)")}>{total}</em>
              {row
                ? (
                  <small
                    className={cx(
                      "text-right text-[11px] tabular-nums",
                      mod > 0 ? "text-[#2d7a4f]" : mod < 0 ? "text-blood-2" : "text-faint",
                    )}
                  >
                    {mod > 0 ? `+${mod}` : mod < 0 ? mod : "±0"}
                  </small>
                )
                : <span />}
            </div>
          );
        })}
      </div>
      {row && (
        <p className="mt-2.5 mb-0 text-[11.5px] leading-normal text-muted">
          Bar: personal growth + class{row.mounted ? " + mount" : ""}. Tick: personal growth alone; the small number is what
          the class adds.{focus.length > 0 && " Coloured stats are this build's focus."}
        </p>
      )}
    </div>
  );
}

/** Column chart for the build page's Growth panel: one column per stat, the bar the total, a tick the personal rate. */
function GrowthColumns({ personal, row, focus = [] }: Omit<Props, "title" | "bare">) {
  const max = Math.max(100, ...STATS.map((s) => personal[s] + (row?.row[s] ?? 0)));
  return (
    <div>
      <div className="grid grid-cols-9 gap-1.5">
        {STATS.map((s) => {
          const mod = row?.row[s] ?? 0;
          const own = personal[s];
          const total = own + mod;
          const hot = focus.includes(s);
          const pct = (v: number) => `${(Math.max(0, Math.min(max, v)) / max) * 100}%`;
          return (
            <div key={s} className="flex min-w-0 flex-col items-center" title={`${s}: personal ${own}%${row ? `, class ${mod >= 0 ? "+" : ""}${mod}` : ""}`}>
              <em className={cx("text-[14px] font-bold not-italic tabular-nums", hot ? "text-(--c)" : "text-ink")}>{total}</em>
              <span className="relative mt-1 h-[84px] w-full max-w-[34px] rounded-t-[3px] bg-paper-3/70">
                <span
                  className={cx(
                    "absolute inset-x-0 bottom-0 rounded-t-[3px]",
                    hot ? "bg-[linear-gradient(0deg,var(--c),color-mix(in_srgb,var(--c)_60%,#fff))]" : "bg-[#c9b68a]",
                  )}
                  style={{ height: pct(total) }}
                />
                {row && mod !== 0 && (
                  <span aria-hidden="true" className="absolute -inset-x-[3px] h-[2px] rounded-full bg-ink/75" style={{ bottom: `calc(${pct(own)} - 1px)` }} />
                )}
              </span>
              <span className={cx("mt-1 font-logo text-[12px] font-bold", hot && "text-(--c)")}>{s}</span>
              {row && (
                <small
                  className={cx(
                    "text-[11px] leading-none tabular-nums",
                    mod > 0 ? "text-[#2d7a4f]" : mod < 0 ? "text-blood-2" : "text-faint",
                  )}
                >
                  {mod > 0 ? `+${mod}` : mod < 0 ? mod : "±0"}
                </small>
              )}
            </div>
          );
        })}
      </div>
      {row && (
        <p
          className="mt-2 mb-0 text-[11.5px] leading-snug text-muted"
          title={`Bar: personal + class${row.mounted ? " + mount" : ""} growth. Line: personal growth alone. Small number: what the class adds.${focus.length ? " Coloured: this build's focus stats." : ""}`}
        >
          Bar = with class{row.mounted ? " + mount" : ""} · line = personal
        </p>
      )}
    </div>
  );
}
