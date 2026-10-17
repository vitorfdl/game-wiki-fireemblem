import { Fragment, type ReactNode } from "react";
import { Check, ChevronRight, Clock, PawPrint, Users } from "lucide-react";
import { CLASSES, char, deployStatus, fillers, META, partnersInArmy } from "../../lib/data.ts";
import { ids } from "../../lib/chapter.ts";
import { mountOf } from "../../lib/growth.ts";
import { hasStable } from "../../lib/mounts.ts";
import { resolve } from "../../lib/refs.ts";
import { type PlannedStage, routeUnits, type UnitPlan } from "../../lib/walkthrough/builds.ts";
import type { Filler, RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { useTrack } from "../../lib/track.ts";
import { Hover } from "../ui/hover.tsx";
import { Medal } from "../ui/medal.tsx";
import { Panel } from "../ui/panel.tsx";
import { renderCard } from "../ref/cards.tsx";
import { useScope } from "../ref/ctx.ts";
import { RefChip, UnitRef } from "../ref/rich.tsx";
import { type Badge, personHref } from "./bits.tsx";
import { stripConf } from "../ui/conf-text.tsx";
import { STATUS_BORDER, STATUS_NAME } from "../ui/status-border.ts";

/* ------------------------------------------------------------ class path */

type PathChip = {
  cls: string;
  start: number | null;
  goal?: boolean;
  detour?: boolean;
  later?: string;
  goalText?: string;
  /** The stage names no class ("The Specialty class he joins in"): shown as a muted note, not a chip. */
  unknown?: boolean;
};

const valid = (cls: string) => Boolean(cls) && !/^starting class|not documented/i.test(cls);

/** A real class name ("Commoner" is stored as "Commoner/Noble"). */
const isClass = (cls: string) =>
  Boolean(CLASSES[cls] || resolve(cls, "class") || Object.keys(CLASSES).some((k) => k.split("/").includes(cls)));

const KNOWN = Object.keys(CLASSES).filter((k) => !k.includes("(")).sort((a, b) => b.length - a.length);

/** A stage whose class line is a sentence ("Specialty class on join; Wing Soldier exam ...") shows the first class it names. */
function className(ps: PlannedStage): string {
  if (CLASSES[ps.cls]) return ps.cls;
  const raw = ps.stage.class ?? "";
  let best: { at: number; k: string } | null = null;
  for (const k of KNOWN) {
    const at = raw.indexOf(k);
    if (at >= 0 && (!best || at < best.at)) best = { at, k };
  }
  return best?.k ?? ps.cls;
}

/** Part I classes in order (consecutive repeats merged), the Part I goal marked, and the final Part II/III class. */
export function classPath(stages: PlannedStage[]): PathChip[] {
  const p1: PathChip[] = [];
  for (const s of stages) {
    if (s.start === null || !valid(s.cls)) continue;
    const cls = className(s);
    const last = p1.at(-1);
    if (last && last.cls === cls) continue;
    p1.push({ cls, start: s.start, detour: s.stage.kind === "detour", goalText: s.stage.goal, unknown: !isClass(cls) });
  }
  const goal = [...p1].reverse().find((c) => !c.detour && !c.unknown) ?? p1.find((c) => !c.unknown);
  if (goal) goal.goal = true;
  const later = [...stages].reverse().find((s) => s.start === null && valid(s.cls));
  if (later && className(later) !== goal?.cls) {
    p1.push({
      cls: className(later),
      start: null,
      later: later.stage.from?.part === 3 ? "Part III" : "Part II",
      goalText: later.stage.goal,
    });
  }
  return p1;
}

/** Last mount the Part I plan rides, for routes with a Stable. */
function partOneMount(stages: PlannedStage[]): string | null {
  let m: string | null = null;
  for (const s of stages) {
    if (s.start === null) continue;
    const x: string | undefined = mountOf(s.stage.mount, m)?.split(";")[0].trim();
    m = x && !/^none/i.test(x) ? x : m;
  }
  return m;
}

/* ------------------------------------------------------------ chips */

/** A class on the path as a chip with the class hover card. Goal filled, side trips dashed, Part II/III badged. */
function ClassChip({ c }: { c: PathChip }) {
  const scope = useScope();
  if (c.unknown) {
    return <span className="text-[12.5px] whitespace-nowrap text-muted italic" title={c.cls}>joins already classed</span>;
  }
  const ref = resolve(c.cls, "class");
  const pill = (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-px text-[12.5px] leading-[1.5] whitespace-nowrap",
        c.goal
          ? "bg-(--c) font-semibold text-white shadow-[0_1px_2px_-1px_rgba(0,0,0,.4)]"
          : c.detour
          ? "border border-dashed border-gold/80 text-muted italic"
          : c.later
          ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_rgba(16,38,42,.22)]"
          : "bg-card text-ink-soft shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]",
      )}
    >
      {c.later && (
        <span className="-ml-1 rounded-full bg-teal px-1.5 font-display text-[10.5px] leading-[1.35] font-bold tracking-[0.06em] text-gold-hi not-italic">
          {c.later === "Part III" ? "III" : "II"}
        </span>
      )}
      {c.cls}
    </span>
  );
  if (!ref) return <span title={c.goalText}>{pill}</span>;
  return (
    <Hover label={c.cls} card={() => renderCard("class", ref.name, scope)} className="inline-flex">
      {pill}
    </Hover>
  );
}

