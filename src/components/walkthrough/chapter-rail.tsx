import type { ReactNode } from "react";
import { Check, CircleHelp } from "lucide-react";
import { routeSlug } from "../../lib/data.ts";
import { chapterEvents, chapterFile, missableId } from "../../lib/chapter.ts";
import { hasStable } from "../../lib/mounts.ts";
import { isChapterDone, nowChapter, useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import type { Section } from "../../lib/walkthrough/model.ts";
import { useProgress } from "../../lib/walkthrough/store.ts";
import { Hover } from "../ui/hover.tsx";
import { PartSwitch } from "../parts/part-switch.tsx";

/*
 * Chapter rail (lesson 2 of the walkthrough pass, styled like the build page's roster rail, D-55): a dark sticky card
 * beside the content. Each chapter: number medallion inside its progress ring (the one progress signal, V-7), name,
 * free-time dates, "Playing" on the chapter after the latest finished and a red dot while it has unticked missables. With the side panel
 * open it shrinks to the medallions.
 */

export type RailExtra = { id: string; label: string; icon: ReactNode };

export type Info = { done: number; total: number; miss: number; free?: string; finished: boolean };

/** Progress, open missables and dates of a chapter, from its JSON file or its Markdown section. */
function useInfo(route: RouteName, sec: Section): Info {
  const t = useTrack();
  const md = useProgress();
  const file = sec.chapter ? chapterFile(route, sec.chapter) : undefined;
  const finished = Boolean(sec.chapter && isChapterDone(route, sec.chapter, t));
  if (file) {
    const ev = chapterEvents(file);
    const miss = file.missables.filter((m) => (m.kind === "choice" ? !t.forks[m.id] : !t.done[missableId(route, m)])).length;
    return {
      done: ev.filter((e) => t.done[e]).length,
      total: ev.length,
      miss,
      free: file.free ? `${file.free.from}–${file.free.to}` : "no free time",
      finished,
    };
  }
  return {
    done: sec.tasks.filter((x) => md[x]).length,
    total: sec.tasks.length,
    miss: sec.missables.filter((x) => !md[x]).length,
    free: sec.free ? `${sec.free.from}–${sec.free.to}` : sec.noFree ? "no free time" : undefined,
    finished,
  };
}

/** Number medallion with the chapter's progress as a ring around it. */
export function Medallion({ n, info, now, size = 30 }: { n: number; info: Info; now: boolean; size?: number }) {
  const r = size / 2 - 1.75;
  const c = 2 * Math.PI * r;
  // Filled only when you marked the chapter finished (D-91); the ring shows ticked steps.
  const full = info.finished;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill={full ? "var(--c)" : now ? "var(--color-gold-hi)" : "none"} stroke="rgba(255,255,255,.16)" strokeWidth="2.5" />
        {info.done > 0 && !full && info.total > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-gold-hi)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(info.done / info.total) * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span
        className={cx(
          "relative font-logo text-[13px] leading-none font-bold tabular-nums",
          now ? "text-teal" : full ? "text-white" : "text-parchment/85",
        )}
      >
        {full ? <Check className="size-3.5" strokeWidth={3.5} /> : n}
      </span>
      {info.miss > 0 && (
        <span
          title={`${info.miss} missable${info.miss > 1 ? "s" : ""} not ticked`}
          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#f0857a] shadow-[0_0_0_2px_var(--color-teal)]"
        />
      )}
    </span>
  );
}

function ChapterItem(
  { route, sec, active, now, compact, onGo }: {
    route: RouteName;
    sec: Section;
    active: boolean;
    now: boolean;
    compact: boolean;
    onGo: (id: string) => void;
  },
) {
  const info = useInfo(route, sec);
  const label = `Ch ${sec.chapter} · ${sec.name}${info.total ? ` · ${info.done} of ${info.total} tracked` : ""}${
    info.miss ? ` · ${info.miss} missable open` : ""
  }`;
  return (
    <li>
      <a
        href={`#/${routeSlug(route)}/ch/${sec.chapter}`}
        onClick={(e) => {
          e.preventDefault();
          onGo(sec.id);
        }}
        aria-current={active ? "location" : undefined}
        title={label}
        className={cx(
          "flex min-w-0 items-center gap-2.5 rounded-md py-1 text-left",
          compact ? "justify-center px-0.5" : "pr-2 pl-1.5",
          active ? "bg-white/15 ring-1 ring-gold-hi/60" : "hover:bg-white/10",
        )}
      >
        <Medallion n={sec.chapter!} info={info} now={now} />
        {!compact && (
          <span className="min-w-0 flex-1 leading-tight">
            <b className={cx("block truncate text-[13px] font-semibold", active ? "text-gold-hi" : "text-white")}>{sec.name}</b>
            <span className="flex items-center gap-1.5 text-[11px] text-parchment/55 tabular-nums">
              {now && <span className="font-bold tracking-[0.08em] text-gold-hi uppercase">Playing</span>}
              {info.finished && !now && <span className="font-semibold text-parchment/70">Done</span>}
              {info.free}
            </span>
          </span>
        )}
      </a>
    </li>
  );
}

