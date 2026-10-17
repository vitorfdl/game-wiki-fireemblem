import { memo, type ReactNode } from "react";
import {
  CalendarRange,
  Castle,
  Gem,
  GraduationCap,
  ListChecks,
  ScrollText,
  Swords,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { dayOf, missableId } from "../../lib/chapter.ts";
import {
  type Battle,
  dropsAt,
  dropTag,
  GOD_LIST,
  P3,
  type P3Quest,
  p3Quest,
  pos,
  section,
  shortBattle,
} from "../../lib/parts.ts";
import { examRanks } from "../../lib/refs.ts";
import { GodPill } from "./god.tsx";
import { ClassChip } from "../ui/class-chip.tsx";
import { pids, salvationFile, squadsAt, squadsFile } from "../../lib/part-plan.ts";
import { nowIn, useTrack } from "../../lib/track.ts";
import type { RouteName, SalvationFile } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { DueLabel, MissableRow } from "../chapter/view.tsx";
import { LineRow, Lines, Row, SubHead, Tag, Tick } from "../chapter/bits.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { Hover } from "../ui/hover.tsx";
import { Gold } from "../walkthrough/inline.tsx";
import { UnitPortrait, UnitRef } from "../ref/rich.tsx";
import {
  BattleFacts,
  CapMeter,
  DropGrid,
  ExamCards,
  examCount,
  ItemChip,
  Kicker,
  KitCards,
  KitLink,
  PartFinish,
  PSlot,
  SquadBadge,
  squadLine,
} from "./shared.tsx";
import { SquadCard } from "./squads.tsx";

/*
 * A Salvation Section (D-124): a band with two stretches (Free Time, then Mission Time), then nine slots: Free Time
 * plan, Missables, Classes, Gear, Joins & merges, Quests, Squads, Gates, Before you move on.
 */

const ICON: Record<number, ReactNode> = {
  1: <CalendarRange />,
  2: <TriangleAlert />,
  3: <GraduationCap />,
  4: <Gem />,
  5: <UserPlus />,
  6: <ScrollText />,
  7: <Users />,
  8: <Castle />,
  9: <ListChecks />,
};
const id = (n: number, slot: string) => `s-${n}-${slot}`;
const go = (to: string) => document.getElementById(to)?.scrollIntoView({ behavior: "smooth", block: "start" });

/* ------------------------------------------------------------ band */

/** Free Time and Mission Time as two stretches on one bar, with a dot per gate and the 6/6 deadline. */
function Stretches({ n }: { n: number }) {
  const s = section(n)!;
  const ft = s.free_time;
  if (!ft) return null;
  const end = s.mission_time?.to ?? ft.to;
  const a = dayOf(ft.from);
  const span = Math.max(1, dayOf(end) - a);
  const at = (d: string) => `${((dayOf(d) - a) / span) * 100}%`;
  const gates = s.battles.filter((b) => !b.kind);
  return (
    <div className="mt-3">
      <div className="relative h-7">
        <span
          className="absolute top-1/2 left-0 h-[6px] -translate-y-1/2 rounded-l-full bg-gold-hi/55"
          style={{ width: s.mission_time ? at(s.mission_time.from) : "100%" }}
        />
        {s.mission_time && (
          <span
            className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-r-full bg-[repeating-linear-gradient(135deg,#f0857a_0_6px,#c4513a_6px_12px)]"
            style={{ left: at(s.mission_time.from), right: 0 }}
          />
        )}
        {s.mission_time && gates.map((b, i) => (
          <Hover
            key={b.name}
            label={b.name}
            card={() => (
              <div className="pr-3">
                <div className="text-[12px] font-semibold text-blood-2">Gate · Mission Time</div>
                <div className="text-[14px] font-semibold">{b.name}</div>
                <div className="text-[13px] text-muted">{b.gate ?? b.location} · max {b.max_units}</div>
              </div>
            )}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(${at(s.mission_time!.from)} + ${
                (i + 1) * ((100 - parseFloat(at(s.mission_time!.from))) / (gates.length + 1))
              }%)`,
            }}
          >
            <button
              type="button"
              onClick={() => go(id(n, "gates"))}
              className="grid size-5 place-items-center rounded-full bg-teal text-[#f0857a] ring-2 ring-[#f0857a] hover:scale-110"
            >
              <Swords className="size-3" />
            </button>
          </Hover>
        ))}
        {n === 6 && (
          <span
            className="absolute top-1/2 right-0 size-3.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f0857a] ring-2 ring-teal"
            title="6/6: every quest ends"
          />
        )}
      </div>
      <div className="flex justify-between gap-2 text-[12px] text-parchment/70 tabular-nums">
        <span>
          <b className="font-semibold text-gold-hi">Free Time</b> {ft.from}–{ft.to}
        </span>
        {s.turns && <span>{s.turns} map turns</span>}
        {s.mission_time
          ? (
            <span>
              <b className="font-semibold text-[#f3b09f]">Mission Time</b> {s.mission_time.from}–{s.mission_time.to}
            </span>
          )
          : <span>quests end 6/6</span>}
      </div>
    </div>
  );
}

function Band({ route, n }: { route: RouteName; n: number }) {
  const track = useTrack();
  const s = section(n)!;
  const now = nowIn(route, "salvation", track) === n;
  const joining = (s.joins ?? []).map((j) => j.unit).filter((u) => !/recruit/i.test(u));
  const gates = s.battles.filter((b) => !b.kind);
  return (
    <header className="relative overflow-hidden rounded-lg bg-teal px-5 pt-4 pb-3 text-parchment shadow-[0_10px_28px_-14px_rgba(16,38,42,.75)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--c)_45%,transparent),transparent_60%)]"
      />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          aria-hidden="true"
          className={cx(
            "grid size-14 shrink-0 place-items-center rounded-full font-logo text-[30px] leading-none font-bold",
            now ? "bg-gold-hi text-teal" : "text-gold-hi shadow-[inset_0_0_0_2px_rgba(231,200,128,.7)]",
          )}
        >
          {n}
        </span>
        <div className="min-w-[240px] flex-1">
          <div className="text-[11px] font-semibold tracking-[0.12em] text-gold-hi/80 uppercase">
            Salvation · Section {n}
          </div>
          <h2 className="m-0 flex flex-wrap items-baseline gap-x-2.5 font-display text-[clamp(22px,2.6vw,30px)] leading-tight text-white">
            {s.name}
            {now && (
              <span className="rounded-full bg-gold-hi/20 px-2 py-px font-sans text-[11px] font-bold tracking-[0.1em] text-gold-hi uppercase ring-1 ring-gold-hi/50">
                Now
              </span>
            )}
          </h2>
          <p className="m-0 mt-0.5 text-[13.5px] text-parchment/75">
            {s.squads ? `${s.squads} squads` : "Battle only, no Free Time"}
            {gates.length
              ? (
                <>
                  {" · "}
                  {gates.length === 1 ? "Gate" : `${gates.length} gates`}: {gates.map((b) =>
                    shortBattle(b.name)
                  ).join(", ")}
                </>
              )
              : null}
            {s.unlocks?.length
              ? <>{" · New: "}{s.unlocks.slice(0, 4).join(", ")}{s.unlocks.length > 4 ? "…" : ""}</>
              : null}
          </p>
        </div>
        {joining.length > 0 && (
          <div className="ml-auto hidden shrink-0 flex-col items-end gap-1 sm:flex">
            <span className="text-[10.5px] font-semibold tracking-[0.1em] text-gold-hi/80 uppercase">Joining</span>
            <span className="flex -space-x-2">
              {joining.slice(0, 5).map((u) => (
                <UnitPortrait key={u} name={u} size={40} ring="var(--color-teal)" className="hover:z-10" />
              ))}
            </span>
          </div>
        )}
      </div>
      <div className="relative">
        <Stretches n={n} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------ 1 Free Time plan */

function Plan({ f, n }: { f: SalvationFile; n: number }) {
  const s = section(n)!;
  return (
    <PSlot n={1} id={id(n, "plan")} title={s.free_time ? "Free Time plan" : "The run to the battle"} icon={ICON[1]}>
      {s.intro && (
        <p className="m-0 mb-1 text-[14px] text-ink-soft">
          <ConfText text={s.intro} k="in" />
        </p>
      )}
      <WhatHappens n={n} />
      <Decided f={f} />
      {s.unlocks?.length
        ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Kicker className="mr-1">Opens</Kicker>
            {s.unlocks.map((u) => (
              <span key={u} className="rounded-full bg-(--c)/10 px-2 py-px text-[13px] font-semibold">{u}</span>
            ))}
          </div>
        )
        : null}
      <div className="grid gap-3 lg:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {f.plan.map((g) => (
          <div key={g.group} className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]">
            <Kicker>{g.group}</Kicker>
            <ul className="m-0 mt-1 grid list-none gap-1.5 p-0 text-[14.5px] leading-snug">
              {g.rows.map((r, i) => (
                <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2">
                  {r.squad
                    ? <SquadBadge id={r.squad} size={20} className="mt-[1px]" />
                    : <span className="mt-[8px] ml-[7px] size-1.5 rounded-full bg-(--c)" />}
                  <span>
                    <ConfText text={r.text} k={`pl${i}`} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {s.scenes?.length
        ? (
          <p className="m-0 mt-2 text-[13px] text-muted">
            <b className="font-semibold text-ink-soft">Optional scenes:</b> {s.scenes.join(" · ")}. {s.scenes_note}
          </p>
        )
        : null}
    </PSlot>
  );
}

/** The Section's events in order (part3-salvation.json `flow`). */
function WhatHappens({ n }: { n: number }) {
  const flow = section(n)?.flow;
  if (!flow?.length) return null;
  return (
    <div className="mb-3 rounded-md bg-teal/[.06] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(16,38,42,.14)]">
      <Kicker className="mb-1.5">What happens</Kicker>
      <ol className="m-0 grid list-none gap-1.5 p-0 text-[14px] leading-snug">
        {flow.map((t, i) => (
          <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2">
            <span className="mt-[1px] grid size-5 place-items-center rounded-full bg-teal text-[11px] font-bold text-gold-hi tabular-nums">
              {i + 1}
            </span>
            <span>
              <ConfText text={t} k={`fw${n}.${i}`} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Calls made for the player (D-143): the pick in bold, the reason, the rejected option. */
function Decided({ f }: { f: SalvationFile }) {
  if (!f.decisions?.length) return null;
  return (
    <div className="mb-3">
      <Kicker className="mb-1.5">Decided for you</Kicker>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-2">
        {f.decisions.map((d, i) => (
          <div
            key={d.topic}
            className="rounded-md border-l-[3px] border-(--c) bg-card px-3 py-2 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]"
          >
            <div className="text-[11px] font-semibold tracking-[0.1em] text-gold-lo uppercase">{d.topic}</div>
            <div className="mt-0.5 text-[14.5px] leading-snug font-semibold">
              <ConfText text={d.pick} k={`dp${f.n}.${i}`} />
            </div>
            <p className="m-0 mt-1 text-[13.5px] leading-snug text-ink-soft">
              <ConfText text={d.why} k={`dw${f.n}.${i}`} />
            </p>
            {d.alt && (
              <p className="m-0 mt-1 text-[12.5px] leading-snug text-muted">
                <b className="font-semibold">Rejected:</b> {d.alt}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 3 Master License queue */

const normCls = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Master License order (D-149): rank, unit, class, exam ranks, the god request that opens it, and why. */
function LicenseQueue({ route, f }: { route: RouteName; f: SalvationFile }) {
  const t = useTrack();
  if (!f.licenses?.length) return null;
  const opener = (cls: string) => P3.quests.find((q) => q.master_class && normCls(q.master_class) === normCls(cls));
  return (
    <div className="mb-3">
      <SubHead
        aside={
          <span className="text-[12.5px] text-muted">
            Dagsion vendor: 3 a Section, 8,000G · repaired markets sell more · Lv 45 + ranks
          </span>
        }
      >
        Master License order
      </SubHead>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,330px),1fr))] gap-1.5 p-0">
        {f.licenses.map((l) => {
          const id = pids.license(route, l.unit, l.to);
          const done = Boolean(t.done[id]);
          const god = opener(l.to);
          const el = l.license === "Elephant";
          // Master rows are numbered against the vendor's stock; Elephant License rows sit outside it (D-156).
          const i = el ? -1 : f.licenses!.filter((x) => !x.license).indexOf(l);
          return (
            <li
              key={id}
              className={cx(
                "flex gap-2 rounded-md bg-paper/60 px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]",
                done && "opacity-60",
                i >= 0 && i < 3 && "shadow-[inset_0_0_0_1.5px_rgba(143,110,194,.55)]",
              )}
            >
              <span
                className={cx(
                  "mt-1 grid size-6 shrink-0 place-items-center rounded-full font-logo font-bold text-white tabular-nums",
                  el ? "bg-[#6b5a3a] text-[10.5px]" : "bg-[#5a3a86] text-[12.5px]",
                )}
                title={el ? "Elephant License (not a Master License)" : undefined}
              >
                {el ? "EL" : i + 1}
              </span>
              <UnitPortrait name={l.unit} size={34} flat />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex flex-wrap items-center gap-1.5">
                  <b className="text-[14px] font-semibold">
                    <UnitRef name={l.unit} avatar={false} />
                  </b>
                  <ClassChip name={l.to} />
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11.5px]">
                  {examRanks(l.to).map((r) => (
                    <span key={r} className="rounded-[3px] bg-(--c)/10 px-1 font-semibold">{r}</span>
                  ))}
                  {el && <Tag tone="route">Elephant License</Tag>}
                  {god && <Tag tone="route">{god.giver}'s request</Tag>}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-muted">{l.why}</span>
              </span>
              <Tick id={id} label={`${l.unit}: ${l.to} exam passed`} />
            </li>
          );
        })}
      </ol>
      <p className="m-0 mt-1 text-[12.5px] text-muted">
        The first three use the vendor's stock. Unfinished picks from the last Section go first. EL rows take an
        Elephant License instead (Lv 35, Riding C).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ 5 Joins and merges */

function Joins({ route, f, n }: { route: RouteName; f: SalvationFile; n: number }) {
  const s = section(n)!;
  const auto = (s.joins ?? []).filter((j) => !/recruit/i.test(j.unit));
  const any = auto.length || f.joins?.length || f.merges?.length || f.copies?.length;
  return (
    <PSlot
      n={5}
      id={id(n, "joins")}
      title="Joins & merges"
      icon={ICON[5]}
      empty={any ? false : "Nobody new this Section."}
    >
      {auto.length + (f.joins?.length ?? 0) > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-2">
          {[
            ...auto.map((j) => ({ unit: j.unit, text: j.how, auto: true })),
            ...(f.joins ?? []).map((j) => ({ ...j, auto: false })),
          ].map((j) => (
            <div
              key={j.unit}
              className="flex gap-3 rounded-md bg-paper/60 p-2.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]"
            >
              <UnitPortrait name={j.unit} size={40} ring="var(--color-card)" />
              <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">
                    <UnitRef name={j.unit} avatar={false} />
                  </span>
                  <span
                    className={cx(
                      "rounded-full px-1.5 text-[10.5px] font-bold tracking-[0.06em] uppercase",
                      j.auto ? "bg-[#dcefe3] text-[#1f6a43]" : "bg-(--c)/12 text-ink",
                    )}
                  >
                    {j.auto ? "Joins" : "Talk"}
                  </span>
                </div>
                <p className="m-0 mt-0.5">
                  <ConfText text={j.text} k={`j${j.unit}`} />
                </p>
              </div>
              {!j.auto && <Tick id={pids.join(route, j.unit)} label={`${j.unit} recruited`} />}
            </div>
          ))}
        </div>
      )}
      {f.copies?.length
        ? (
          <>
            <SubHead aside={<span className="text-[12.5px] text-muted">Talk to them in Dagsion · one copy each</span>}>
              Which copy to recruit
            </SubHead>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-1.5">
              {f.copies.map((c) => (
                <div
                  key={c.unit}
                  className="flex items-center gap-2 rounded-md bg-paper/60 px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]"
                >
                  <UnitPortrait name={c.unit} size={30} flat />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex items-center gap-1.5">
                      <b className="text-[14px] font-semibold">
                        <UnitRef name={c.unit} avatar={false} />
                      </b>
                      <span className="rounded-full bg-(--c)/12 px-1.5 text-[11.5px] font-bold">{c.pick}'s</span>
                    </span>
                    {c.why && <span className="line-clamp-2 block text-[12.5px] text-muted">{c.why}</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )
        : null}
      {f.merges?.length
        ? (
          <>
            <SubHead
              aside={<span className="text-[12.5px] text-muted">Shrine of Causality · 300 Karma Shards each</span>}
            >
              Merge Causality
            </SubHead>
            <div className="grid gap-1.5">
              {f.merges.map((m) => (
                <Row key={m.unit} tick={{ id: pids.merge(route, m.unit), label: `${m.unit} merged` }}>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <UnitRef name={m.unit} />
                    <span className="text-[13px] text-muted">{m.base}'s copy keeps the best of</span>
                    {m.with.map((r) => (
                      <span key={r} className="rounded-full bg-paper-2 px-2 py-px text-[12.5px] font-semibold">
                        {r}
                      </span>
                    ))}
                  </span>
                  <div className="text-[13.5px] text-muted">
                    <ConfText text={m.why} k={`mg${m.unit}`} />
                  </div>
                </Row>
              ))}
            </div>
          </>
        )
        : null}
    </PSlot>
  );
}

/* ------------------------------------------------------------ 6 Quests */

/** A Part III quest name with its card: giver, task, reward, deadline (part3-salvation.json). */
export function P3QuestName({ q }: { q: P3Quest }) {
  return (
    <Hover
      label={q.name}
      card={() => (
        <div className="max-w-[380px] pr-3 text-[14px] leading-snug">
          <div className="text-[12px] font-semibold tracking-[0.06em] text-gold-lo uppercase">
            {q.kind === "god-request" ? "God request" : q.kind === "perform" ? "Perform quest" : "Part III quest"}{" "}
            · ends {q.due}
          </div>
          <div className="font-semibold">{q.name}</div>
          <div className="text-muted">{[q.giver, q.where].filter(Boolean).join(", ")}</div>
          <p className="m-0 mt-1">{q.task}</p>
          {q.requires && (
            <p className="m-0 mt-1 text-[13px]">
              <b className="font-semibold">Needs:</b> {q.requires}
            </p>
          )}
          <p className="m-0 mt-1 text-[13px]">
            <b className="font-semibold">Reward:</b> {rewardText(q)}
          </p>
        </div>
      )}
    >
      <span className="font-semibold underline decoration-gold/60 decoration-dotted underline-offset-[3px]">
        {q.name}
      </span>
    </Hover>
  );
}

const rewardText = (q: P3Quest) =>
  [
    q.reward.gold && `${q.reward.gold.toLocaleString("en-US")}G`,
    q.reward.relief && `${q.reward.relief} Relief`,
    ...(q.reward.items ?? []),
    ...(q.reward.unlocks ?? []),
    q.reward.trial_items && `Trial: ${q.reward.trial_items.join(", ")}`,
  ].filter(Boolean).join(" · ");

function Quests({ f, n }: { f: SalvationFile; n: number }) {
  const t = useTrack();
  return (
    <PSlot
      n={6}
      id={id(n, "quests")}
      title="Quests"
      icon={ICON[6]}
      empty={f.quests.length ? false : "No new quests: finish the open ones by 6/6."}
      aside={<KitLink tab="temples">Temples</KitLink>}
    >
      <div className="@container grid gap-0.5">
        {f.quests.map((row) => {
          const q = p3Quest(row.id);
          if (!q) return null;
          const qid = pids.p3quest(q.id);
          return (
            <Row key={q.id} tick={{ id: qid, label: q.name }} done={Boolean(t.done[qid])}>
              <div className="grid gap-x-3 gap-y-0.5 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                  {row.squad && <SquadBadge id={row.squad} size={18} />}
                  <P3QuestName q={q} />
                  {q.kind === "god-request" && <Tag tone="route">{q.giver}</Tag>}
                  {q.missable && <Tag tone="red">missable</Tag>}
                </span>
                <span className="text-[13.5px] text-ink-soft">
                  {q.task}
                  {row.note ? <span className="text-muted">· {row.note}</span> : null}
                </span>
                <span className="flex items-center gap-2 text-[13px] whitespace-nowrap">
                  {q.reward.gold ? <Gold amount={`${q.reward.gold.toLocaleString("en-US")}G`} /> : null}
                  <span className="font-semibold text-blood tabular-nums">ends {q.due}</span>
                </span>
              </div>
              {(q.reward.unlocks?.length || q.reward.items?.length || q.reward.trial_items?.length)
                ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px]">
                    {q.reward.unlocks?.map((u) => (
                      <span key={u} className="rounded-full bg-(--c)/10 px-2 py-px font-semibold">{u}</span>
                    ))}
                    {[...(q.reward.items ?? []), ...(q.reward.trial_items ?? [])].map((it) => (
                      <ItemChip key={it} name={it.replace(/\s*×\d+$/, "")} />
                    ))}
                  </div>
                )
                : null}
            </Row>
          );
        })}
      </div>
    </PSlot>
  );
}

/* ------------------------------------------------------------ 7 Squads */

function Squads({ route, n }: { route: RouteName; n: number }) {
  const at = squadsAt(route, n);
  const s = section(n)!;
  return (
    <PSlot
      n={7}
      id={id(n, "squads")}
      title="Squads"
      icon={ICON[7]}
      empty={s.squads && at ? false : "No world map this Section: the battle uses the arriving allies."}
      aside={<KitLink tab="squads">Squad board</KitLink>}
    >
      {at && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
            {squadsFile(route)?.draft && (
              <span className="rounded-full bg-warn px-2 py-px text-[11.5px] font-bold tracking-[0.06em] text-warn-ink uppercase">
                Draft
              </span>
            )}
            {squadLine(n)} · Eshmel stays in Dagsion and joins any gate
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-2">
            {at.squads.map((q) => <SquadCard key={q.id} sq={q} route={route} n={n} compact />)}
          </div>
        </>
      )}
    </PSlot>
  );
}

/* ------------------------------------------------------------ 8 Gates */

function GateCard(
  { route, n, b, f, order }: { route: RouteName; n: number; b: Battle; f: SalvationFile; order?: number },
) {
  const t = useTrack();
  const plan = f.gates.find((g) => g.battle === b.name);
  const squads = (squadsAt(route, n)?.squads ?? []).filter((q) => q.gates.includes(b.name));
  const units = plan?.deploy
    ? plan.deploy.length + (b.kind ? 0 : 1)
    : squads.reduce((a, q) => a + q.units.length, 0) + (b.kind ? 0 : 1);
  const gid = pids.gate(route, n, b.name);
  const done = Boolean(t.done[gid]);
  return (
    <article
      className={cx(
        "overflow-hidden rounded-lg bg-paper/50 shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]",
        done && "opacity-70",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gold/25 bg-paper-2/60 px-3 py-2">
        <Tick id={gid} label={`${b.name} cleared`} />
        {order && (
          <span className="grid size-6 place-items-center rounded-full bg-(--c) font-logo text-[13px] font-bold text-white">
            {order}
          </span>
        )}
        <span className="min-w-0">
          <b className="font-display text-[16.5px]">{b.name}</b>
          <span className="ml-2 text-[13px] text-muted">{[b.gate, b.location].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex-1" />
        {b.kind === "skirmish" && <Tag tone="route">skirmish</Tag>}
        {squads.map((q) => (
          <span key={q.id} className="inline-flex items-center gap-1">
            <SquadBadge id={q.id} size={20} />
            {plan?.launch === q.id && (
              <span
                className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase"
                title="Starts the battle and spends its map turn"
              >
                launches
              </span>
            )}
          </span>
        ))}
        {b.max_units ? <CapMeter used={Math.min(units, b.max_units + 2)} cap={b.max_units} /> : null}
      </header>
      {plan?.deploy?.length ? <Deploy route={route} n={n} units={plan.deploy} eshmel={!b.kind} /> : null}
      {plan?.blessings?.length ? <Blessings list={plan.blessings} k={`${n}${b.name}`} /> : null}
      <div className="px-3 py-2.5">
        <BattleFacts b={b} lose={b.kind === "dungeon" ? "—" : "Eshmel falls"} tips={plan?.tips} />
        {b.flow && (
          <p className="m-0 mt-2 text-[14px]">
            <b className="font-semibold">Flow:</b> <ConfText text={b.flow} k="fl" />
          </p>
        )}
        {b.allies && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px]">
            <Kicker>Allies arrive</Kicker>
            {b.allies.map((a) => (
              <span key={a.turn} className="inline-flex items-center gap-1 rounded-full bg-paper-2/80 py-0.5 pr-2 pl-1">
                <b className="px-1 text-[12px] text-gold-lo">T{a.turn}</b>
                {a.units.map((u) => <UnitPortrait key={u} name={u.replace("?", "")} size={22} flat title={u} />)}
              </span>
            ))}
            {b.allies_note && <span className="text-muted">{b.allies_note}</span>}
          </div>
        )}
        {b.guests?.length
          ? (
            <p className="m-0 mt-2 text-[14px]">
              <b className="font-semibold">Guests:</b> {b.guests.join("; ")}
            </p>
          )
          : null}
        {b.formation && (
          <p className="m-0 mt-2 text-[14px]">
            <b className="font-semibold">Formation:</b> {b.formation}
          </p>
        )}
      </div>
    </article>
  );
}

/** Blessings to equip for a gate (as on War chapters): the god, the level's effect from gods.json, and why. */
function Blessings({ list, k }: { list: NonNullable<SalvationFile["gates"][number]["blessings"]>; k: string }) {
  return (
    <div className="border-b border-gold/25 bg-paper/50 px-3 py-2">
      <Kicker>Blessings</Kicker>
      <ul className="m-0 mt-1 grid list-none gap-1.5 p-0">
        {list.map((b, i) => {
          const fx = GOD_LIST.find((g) => g.name === b.god)?.levels.find((l) => l.lv === (b.lv ?? 1))?.effect;
          return (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
              <GodPill god={b.god} lv={b.lv} />
              <span className="text-[14px] leading-snug">
                {b.lv && fx && <b className="font-semibold">{fx}.</b>} <ConfText text={b.why} k={`gb${k}${i}`} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The deploy list, grouped by the squad each unit rides in, with Eshmel on top. */
function Deploy({ route, n, units, eshmel }: { route: RouteName; n: number; units: string[]; eshmel: boolean }) {
  const sq = squadsAt(route, n)?.squads ?? [];
  const of = (u: string) => sq.find((q) => q.units.includes(u))?.id;
  const groups: { id?: string; units: string[] }[] = [];
  for (const u of units) {
    const id = of(u);
    const g = groups.find((x) => x.id === id);
    if (g) g.units.push(u);
    else groups.push({ id, units: [u] });
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gold/25 bg-paper/70 px-3 py-2">
      <Kicker>Deploy</Kicker>
      {groups.map((g) => (
        <span key={g.id ?? "x"} className="inline-flex items-center gap-1">
          {g.id && <SquadBadge id={g.id} size={18} />}
          <span className="flex gap-0.5">
            {g.units.map((u) => <UnitPortrait key={u} name={u} size={32} flat />)}
          </span>
        </span>
      ))}
      {eshmel && (
        <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
          <UnitPortrait name="Eshmel" size={24} flat />+ Eshmel
        </span>
      )}
    </div>
  );
}

function Gates({ route, f, n }: { route: RouteName; f: SalvationFile; n: number }) {
  const s = section(n)!;
  const list = s.battles.filter((b) => b.kind !== "dungeon");
  const dungeon = s.battles.find((b) => b.kind === "dungeon");
  const drops = dropsAt(dropTag(3, n));
  const orderOf = (b: Battle) => f.gates.find((g) => g.battle === b.name)?.order;
  return (
    <PSlot n={8} id={id(n, "gates")} title={list.length > 1 ? `Battles · ${list.length}` : "Battle"} icon={ICON[8]}>
      {s.overworld?.length
        ? (
          <ul className="m-0 mb-2 grid list-none gap-1 p-0 text-[14px]">
            {s.overworld.map((o, i) => (
              <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2">
                <span className="mt-[7px] size-1.5 rounded-full bg-gold" />
                <span>
                  <ConfText text={o} k={`ow${i}`} />
                </span>
              </li>
            ))}
          </ul>
        )
        : null}
      <div className="grid gap-3">
        {[...list].sort((a, b) =>
          (orderOf(a) ?? 9) - (orderOf(b) ?? 9)
        ).map((b) => <GateCard key={b.name} route={route} n={n} b={b} f={f} order={orderOf(b)} />)}
      </div>
      {dungeon && (
        <p className="m-0 mt-3 text-[14px]">
          <b className="font-semibold">{dungeon.name}:</b> <ConfText text={dungeon.flow ?? ""} k="dg" />
        </p>
      )}
      {drops.length > 0 && (
        <>
          <SubHead>Drops and pickups</SubHead>
          <DropGrid drops={drops} />
        </>
      )}
    </PSlot>
  );
}

/* ------------------------------------------------------------ 9 Before you move on */

function Exit({ route, f, n }: { route: RouteName; f: SalvationFile; n: number }) {
  const t = useTrack();
  const open = f.missables.filter((m) => !t.done[missableId(route, m)]);
  const quests = n >= 5
    ? ([...new Set(salvationAll(route).flatMap((x) => x.quests).map((q) => q.id))].map((id) => p3Quest(id)).filter((
      q,
    ): q is P3Quest => Boolean(q && !t.done[pids.p3quest(q.id)])))
    : [];
  const gates = (section(n)?.battles ?? []).filter((b) => !b.kind && !t.done[pids.gate(route, n, b.name)]);
  const clear = !open.length && !quests.length && !gates.length && !f.exitExtra?.length;
  return (
    <PSlot
      n={9}
      id={id(n, "exit")}
      title="Before you move on"
      icon={ICON[9]}
      alert={!clear}
      empty={clear ? "All clear." : false}
    >
      {open.map((m) => (
        <Row key={m.id} tick={{ id: missableId(route, m), label: m.text }}>
          <ConfText text={m.text} k={`xo${m.id}`} />
          <DueLabel due={m.when} text={m.text} />
        </Row>
      ))}
      {gates.map((b) => (
        <Row key={b.name} tick={{ id: pids.gate(route, n, b.name), label: `${b.name} cleared` }}>
          {b.name} <span className="text-[13px] text-muted">· {b.location}</span>
        </Row>
      ))}
      {quests.map((q) => (
        <Row key={q.id} tick={{ id: pids.p3quest(q.id), label: q.name }}>
          <P3QuestName q={q} />{" "}
          <span className="ml-1.5 text-[13px] font-semibold text-blood tabular-nums">ends {q.due}</span>
        </Row>
      ))}
      {(f.exitExtra ?? []).map((l, i) => <LineRow key={i} line={l} k={`sx${i}`} />)}
    </PSlot>
  );
}

const salvationAll = (route: RouteName) =>
  [1, 2, 3, 4, 5, 6].map((n) => salvationFile(route, n)).filter((x): x is SalvationFile => Boolean(x));

/* ------------------------------------------------------------ section */

export const SectionView = memo(function SectionView({ route, n }: { route: RouteName; n: number }) {
  const f = salvationFile(route, n);
  const p = pos(3, n);
  return (
    <section id={`s-${n}`} data-section={`s-${n}`} className="scroll-mt-20 pt-10 pb-2">
      <Band route={route} n={n} />
      {f
        ? (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            <Plan f={f} n={n} />
            <PSlot
              n={2}
              id={id(n, "missables")}
              title="Missables & choices"
              icon={ICON[2]}
              alert
              empty={f.missables.length ? false : "Nothing missable this Section."}
            >
              {f.missables.map((m, i) => <MissableRow key={m.id} m={m} k={`sm${n}${i}`} route={route} />)}
            </PSlot>
            <PSlot
              n={3}
              id={id(n, "classes")}
              title="Classes"
              icon={ICON[3]}
              empty={examCount(route, p).length || f.licenses?.length ? false : "No class changes this Section."}
              aside={<KitLink tab="diadem">Divine classes</KitLink>}
            >
              <LicenseQueue route={route} f={f} />
              <ExamCards route={route} p={p} />
            </PSlot>
            <PSlot n={4} id={id(n, "gear")} title="Gear" icon={ICON[4]} empty={false}>
              <KitCards route={route} p={p} assign={f.gear?.assign} />
              {f.gear?.note?.length ? <Lines lines={f.gear.note} k="sg" /> : null}
              <p className="m-0 mt-1 text-[13.5px] text-muted">
                Storage holds every route's Part I inventory. Trial rewards: Temples tab · Divine items: Diadem tab ·
                max refines need Warrior's Soulstone.
              </p>
            </PSlot>
            <Joins route={route} f={f} n={n} />
            <Quests f={f} n={n} />
            <Squads route={route} n={n} />
            <Gates route={route} f={f} n={n} />
            <Exit route={route} f={f} n={n} />
            <PartFinish route={route} part="salvation" n={n} label={`Section ${n}`} />
          </div>
        )
        : <p className="mt-3 text-muted">No plan for this Section yet.</p>}
    </section>
  );
});