function MountChip({ name }: { name: string }) {
  const scope = useScope();
  const ref = resolve(name, "mount");
  const pill = (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-px text-[12px] leading-[1.5] whitespace-nowrap text-ink-soft">
      <PawPrint aria-hidden="true" className="size-3 text-gold-lo" />
      {name}
    </span>
  );
  return ref
    ? <Hover label={name} card={() => renderCard("mount", ref.name, scope)} className="inline-flex">{pill}</Hover>
    : pill;
}

function PathChips({ chips, mount }: { chips: PathChip[]; mount?: string | null }) {
  if (!chips.length) return <span className="text-[13px] text-faint">No class plan yet</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-0.5 gap-y-1">
      {chips.map((c, i) => (
        <Fragment key={`${c.cls}-${i}`}>
          {i > 0 && (
            <ChevronRight
              aria-hidden="true"
              className={cx("size-3.5 shrink-0", c.later ? "ml-1 text-gold/60" : "text-faint")}
              strokeWidth={2.5}
            />
          )}
          <ClassChip c={c} />
        </Fragment>
      ))}
      {mount && <span className="ml-2"><MountChip name={mount} /></span>}
    </span>
  );
}

function RoleCell({ role }: { role?: ReactNode }) {
  if (!role) return <span className="text-faint">–</span>;
  return <span className="min-w-0 text-[13.5px] leading-snug text-ink-soft">{role}</span>;
}

const ROW_TONE = STATUS_BORDER;
const TONE_LABEL = STATUS_NAME;

/* ------------------------------------------------------------ rows */

type Row = {
  name: string;
  join: number;
  role?: ReactNode;
  status: Badge;
  path: ReactNode;
  why?: string;
  /** Recruit tick: units that need recruiting (not the lord, not auto joins). */
  tracked: boolean;
};

const GRID = "@2xl:grid-cols-[minmax(0,11rem)_minmax(0,1.15fr)_minmax(0,1.85fr)]";

function MusterRow({ row, route }: { row: Row; route: RouteName }) {
  const t = useTrack();
  const c = char(row.name);
  if (!c) return null;
  const recruited = row.tracked && Boolean(t.done[ids.recruit(route, row.name)]);
  const tone = String(row.status);
  return (
    <li
      title={`${TONE_LABEL[tone] ?? tone}${row.why ? `: ${stripConf(row.why)}` : ""}`}
      className={cx("grid items-center gap-x-4 gap-y-1 border-l-[3px] py-1 pr-2 pl-2.5 shadow-[inset_0_1px_0_rgba(176,144,90,.15)]", GRID, ROW_TONE[tone])}
    >
      <span className="flex min-w-0 items-center gap-2">
        <a href={personHref(row.name, route)} className="shrink-0" tabIndex={-1} aria-hidden="true">
          <Medal name={row.name} route={c.homeRoute} size={28} ring="var(--color-card)" />
        </a>
        <span className="min-w-0 truncate text-[14.5px]"><UnitRef name={row.name} avatar={false} /></span>
        {recruited && <Check aria-label="Recruited" className="size-3.5 shrink-0 text-(--c)" strokeWidth={3} />}
      </span>
      <span className="min-w-0 pl-9 @2xl:pl-0"><RoleCell role={row.role} /></span>
      <span className="flex min-w-0 items-center pl-9 @2xl:pl-0">{row.path}</span>
    </li>
  );
}

function unitRow(u: UnitPlan, route: RouteName): Row {
  const c = u.character;
  const dep = deployStatus(u.name, route);
  const copy = u.extra ? c.copies?.find((x) => x.route === route) : undefined;
  const how = c.recruitOn?.[route]?.how;
  return {
    name: u.name,
    join: u.join,
    role: dep?.role ?? copy?.role ?? c.guide?.role ?? c.build?.role,
    status: dep?.status ?? (u.extra ? "extra" : "bench"),
    path: <PathChips chips={classPath(u.stages)} mount={hasStable(route) ? partOneMount(u.stages) : null} />,
    why: [dep?.why, copy?.why].filter(Boolean).join(" ") || undefined,
    tracked: !u.lord && how === "recruit",
  };
}

