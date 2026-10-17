import { char, META } from "../../lib/data.ts";
import { routeVars } from "../../lib/route-style.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import { routeUnits, type UnitPlan } from "../../lib/walkthrough/builds.ts";
import type { DeployStatus, RouteName } from "../../lib/types.ts";
import { Medal } from "../ui/medal.tsx";
import { personHref, STATUS_HINT, STATUS_LABEL } from "./bits.tsx";
import { Board, type BoardRow, phaseRange, type Seg } from "./board.tsx";

/*
 * "By unit" view of the Lineup: one row per unit on the same chapter board as the slot view. A tinted bar where
 * the unit deploys, a dashed bar where it waits on the bench, nothing before it joins.
 */

type State = "deploy" | "bench";

const ORDER: DeployStatus[] = ["core", "early", "late", "bench"];

function Bar({ state, span, name, when = "" }: { state: State; span: number; name: string; when?: string }) {
  const c = char(name);
  return state === "deploy"
    ? (
      <span
        style={routeVars(c?.homeRoute)}
        title={`${name}${when}: deploys`}
        className="mx-[3px] block h-[18px] flex-1 rounded-full bg-[color-mix(in_srgb,var(--c)_30%,var(--color-card))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c)_45%,transparent)]"
      />
    )
    : (
      <span
        title={`${name}${when}: bench`}
        className="mx-[3px] flex h-[18px] flex-1 items-center justify-center rounded-full border border-dashed border-gold/70 bg-card text-[11px] text-muted"
      >
        {span >= 2 && "bench"}
      </span>
    );
}

function Part2Cell({ on, name }: { on: boolean; name: string }) {
  return <Bar state={on ? "deploy" : "bench"} span={1} name={name} when=", Part II" />;
}

/** Units × chapters: when each unit deploys, sits on the bench or hasn't joined yet. */
export function DeployGrid({ r }: { r: RouteName }) {
  const d = META.routes[r].deployment;
  const now = nowChapter(r, useTrack());
  if (!d?.phases.length) return null;
  const units = [...routeUnits(r)].sort((a, b) =>
    (ORDER.indexOf(a.status ?? "bench") - ORDER.indexOf(b.status ?? "bench")) || a.join - b.join
  );
  const part2 = new Set(d.part2?.core ?? []);
  const segsOf = (u: UnitPlan): Seg[] => {
    const out: { from: number; to: number; state: State }[] = [];
    for (const p of d.phases) {
      const pr = phaseRange(p);
      if (!pr || u.join > pr[1]) continue;
      const state: State = p.deploy.includes(u.name) ? "deploy" : "bench";
      const from = Math.max(pr[0], u.join);
      const last = out.at(-1);
      if (last && last.state === state && last.to === from - 1) last.to = pr[1];
      else out.push({ from, to: pr[1], state });
    }
    return out.map((x) => ({
      key: `${x.from}`,
      from: x.from,
      to: x.to,
      node: <Bar state={x.state} span={x.to - x.from + 1} name={u.name} />,
    }));
  };
  const rows: BoardRow[] = [];
  let group: DeployStatus | undefined;
  for (const u of units) {
    const st = u.status ?? "bench";
    if (st !== group) {
      group = st;
      rows.push({
        kind: "group",
        key: `g${st}`,
        label: (
          <>
            {STATUS_LABEL[st]}
            <span className="font-normal tracking-normal text-muted normal-case">{STATUS_HINT[st]}</span>
          </>
        ),
      });
    }
    const c = char(u.name);
    rows.push({
      kind: "row",
      key: u.name,
      head: (
        <a href={personHref(u.name, r)} className="flex min-w-0 items-center gap-2 hover:underline">
          <Medal name={u.name} route={c?.homeRoute} size={26} ring="var(--color-card)" />
          <span className="min-w-0 truncate text-[13.5px] font-semibold">{u.name}</span>
        </a>
      ),
      segs: segsOf(u),
      part2: part2.size > 0 ? <Part2Cell on={part2.has(u.name)} name={u.name} /> : undefined,
    });
  }
  return (
    <>
      <Board
        label="Unit"
        phases={d.phases}
        now={now}
        rows={rows}
        part2={part2.size > 0 ? { label: "Part II", sub: `up to ${META.part2Cap}`, note: d.part2?.note } : undefined}
      />
      <p className="mt-2 mb-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="block h-2.5 w-6 rounded-full bg-ink/12 shadow-[inset_0_0_0_1px_rgba(16,38,42,.25)]" />
          deploys (bar colour: the unit's home route)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block h-2.5 w-6 rounded-full border border-dashed border-gold/70" />
          bench
        </span>
        <span>empty: not joined yet. Hover a phase for its note.</span>
      </p>
    </>
  );
}
