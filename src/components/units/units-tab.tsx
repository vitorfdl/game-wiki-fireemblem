import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Clock, TriangleAlert } from "lucide-react";
import { routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { routeVars } from "../../lib/route-style.ts";
import { chapterFile, examsFor, exitText, ids } from "../../lib/chapter.ts";
import { activeStage, routeUnits, stageLabel, type UnitPlan } from "../../lib/walkthrough/builds.ts";
import { inventory, kitRows } from "../../lib/inventory.ts";
import { saveUnitView, type TrackState, useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Medal } from "../ui/medal.tsx";
import { PART_HOME, pos, posLabel, SQUAD_TONE } from "../../lib/parts.ts";
import { licenseRows, p3BuildHref, p3Plan, p3Roster, salvationArmy, squadSection } from "../../lib/part-army.ts";
import { pids } from "../../lib/part-plan.ts";
import { InventoryMeter } from "../ui/kit-type.tsx";
import { GearRow, KindPill } from "../walkthrough/stage-bits.tsx";
import { Rich, UnitRef } from "../ref/rich.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { Tick } from "../chapter/bits.tsx";
import { TierBadge } from "../dossier/journey.tsx";
import { classKey, classLabel, isClass } from "../ui/class-chip.tsx";
import { Gate, Gold } from "../walkthrough/inline.tsx";
import { GrowthCheckLines } from "../dossier/growth-checks.tsx";

/* Field Kit "Units" tab (redesign/02-templates.md §4): unit-first, chapter-aware, with a Watch list. */

/** The last stage the player has ticked as reached, if any. */
function reached(route: RouteName, u: UnitPlan, t: TrackState): number {
  let hit = -1;
  u.stages.forEach((ps, i) => {
    if (t.done[ids.exam(route, u.name, ps.cls, i)]) hit = i;
  });
  return hit;
}

type Warn = { unit: string; text: string; tone: "late" | "soon" };

function watchList(route: RouteName, ch: number, t: TrackState): Warn[] {
  const out: Warn[] = [];
  for (const back of [ch - 2, ch - 1]) {
    if (back < 1) continue;
    for (const e of examsFor(route, back)) {
      if (!e.onJoin && !t.done[e.id]) {
        out.push({ unit: e.unit.name, text: `${e.to} was planned for ${posLabel(back)}`, tone: "late" });
      }
    }
    for (const r of chapterFile(route, back)?.recruits ?? []) {
      if (!t.done[ids.recruit(route, r.unit)]) {
        out.push({ unit: r.unit, text: `recruit was planned for Ch ${back}`, tone: "late" });
      }
    }
  }
  for (const u of routeUnits(route)) {
    for (const g of u.character.guide?.gates ?? []) {
      if (g.route && g.route !== route) continue;
      const from = g.from.part === 1 ? g.from.ch ?? 1 : 99;
      if (from <= ch + 2 && from >= ch - 1) out.push({ unit: u.name, text: g.text, tone: "soon" });
    }
  }
  return out;
}

function Journey({ u, ch, mine }: { u: UnitPlan; ch: number; mine: number }) {
  const now = activeStage(u, Math.max(ch, u.join));
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
      {u.stages.map((ps, i) => {
        const isNow = ps === now;
        const done = i <= mine;
        return (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className="h-px w-2 bg-gold/60" />}
            <span
              title={`${ps.stage.when}${ps.stage.level ? ` · ${ps.stage.level}` : ""}`}
              className={cx(
                "inline-flex flex-col rounded-md px-1.5 py-0.5 text-[11.5px] leading-tight",
                isNow
                  ? "bg-(--c) text-white"
                  : done
                  ? "bg-paper-2 text-ink"
                  : "bg-card text-ink-soft shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]",
                ps.stage.kind === "detour" && !isNow && "border border-dashed border-(--c)",
              )}
            >
              <b className="flex items-center gap-1 text-[12px]">
                {done
                  ? <Check className="size-3" />
                  : isClass(ps.cls) && (
                    <TierBadge cls={classKey(ps.cls)!} size={14} side={ps.stage.kind === "detour"} />
                  )}
                {classLabel(ps.cls)}
              </b>
              <span className="opacity-80">{stageLabel(ps)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function UnitDetail({ route, u, ch, build }: { route: RouteName; u: UnitPlan; ch: number; build?: string }) {
  const t = useTrack();
  const mine = reached(route, u, t);
  const ps = activeStage(u, Math.max(ch, u.join));
  const idx = ps ? u.stages.indexOf(ps) : -1;
  const next = idx >= 0 ? u.stages[idx + 1] : u.stages[0];
  const kit = ps ? kitRows(ps.stage) : [];
  const gate = u.character.recruitOn?.[route];
  const recruitId = ids.recruit(route, u.name);
  return (
    <div className="animate-rise mt-2 space-y-2 pl-1 text-[13.5px]">
      {!u.lord && gate?.how === "recruit" && ch <= 12 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-paper/70 px-2 py-1.5">
          <Tick id={recruitId} label={`${u.name} recruited`} />
          <span className={cx("font-semibold", !t.done[recruitId] && "text-ink-soft")}>Recruited</span>
          <span className="flex flex-wrap items-center gap-1">
            {gate.support !== undefined && <Gate kind="S" n={gate.support} />}
            {gate.renown !== undefined && <Gate kind="R" n={gate.renown} />}
            {gate.gold !== undefined && <Gold amount={`${gate.gold.toLocaleString("en-US")}G`} />}
            {gate.item && <span className="text-[12.5px] text-muted">{gate.item}</span>}
          </span>
          {gate.task && <span className="w-full pl-6 text-[12.5px] leading-snug text-muted">{gate.task}</span>}
        </div>
      )}
      <Journey u={u} ch={ch} mine={mine} />
      {mine >= 0 && ps && u.stages[mine] !== ps && (
        <p className="m-0 rounded bg-warn px-2 py-1 text-[#5b2a1c]">
          Plan for {posLabel(ch)}: <b>{classLabel(ps.cls)}</b>. You ticked <b>{classLabel(u.stages[mine].cls)}</b> last.
        </p>
      )}
      {ps && (
        <div className="rounded-md bg-paper/70 p-2">
          <div className="flex items-center gap-2">
            <span className="label text-[10.5px] text-gold-lo">Now</span>
            <b className="text-[14.5px]">{classLabel(ps.cls)}</b>
            {ps.stage.kind && ps.stage.kind !== "core" && <KindPill kind={ps.stage.kind} />}
            {ps.stage.level && <span className="text-muted">{ps.stage.level}</span>}
          </div>
          {ps.stage.goal && (
            <p className="mt-1 mb-0 leading-snug">
              <Rich text={ps.stage.goal} k="g" />
            </p>
          )}
          {exitText(ps.stage.exit) && (
            <p className="mt-1 mb-0 leading-snug">
              <span className="label mr-1 text-[10.5px] text-gold-lo">Leave when</span>
              {exitText(ps.stage.exit)}
            </p>
          )}
          {ps.stage.training?.length
            ? (
              <p className="mt-1 mb-0">
                <span className="label mr-1 text-[10.5px] text-gold-lo">Train</span>
                {ps.stage.training.map((x) => x.rank).join(", ")}
              </p>
            )
            : null}
          {ps.stage.checks?.length
            ? (
              <div className="mt-1">
                <span className="label text-[10.5px] text-gold-lo">Growth checks</span>
                <GrowthCheckLines checks={ps.stage.checks} />
              </div>
            )
            : null}
          <div className="mt-1">
            <InventoryMeter {...inventory(ps.stage)} />
          </div>
          <ul className="m-0 list-none p-0">
            {kit.map((x) => <GearRow key={x.g.item} g={x.g} kind={x.kind} showWhere={false} />)}
          </ul>
        </div>
      )}
      {next && (
        <div className="rounded-md p-2 shadow-[inset_0_0_0_1px_rgba(176,144,90,.4)]">
          <span className="label mr-2 text-[10.5px] text-gold-lo">Next</span>
          <b>{classLabel(next.cls)}</b> <span className="text-muted">· {stageLabel(next)}</span>
          {next.stage.goal && (
            <p className="mt-1 mb-0 leading-snug text-ink-soft">
              <Rich text={next.stage.goal} k="ng" />
            </p>
          )}
        </div>
      )}
      <a
        href={build ?? href(routeSlug(route), u.character.slug)}
        onClick={() => saveUnitView(route, u.name, { stage: idx >= 0 ? idx : undefined })}
        className="inline-flex items-center gap-1 font-semibold text-(--c) hover:underline"
      >
        Full build <ArrowRight className="size-4" />
      </a>
    </div>
  );
}

/** A unit to open and scroll to (a click on a unit name in the walkthrough). `nonce` repeats the same unit. */
export type UnitFocus = { name: string; nonce: number };

export function UnitsTab({ route, chapter, focus }: { route: RouteName; chapter: number; focus?: UnitFocus | null }) {
  if (chapter > 18) return <SalvationUnits n={chapter - 18} focus={focus} />;
  return <RouteUnits route={route} chapter={chapter} focus={focus} />;
}

function RouteUnits({ route, chapter, focus }: { route: RouteName; chapter: number; focus?: UnitFocus | null }) {
  const t = useTrack();
  const [open, setOpen] = useState<string | null>(focus?.name ?? null);
  const [flash, setFlash] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!focus) return;
    setOpen(focus.name);
    setFlash(focus.name);
    const id = requestAnimationFrame(() => {
      const el = list.current?.querySelector<HTMLElement>(`[data-unit="${CSS.escape(focus.name)}"]`);
      const box = el?.closest<HTMLElement>("[data-kit-scroll]");
      if (el && box) {
        box.scrollTop = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
      }
    });
    const off = setTimeout(() => setFlash(null), 1600);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(off);
    };
  }, [focus?.nonce]);
  const units = routeUnits(route);
  const warns = watchList(route, chapter, t);
  return (
    <RouteCtx.Provider value={route}>
      <div className="mb-2 text-[13px] text-muted">
        Showing <b className="text-ink">{posLabel(chapter)}</b>. It follows the {chapter > 18 ? "Section" : "chapter"}
        {" "}
        you're reading.
      </div>
      <Watch warns={warns} />
      <ul ref={list} className="m-0 grid list-none gap-1.5 p-0">
        {units.map((u) => {
          const ps = activeStage(u, chapter);
          const on = open === u.name;
          const how = u.character.recruitOn?.[route]?.how;
          const recruited = chapter > 12 || u.lord || how === "auto" || how === "lord" ||
            Boolean(t.done[ids.recruit(route, u.name)]);
          const mine = reached(route, u, t);
          return (
            <li
              key={u.name}
              data-unit={u.name}
              style={routeVars(u.character.homeRoute)}
              className={cx(
                "rounded-md border border-gold/40 bg-card px-2.5 py-1.5 shadow-[inset_3px_0_0_var(--c)] transition-[background-color,box-shadow] duration-700",
                on && "border-gold/70 bg-paper/40",
                flash === u.name && "bg-(--c)/10 shadow-[inset_3px_0_0_var(--c)]",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(on ? null : u.name)}
                aria-expanded={on}
                className={cx("flex w-full items-center gap-2.5 text-left", !ps && "opacity-60")}
              >
                <Medal flat name={u.name} route={u.character.homeRoute} size={30} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[12.5px] text-muted">
                    {u.name}
                    {u.extra && " · 2nd copy"}
                    {u.status === "bench" && " · bench"}
                    {!ps && ` · joins ${u.estimate ? "~" : ""}Ch ${u.join}`}
                    {ps && !u.lord && !recruited && u.join <= chapter && (
                      <span className="text-blood-2">· not ticked as recruited</span>
                    )}
                  </span>
                  <span className="block truncate text-[15px] font-semibold">
                    {classLabel(ps?.cls ?? u.stages[0]?.cls)}
                    {mine >= 0 && ps && u.stages[mine] !== ps && (
                      <span className="ml-1 text-[12px] font-semibold text-warn-ink">
                        (you: {classLabel(u.stages[mine].cls)})
                      </span>
                    )}
                  </span>
                </span>
                {ps?.stage.kind && ps.stage.kind !== "core" && <KindPill kind={ps.stage.kind} />}
                <ChevronDown
                  aria-hidden="true"
                  className={cx("size-4 text-muted transition-transform", on && "rotate-180")}
                />
              </button>
              {on && <UnitDetail route={route} u={u} ch={chapter} />}
            </li>
          );
        })}
      </ul>
    </RouteCtx.Provider>
  );
}

/** Opens and scrolls to the unit a walkthrough click asked for, with a short flash. */
function useFocus(focus: UnitFocus | null | undefined, list: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState<string | null>(focus?.name ?? null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!focus) return;
    setOpen(focus.name);
    setFlash(focus.name);
    const id = requestAnimationFrame(() => {
      const el = list.current?.querySelector<HTMLElement>(`[data-unit="${CSS.escape(focus.name)}"]`);
      const box = el?.closest<HTMLElement>("[data-kit-scroll]");
      if (el && box) {
        box.scrollTop = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
      }
    });
    const off = setTimeout(() => setFlash(null), 1600);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(off);
    };
  }, [focus?.nonce]);
  return { open, setOpen, flash };
}

