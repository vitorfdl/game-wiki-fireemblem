import type { GrowthRow } from "../../lib/growth.ts";
import { growthOdds } from "../../lib/growth.ts";
import type { StatCheck, StatLine } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Rich } from "../ref/rich.tsx";

/** Growth of one stat in this stage: personal rate plus the class (and mount) row. */
function growthOf(stat: StatCheck["stat"], personal: StatLine | undefined, row: GrowthRow | null): number | undefined {
  if (!personal) return undefined;
  return personal[stat] + (row?.row[stat] ?? 0);
}

/**
 * Growth checks (build-standard.md §12): the stats a build lives on, how to read them in game, and the patches to try
 * when level-ups roll low. The expected gain comes from the stage's growth row, so the text never repeats it.
 */
export function GrowthChecks({ checks, personal, row, quiet }: {
  checks: StatCheck[];
  personal?: StatLine;
  row: GrowthRow | null;
  quiet?: string[];
}) {
  return (
    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] p-0">
      {checks.map((c, i) => {
        const g = growthOf(c.stat, personal, row);
        const odds = g !== undefined ? growthOdds(g) : undefined;
        return (
          <li
            key={`${c.stat}-${i}`}
            className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3.5 gap-y-2 border-t border-gold/15 py-2.5 first:border-t-0 first:pt-1 md:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div
              className="row-span-2 flex flex-col items-center justify-center self-start rounded-md bg-[color-mix(in_srgb,var(--c)_8%,var(--color-card))] px-1 py-1.5 text-center shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c)_28%,transparent)] md:row-span-1"
              title={odds
                ? `${c.stat} grows ${g}% a level here (personal + class${
                  row?.mounted ? " + mount" : ""
                }): about +${odds.per5} every 5 levels. Under +${odds.behind10} in 10 levels means the rolls are running low.`
                : undefined}
            >
              <span className="font-display text-[22px] leading-none text-(--c)">{c.stat}</span>
              {g !== undefined && (
                <span className="mt-0.5 text-[11px] font-semibold text-ink-soft tabular-nums">{g}% growth</span>
              )}
              {odds && (
                <span className="mt-1 rounded-full bg-card px-1.5 text-[11px] whitespace-nowrap font-bold text-ink tabular-nums shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]">
                  ≈ +{odds.per5} / 5 Lv
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.08em] text-gold-lo uppercase">
                On track{c.at && (
                  <span className="ml-1 font-normal tracking-normal text-muted normal-case">· {c.at}</span>
                )}
              </div>
              <p className="mt-0.5 mb-0 text-[14px] leading-snug font-medium">
                <Rich text={c.need} k={`chk${i}`} quiet={quiet} />
              </p>
              {c.why && (
                <p className="mt-0.5 mb-0 text-[12.5px] leading-snug text-muted">
                  <Rich text={c.why} k={`chw${i}`} quiet={quiet} />
                </p>
              )}
            </div>
            <div className="col-start-2 min-w-0 md:col-start-3">
              <div className="text-[11px] font-semibold tracking-[0.08em] text-blood-2 uppercase">
                If it lags
                {odds && odds.behind10 > 0 && (
                  <span className="ml-1 font-normal tracking-normal text-muted normal-case">
                    · under +{odds.behind10} in 10 Lv
                  </span>
                )}
              </div>
              <ol className="m-0 mt-0.5 grid list-none gap-0.5 p-0">
                {c.fix.map((f, j) => (
                  <li key={f} className="flex items-baseline gap-1.5 text-[13.5px] leading-snug">
                    <span
                      aria-hidden="true"
                      className={cx(
                        "grid size-4 shrink-0 translate-y-[1px] place-items-center rounded-full text-[10px] font-bold tabular-nums",
                        j === 0 ? "bg-(--c) text-white" : "bg-paper-3 text-ink-soft",
                      )}
                    >
                      {j + 1}
                    </span>
                    <span className="min-w-0">
                      <Rich text={f} k={`chf${i}.${j}`} quiet={quiet} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** One line per check for the Units side panel: the stat, when to look, and the on-track test (fixes on hover). */
export function GrowthCheckLines({ checks }: { checks: StatCheck[] }) {
  return (
    <ul className="m-0 mt-1 grid list-none gap-0.5 p-0">
      {checks.map((c, i) => (
        <li
          key={`${c.stat}-${i}`}
          className="flex items-baseline gap-1.5 leading-snug"
          title={`If it lags: ${
            c.fix.map((f) => f.replace(/\[\[(?:\w+:)?([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a, b) => b ?? a)).join(" · ")
          }`}
        >
          <span className="shrink-0 rounded-[3px] bg-(--c) px-1 text-[11px] font-extrabold text-white">{c.stat}</span>
          <span className="min-w-0">
            {c.at && <span className="text-muted">{c.at}:</span>}
            <Rich text={c.need} k={`ul${i}`} />
          </span>
        </li>
      ))}
    </ul>
  );
}
