import { Fragment, useState } from "react";
import { Check, Crown, Dices, Home, Star, Swords, TriangleAlert } from "lucide-react";
import { setRank3, useTrack } from "../../lib/track.ts";
import { cx } from "../../lib/cx.ts";
import { RANKS, START_RANK } from "../../lib/arena.ts";
import {
  ARENA3_OPENS,
  type P3Kind,
  type P3Need,
  type P3Session,
  type P3Trainee,
  rankBoard3,
  rotation3,
  weeksIn,
} from "../../lib/arena3.ts";
import { P3 } from "../../lib/parts.ts";
import { routeVars } from "../../lib/route-style.ts";
import { Medal } from "../ui/medal.tsx";
import { UnitRef } from "../ref/rich.tsx";
import { CourseTag, Rules } from "../walkthrough/arena-tab.tsx";
import { SquadBadge } from "./shared.tsx";

const KIND: Record<P3Kind, { label: string; tone: string }> = {
  divine: { label: "Divine", tone: "bg-[#5a3a86] text-white" },
  exam: { label: "Exam", tone: "bg-[#24467f] text-white" },
  weapon: { label: "Weapon", tone: "bg-paper-3 text-ink" },
  ability: { label: "Ability", tone: "bg-paper-3 text-ink" },
  training: { label: "Plan", tone: "bg-paper-3 text-ink" },
};

const where = (t: P3Trainee) =>
  t.squad === "bench"
    ? <Home aria-label="Bench: always in Dagsion" className="size-3.5 text-gold-lo" />
    : t.squad
    ? <SquadBadge id={t.squad} size={16} title={`Squad ${t.squad}: trains on weeks it ends in Dagsion`} />
    : null;

/** "Spear B→A · S4": a target as the course row shows it. */
function NeedPill({ x, n }: { x: P3Need; n: number }) {
  return (
    <span
      title={`For ${x.for}`}
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[12px] font-semibold whitespace-nowrap",
        x.boon ? "bg-gold-hi/50 text-[#5d4512]" : "bg-paper-2 text-ink",
      )}
    >
      {x.boon && <Star aria-label="Boon" className="size-3 fill-current" />}
      {x.skill} <span className="font-normal text-muted">{x.own}→</span>
      {x.rank}
      <span className={cx("font-normal", x.due <= n ? "text-[#8a2f1d]" : "text-muted")}>
        {x.due <= n ? "now" : `S${x.due}`}
      </span>
    </span>
  );
}

function Seat({ t, n }: { t: P3Trainee; n: number }) {
  return (
    <span style={routeVars(t.unit.character.homeRoute)} className="flex min-w-0 items-center gap-1.5">
      <Medal flat name={t.unit.name} route={t.unit.character.homeRoute} size={26} ring="var(--color-card)" />
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1 text-[13.5px] font-bold">
          {t.unit.name}
          {where(t)}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          {t.needs.map((x) => <NeedPill key={x.skill} x={x} n={n} />)}
        </span>
      </span>
    </span>
  );
}

function Row({ s, n }: { s: P3Session; n: number }) {
  return (
    <tr className="border-b border-gold/25 align-middle last:border-0">
      <td className="px-2.5 py-1.5">
        <CourseTag c={s.course} />
      </td>
      <td className="px-2.5 py-1.5">
        <Seat t={s.a} n={n} />
      </td>
      <td className="px-2.5 py-1.5">
        {s.b ? <Seat t={s.b} n={n} /> : s.partner
          ? (
            <span className="flex items-center gap-1.5">
              <Medal
                flat
                name={s.partner.unit.name}
                route={s.partner.unit.character.homeRoute}
                size={26}
                ring="var(--color-card)"
              />
              <span className="leading-tight">
                <span className="block text-[13.5px] font-bold">{s.partner.unit.name}</span>
                <span className="text-[12px] text-muted">{s.partner.why}</span>
              </span>
            </span>
          )
          : <span className="text-[13px] text-muted">Any bench unit</span>}
      </td>
      <td className="px-2.5 py-1.5 text-[12.5px] text-muted">
        {s.next?.length ? s.next.map((t) => t.unit.name).join(", ") : <span className="text-faint">None</span>}
      </td>
    </tr>
  );
}

