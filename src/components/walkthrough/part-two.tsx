import type { ReactNode } from "react";
import { Archive, ArrowRight, ChevronDown, CircleHelp, Flag, ListChecks, Sparkles, TriangleAlert, UserPlus } from "lucide-react";
import { char } from "../../lib/data.ts";
import { chapterFile, dayOf, ids, quest, setAsideQuests } from "../../lib/chapter.ts";
import { isTaskDone, taskById, tasks } from "../../lib/open-tasks.ts";
import { resolve } from "../../lib/refs.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import type { Line, RouteName } from "../../lib/types.ts";
import { routeUnits } from "../../lib/walkthrough/builds.ts";
import type { Section } from "../../lib/walkthrough/model.ts";
import { type OpenQuestion, routeExit, routeNotes } from "../../lib/walkthrough/route-files.ts";
import { RefChip, UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { Panel, Sub } from "../ui/panel.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { Gate } from "./inline.tsx";
import { Lines, Tick } from "../chapter/bits.tsx";
import { GroupView, Row } from "./sections.tsx";

/*
 * The end of the route page: Before Part II (exit.json, else the Markdown exit checklist), Open questions
 * (notes.json, else the Markdown notes) and, while chapters still render from Markdown, the old Route plan as a
 * folded archive at the bottom.
 */

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Dark band that opens an end section, in the chapter band's style (V-14). */
function EndBand({ icon, kicker, title, sub }: { icon: ReactNode; kicker: string; title: string; sub: string }) {
  return (
    <header className="relative overflow-hidden rounded-lg bg-teal px-5 py-4 text-parchment shadow-[0_10px_28px_-14px_rgba(16,38,42,.75)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--c)_45%,transparent),transparent_60%)]"
      />
      <div className="relative flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full text-gold-hi shadow-[inset_0_0_0_2px_rgba(231,200,128,.7)] [&>svg]:size-6"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-[0.12em] text-gold-hi/85 uppercase">{kicker}</div>
          <h2 className="m-0 font-display text-[clamp(22px,2.6vw,30px)] leading-tight text-white">{title}</h2>
          <p className="m-0 mt-0.5 text-[13.5px] text-parchment/75">{sub}</p>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------ Before Part II */

type Open = { id: string; text: string; ch: number; kind: "missable" | "quest"; due?: string };

/**
 * Tracked Part I events still open up to the current chapter: recruits from the unit files (army and Part II
 * extras, only those that have joined by now), missables and quests from the chapter files (skipped quests and
 * unpicked fork branches left out).
 */
function useOpenPartOne(route: RouteName) {
  const t = useTrack();
  const now = nowChapter(route, t);
  // Same task list as the chapters' carried rows (D-139), so the two never disagree.
  const recruits = routeUnits(route).filter((u) => {
    const task = !u.lord ? taskById(route, ids.recruit(route, u.name)) : undefined;
    return task && task.start <= now && !t.done[task.id];
  });
  const aside = setAsideQuests(route, t.forks);
  const open: Open[] = tasks(route).flatMap((task): Open[] => {
    if (isTaskDone(task, t.done, t.forks)) return [];
    if (task.kind === "missable") {
      if (task.m.quest && aside.has(task.m.quest)) return [];
      return [{ id: task.id, text: task.m.text, ch: task.start, kind: "missable", due: task.m.when ?? task.due }];
    }
    if (task.kind === "quest" && !aside.has(task.quest)) {
      return [{ id: task.id, text: task.quest, ch: task.start, kind: "quest", due: task.due }];
    }
    return [];
  });
  return { recruits, open };
}

/** The first day of the current chapter's free time: anything due before it has expired. */
function today(route: RouteName, now: number): number {
  for (let ch = now; ch >= 1; ch--) {
    const f = chapterFile(route, ch)?.free;
    if (f) return dayOf(f.from);
  }
  return 0;
}

/**
 * Tracked Part I steps not ticked: recruits that have joined, then missables and quests by chapter (the current
 * one and earlier open, later chapters folded), with the ones whose date has passed folded into "Expired".
 */
function StillOpen({ route }: { route: RouteName }) {
  const { recruits, open } = useOpenPartOne(route);
  const now = nowChapter(route, useTrack());
  const day = today(route, now);
  // A row expires after the last date it names ("9/17 to 9/25" ends 9/25).
  const dated = (o: Open) => {
    const d = o.due?.match(/\d{1,2}\/\d{1,2}/g)?.at(-1);
    return d ? dayOf(d) : undefined;
  };
  const expired = open.filter((o) => (dated(o) ?? Infinity) < day);
  const live = open.filter((o) => !expired.includes(o));
  const byCh = [...new Set(live.map((o) => o.ch))].sort((a, b) => a - b).map((ch) => [ch, live.filter((o) => o.ch === ch)] as const);
  const dueNow = recruits.length + live.filter((o) => o.ch <= now).length + expired.length;
  return (
    <Panel
      icon={<Flag />}
      title="Still open in Part I"
      sub={dueNow ? `tracked steps up to Ch ${now} not ticked yet` : undefined}
      empty={!dueNow && !live.length ? "Nothing due yet." : undefined}
    >
      {!dueNow && <p className="m-0 text-[13.5px] text-muted">Nothing due yet. Later chapters are folded below.</p>}
      {recruits.length > 0 && (
        <>
          <Sub icon={<UserPlus />}>Not recruited · {recruits.length}</Sub>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5 p-0">
            {recruits.map((u) => {
              const g = u.character.recruitOn?.[route];
              return (
                <li
                  key={u.name}
                  className="flex min-w-0 items-center gap-2 rounded-md bg-paper/60 py-1 pr-2 pl-1 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]"
                >
                  <UnitPortrait name={u.name} size={28} ring="var(--color-card)" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[14px]"><UnitRef name={u.name} avatar={false} /></span>
                    <span className="flex flex-wrap gap-1 text-[12px] text-muted">
                      {u.extra ? "Extra · " : ""}Ch {u.join}
                      {g?.support !== undefined && <Gate kind="S" n={g.support} />}
                      {g?.renown !== undefined && <Gate kind="R" n={g.renown} />}
                    </span>
                  </span>
                  <Tick id={ids.recruit(route, u.name)} label={`${u.name} recruited`} />
                </li>
              );
            })}
          </ul>
        </>
      )}
      {expired.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
            <ChevronDown aria-hidden="true" className="size-3.5 -rotate-90 transition-transform group-open:rotate-0" />
            Expired · {expired.length}
            <span className="font-normal tracking-normal normal-case">past their date: lost unless the note says otherwise</span>
          </summary>
          <OpenList list={expired} route={route} />
        </details>
      )}
      {byCh.map(([ch, list]) =>
        ch <= now
          ? (
            <div key={ch} className="mt-3">
              <Sub icon={<TriangleAlert />} aside={<ChLink ch={ch} />}>Ch {ch} · {list.length}</Sub>
              <OpenList list={list} route={route} />
            </div>
          )
          : (
            <details key={ch} className="group mt-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-semibold tracking-[0.08em] text-gold-lo uppercase">
                <ChevronDown aria-hidden="true" className="size-3.5 -rotate-90 transition-transform group-open:rotate-0" />
                Ch {ch} · {list.length}
                <span className="font-normal tracking-normal text-muted normal-case">not reached yet</span>
              </summary>
              <OpenList list={list} route={route} />
            </details>
          )
      )}
    </Panel>
  );
}

const ChLink = ({ ch }: { ch: number }) => (
  <button type="button" onClick={() => go(`ch-${ch}`)} className="text-[12.5px] font-semibold text-gold-lo hover:text-ink">
    Ch {ch} →
  </button>
);

function OpenList({ list, route }: { list: Open[]; route: RouteName }) {
  return (
    <ul className="m-0 mt-1 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-x-6 gap-y-1 p-0">
      {list.map((o) => {
        const ref = o.kind === "quest" ? resolve(o.text, "quest") : undefined;
        return (
          <li key={o.id} className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-1.5 text-[14.5px]">
            <Tick id={o.id} label={o.text} />
            <span className="min-w-0">
              {o.kind === "missable" && <span className="mr-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-blood-2 uppercase">Missable</span>}
              {ref ? <RefChip r={ref} /> : <ConfText text={o.kind === "quest" ? quest(o.text)?.name ?? o.text : o.text} k={`${route}${o.id}`} />}
              {o.due && <span className="ml-1.5 text-[12.5px] text-muted tabular-nums">{o.kind === "quest" ? `due ${o.due}` : `when: ${o.due}`}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Authored lines grouped by their `group` label, each group under a sub-header. */
function Grouped({ lines, k }: { lines: Line[]; k: string }) {
  const groups = new Map<string, Line[]>();
  for (const l of lines) groups.set(l.group ?? "", [...(groups.get(l.group ?? "") ?? []), l]);
  return (
    <>
      {[...groups].map(([g, list]) => (
        <div key={g}>
          {g && <Sub>{g}</Sub>}
          <Lines lines={list} k={`${k}${g}`} stats />
        </div>
      ))}
    </>
  );
}

export function BeforePartTwo({ route, exits, later }: { route: RouteName; exits: Section[]; later: Section[] }) {
  const exit = routeExit(route);
  return (
    <section id="before-part-2" data-section="before-part-2" className="scroll-mt-20 pt-10 pb-2">
      <EndBand
        icon={<ListChecks />}
        kicker="After Chapter 12"
        title="Before Part II"
        sub="What to finish in Part I, and what Part II changes about it."
      />
      {exit
        ? (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            <StillOpen route={route} />
            <Panel icon={<Sparkles />} title="Part II" sub="Army Training, free Licenses, side trips" bodyClassName="lg:columns-2 lg:gap-8 [&_.grid]:break-inside-avoid">
              <Grouped lines={exit.partII} k="p2" />
              {exit.extra?.length
                ? (
                  <>
                    <Sub>Also</Sub>
                    <Lines lines={exit.extra} k="px" />
                  </>
                )
                : null}
            </Panel>
          </div>
        )
        : (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            <StillOpen route={route} />
            {exits.map((s, i) => (
              <Panel key={s.id} id={i === 0 ? undefined : s.id} icon={<ListChecks />} title={i === 0 ? "Part I exit checklist" : s.title} bodyClassName="text-[15.5px] leading-[1.6]">
                {s.groups.map((g) => <GroupView key={g.id} g={g} />)}
              </Panel>
            ))}
            {later.map((s) => (
              <Panel key={s.id} icon={<Sparkles />} title={s.title} fold={{ open: false }} bodyClassName="text-[15.5px] leading-[1.6]">
                {s.groups.map((g) => <GroupView key={g.id} g={g} />)}
              </Panel>
            ))}
          </div>
        )}
    </section>
  );
}

/* ------------------------------------------------------------ Open questions */

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

function QuestionCard({ q, i }: { q: OpenQuestion; i: number }) {
  return (
    <li className="flex min-w-0 flex-col rounded-md bg-paper/60 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3),inset_3px_0_0_var(--color-gold)]">
      <p className="m-0 text-[14.5px] leading-snug"><ConfText text={q.text} k={`oq${i}`} /></p>
      {(q.ch || q.units?.length || q.sources?.length)
        ? (
          <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-2 text-[12.5px]">
            {q.ch && (
              <button type="button" onClick={() => go(`ch-${q.ch}`)} className="inline-flex items-center gap-0.5 font-semibold text-gold-lo hover:text-ink">
                Ch {q.ch} <ArrowRight aria-hidden="true" className="size-3" />
              </button>
            )}
            {q.units?.length
              ? <span className="flex -space-x-1">{q.units.filter((u) => char(u)).map((u) => <UnitPortrait key={u} name={u} size={22} flat className="ring-2 ring-card" />)}</span>
              : null}
            <span className="flex-1" />
            {q.sources?.map((s) =>
              /^https?:/.test(s)
                ? <a key={s} href={s} target="_blank" rel="noreferrer" className="text-muted underline decoration-gold/50 underline-offset-2 hover:text-ink">{host(s)}</a>
                : <span key={s} className="text-muted">{s}</span>
            )}
          </div>
        )
        : null}
    </li>
  );
}

export function OpenQuestions({ route, sections }: { route: RouteName; sections: Section[] }) {
  const notes = routeNotes(route);
  if (notes) {
    const list = notes.openQuestions;
    return (
      <div className="mt-3">
        <Panel
          id="notes"
          icon={<CircleHelp />}
          title="Open questions"
          sub={`${list.length} thing${list.length === 1 ? "" : "s"} the sources don't settle yet`}
          empty={list.length ? undefined : "None: the sources agree on everything this route uses."}
        >
          <ul className="m-0 list-none gap-2 p-0 lg:columns-2 [&>li]:mb-2 [&>li]:break-inside-avoid">
            {[...list].sort((a, b) => (a.ch ?? 99) - (b.ch ?? 99)).map((q, i) => <QuestionCard key={i} q={q} i={i} />)}
          </ul>
        </Panel>
      </div>
    );
  }
  if (!sections.length) return null;
  return (
    <div className="mt-3">
      <Panel id="notes" icon={<CircleHelp />} title="Open questions" sub="Conflicts and unknowns in the sources" fold={{ open: false }} bodyClassName="!p-0">
        {/* One level only: each source section under its own sub-header, its groups open (no folds inside folds). */}
        <div className="px-4 py-3 text-[15px] leading-[1.6]">
          {sections.map((sec) => (
            <div key={sec.id}>
              {sections.length > 1 && <Sub>{sec.title}</Sub>}
              {sec.groups.map((g) => <GroupView key={g.id} g={{ ...g, fold: false }} />)}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ Route notes (archive) */

/** True once every chapter of the route renders from JSON: the old Route plan has nothing left to hold. */
export const planRetired = (route: RouteName, chapters: Section[]) =>
  chapters.length > 0 && chapters.every((s) => s.chapter && chapterFile(route, s.chapter));

/** The old Route plan, folded at the bottom while Markdown chapters still point into it. */
export function RouteArchive({ route, plan, intro }: { route: RouteName; plan: Section[]; intro: Section | null }) {
  const rows = [
    ...(intro ? [{ id: intro.id, title: intro.title, groups: intro.groups }] : []),
    ...plan.flatMap((sec) =>
      sec.groups.map((g, i) => ({ id: g.id, title: (i === 0 && !g.title ? sec.title : g.title ?? sec.title), groups: [{ ...g, title: undefined }] }))
    ),
  ];
  if (!rows.length) return null;
  return (
    <div className="mt-3">
      <Panel
        id="archive"
        icon={<Archive />}
        title="Route notes (archive)"
        sub={`${rows.length} older planning notes for ${route}'s route`}
        fold={{ open: false }}
        bodyClassName="!p-0"
      >
        {rows.map((r) => (
          <Row key={r.id} icon={<Archive className="size-4 text-faint" />} title={<span className="text-[15px]">{r.title}</span>}>
            {r.groups.map((g) => <GroupView key={g.id} g={g} />)}
          </Row>
        ))}
      </Panel>
    </div>
  );
}