function Legend({ route }: { route: RouteName }) {
  const keys: [string, string][] = [
    ["U", "Units"],
    ["L", "Ledger"],
    ["G", "Gifts"],
    ["E", "Meals"],
    ["R", "Pale Raven"],
    ["A", "Arena"],
    ["M", "Map"],
    ...(hasStable(route) ? [["T", "Mounts"] as [string, string]] : []),
    ["J / K", "next / previous chapter"],
    ["Esc", "close the panel"],
  ];
  return (
    <div className="pr-4 text-[13px] leading-relaxed">
      <div className="label mb-1 text-gold-lo">Reading the marks</div>
      <div className="grid gap-0.5">
        <span><b className="text-[#c2415f]">◆◆◆</b> S3 · Support rank needed</span>
        <span><b className="text-teal-3">✦</b> R6 · Renown needed</span>
        <span><b className="text-blood">▣</b> red date · a deadline</span>
        <span><b className="text-gold-lo">●</b> gold cost</span>
        <span><b className="text-[#e0675a]">●</b> on a chapter · missable not ticked</span>
        <span>Ring around a chapter number · tracked steps done</span>
        <span>Filled with a check · chapter you marked finished (button at the end of each chapter)</span>
        <span>Playing · the chapter after the latest one you finished</span>
        <span>A unit's name or portrait opens it in the Units panel; Ctrl-click opens the full build</span>
      </div>
      <div className="label mt-3 mb-1 text-gold-lo">Keys</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {keys.map(([k, v]) => (
          <span key={k} className="contents">
            <kbd className="justify-self-start">{k}</kbd>
            <span>{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChapterRail(
  { route, chapters, extras, active, compact, onGo }: {
    route: RouteName;
    chapters: Section[];
    extras: RailExtra[];
    active: string;
    compact: boolean;
    onGo: (id: string) => void;
  },
) {
  const now = nowChapter(route, useTrack());
  return (
    <nav
      aria-label="Chapters"
      className={cx(
        "sticky top-[72px] z-20 hidden max-h-[calc(100vh-88px)] shrink-0 flex-col self-start rounded-xl bg-teal text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] lg:flex",
        compact ? "w-[52px]" : "w-[216px]",
      )}
    >
      <PartSwitch route={route} part={1} compact={compact} />
      <div className={cx("flex items-center pt-2.5 pb-1.5", compact ? "justify-center px-1" : "justify-between px-3")}>
        {!compact && <span className="text-[11px] font-bold tracking-[0.12em] text-gold-hi uppercase">Chapters</span>}
        <Hover label="Reading the marks and keys" card={() => <Legend route={route} />}>
          <CircleHelp aria-hidden="true" className="size-4 text-parchment/60 hover:text-gold-hi" />
        </Hover>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 [scrollbar-color:rgba(231,200,128,.45)_transparent] [scrollbar-width:thin]">
        <ol className="m-0 list-none space-y-0.5 p-0">
          {chapters.map((s) => (
            <ChapterItem
              key={s.id}
              route={route}
              sec={s}
              active={active === s.id}
              now={s.chapter === now}
              compact={compact}
              onGo={onGo}
            />
          ))}
        </ol>
        {extras.length > 0 && (
          <ul className="m-0 mt-2 list-none space-y-0.5 border-t border-gold-hi/15 p-0 pt-2">
            {extras.map((x) => (
              <li key={x.id}>
                <a
                  href={`#/${routeSlug(route)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onGo(x.id);
                  }}
                  title={x.label}
                  aria-current={active === x.id ? "location" : undefined}
                  className={cx(
                    "flex items-center gap-2.5 rounded-md py-1 text-[13px] font-semibold",
                    compact ? "justify-center" : "pr-2 pl-1.5",
                    active === x.id ? "bg-white/15 text-gold-hi ring-1 ring-gold-hi/60" : "text-white hover:bg-white/10",
                  )}
                >
                  <span className="grid size-[30px] shrink-0 place-items-center rounded-full text-gold-hi ring-[2.5px] ring-white/15 ring-inset [&>svg]:size-4">
                    {x.icon}
                  </span>
                  {!compact && <span className="truncate">{x.label}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