/** One target on the board: the rank held (a picker), the target, its Section and why; the tick reports it reached. */
function Target({ unit, x, n }: { unit: string; x: P3Need; n: number }) {
  const k = KIND[x.kind];
  return (
    <span
      title={`For ${x.for}${x.later ? ` · then ${x.later}` : ""}`}
      className={cx(
        "inline-flex items-center gap-1 rounded-md py-[2px] pr-1 pl-1.5 text-[12.5px] whitespace-nowrap shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]",
        x.boon ? "bg-gold-hi/35" : "bg-card",
        x.short && "shadow-[inset_0_0_0_1.5px_#b0452f]",
      )}
    >
      <span className={cx("rounded-[3px] px-1 text-[10.5px] font-bold uppercase", k.tone)}>{k.label}</span>
      {x.boon && <Star aria-label="Boon" className="size-3 fill-current text-[#5d4512]" />}
      <b className="font-semibold">{x.skill}</b>
      <select
        aria-label={`${unit} ${x.skill} rank now`}
        title={x.source === "p3"
          ? "Rank you set for Part III"
          : x.source === "p1"
          ? "Best rank reported in Part I: set what the game shows"
          : "Estimated from classes held: set what the game shows"}
        value={x.own}
        onChange={(e) => setRank3(unit, x.skill, e.target.value)}
        className={cx(
          "cursor-pointer appearance-none rounded bg-paper-2 px-1 text-[12px] font-bold tabular-nums hover:bg-paper-3",
          x.source !== "p3" && "italic text-muted",
        )}
      >
        {RANKS.slice(RANKS.indexOf(START_RANK)).map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <span className="text-faint">→</span>
      <b className="font-bold">{x.rank}</b>
      <span className={cx("text-[11.5px]", x.due <= n ? "font-semibold text-[#8a2f1d]" : "text-muted")}>
        {x.due <= n ? "now" : `S${x.due}`}
      </span>
      {x.battle && <Swords aria-label="Battles train it too" className="size-3 text-muted" />}
      {x.short && (
        <TriangleAlert aria-label={`${x.exp} EXP: more than the Arena weeks left`} className="size-3 text-[#b0452f]" />
      )}
      <button
        type="button"
        onClick={() => setRank3(unit, x.skill, x.rank)}
        title={`${unit} reached ${x.skill} ${x.rank}`}
        aria-label={`${unit} reached ${x.skill} ${x.rank}`}
        className="ml-0.5 grid size-[18px] place-items-center rounded-[4px] text-muted shadow-[inset_0_0_0_1.5px_rgba(125,100,53,.55)] hover:bg-(--c) hover:text-white"
      >
        <Check className="size-3" strokeWidth={3} />
      </button>
    </span>
  );
}

const ORDER = ["A", "B", "C", "D", "E", "bench", ""];

/** Every unit's open targets, grouped by where it is this Section (squads, then the bench). */
function Board({ n, seated }: { n: number; seated: Set<string> }) {
  const board = rankBoard3(n);
  if (!board.length) return <p className="text-[14px] text-muted">No rank targets left this Section.</p>;
  const groups = ORDER.map((g) => ({ g, rows: board.filter((t) => (t.squad ?? "") === g) })).filter((x) =>
    x.rows.length
  );
  const short = board.flatMap((t) => t.needs.filter((x) => x.short)).length;
  return (
    <div className="mt-4">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
        <h4 className="label m-0 text-gold-lo">Ranks to reach · {board.length} units</h4>
        <span className="text-[12px] text-muted">
          Most urgent first in each group. Set the rank the game shows, or tick a target when you reach it.
          {short > 0 && <span className="text-[#b0452f]">{short} targets need battle EXP or skill Boons too.</span>}
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border border-gold/55 bg-card">
        <table className="w-full border-collapse text-left">
          <tbody>
            {groups.map(({ g, rows }) => (
              <Fragment key={g || "none"}>
                <tr className="bg-paper-2/70">
                  <td
                    colSpan={2}
                    className="px-2.5 py-1 text-[11.5px] font-semibold tracking-[0.06em] text-ink-soft uppercase"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {g === "bench"
                        ? (
                          <>
                            <Home aria-hidden="true" className="size-3.5" />Bench · always in Dagsion, no battle EXP
                          </>
                        )
                        : g
                        ? (
                          <>
                            <SquadBadge id={g} size={16} />Squad {g} · trains on weeks it ends in Dagsion
                          </>
                        )
                        : "Not seated yet"}
                    </span>
                  </td>
                </tr>
                {rows.map((t) => (
                  <tr key={t.unit.name} className="border-b border-gold/25 align-middle last:border-0">
                    <td className="w-[170px] px-2.5 py-1.5" style={routeVars(t.unit.character.homeRoute)}>
                      <span className="flex items-center gap-1.5">
                        <Medal
                          flat
                          name={t.unit.name}
                          route={t.unit.character.homeRoute}
                          size={24}
                          ring="var(--color-card)"
                        />
                        <span className="leading-tight">
                          <span className="block text-[13.5px] font-bold">
                            <UnitRef name={t.unit.name} avatar={false} />
                          </span>
                          <span className="text-[11.5px] text-muted">
                            {t.cls}
                            {!seated.has(t.unit.name) && <span className="text-[#8a5a14]">· no seat</span>}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span className="flex flex-wrap gap-1.5">
                        {t.needs.map((x) => <Target key={x.skill} unit={t.unit.name} x={x} n={n} />)}
                      </span>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Part III Arena (D-159): the Section's weekly pairs for the whole Salvation army, then every unit's open rank
 * targets grouped by squad, with the rank picker and ticks that re-plan the weeks.
 */
export function Arena3Tab({ n, setN }: { n: number; setN: (n: number) => void }) {
  useTrack();
  const sec = Math.max(ARENA3_OPENS, Math.min(6, n));
  const [pick, setWeek] = useState(0);
  const weeks = rotation3(sec);
  const week = Math.min(pick, Math.max(0, weeks.length - 1));
  const list = weeks[week] ?? [];
  const seated = new Set(list.flatMap((s) => [s.a.unit.name, s.b?.unit.name ?? ""]));
  const s = P3.sections.find((x) => x.n === sec);
  return (
    <>
      <div className="sticky top-0 z-[2] -mx-4 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-2 shadow-[0_1px_0_rgba(176,144,90,.4)]">
        <div>
          <div className="label mb-1.5 text-gold-lo">Arena for Section</div>
          <div className="flex gap-1">
            {[2, 3, 4, 5, 6].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => {
                  setN(x);
                  setWeek(0);
                }}
                aria-pressed={x === sec}
                className={cx(
                  "h-7 rounded px-2 text-[13px] font-bold tabular-nums",
                  x === sec ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
                )}
              >
                S{x}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-1.5 text-gold-lo">Week · {weeksIn(sec)} this Section</div>
          <div className="flex gap-1">
            {weeks.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setWeek(i)}
                aria-pressed={week === i}
                className={cx(
                  "size-7 rounded text-[13px] font-bold tabular-nums",
                  week === i ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-right text-[12.5px] leading-snug">
          <div className="font-bold">
            {s?.free_time?.from}–{s?.mission_time?.to ?? s?.free_time?.to}
          </div>
          <div className="text-muted">
            {sec === 2 ? "Arena after 3 Building Materials" : sec === 3 ? "Arena II at 20 materials" : "Arena II"}
          </div>
        </div>
      </div>
      <p className="mt-0 mb-2 flex items-start gap-1.5 text-[13px] leading-snug text-ink-soft">
        <Dices aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold-lo" />
        <span>
          4 of the 5 courses show up each week: book the row of each one that does. Only units inside Dagsion train: the
          bench always can, a squad only on weeks it ends in Dagsion.{" "}
          <Crown aria-hidden="true" className="inline size-3.5" /> Divine S and Master exam ranks come first;{" "}
          <Swords aria-hidden="true" className="inline size-3.5" /> marks a skill the unit's squad fights with.
        </span>
      </p>
      {list.length
        ? (
          <div className="overflow-x-auto rounded-md border border-gold/55 bg-card">
            <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-gold/60 bg-paper-2/70">
                  {["Course", "Trainee", "Partner", "Next"].map((h) => (
                    <th
                      key={h}
                      className="px-2.5 py-1.5 text-[11.5px] font-semibold tracking-[0.06em] text-ink-soft uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{list.map((x) => <Row key={x.course} s={x} n={sec} />)}</tbody>
            </table>
          </div>
        )
        : <p className="text-[14px] text-muted">No rank targets left this Section.</p>}
      <Board n={sec} seated={seated} />
      <p className="mt-2 text-[12px] leading-snug text-muted">
        Targets come from each unit's Part III plan: the next class exam (Master, Elephant, Divine at 100%), weapon
        ranks, rank abilities and training rows. A grey italic rank is an estimate (best Part I report, else the classes
        held); a bold one is what you set. A red outline means the EXP left beats one Good session a week before the
        deadline. Arena II's EXP is unknown: the numbers below are Part I's Arena Lv 3.
      </p>
      <Rules level={3} />
    </>
  );
}
