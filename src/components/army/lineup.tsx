import { useEffect, useState } from "react";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { char, META } from "../../lib/data.ts";
import { routeVars } from "../../lib/route-style.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import type { Deployment, RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Medal } from "../ui/medal.tsx";
import { Hover } from "../ui/hover.tsx";
import { Panel } from "../ui/panel.tsx";
import { UnitRef } from "../ref/rich.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { DeployGrid } from "./deploy-grid.tsx";
import { Board, type BoardRow, CHAPTERS } from "./board.tsx";

/*
 * Lineup (redesign/10-visual-language.md): deployment as ordered slots on a chapter board. Most maps take 6 units,
 * big maps 8 to 9, so slots 1-6 are the standard lineup and 7-9 join on big maps. Each holder is one bar across
 * the chapters it holds the slot; an arrow marks where a better unit takes the slot over (hover for why).
 */

type Slot = NonNullable<Deployment["lineup"]>[number];
type Holder = Slot["holders"][number];

const range = (h: Holder) => `Ch ${h.from}${h.to === h.from ? "" : h.to ? `–${h.to}` : " on"}`;

function HolderBar({ s, h, prev }: { s: Slot; h: Holder; prev?: Holder }) {
  const c = char(h.unit);
  const swap = Boolean(prev && prev.unit !== h.unit && (prev.to ?? 12) === h.from - 1);
  return (
    <>
      {swap && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-[8px] z-20 grid size-4 -translate-y-1/2 place-items-center rounded-full bg-card text-gold-lo shadow-[0_0_0_1px_rgba(176,144,90,.7)]"
        >
          <ArrowRight className="size-2.5" strokeWidth={3} />
        </span>
      )}
      <Hover
        label={`${h.unit}, slot ${s.slot}, ${range(h)}`}
        style={routeVars(c?.homeRoute)}
        className={cx(
          "@container mx-[2px] flex h-[34px] min-w-0 flex-1 items-center rounded-full transition-colors",
          "bg-[color-mix(in_srgb,var(--c)_15%,var(--color-card))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c)_32%,transparent)]",
          "hover:bg-[color-mix(in_srgb,var(--c)_24%,var(--color-card))]",
        )}
        card={() => (
          <div className="pr-4">
            <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              Slot {s.slot} · {s.role} · {range(h)}
            </div>
            <div className="mt-1 font-semibold"><UnitRef name={h.unit} /></div>
            {swap && prev && <div className="mt-1 text-[12.5px] text-muted">Takes the slot from {prev.unit}</div>}
            {h.why && <p className="mt-1 mb-0 text-[13.5px] leading-snug"><ConfText text={h.why} k={`hw${s.slot}${h.from}`} /></p>}
          </div>
        )}
      >
        {/* Sticky: when the board scrolls sideways, the holder stays named at the left of a long bar. */}
        <span
          className={cx(
            "sticky left-[calc(var(--lw)+6px)] flex min-w-0 items-center gap-1 @[44px]:mx-0 @[44px]:px-1.5 @[64px]:pr-2 @[64px]:pl-[4px] @[112px]:gap-1.5 @[112px]:pl-[3px]",
            // Tiny bars: clear the swap arrow that overlaps the bar's left edge.
            swap ? "pl-[7px]" : "mx-auto px-0.5",
          )}
        >
          <span className="hidden shrink-0 @[112px]:block">
            <Medal name={h.unit} route={c?.homeRoute} size={28} ring="var(--color-card)" />
          </span>
          {/* Short bars: the portrait alone (the hover card names the unit), never a clipped name. */}
          <span className="shrink-0 @[112px]:hidden" title={h.unit}>
            <Medal name={h.unit} route={c?.homeRoute} size={22} ring="var(--color-card)" />
          </span>
          <span
            className={cx(
              "hidden min-w-0 truncate text-[13px] font-semibold text-ink @[112px]:inline",
              h.why && "underline decoration-(--c)/60 decoration-dotted underline-offset-[3px]",
            )}
          >
            {h.unit}
          </span>
        </span>
      </Hover>
    </>
  );
}

function SlotBoard({ r }: { r: RouteName }) {
  const dep = META.routes[r].deployment!;
  const now = nowChapter(r, useTrack());
  const rows: BoardRow[] = [];
  for (const s of dep.lineup!) {
    if (s.slot === 7) {
      const top = Math.max(...dep.lineup!.map((x) => x.slot));
      rows.push({ kind: "group", key: "big", label: `Big maps add (up to ${top} slots)` });
    }
    rows.push({
      kind: "row",
      key: `s${s.slot}`,
      head: (
        <span className="flex min-w-0 items-baseline gap-2" title={s.note ? `${s.role}: ${s.note}` : s.role}>
          <span className="w-3 shrink-0 text-right text-[12px] font-semibold text-faint tabular-nums">{s.slot}</span>
          <span
            className={cx(
              "line-clamp-2 min-w-0 text-[13px] leading-tight text-ink-soft",
              s.note && "underline decoration-gold/50 decoration-dotted underline-offset-[3px]",
            )}
          >
            {s.role}
          </span>
        </span>
      ),
      segs: s.holders.map((h, i) => ({
        key: `${h.unit}${h.from}`,
        from: h.from,
        to: h.to ?? CHAPTERS.length,
        node: <HolderBar s={s} h={h} prev={s.holders[i - 1]} />,
      })),
    });
  }
  return (
    <>
      <Board label="Slot · role" phases={dep.phases} now={now} rows={rows} />
      <p className="mt-2 mb-0 text-[12.5px] text-muted">
        <span className="mr-1.5 inline-grid size-4 place-items-center rounded-full bg-card align-[-3px] text-gold-lo shadow-[0_0_0_1px_rgba(176,144,90,.7)]">
          <ArrowRight aria-hidden="true" className="size-2.5" strokeWidth={3} />
        </span>
        a better unit takes the slot (hover the bar for why). Slot counts are player reports: check the prep screen.
      </p>
    </>
  );
}

/** Lineup by slot when the route has one, with the per-unit board as the other view. */
export function Lineup({ r }: { r: RouteName }) {
  const has = Boolean(META.routes[r].deployment?.lineup?.length);
  const [view, setView] = useState<"slot" | "unit">(has ? "slot" : "unit");
  // The page component stays mounted across routes: start each route on its default view.
  useEffect(() => {
    setView(has ? "slot" : "unit");
  }, [r, has]);
  if (!META.routes[r].deployment?.phases.length) return null;
  return (
    <Panel
      id="lineup"
      icon={<LayoutGrid />}
      title="Lineup"
      sub={has && view === "slot" ? "Who holds each map slot, chapter by chapter" : "Who deploys in each phase"}
      aside={has && (
        <div role="radiogroup" className="flex rounded-full bg-paper-2 p-0.5 text-[12.5px] font-semibold">
          {(["slot", "unit"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cx("rounded-full px-2.5 py-0.5", view === v ? "bg-card text-ink shadow-sm" : "text-muted")}
            >
              {v === "slot" ? "By slot" : "By unit"}
            </button>
          ))}
        </div>
      )}
    >
      {view === "slot" && has ? <SlotBoard r={r} /> : <DeployGrid r={r} />}
    </Panel>
  );
}