function fillerRow(f: Filler, route: RouteName): Row | null {
  const c = char(f.name);
  if (!c) return null;
  const partners = partnersInArmy(c, route);
  const item = f.item?.replace(/\?$/, "");
  const ref = item ? resolve(item, "item") : undefined;
  return {
    name: f.name,
    join: Number(f.when.match(/Ch (\d+)/)?.[1] ?? 12),
    role: f.kind === "items"
      ? (
        <>
          Brings {ref ? <RefChip r={ref} /> : item}
          {f.item?.endsWith("?") && "?"}
        </>
      )
      : partners.length ? "Supports filler" : "Part III body",
    status: "filler",
    path: f.kind === "items" || !partners.length
      ? (
        <span className="flex items-start gap-1.5 text-[13.5px] leading-snug text-ink-soft">
          <Clock aria-hidden="true" className="mt-[3px] size-3.5 shrink-0 text-gold-lo" />
          <span>Recruit {f.when.replace(/^(Ch|When|By)\b/, (m) => m === "Ch" ? "in Ch" : m.toLowerCase())}</span>
        </span>
      )
      : (
        <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink-soft">
          Supports with
          <span className="flex flex-wrap items-center gap-1">
            {partners.map((n) => (
              <a key={n} href={personHref(n, route)} title={n} className="transition-transform hover:-translate-y-0.5">
                <Medal flat name={n} route={char(n)?.homeRoute} size={22} />
              </a>
            ))}
          </span>
        </span>
      ),
    why: `${f.when}. ${f.why}`,
    tracked: c.recruitOn?.[route]?.how === "recruit",
  };
}

function Group({ children }: { children: ReactNode }) {
  return (
    <li className="pt-3 pb-1 text-[11.5px] font-semibold tracking-[0.08em] text-gold-lo uppercase first:pt-1">
      {children}
    </li>
  );
}

/** The whole army in join order, grouped by chapter, then units also recruitable elsewhere and fillers (V-4). */
export function Muster({ r }: { r: RouteName }) {
  const info = META.routes[r];
  // Second copies that hold a lineup slot fight in Part I: they sit with the army, by join chapter.
  const fights = new Set([
    ...(info.deployment?.lineup ?? []).flatMap((s) => s.holders.map((h) => h.unit)),
    ...(info.deployment?.phases ?? []).flatMap((p) => p.deploy),
  ]);
  const units = routeUnits(r).filter((u) => !u.extra || fights.has(u.name));
  const extras = routeUnits(r).filter((u) => u.extra && !fights.has(u.name));
  const fill = fillers(r).map((f) => fillerRow(f, r)).filter((x): x is Row => Boolean(x)).sort((a, b) => a.join - b.join);
  const by = new Map<number, UnitPlan[]>();
  for (const u of units) by.set(u.join, [...(by.get(u.join) ?? []), u]);
  return (
    <Panel
      id="muster"
      icon={<Users />}
      title="Muster"
      sub={`${units.length} units by join chapter, ${extras.length} also recruitable elsewhere, ${fill.length} fillers`}
      bodyClassName="@container"
      aside={
        <span className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
          {(["core", "bench", "extra", "filler"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={cx("inline-block h-3.5 w-0 border-l-[3px]", ROW_TONE[k])} />
              {TONE_LABEL[k]}
            </span>
          ))}
        </span>
      }
    >
      <div
        className={cx(
          "hidden gap-x-4 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase @2xl:grid",
          GRID,
        )}
      >
        <span>Unit</span>
        <span>Role</span>
        <span>Class path</span>
      </div>
      <ul className="m-0 list-none p-0">
        {[...by.entries()].sort((a, b) => a[0] - b[0]).map(([ch, list]) => {
          const meta = info.chapters[String(ch)] ?? {};
          return (
            <Fragment key={ch}>
              <Group>
                Ch {ch}
                {meta.title && ` · ${meta.title}`}
                {meta.free && <span className="ml-2 font-normal tracking-normal text-muted normal-case">free time {meta.free}</span>}
              </Group>
              {list.map((u) => <MusterRow key={u.name} row={unitRow(u, r)} route={r} />)}
            </Fragment>
          );
        })}
        {extras.length > 0 && (
          <>
            <Group>Also recruitable on other routes (merge in Part III)</Group>
            {extras.map((u) => <MusterRow key={u.name} row={unitRow(u, r)} route={r} />)}
          </>
        )}
        {fill.length > 0 && (
          <>
            <Group>Fillers · bench only, for an item or supports</Group>
            {fill.map((row) => <MusterRow key={row.name} row={row} route={r} />)}
          </>
        )}
      </ul>
      <p className="mt-1.5 mb-0 text-[12.5px] text-muted">
        Hover a row for its status and why. Recruit gates and deadlines: the Ledger (L) and each chapter's Recruits slot.
      </p>
    </Panel>
  );
}
