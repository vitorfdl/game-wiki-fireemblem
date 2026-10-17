import { memo, type ReactNode } from "react";
import { Flag, Gem, GraduationCap, LayoutGrid, ListChecks, Swords, TriangleAlert, UserPlus, Zap } from "lucide-react";
import { CLASSES } from "../../lib/data.ts";
import { examsFor, missableId } from "../../lib/chapter.ts";
import { dropsAt, dropTag, GOD_LIST, P2, pos, warChapter } from "../../lib/parts.ts";
import { pids, warFile } from "../../lib/part-plan.ts";
import { nowIn, useTrack } from "../../lib/track.ts";
import type { RouteName, WarChapterFile } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { DueLabel, MissableRow } from "../chapter/view.tsx";
import { LineRow, Lines, Row, SubHead, Tag } from "../chapter/bits.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { classKey } from "../ui/class-chip.tsx";
import { UnitPortrait, UnitRef } from "../ref/rich.tsx";
import {
  BattleFacts,
  CapMeter,
  DropGrid,
  ExamCards,
  Kicker,
  KitCards,
  KitLink,
  loseLine,
  PartFinish,
  PSlot,
  Seat,
} from "./shared.tsx";
import { GodPill } from "./god.tsx";

/*
 * A War chapter (D-124): band, then eight slots in a fixed order: Prep, Missables, Classes, Gear, Recruits & guests,
 * Deploy, Battle, Before you move on. No Quests or Explore: Part II has neither.
 */

const ICON: Record<number, ReactNode> = {
  1: <Flag />,
  2: <TriangleAlert />,
  3: <GraduationCap />,
  4: <Gem />,
  5: <UserPlus />,
  6: <LayoutGrid />,
  7: <Swords />,
  8: <ListChecks />,
};

const id = (ch: number, slot: string) => `w-${ch}-${slot}`;

/* ------------------------------------------------------------ band */

