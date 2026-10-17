import { Fragment, type ReactNode } from "react";
import { ArrowRight, Crown, Users } from "lucide-react";
import { char, META, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { notePart } from "../../lib/track.ts";
import { examsFor } from "../../lib/chapter.ts";
import { PART_HOME, pos, section, SQUAD_TONE, warChapter } from "../../lib/parts.ts";
import { squadsFile } from "../../lib/part-plan.ts";
import {
  classAt,
  deploysIn,
  notPlanned,
  type Origin,
  P3_END,
  salvationArmy,
  type SalvationUnit,
  squadOf,
  warArmy,
  warSeat,
  type WarUnit,
} from "../../lib/part-army.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { routeVars } from "../../lib/route-style.ts";
import { Panel } from "../ui/panel.tsx";
import { Portrait } from "../ui/portrait.tsx";
import { ClassChip, classLabel } from "../ui/class-chip.tsx";
import { Rich, UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { useWalk } from "../walkthrough/ctx.ts";
import { TierTag } from "../parts/shared.tsx";
import { Group, Tile } from "./cast.tsx";

/*
 * Army page for Part II and Part III (D-128). Same shell as Part I: a dark header band with the cast, then panels.
 * War: the 15 that play the War Path, lineup and bench, a chapter-by-chapter deploy and class grid. Salvation: every
 * army that reaches Part III (Theodora's as the base), grouped by origin, with the squad each unit rides in per
 * Section and its Part III target class.
 */

export type ArmyPart = "war" | "salvation";

/** Part I · War · Salvation as pills on the header band; each opens that Part's Army view. */
export function ArmyPartSwitch({ r, part }: { r: RouteName; part: ArmyPart | null }) {
  const items: [ArmyPart | null, string, string][] = [[null, "I", "Part I"], ["war", "II", "War"], [
    "salvation",
    "III",
    "Salvation",
  ]];
  return (
    <nav aria-label="Part" className="inline-flex gap-0.5 rounded-full bg-black/25 p-0.5 ring-1 ring-white/10">
      {items.map(([p, roman, label]) => (
        <a
          key={label}
          href={p ? href(routeSlug(r), "army", p) : href(routeSlug(r), "army")}
          onClick={() => notePart(p === "war" ? 2 : p === "salvation" ? 3 : 1)}
          aria-current={p === part ? "page" : undefined}
          className={cx(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
            p === part ? "bg-gold-hi text-teal" : "text-parchment/75 hover:bg-white/10 hover:text-white",
          )}
        >
          <span className="font-logo font-bold">{roman}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}

const PILL = "rounded-full bg-white/10 px-3 py-1 text-parchment ring-1 ring-white/15 hover:bg-white/20";

function Stat({ k, v, sub }: { k: string; v: ReactNode; sub?: string }) {
  return (
    <div className="max-w-[240px] min-w-[120px] flex-1 rounded-md bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
      <div className="text-[10.5px] font-semibold tracking-[0.1em] text-gold-hi uppercase">{k}</div>
      <div className="font-logo text-[22px] leading-tight font-bold text-white tabular-nums">{v}</div>
      {sub && <div className="text-[12px] leading-snug text-parchment/65">{sub}</div>}
    </div>
  );
}

function Band(
  { r, part, kicker, title, hook, actions, stats, art, children }: {
    r: RouteName;
    part: ArmyPart;
    kicker: string;
    title: string;
    hook: string;
    actions: ReactNode;
    stats: ReactNode;
    art: string;
    children: ReactNode;
  },
) {
  return (
    <header className="@container relative mt-5 overflow-hidden rounded-xl bg-teal px-5 pt-5 pb-5 text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] sm:px-7">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_95%_0%,color-mix(in_srgb,var(--c)_55%,transparent),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 hidden h-[260px] w-[280px] @4xl:block"
      >
        <Portrait
          name={art}
          eager
          className="absolute right-4 bottom-0 h-full w-auto max-w-none [mask-image:linear-gradient(to_bottom,#000_65%,transparent)]"
          opaqueClassName="!h-[85%] rounded-lg"
        />
      </div>
      <div className="relative @4xl:pr-[260px]">
        <div className="flex flex-wrap items-center gap-3">
          <ArmyPartSwitch r={r} part={part} />
          <span className="text-[11.5px] font-semibold tracking-[0.12em] text-gold-hi uppercase">{kicker}</span>
        </div>
        <h1 className="m-0 mt-2 font-display text-[clamp(28px,4.2cqi,40px)] leading-tight text-white">{title}</h1>
        <p className="mt-1 mb-0 max-w-[62ch] text-[15px] leading-snug text-parchment/85">{hook}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">{actions}</div>
        <div className="mt-4 flex flex-wrap gap-2">{stats}</div>
      </div>
      <section aria-label="Cast" className="relative mt-5 border-t border-white/10 pt-4">{children}</section>
    </header>
  );
}

/* ------------------------------------------------------------ War */

const TH = "px-2 py-2 text-[11px] font-semibold tracking-[0.06em] text-ink-soft uppercase";

/** One War chapter cell: class on the map (accent when an exam lands that chapter), dashed when benched. */
function WarCell({ r, u, ch }: { r: RouteName; u: WarUnit; ch: number }) {
  const seat = warSeat(r, ch, u.name);
  const cls = classAt(u.name, pos(2, ch), r);
  const exam = examsFor(r, pos(2, ch)).some((e) => !e.onJoin && e.unit.name === u.name);
  if (seat === undefined) return <td className="px-1 py-1.5 text-center text-faint">·</td>;
  const tone = exam
    ? "bg-(--c) text-white"
    : seat
    ? "bg-(--c)/12 text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c)_45%,transparent)]"
    : "border border-dashed border-gold/50 text-muted";
  return (
    <td className="px-1 py-1.5">
      <span
        title={`${u.name} · War Ch ${ch}: ${seat ? "deploys" : "bench"}${cls ? ` · ${cls}` : ""}${
          exam ? " · exam this chapter" : ""
        }`}
        className={cx(
          "flex h-[30px] min-w-0 items-center justify-center gap-1 rounded-[5px] px-1 text-[11.5px] leading-none font-semibold",
          tone,
        )}
      >
        {exam && <span aria-hidden="true">↑</span>}
        <span className="truncate">{seat || exam ? classLabel(cls) : "bench"}</span>
        {exam && !seat && <span className="text-[10px] font-normal opacity-80">bench</span>}
      </span>
    </td>
  );
}

function WarGrid({ r }: { r: RouteName }) {
  const army = warArmy(r);
  const groups: [string, WarUnit[]][] = [["Main lineup", army.filter((u) => u.main)], [
    "Part II bench",
    army.filter((u) => !u.main),
  ]];
  const chs = [1, 2, 3, 4, 5, 6];
  return (
    <Panel
      icon={<Users />}
      title="Deploy and classes by chapter"
      sub="tinted: deploys in the class shown · solid ↑: class exam that chapter · dashed: bench"
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-[14px] leading-snug">
          <thead>
            <tr className="border-b border-gold/60 bg-paper-2/70">
              <th className={cx(TH, "w-[220px] pl-4")}>Unit</th>
              {chs.map((c) => (
                <th key={c} className={cx(TH, "text-center")} title={warChapter(c)?.name}>
                  Ch {c}
                  <div className="text-[10px] font-normal tracking-normal normal-case text-muted">
                    max {warChapter(c)?.battles[0]?.max_units}
                  </div>
                </th>
              ))}
              <th className={cx(TH, "w-[170px] pr-4")}>Part III target</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([label, list]) => (
              <Fragment key={label}>
                <tr>
                  <td
                    colSpan={8}
                    className="bg-paper/70 px-4 pt-2.5 pb-1 text-[11px] font-bold tracking-[0.1em] text-gold-lo uppercase"
                  >
                    {label} · {list.length}
                  </td>
                </tr>
                {list.map((u) => (
                  <tr key={u.name} className="border-b border-gold/20 align-middle">
                    <td className="py-1.5 pr-2 pl-4">
                      <span className="flex min-w-0 items-center gap-2">
                        <UnitPortrait name={u.name} size={30} flat />
                        <span className="min-w-0 leading-tight">
                          <span className="block text-[14.5px] font-semibold">
                            <UnitRef name={u.name} avatar={false} />
                          </span>
                          {u.role && (
                            <span className="block truncate text-[12px] text-muted" title={u.role}>{u.role}</span>
                          )}
                        </span>
                      </span>
                    </td>
                    {chs.map((c) => <WarCell key={c} r={r} u={u} ch={c} />)}
                    <td className="py-1.5 pr-4">
                      <span className="flex items-center gap-1.5">
                        <ClassChip name={classAt(u.name, P3_END, r) ?? "?"} />
                      </span>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="bg-paper-2/60">
              <td className="py-2 pl-4 text-[12px] font-semibold text-ink-soft">Deployed / cap</td>
              {chs.map((c) => {
                const n = army.filter((u) => warSeat(r, c, u.name)).length;
                const cap = warChapter(c)?.battles[0]?.max_units ?? n;
                return (
                  <td
                    key={c}
                    className={cx(
                      "py-2 text-center text-[13px] font-semibold tabular-nums",
                      n > cap ? "text-blood-2" : "text-ink-soft",
                    )}
                  >
                    {n}/{cap}
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function WarNotes({ r }: { r: RouteName }) {
  const army = warArmy(r).filter((u) => u.note);
  const dep = META.routes[r].deployment;
  return (
    <Panel icon={<Crown />} title="Each unit's War Path" sub="from the Army plan (one line per unit)">
      {dep?.part2?.note && (
        <p className="m-0 mb-3 text-[14px] leading-snug text-ink-soft">
          <Rich text={dep.part2.note} k="p2n" />
        </p>
      )}
      <div className="grid gap-x-6 gap-y-2 lg:grid-cols-2">
        {army.map((u) => (
          <div
            key={u.name}
            className="grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 border-t border-gold/20 pt-2 text-[14px] leading-snug"
          >
            <UnitPortrait name={u.name} size={30} flat />
            <span>
              <b className="font-semibold">
                <UnitRef name={u.name} avatar={false} />
              </b>{" "}
              <span className="text-ink-soft">
                <ConfText text={u.note!} k={`wn${u.name}`} />
              </span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function WarArmy({ r }: { r: RouteName }) {
  const { openKit } = useWalk();
  const army = warArmy(r);
  const plays = r === PART_HOME;
  const exams = [1, 2, 3, 4, 5, 6].reduce((a, c) => a + examsFor(r, pos(2, c)).filter((e) => !e.onJoin).length, 0);
  return (
    <>
      <Band
        r={r}
        part="war"
        kicker={plays ? "Part II · War Path" : "Part II · skipped (D-118)"}
        title={`The Army of ${r} at War`}
        hook={plays
          ? "Fifteen units: the Ch 12 lineup plus the bench that waited for Part II. Everyone fights in the class their Part I build ended in; Part II's free Licenses take the bench to Advanced."
          : `${r}'s War Path is skipped after Theodora's: this army gains about 5 levels and waits in Dagsion for Part III Section 2.`}
        art={r}
        actions={
          <>
            <a
              href={href(routeSlug(plays ? r : PART_HOME), "war")}
              className="inline-flex items-center gap-1 rounded-full bg-gold-hi px-3 py-1 text-teal hover:bg-white"
            >
              {plays ? "War walkthrough" : "Theodora's War"} <ArrowRight className="size-3.5" />
            </a>
            <button type="button" onClick={() => openKit("ledger")} className={PILL}>Ledger · L</button>
          </>
        }
        stats={
          <>
            <Stat
              k="Army"
              v={army.length}
              sub={`${army.filter((u) => u.main).length} lineup · ${army.filter((u) => !u.main).length} bench`}
            />
            {plays && <Stat k="Deploy" v="10→13" sub="Ch 1 caps at 10" />}
            {plays && <Stat k="Exams" v={exams} sub="on Part II's free Licenses" />}
            {plays && <Stat k="Level floor" v="37→42" sub="Training Drills, Ch 1 to 4" />}
          </>
        }
      >
        <Group label={`Main lineup · ${army.filter((u) => u.main).length}`}>
          {army.filter((u) => u.main).map((u, i) => (
            <Tile
              key={u.name}
              name={u.name}
              r={r}
              i={i}
              kind="army"
              sub={classLabel(classAt(u.name, pos(2, 6), r))}
              title={[u.name, u.role].filter(Boolean).join(" · ")}
            />
          ))}
        </Group>
        {army.some((u) => !u.main) && (
          <Group label={`Part II bench · ${army.filter((u) => !u.main).length}`}>
            {army.filter((u) => !u.main).map((u, i) => (
              <Tile
                key={u.name}
                name={u.name}
                r={r}
                i={i + 9}
                kind="extra"
                sub={classLabel(classAt(u.name, pos(2, 6), r))}
                title={[u.name, u.role].filter(Boolean).join(" · ")}
              />
            ))}
          </Group>
        )}
      </Band>
      {plays && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
          <WarGrid r={r} />
          <WarNotes r={r} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ Salvation */

const ORIGIN_LABEL = (
  o: Origin,
) => (o === "joiner" ? "Part III joiners" : o === PART_HOME ? `${o}'s army · the base` : `From ${o}'s army`);

function SquadCell({ n, name, join }: { n: number; name: string; join: number }) {
  if (name === "Eshmel") {
    return (
      <td className="px-1 py-1.5">
        <span
          title="Stays in Dagsion and joins any gate battle"
          className="flex h-[26px] items-center justify-center rounded-[5px] bg-gold-hi/40 text-[11px] font-bold text-ink"
        >
          any
        </span>
      </td>
    );
  }
  if (n < join) return <td className="px-1 py-1.5 text-center text-[11px] text-faint">—</td>;
  const s = squadOf(n, name);
  if (!s) return <td className="px-1 py-1.5 text-center text-faint">·</td>;
  if (s === "bench") {
    return (
      <td className="px-1 py-1.5">
        <span
          title={`Section ${n}: outside the squads (EXP every map turn)`}
          className="flex h-[26px] items-center justify-center rounded-[5px] border border-dashed border-gold/50 text-[11px] font-semibold text-muted"
        >
          out
        </span>
      </td>
    );
  }
  const t = SQUAD_TONE[s];
  const sq = squadsFile(PART_HOME)?.sections.find((x) => x.n === n)?.squads.find((q) => q.id === s);
  // ⚔ only for units in a gate's planned deploy (a squad at a gate can hold units that don't fight there).
  const fights = deploysIn(n, name);
  return (
    <td className="px-1 py-1.5">
      <span
        title={`Section ${n}: squad ${s} · ${sq?.role}${
          fights.length ? ` · deploys: ${fights.join(", ")}` : sq?.gates.length ? " · at a gate, doesn't deploy" : ""
        }`}
        className="flex h-[26px] items-center justify-center gap-1 rounded-[5px] text-[12px] font-bold"
        style={{ background: t.bg, color: t.fg }}
      >
        {s}
        {fights.length ? <span className="text-[10px] opacity-80">⚔</span> : null}
      </span>
    </td>
  );
}

function SquadGrid() {
  const army = salvationArmy();
  const file = squadsFile(PART_HOME);
  const origins = [...new Set(army.map((u) => u.origin))];
  const ns = [1, 2, 3, 4, 5, 6];
  return (
    <Panel
      icon={<Users />}
      title="Squads by Section"
      sub="letter: squad · ⚔ deploys at a gate · out: outside the squads · ·: not placed yet · —: not joined"
      aside={file?.draft
        ? (
          <span className="rounded-full bg-warn px-2 py-px text-[11.5px] font-bold tracking-[0.06em] text-warn-ink uppercase">
            Draft
          </span>
        )
        : undefined}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-[14px] leading-snug">
          <thead>
            <tr className="border-b border-gold/60 bg-paper-2/70">
              <th className={cx(TH, "w-[230px] pl-4")}>Unit</th>
              {ns.map((n) => (
                <th key={n} className={cx(TH, "w-[64px] text-center")} title={section(n)?.name}>
                  S{n}
                  <div className="text-[10px] font-normal tracking-normal normal-case text-muted">
                    {section(n)?.squads || "battle"}
                    {section(n)?.squads ? " sq" : ""}
                  </div>
                </th>
              ))}
              <th className={cx(TH, "pr-4")}>Part III target</th>
            </tr>
          </thead>
          <tbody>
            {origins.map((o) => {
              const list = army.filter((u) => u.origin === o && !notPlanned(u));
              if (!list.length) return null;
              return (
                <Fragment key={o}>
                  <tr>
                    <td
                      colSpan={8}
                      className="bg-paper/70 px-4 pt-2.5 pb-1 text-[11px] font-bold tracking-[0.1em] text-gold-lo uppercase"
                      style={o !== "joiner" ? routeVars(o) : undefined}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {o !== "joiner" && <span className="size-2 rounded-full bg-(--c)" />}
                        {ORIGIN_LABEL(o)} · {list.length}
                      </span>
                    </td>
                  </tr>
                  {list.map((u) => <SalvationRow key={u.name} u={u} ns={ns} />)}
                </Fragment>
              );
            })}
            {army.some(notPlanned) && (
              <>
                <tr>
                  <td
                    colSpan={8}
                    className="bg-paper/70 px-4 pt-2.5 pb-1 text-[11px] font-bold tracking-[0.1em] text-faint uppercase"
                  >
                    Not planned · {army.filter(notPlanned).length} · in no squad or bench list
                  </td>
                </tr>
                {army.filter(notPlanned).map((u) => <SalvationRow key={u.name} u={u} ns={ns} muted />)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SalvationRow({ u, ns, muted }: { u: SalvationUnit; ns: number[]; muted?: boolean }) {
  const cls = classAt(u.name, P3_END, u.origin === "joiner" ? undefined : u.origin);
  return (
    <tr className={cx("border-b border-gold/20 align-middle", muted && "opacity-55")}>
      <td className="py-1.5 pr-2 pl-4">
        <span className="flex min-w-0 items-center gap-2">
          <UnitPortrait name={u.name} size={28} flat />
          <span className="min-w-0 leading-tight">
            <span className="block text-[14px] font-semibold">
              <UnitRef name={u.name} avatar={false} />
            </span>
            {u.copies.length > 1 && (
              <span className="block text-[11.5px] text-muted" title="Merge Causality in Section 2, 300 Karma Shards">
                merges {u.copies.slice(1).join(", ")} copy
              </span>
            )}
            {u.origin === "joiner" && <span className="block text-[11.5px] text-muted">joins Section {u.join}</span>}
          </span>
        </span>
      </td>
      {ns.map((n) => <SquadCell key={n} n={n} name={u.name} join={u.join} />)}
      <td className="py-1.5 pr-4">
        {cls
          ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <ClassChip name={cls} />
              <TierTag cls={cls} />
            </span>
          )
          : <span className="text-[13px] text-muted" title="No Part III build plan yet">no plan yet</span>}
      </td>
    </tr>
  );
}

export function SalvationArmy({ r }: { r: RouteName }) {
  const { openKit } = useWalk();
  const army = salvationArmy();
  const planned = army.filter((u) => !notPlanned(u));
  const origins = [...new Set(army.map((u) => u.origin))];
  const merges = planned.filter((u) => u.copies.length > 1).length;
  const divine =
    planned.filter((u) => /^The /.test(classAt(u.name, P3_END, u.origin === "joiner" ? undefined : u.origin) ?? ""))
      .length;
  const homeOf = (
    u: SalvationUnit,
  ): RouteName => (u.origin === "joiner" ? char(u.name)?.homeRoute ?? PART_HOME : u.origin);
  return (
    <>
      <Band
        r={r}
        part="salvation"
        kicker="Part III · every army, Theodora's as the base (D-118)"
        title="The Army of Salvation"
        hook="Every army that cleared or skipped its War Path waits in Dagsion from Section 2. Recruit the copy the plan picks; other copies merge into it (300 Karma Shards, D-145). Squads carry them over the map, 8 to a squad, with Eshmel apart."
        art="Eshmel"
        actions={
          <>
            <a
              href={href(routeSlug(PART_HOME), "salvation")}
              className="inline-flex items-center gap-1 rounded-full bg-gold-hi px-3 py-1 text-teal hover:bg-white"
            >
              Salvation walkthrough <ArrowRight className="size-3.5" />
            </a>
            <button type="button" onClick={() => openKit("squads")} className={PILL}>Squad board · Q</button>
            <button type="button" onClick={() => openKit("diadem")} className={PILL}>Divine classes · D</button>
          </>
        }
        stats={
          <>
            <Stat
              k="Units"
              v={planned.length}
              sub={`${origins.length - (origins.includes("joiner") ? 1 : 0)} armies + Part III joiners`}
            />
            <Stat k="Merges" v={merges} sub="second copies, Section 2" />
            <Stat k="Squads" v="2→5" sub="8 seats each" />
            <Stat k="Divine" v={`${divine}/8`} sub="planned holders" />
            <Stat k="Finale" v={25} sub="units against Balor" />
          </>
        }
      >
        {origins.filter((o) => planned.some((u) => u.origin === o)).map((o, gi) => (
          <Group
            key={o}
            label={`${ORIGIN_LABEL(o)} · ${planned.filter((u) => u.origin === o).length}`}
          >
            {planned.filter((u) => u.origin === o).map((u, i) => (
              <Tile
                key={u.name}
                name={u.name}
                r={homeOf(u)}
                i={gi * 6 + i}
                kind={u.origin === PART_HOME ? "army" : "extra"}
                sub={classAt(u.name, P3_END, u.origin === "joiner" ? undefined : u.origin) ?? "no plan yet"}
                title={[u.name, u.copies.length > 1 ? `merges ${u.copies.slice(1).join(", ")} copy` : ""].filter(
                  Boolean,
                ).join(" · ")}
              />
            ))}
          </Group>
        ))}
        {army.some(notPlanned) && (
          <div className="opacity-60">
            <Group label={`Not planned · ${army.filter(notPlanned).length}`}>
              {army.filter(notPlanned).map((u, i) => (
                <Tile
                  key={u.name}
                  name={u.name}
                  r={homeOf(u)}
                  i={i}
                  kind="extra"
                  sub="in no squad list"
                  title={`${u.name} · not in the Part III squads`}
                />
              ))}
            </Group>
          </div>
        )}
      </Band>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
        <SquadGrid />
      </div>
    </>
  );
}
