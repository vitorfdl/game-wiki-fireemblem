import { useState } from "react";
import { Check, ChevronDown, Dices, Star } from "lucide-react";
import { setRank, useTrack } from "../../lib/track.ts";
import { cx } from "../../lib/cx.ts";
import type { RouteName } from "../../lib/types.ts";
import {
  ARENA_LEVELS,
  arenaLevel,
  COURSE_NAMES,
  COURSES,
  dueLabel,
  idleCourses,
  type Need,
  RANK_EXP,
  rankBoard,
  RANKS,
  rotation,
  type Session,
  START_RANK,
  type Trainee,
} from "../../lib/arena.ts";
import { routeVars } from "../../lib/route-style.ts";
import { Medal } from "../ui/medal.tsx";

const COURSE_TONE: Record<string, string> = {
  Warrior: "bg-[#f6e1dc] text-[#8a2f1d]",
  Infantry: "bg-[#e6eef6] text-[#2b4d74]",
  Heavy: "bg-[#ece6da] text-[#5a4a2b]",
  Mage: "bg-[#ece2f4] text-[#5a2f86]",
  Mounted: "bg-[#e1efe6] text-[#24603e]",
};

export function CourseTag({ c }: { c: string }) {
  return (
    <span className={cx("inline-flex rounded px-2 py-[1px] text-[12.5px] font-bold whitespace-nowrap", COURSE_TONE[c])}>
      {c}
    </span>
  );
}

/** "Sword D → C · Ch 9": what a trainee works on in a course (compact, read-only). */
function NeedText({ n, chapter }: { n: Need; chapter: number }) {
  const late = n.due <= chapter;
  return (
    <span
      title={n.for ? `For ${n.for}` : undefined}
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[12px] font-semibold whitespace-nowrap",
        n.boon ? "bg-gold-hi/50 text-[#5d4512]" : "bg-paper-2 text-ink",
      )}
    >
      {n.boon && <Star aria-label="Boon" className="size-3 fill-current" />}
      {n.skill} <span className="font-normal text-muted">{n.own}→</span>
      {n.rank}
      <span className={cx("font-normal", late ? "text-[#8a2f1d]" : "text-muted")}>
        {late ? "now" : dueLabel(n.due)}
      </span>
    </span>
  );
}

/** One seat in a course row: portrait, name, the targets this course trains. */
function Seat({ t, chapter }: { t: Trainee; chapter: number }) {
  return (
    <span style={routeVars(t.unit.character.homeRoute)} className="flex min-w-0 items-center gap-1.5">
      <Medal flat name={t.unit.name} route={t.unit.character.homeRoute} size={26} ring="var(--color-card)" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[13.5px] font-bold">{t.unit.name}</span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          {t.needs.map((n) => <NeedText key={n.skill} n={n} chapter={chapter} />)}
        </span>
      </span>
    </span>
  );
}

function Row({ s, chapter }: { s: Session; chapter: number }) {
  return (
    <tr className="border-b border-gold/25 align-middle last:border-0">
      <td className="px-2.5 py-1.5">
        <CourseTag c={s.course} />
      </td>
      <td className="px-2.5 py-1.5">
        <Seat t={s.a} chapter={chapter} />
      </td>
      <td className="px-2.5 py-1.5">
        {s.b ? <Seat t={s.b} chapter={chapter} /> : s.partner
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
          : <span className="text-[13px] text-muted">Any second unit</span>}
      </td>
      <td className="px-2.5 py-1.5 text-[12.5px] text-muted">
        {s.next?.length ? s.next.map((t) => t.unit.name).join(", ") : <span className="text-faint">None</span>}
      </td>
    </tr>
  );
}

/**
 * One target on the rank board: the rank held now (a picker: what you see in game), the target and its deadline, and
 * a tick that reports the target as reached. Reporting re-plans the whole Arena (D-140).
 */