function WarBand({ route, ch }: { route: RouteName; ch: number }) {
  const track = useTrack();
  const c = warChapter(ch)!;
  const now = nowIn(route, "war", track) === ch;
  const b = c.battles[0];
  const people = b.guests?.length ? ["Aswan", "Tahonia"].filter((n) => b.guests!.some((g) => g.includes(n))) : [];
  return (
    <header className="relative overflow-hidden rounded-lg bg-teal px-5 pt-4 pb-4 text-parchment shadow-[0_10px_28px_-14px_rgba(16,38,42,.75)]">
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
          {ch}
        </span>
        <div className="min-w-[240px] flex-1">
          <div className="text-[11px] font-semibold tracking-[0.12em] text-gold-hi/80 uppercase">
            War · Chapter {ch}
          </div>
          <h2 className="m-0 flex flex-wrap items-baseline gap-x-2.5 font-display text-[clamp(22px,2.6vw,30px)] leading-tight text-white">
            {c.name}
            {now && (
              <span className="rounded-full bg-gold-hi/20 px-2 py-px font-sans text-[11px] font-bold tracking-[0.1em] text-gold-hi uppercase ring-1 ring-gold-hi/50">
                Now
              </span>
            )}
          </h2>
          <p className="m-0 mt-0.5 text-[13.5px] text-parchment/75">
            {c.battles.map((x) => x.name).join(", then ")} ·{" "}
            <b className="font-semibold text-parchment">{b.location}</b>
            {ch >= 5 ? " · no facilities" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BandChip k="Deploy" v={String(b.max_units ?? "?")} />
          <BandChip k="Floor" v={floor(ch) ?? "—"} />
          {people.length > 0 && (
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <span className="text-[10.5px] font-semibold tracking-[0.1em] text-gold-hi/80 uppercase">Guests</span>
              <span className="flex -space-x-2">
                {people.map((n) => <UnitPortrait key={n} name={n} size={40} ring="var(--color-teal)" />)}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const BandChip = ({ k, v }: { k: string; v: string }) => (
  <span className="flex flex-col items-center rounded-md bg-white/[0.07] px-2.5 py-1 ring-1 ring-white/10">
    <span className="text-[9.5px] font-semibold tracking-[0.12em] text-gold-hi/80 uppercase">{k}</span>
    <span className="font-logo text-[18px] leading-tight font-bold text-white tabular-nums">{v}</span>
  </span>
);

/** Training Drills level floor for a War chapter (part2-war.json). */
const floor = (ch: number) => P2.prep.army_actions.find((a) => a.levels)?.levels?.[String(ch)];

/* ------------------------------------------------------------ 1 Prep */

/** Licenses spent this chapter, per tier, from the exam cards (free Licenses: 5 of each, refilled). */
function LicenseMeter({ route, ch }: { route: RouteName; ch: number }) {
  const exams = examsFor(route, pos(2, ch)).filter((e) => !e.onJoin);
  const tierOf = (cls: string) => CLASSES[classKey(cls) ?? ""]?.tier;
  return (
    <div className="grid gap-1.5">
      {(["Beginner", "Specialty", "Advanced"] as const).map((tier) => {
        const who = exams.filter((e) => tierOf(e.to) === tier).map((e) => e.unit.name);
        return (
          <div key={tier} className="grid grid-cols-[74px_minmax(0,1fr)] items-center gap-2">
            <span className="text-[12px] font-semibold text-ink-soft">{tier}</span>
            <span className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={cx(
                    "grid size-[30px] place-items-center rounded-md",
                    who[i]
                      ? "bg-(--c)/12 shadow-[inset_0_0_0_1.5px_var(--c)]"
                      : "shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]",
                  )}
                >
                  {who[i] && <UnitPortrait name={who[i]} size={24} flat />}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Prep({ route, f }: { route: RouteName; f: WarChapterFile }) {
  const a = f.action;
  const fl = floor(f.ch);
  return (
    <PSlot n={1} id={id(f.ch, "prep")} title="Prep" icon={ICON[1]} aside={<KitLink tab="warprep">War Prep</KitLink>}>
      <div className="grid gap-3 @container lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto]">
        <div className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]">
          <Kicker>Army Action</Kicker>
          {a
            ? (
              <>
                <div className="mt-1 flex items-center gap-2">
                  <Zap className="size-4 text-(--c)" />
                  <b className="text-[16px]">{a.pick}</b>
                  {a.pick === "Training Drills" && fl && <Tag tone="route">floor Lv {fl}</Tag>}
                  {a.god && <GodPill god={a.god} />}
                </div>
                <p className="m-0 mt-1 text-[14px] leading-snug text-ink-soft">
                  <ConfText text={a.why} k="aw" />
                </p>
              </>
            )
            : (
              <p className="m-0 mt-1 text-[14px] text-muted">
                No Dispatch Officer this chapter: no facilities after Ch 4.
              </p>
            )}
        </div>
        <div className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]">
          <Kicker>Blessings · Divine Sand refilled</Kicker>
          <ul className="m-0 mt-1 grid list-none gap-1.5 p-0">
            {f.blessings.map((b, i) => {
              const fx = GOD_LIST.find((g) =>
                g.name === b.god
              )?.levels.find((l) =>
                l.lv === (b.lv ?? 1)
              )?.effect;
              return (
                <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
                  <GodPill god={b.god} lv={b.lv} />
                  <span className="text-[14px] leading-snug">
                    {b.lv && fx && <b className="font-semibold">{fx}.</b>}
                    <ConfText text={b.why} k={`b${i}`} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]">
          <Kicker>Free Licenses used</Kicker>
          <div className="mt-1.5">
            <LicenseMeter route={route} ch={f.ch} />
          </div>
        </div>
      </div>
    </PSlot>
  );
}

/* ------------------------------------------------------------ 2, 3, 4, 5 */

function Missables({ route, f }: { route: RouteName; f: WarChapterFile }) {
  return (
    <PSlot
      n={2}
      id={id(f.ch, "missables")}
      title="Missables & choices"
      icon={ICON[2]}
      alert
      empty={f.missables.length ? false : "Nothing missable this chapter."}
    >
      {f.missables.map((m, i) => <MissableRow key={m.id} m={m} k={`wm${f.ch}${i}`} route={route} />)}
    </PSlot>
  );
}

function Classes({ route, ch }: { route: RouteName; ch: number }) {
  const n = examsFor(route, pos(2, ch)).filter((e) => !e.onJoin).length;
  return (
    <PSlot
      n={3}
      id={id(ch, "classes")}
      title="Classes"
      icon={ICON[3]}
      empty={n ? false : "No class changes: everyone keeps their class this chapter."}
      aside={<KitLink tab="ledger">Part II class plan</KitLink>}
    >
      <ExamCards route={route} p={pos(2, ch)} />
    </PSlot>
  );
}

function Gear({ route, f }: { route: RouteName; f: WarChapterFile }) {
  const drops = dropsAt(dropTag(2, f.ch));
  const p = pos(2, f.ch);
  return (
    <PSlot n={4} id={id(f.ch, "gear")} title="Gear" icon={ICON[4]}>
      <p className="m-0 text-[13.5px] text-muted">
        Handouts every chapter: 1 Concoction and 1 Antitoxin per unit, plus +2/+3 class weapons that stay in Part II.
      </p>
      <KitCards route={route} p={p} assign={f.gear?.assign} />
      {drops.length > 0 && (
        <>
          <SubHead>Drops on this map</SubHead>
          <DropGrid drops={drops} />
        </>
      )}
      {f.gear?.note?.length
        ? (
          <div className="mt-1">
            <Lines lines={f.gear.note} k="gn" />
          </div>
        )
        : null}
    </PSlot>
  );
}

const PEOPLE_TONE = {
  guest: "bg-[#dcefe3] text-[#1f6a43]",
  recruit: "bg-(--c)/12 text-ink",
  skip: "bg-paper-3 text-muted",
};
const PEOPLE_LABEL = { guest: "Guest", recruit: "Recruit", skip: "Not this route" };

function People({ f }: { f: WarChapterFile }) {
  const list = f.people ?? [];
  return (
    <PSlot
      n={5}
      id={id(f.ch, "people")}
      title="Recruits & guests"
      icon={ICON[5]}
      empty={list.length ? false : "No guests or recruits on this map."}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-2">
        {list.map((x) => (
          <div
            key={x.unit}
            className={cx(
              "flex gap-3 rounded-md bg-paper/60 p-2.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]",
              x.kind === "skip" && "opacity-75",
            )}
          >
            <UnitPortrait name={x.unit} size={40} ring="var(--color-card)" />
            <div className="min-w-0 text-[13.5px] leading-snug">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">
                  <UnitRef name={x.unit} avatar={false} />
                </span>
                <span
                  className={cx(
                    "rounded-full px-1.5 text-[10.5px] font-bold tracking-[0.06em] uppercase",
                    PEOPLE_TONE[x.kind],
                  )}
                >
                  {PEOPLE_LABEL[x.kind]}
                </span>
              </div>
              <p className="m-0 mt-0.5">
                <ConfText text={x.text} k={`p${x.unit}`} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </PSlot>
  );
}

/* ------------------------------------------------------------ 6 Deploy */

function Deploy({ route, f }: { route: RouteName; f: WarChapterFile }) {
  const cap = warChapter(f.ch)?.battles[0]?.max_units ?? f.deploy.units.length;
  const p = pos(2, f.ch);
  const seats = Array.from({ length: cap }, (_, i) => f.deploy.units[i]);
  return (
    <PSlot
      n={6}
      id={id(f.ch, "deploy")}
      title="Deploy"
      icon={ICON[6]}
      aside={<CapMeter used={f.deploy.units.length} cap={cap} label="slots" />}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-1.5">
        {seats.map((n, i) => <Seat key={i} name={n} route={route} p={p} n={i + 1} />)}
      </div>
      {f.deploy.bench?.length
        ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-paper-2/60 px-3 py-2">
            <Kicker>Bench</Kicker>
            {f.deploy.bench.map((n) => (
              <span key={n} className="inline-flex items-center gap-1.5 text-[14px]">
                <UnitPortrait name={n} size={24} flat />
                <UnitRef name={n} avatar={false} />
              </span>
            ))}
            <span className="text-[12.5px] text-muted">· Training Drills keeps them at the floor</span>
          </div>
        )
        : null}
      {f.deploy.note && (
        <p className="m-0 mt-2 text-[14px] text-ink-soft">
          <ConfText text={f.deploy.note} k="dn" />
        </p>
      )}
    </PSlot>
  );
}

/* ------------------------------------------------------------ 7 Battle */

function Battles({ route, f }: { route: RouteName; f: WarChapterFile }) {
  const c = warChapter(f.ch)!;
  const lose = loseLine(route);
  return (
    <PSlot
      n={7}
      id={id(f.ch, "battle")}
      title={`Battle · ${c.battles.map((b) => b.name).join(" → ")}`}
      icon={ICON[7]}
    >
      {c.battles.map((b, i) => (
        <div key={b.name} className={cx(i > 0 && "mt-4 border-t border-gold/25 pt-3")}>
          {c.battles.length > 1 && <div className="mb-1.5 font-display text-[16px]">{i + 1}. {b.name}</div>}
          <BattleFacts b={b} lose={lose} tips={i === 0 ? f.tips : undefined} />
          {b.after && (
            <p className="m-0 mt-2 text-[14px] text-ink-soft">
              <b className="font-semibold">After:</b> {b.after}
            </p>
          )}
        </div>
      ))}
    </PSlot>
  );
}

/* ------------------------------------------------------------ 8 Before you move on */

function Exit({ route, f }: { route: RouteName; f: WarChapterFile }) {
  const t = useTrack();
  const open = f.missables.filter((m) => !t.done[missableId(route, m)]);
  const won = pids.war(route, f.ch);
  return (
    <PSlot
      n={8}
      id={id(f.ch, "exit")}
      title="Before you move on"
      icon={ICON[8]}
      alert={open.length > 0 || !t.done[won]}
    >
      {open.map((m) => (
        <Row key={m.id} tick={{ id: missableId(route, m), label: m.text }}>
          <ConfText text={m.text} k={`xo${m.id}`} />
          <DueLabel due={m.when} text={m.text} />
        </Row>
      ))}
      <Row tick={{ id: won, label: `War Ch ${f.ch} won` }}>
        Battle won{f.ch < 6 ? ", every exam taken and the Army Action spent" : ""}
      </Row>
      {(f.exitExtra ?? []).map((l, i) => <LineRow key={i} line={l} k={`xx${i}`} />)}
    </PSlot>
  );
}

/* ------------------------------------------------------------ chapter */

export const WarChapterView = memo(function WarChapterView({ route, ch }: { route: RouteName; ch: number }) {
  const f = warFile(route, ch);
  return (
    <>
      <section id={`w-${ch}`} data-section={`w-${ch}`} className="scroll-mt-20 pt-10 pb-2">
        <WarBand route={route} ch={ch} />
        {f
          ? (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
              <Prep route={route} f={f} />
              <Missables route={route} f={f} />
              <Classes route={route} ch={ch} />
              <Gear route={route} f={f} />
              <People f={f} />
              <Deploy route={route} f={f} />
              <Battles route={route} f={f} />
              <Exit route={route} f={f} />
              <PartFinish route={route} part="war" n={ch} label={`War Ch ${ch}`} />
            </div>
          )
          : <p className="mt-3 text-muted">No plan for this chapter yet.</p>}
      </section>
    </>
  );
});
