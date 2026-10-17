import { useState } from "react";
import { ArrowRight, Backpack, GraduationCap, UserPlus } from "lucide-react";
import { char } from "../../lib/data.ts";
import { classKey, isClass } from "../ui/class-chip.tsx";
import { TierBadge } from "../dossier/journey.tsx";
import { routeVars } from "../../lib/route-style.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { type Checkpoint, checkpoints, joiners, type PlannedStage } from "../../lib/walkthrough/builds.ts";
import { Medal } from "../ui/medal.tsx";
import { Requirement } from "./char-card.tsx";
import { useWalk } from "./ctx.ts";
import { GearRow, KindPill } from "./stage-bits.tsx";
import { Panel } from "../ui/panel.tsx";

function Detail({ cp }: { cp: Checkpoint }) {
  return (
    <div className="animate-rise mt-3 rounded-md bg-paper/70 p-3 text-[14.5px] shadow-[inset_3px_0_0_var(--c)]">
      {cp.stages.map((ps, i) => <StageInfo key={i} ps={ps} titled={cp.stages.length > 1} />)}
      {cp.gear.length > 0 && (
        <>
          <div className="mt-3 flex items-center gap-1.5 label text-gold-lo">
            <Backpack aria-hidden="true" className="size-3.5" />Get and equip
          </div>
          <ul className="m-0 mt-1 list-none p-0">
            {cp.gear.map((x) => <GearRow key={`${x.kind}${x.g.item}`} g={x.g} change={x.change} kind={x.kind} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function StageInfo({ ps, titled }: { ps: PlannedStage; titled: boolean }) {
  const st = ps.stage;
  return (
    <div className={cx(titled && "mb-3 last-of-type:mb-0")}>
      {titled && <div className="mb-0.5 text-[13px] font-bold text-(--c)">{isClass(ps.cls) ? ps.cls : "Class on join"}</div>}
      {st.goal && <p className="m-0 font-semibold leading-snug">{st.goal}</p>}
      <dl className="m-0 mt-2 grid gap-x-3 gap-y-1.5 text-[13.5px] sm:grid-cols-[auto_1fr]">
        {st.level && (
          <>
            <dt className="label text-gold-lo">Level</dt>
            <dd className="m-0">{st.level}</dd>
          </>
        )}
        {st.mount && (
          <>
            <dt className="label text-gold-lo">Mount</dt>
            <dd className="m-0">{st.mount}</dd>
          </>
        )}
        {st.masteries?.length
          ? (
            <>
              <dt className="label text-gold-lo">Master</dt>
              <dd className="m-0">{st.masteries.join(", ")}</dd>
            </>
          )
          : null}
        {st.exit && (
          <>
            <dt className="label text-gold-lo">Move on</dt>
            <dd className="m-0">{st.exit}</dd>
          </>
        )}
        {st.training?.length
          ? (
            <>
              <dt className="label text-gold-lo">Train</dt>
              <dd className="m-0 grid gap-1">
                {st.training.map((t) => (
                  <span key={t.rank} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="rounded-[3px] bg-(--c) px-1.5 text-[12.5px] font-bold whitespace-nowrap text-white">
                      {t.rank}
                    </span>
                    {t.for && <span className="text-ink-soft">{`for ${t.for}`}</span>}
                  </span>
                ))}
              </dd>
            </>
          )
          : null}
      </dl>
    </div>
  );
}

/**
 * One compact strip per chapter: every unit that joins or changes class here. A green plus marks a new
 * arrival (with its Support and Renown gate); the arrow line is the class to take and the bag counts new gear.
 */
export function ChapterBuilds({ route, chapter }: { route: RouteName; chapter: number }) {
  const { focusUnit } = useWalk();
  const [open, setOpen] = useState<string | null>(null);
  const cps = checkpoints(route, chapter);
  const joins = joiners(route, chapter);
  const names = [...new Set([...joins.map((u) => u.name), ...cps.map((cp) => cp.unit.name)])];
  if (!names.length) return null;
  const current = cps.find((cp) => cp.unit.name === open);
  return (
    <Panel
      icon={<GraduationCap />}
      title="Army this chapter"
      sub="joins and class changes, from the unit plans"
      aside={<span className="flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
        <span className="flex items-center gap-1">
          <UserPlus aria-hidden="true" className="size-3.5 text-(--c)" />joins
        </span>
        <span className="flex items-center gap-1">
          <ArrowRight aria-hidden="true" className="size-3.5 text-(--c)" />class to take
        </span>
        <span className="flex items-center gap-1">
          <Backpack aria-hidden="true" className="size-3.5" />new gear
        </span>
      </span>}
    >
      <div className="flex flex-wrap gap-2">
        {names.map((name) => {
          const join = joins.find((u) => u.name === name);
          const cp = cps.find((x) => x.unit.name === name);
          const unit = join ?? cp!.unit;
          const c = char(name);
          const on = open === name;
          const last = cp?.stages[cp.stages.length - 1];
          return (
            <button
              key={name}
              type="button"
              aria-expanded={cp ? on : undefined}
              onClick={() => (cp ? setOpen(on ? null : name) : focusUnit(name))}
              style={routeVars(c?.homeRoute)}
              className={cx(
                "flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-left transition-colors",
                on ? "bg-(--c2) shadow-[inset_0_0_0_1.5px_var(--c)]" : "bg-paper/80 hover:bg-paper-2",
              )}
            >
              <span className="relative">
                <Medal name={name} route={c?.homeRoute} size={38} ring="var(--color-card)" />
                {join && (
                  <span
                    title="Joins this chapter"
                    className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-(--c) text-white shadow-[0_0_0_2px_var(--color-card)]"
                  >
                    <UserPlus aria-hidden="true" className="size-3" />
                  </span>
                )}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                  {join?.estimate && <span title="Estimated chapter">~</span>}
                  {name}
                  {join && (join.extra
                    ? <span className="text-[10.5px] font-bold tracking-[0.06em] text-gold-lo uppercase">Extra</span>
                    : <Requirement text={c?.requirements?.[route]} />)}
                </span>
                {cp
                  ? (
                    <span className="flex items-center gap-1 text-[14px] font-bold">
                      {cp.stages.map((ps, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          {i > 0 && <ArrowRight aria-hidden="true" className="size-3.5 text-faint" />}
                          {isClass(ps.cls)
                            ? <TierBadge cls={classKey(ps.cls)!} size={17} side={ps.stage.kind === "detour"} />
                            : <ArrowRight aria-hidden="true" className="size-3.5 text-(--c)" />}
                          {isClass(ps.cls) ? ps.cls : <span className="font-normal text-muted italic">class on join</span>}
                        </span>
                      ))}
                    </span>
                  )
                  : (
                    <span className="text-[13px] font-semibold text-ink-soft">
                      {unit.status === "bench" ? "Bench" : "Joins"}
                    </span>
                  )}
              </span>
              {last?.stage.kind && last.stage.kind !== "core" && <KindPill kind={last.stage.kind} />}
              {cp && cp.gear.length > 0 && (
                <span className="flex items-center gap-0.5 text-[12px] font-bold text-gold-lo" title="New gear">
                  <Backpack aria-hidden="true" className="size-3.5" />
                  {cp.gear.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {current && (
        <div style={routeVars(char(current.unit.name)?.homeRoute)}>
          <Detail cp={current} />
        </div>
      )}
    </Panel>
  );
}