/**
 * Units tab in Part III (D-122, D-145): the squads of the Section shown, every army, each unit's picked copy with its
 * class now and next. Units outside the squads and those the plan never lists fold into Bench.
 */
function SalvationUnits({ n, focus }: { n: number; focus?: UnitFocus | null }) {
  const t = useTrack();
  const list = useRef<HTMLDivElement>(null);
  const { open, setOpen, flash } = useFocus(focus, list);
  const groups = p3Roster(n);
  const squads = groups.filter((g) => g.squad);
  const bench = groups.filter((g) => !g.squad).flatMap((g) => g.names.map((name) => ({ name, none: g.muted })));
  const [showBench, setShowBench] = useState(false);
  useEffect(() => {
    if (focus && bench.some((b) => b.name === focus.name)) setShowBench(true);
  }, [focus?.nonce]);
  const shown = squadSection(n);
  const p = pos(3, n);
  // Behind plan: Master Licenses of earlier Sections not ticked as passed.
  const warns: Warn[] = licenseRows().filter((l) => l.n < n && !t.done[pids.license(PART_HOME, l.unit, l.to)]).map((
    l,
  ) => ({ unit: l.unit, text: `${l.to} License was planned for Section ${l.n}`, tone: "late" }));
  const row = (name: string, extra?: string) => {
    const x = p3Plan(name);
    if (!x) return null;
    const route = x.route ?? PART_HOME;
    const u = x.plan;
    const ps = activeStage(u, Math.max(p, u.join));
    const i = ps ? u.stages.indexOf(ps) : -1;
    const next = u.stages[i + 1];
    const on = open === name;
    // Where the unit comes from: the copy recruited (several routes), the army (one route), or a Part III joiner.
    const army = salvationArmy().find((a) => a.name === name);
    const copy = !x.route
      ? "Part III joiner"
      : army && army.copies.length > 1
      ? `${x.route}'s copy`
      : x.route !== PART_HOME && x.route !== name
      ? `${x.route}'s army`
      : undefined;
    return (
      <li
        key={name}
        data-unit={name}
        style={routeVars(u.character.homeRoute)}
        className={cx(
          "rounded-md border border-gold/40 bg-card px-2.5 py-1.5 shadow-[inset_3px_0_0_var(--c)] transition-[background-color,box-shadow] duration-700",
          on && "border-gold/70 bg-paper/40",
          flash === name && "bg-(--c)/10 shadow-[inset_3px_0_0_var(--c)]",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(on ? null : name)}
          aria-expanded={on}
          className="flex w-full items-center gap-2.5 text-left"
        >
          <Medal flat name={name} route={u.character.homeRoute} size={30} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[12.5px] text-muted">
              {[name, copy, extra].filter(Boolean).join(" · ")}
            </span>
            <span className="flex min-w-0 items-baseline gap-1.5">
              <b className="truncate text-[15px] font-semibold">{ps ? classLabel(ps.cls) : "No plan"}</b>
              {next && (
                <span className="truncate text-[12.5px] text-muted">
                  → {classLabel(next.cls)} · {posLabel(Math.max(next.pos, p))}
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cx("size-4 text-muted transition-transform", on && "rotate-180")}
          />
        </button>
        {on && <UnitDetail route={route} u={u} ch={p} build={p3BuildHref(name)} />}
      </li>
    );
  };
  return (
    <div ref={list}>
      <div className="mb-2 text-[13px] text-muted">
        Showing <b className="text-ink">Section {n}</b>
        {shown && shown !== n ? `, with the squads of Section ${shown}` : ""}. Every army, each unit's recruited copy.
        It follows the Section you're reading.
      </div>
      <Watch warns={warns} />
      {squads.map((g) => {
        const tone = SQUAD_TONE[g.squad!];
        return (
          <section key={g.key} className="mb-2.5">
            <h3
              className="m-0 mb-1 flex items-center gap-1.5 text-[12px] font-bold tracking-[0.06em] uppercase"
              style={{ color: tone?.bg }}
            >
              <span
                className="grid size-5 place-items-center rounded-[4px] font-logo text-[12px]"
                style={{ background: tone?.bg, color: tone?.fg }}
              >
                {g.squad}
              </span>
              {g.title.replace(/^Squad \w · /, "")}
              <span className="font-semibold text-muted">{g.names.length}</span>
            </h3>
            <ul className="m-0 grid list-none gap-1.5 p-0">{g.names.map((name) => row(name))}</ul>
          </section>
        );
      })}
      {bench.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowBench(!showBench)}
            aria-expanded={showBench}
            className="flex w-full items-center gap-1.5 rounded-md bg-paper-2/70 px-2 py-1.5 text-left text-[12px] font-bold tracking-[0.06em] text-ink-soft uppercase hover:bg-paper-2"
          >
            Bench <span className="font-semibold text-muted">{bench.length}</span>
            <span className="flex-1 text-[12px] font-normal tracking-normal text-muted normal-case">
              outside the squads this Section, or not in the Part III plan
            </span>
            <ChevronDown aria-hidden="true" className={cx("size-4 text-muted", showBench && "rotate-180")} />
          </button>
          {showBench && (
            <ul className="m-0 mt-1.5 grid list-none gap-1.5 p-0">
              {bench.map((b) => row(b.name, b.none ? "not in the plan" : "out"))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** Watch list (V-7: one signal): behind-plan items fold into one line when there are many, coming-up items stay. */
function Watch({ warns }: { warns: Warn[] }) {
  const [all, setAll] = useState(false);
  if (!warns.length) return null;
  const late = warns.filter((w) => w.tone === "late");
  const soon = warns.filter((w) => w.tone !== "late");
  const fold = late.length > 3 && !all;
  const Item = ({ w, i }: { w: Warn; i: number }) => (
    <li className="grid grid-cols-[16px_minmax(0,1fr)] gap-1.5 leading-snug">
      {w.tone === "late"
        ? <TriangleAlert className="mt-[3px] size-3.5 text-blood-2" aria-label="Behind plan" />
        : <Clock className="mt-[3px] size-3.5 text-faint" aria-label="Coming up" />}
      <span>
        <UnitRef name={w.unit} avatar={false} />: <Rich text={w.text} k={`w${i}`} />
      </span>
    </li>
  );
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">Watch</div>
      <ul className="m-0 list-none space-y-1 p-0 text-[13.5px]">
        {fold
          ? (
            <li className="grid grid-cols-[16px_minmax(0,1fr)] gap-1.5 leading-snug">
              <TriangleAlert className="mt-[3px] size-3.5 text-blood-2" aria-label="Behind plan" />
              <span>
                {late.length} planned steps not ticked yet: {[...new Set(late.map((w) => w.unit))].join(", ")}.{" "}
                <button
                  type="button"
                  onClick={() => setAll(true)}
                  className="font-semibold text-gold-lo hover:text-ink"
                >
                  Show
                </button>
              </span>
            </li>
          )
          : late.map((w, i) => <Item key={`l${i}`} w={w} i={i} />)}
        {soon.slice(0, 6).map((w, i) => <Item key={`s${i}`} w={w} i={i + 100} />)}
      </ul>
    </div>
  );
}