function RankTarget({ route, unit, n, chapter }: { route: RouteName; unit: string; n: Need; chapter: number }) {
  const late = n.due <= chapter;
  const options = RANKS.slice(RANKS.indexOf(START_RANK));
  return (
    <span
      title={n.for ? `For ${n.for}` : undefined}
      className={cx(
        "inline-flex items-center gap-1 rounded-md py-[2px] pr-1 pl-2 text-[12.5px] whitespace-nowrap shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]",
        n.boon ? "bg-gold-hi/35" : "bg-card",
      )}
    >
      {n.boon && <Star aria-label="Boon" className="size-3 fill-current text-[#5d4512]" />}
      <b className="font-semibold">{n.skill}</b>
      <select
        aria-label={`${unit} ${n.skill} rank now`}
        title={n.reported ? "Rank you reported" : "Estimated: set what the game shows"}
        value={n.own}
        onChange={(e) => setRank(route, unit, n.skill, e.target.value)}
        className={cx(
          "cursor-pointer appearance-none rounded bg-paper-2 px-1 text-[12px] font-bold tabular-nums hover:bg-paper-3",
          !n.reported && "italic text-muted",
        )}
      >
        {options.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <span className="text-faint">→</span>
      <b className="font-bold">{n.rank}</b>
      <span className={cx("text-[11.5px]", late ? "font-semibold text-[#8a2f1d]" : "text-muted")}>
        {late ? "now" : dueLabel(n.due)}
      </span>
      <button
        type="button"
        onClick={() => setRank(route, unit, n.skill, n.rank)}
        title={`${unit} reached ${n.skill} ${n.rank}`}
        aria-label={`${unit} reached ${n.skill} ${n.rank}`}
        className="ml-0.5 grid size-[18px] place-items-center rounded-[4px] text-muted shadow-[inset_0_0_0_1.5px_rgba(125,100,53,.55)] hover:bg-(--c) hover:text-white"
      >
        <Check className="size-3" strokeWidth={3} />
      </button>
    </span>
  );
}

/** Every unit's open rank targets in one compact table; ticks feed the plan above. */
function RankBoard({ route, chapter, seated }: { route: RouteName; chapter: number; seated: Set<string> }) {
  const board = rankBoard(route, chapter);
  if (!board.length) return null;
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-baseline gap-2">
        <h4 className="label m-0 text-gold-lo">Ranks to reach · {board.length} units</h4>
        <span className="text-[12px] text-muted">
          Set the rank the game shows, or tick a target when you reach it: the plan above updates.
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border border-gold/55 bg-card">
        <table className="w-full border-collapse text-left">
          <tbody>
            {board.map((b) => (
              <tr key={b.unit.name} className="border-b border-gold/25 align-middle last:border-0">
                <td className="w-[170px] px-2.5 py-1.5" style={routeVars(b.unit.character.homeRoute)}>
                  <span className="flex items-center gap-1.5">
                    <Medal
                      flat
                      name={b.unit.name}
                      route={b.unit.character.homeRoute}
                      size={24}
                      ring="var(--color-card)"
                    />
                    <span className="leading-tight">
                      <span className="block text-[13.5px] font-bold">{b.unit.name}</span>
                      <span className="text-[11.5px] text-muted">
                        {b.cls}
                        {b.bench && " · bench"}
                        {!seated.has(b.unit.name) && <span className="text-[#8a5a14]">· no seat</span>}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-2.5 py-1.5">
                  <span className="flex flex-wrap gap-1.5">
                    {b.needs.map((n) => (
                      <RankTarget key={n.skill} route={route} unit={b.unit.name} n={n} chapter={chapter} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Rules({ level }: { level: number }) {
  const [open, setOpen] = useState(false);
  const th = "px-2.5 py-1.5 text-left text-[11.5px] font-semibold tracking-[0.06em] text-ink-soft uppercase";
  const td = "px-2.5 py-1.5 tabular-nums";
  return (
    <div className="mt-5 rounded-md bg-paper/70 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-semibold"
      >
        How Arena EXP works
        <ChevronDown
          aria-hidden="true"
          className={cx("ml-auto size-4 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="grid gap-4 px-3 pb-3 text-[13.5px] lg:grid-cols-2">
          <div>
            <h4 className="label mb-1 text-gold-lo">EXP per session, per skill in the course</h4>
            <table className="w-full border-collapse rounded bg-card">
              <thead>
                <tr className="bg-paper-2/70">
                  {["Arena", "Good", "Great", "Perfect", "Boon", "Per ½ rank below"].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ARENA_LEVELS.map((a) => (
                  <tr key={a.lv} className={cx("border-t border-gold/25", a.lv === level && "bg-(--c2)")}>
                    <td className={td}>
                      <b>Lv {a.lv}</b>
                      <div className="text-[11.5px] text-muted">{a.when}</div>
                    </td>
                    <td className={td}>{a.good}</td>
                    <td className={td}>{a.great}</td>
                    <td className={td}>{a.perfect}</td>
                    <td className={td}>+{a.boon}</td>
                    <td className={td}>+{a.gap}, max ×4</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-2 mb-0 list-disc space-y-1 pl-5 leading-snug">
              <li>
                Who gets seats: units in the lineup reach B+ by Ch 9 in the skills they fight with (battle plus the
                skill-EXP Boons), so seats go to the bench first, then to skills a unit doesn't fight with (Authority,
                Riding, Flying, Heavy, Infantry), then to S pushes for Divine classes. A lineup unit holding B+ is the
                bench's mentor: up to 2 ranks of gap bonus.
              </li>
              <li>
                Each week the Arena offers 4 of the 5 courses. Each course takes exactly two units; a unit can train in
                several courses the same week.
              </li>
              <li>Only the lower-ranked unit of the pair gets the rank-gap bonus. It caps at 2 full ranks below.</li>
              <li>Best session: Perfect, a boon skill, 2 ranks below the partner (105 EXP at Arena Lv 3).</li>
              <li>The result is seeded: reload a save or pass a Turn to reroll a Perfect. The Arena opens at 6:00.</li>
              <li>A bane gets no bonus but still trains normally.</li>
            </ul>
          </div>
          <div>
            <h4 className="label mb-1 text-gold-lo">EXP to the next rank</h4>
            <table className="w-full border-collapse rounded bg-card">
              <tbody>
                {RANK_EXP.map(([r, n]) => (
                  <tr key={r} className="border-t border-gold/25 first:border-0">
                    <td className={td}>{r}</td>
                    <td className={cx(td, "text-right font-semibold")}>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4 className="label mt-3 mb-1 text-gold-lo">Courses</h4>
            <ul className="m-0 list-none space-y-1 p-0">
              {COURSE_NAMES.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <CourseTag c={c} />
                  <span>{COURSES[c].join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Arena sheet (D-140): this week's pairs for the whole team, then every unit's open rank targets with ticks. */
export function ArenaTab(
  { route, chapter, setChapter }: { route: RouteName; chapter: number; setChapter: (n: number) => void },
) {
  useTrack(); // reported ranks re-plan the sheet
  const [pick, setWeek] = useState(0);
  const weeks = rotation(route, chapter);
  const week = Math.min(pick, weeks.length - 1);
  const list = weeks[week] ?? [];
  const seated = new Set(list.flatMap((s) => [s.a.unit.name, s.b?.unit.name ?? ""]));
  const idle = idleCourses(route, chapter);
  const level = arenaLevel(chapter);
  const lv = ARENA_LEVELS[level - 1];
  return (
    <>
      <div className="sticky top-0 z-[2] -mx-4 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-2 shadow-[0_1px_0_rgba(176,144,90,.4)]">
        <div>
          <div className="label mb-1.5 text-gold-lo">Arena for chapter</div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setChapter(n)}
                aria-pressed={n === chapter}
                className={cx(
                  "size-7 rounded text-[13px] font-bold tabular-nums",
                  n === chapter ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-1.5 text-gold-lo">Week</div>
          <div className="flex gap-1">
            {weeks.map((_, i) => "ABC"[i]).map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeek(i)}
                aria-pressed={week === i}
                className={cx(
                  "h-7 rounded px-2.5 text-[13px] font-bold",
                  week === i ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-right text-[13px] leading-snug">
          <div className="font-bold">Arena Lv {level}?</div>
          <div className="text-muted">
            Perfect + boon + 2 ranks below: {Math.floor(lv.perfect + lv.boon + lv.gap * 4)} EXP
          </div>
        </div>
      </div>
      <p className="mt-0 mb-2 flex items-center gap-1.5 text-[13px] text-ink-soft">
        <Dices aria-hidden="true" className="size-4 shrink-0 text-gold-lo" />
        4 of the 5 courses show up each week: book the row of each one that does. Two units per course; one unit can sit
        in several. Save first and reload until Perfect.
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
              <tbody>{list.map((s) => <Row key={s.course} s={s} chapter={chapter} />)}</tbody>
            </table>
          </div>
        )
        : <p className="text-[14px] text-muted">No rank targets left for this chapter.</p>}
      {idle.length > 0 && list.length > 0 && (
        <p className="mt-1.5 mb-0 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          No target: {idle.map((c) => <CourseTag key={c} c={c} />)} skip it, or seat any two bench units.
        </p>
      )}
      <RankBoard route={route} chapter={chapter} seated={seated} />
      <p className="mt-2 text-[12px] leading-snug text-muted">
        Every skill starts at D. A grey italic rank is an estimate (exams passed, battle use); a bold one is what you
        set. Targets come from each unit's plan: stage training, rank gates, the next exam, and the ranks later weapons,
        arts and abilities need. Starred skills are boons (+{lv.boon} EXP).
      </p>
      <Rules level={level} />
    </>
  );
}
