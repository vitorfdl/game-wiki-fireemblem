import { Fragment, type ReactNode, useState } from "react";
import { Backpack, ChevronDown, PackageOpen, ShieldAlert, TriangleAlert, Weight } from "lucide-react";
import { META, rosterEntry, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { routeVars } from "../../lib/route-style.ts";
import { cx } from "../../lib/cx.ts";
import type { Character, Filler, RouteName } from "../../lib/types.ts";
import { ROUTE_NAMES, STATS } from "../../lib/types.ts";
import { Panel } from "../ui/panel.tsx";
import { TierGem } from "../ui/tier-gem.tsx";
import { TIER_SCALE, Tip } from "../ui/tooltip.tsx";
import { publicSources, requirementText } from "../ui/clamp.tsx";
import { RefChip, Rich } from "../ref/rich.tsx";
import { enhance } from "../walkthrough/inline.tsx";
import { splitRefs, STAT_ABBR } from "../../lib/refs.ts";
import { GrowthPanel } from "./growth-panel.tsx";
import { Chip, ClampText, Label } from "./fold.tsx";
import { gateChips, placementOn } from "./variants.ts";

/* ------------------------------------------------------------ Watch out */

const NUMBERS_FIRST = /^(Weight|Inventory|Res|Def|HP|Spd)\b/i;

/** Split a warning into a headline and the rest: its "Label:" prefix, else its first clause, else its first words. */
function warnHead(t: string): { head: string; note?: string; body: string } {
  const text = t.trim();
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === ":" || ch === ";" || ((ch === "." || ch === ",") && text[i + 1] === " "))) {
      cut = i;
      break;
    }
  }
  const head = cut > 0 ? text.slice(0, cut) : text;
  const body = cut > 0 ? text.slice(cut + 1).trim() : "";
  // "Weight (dancer, at most 3 over the weapon)" -> "Weight" with a muted note.
  const pm = head.match(/^([^()]+?)\s*\(([^()]*)\)$/);
  const bare = pm ? pm[1] : head;
  if (bare.length <= 80) {
    return { head: bare, note: pm ? pm[2] : undefined, body: body.replace(/^./, (c) => c.toUpperCase()) };
  }
  const words = text.split(" ");
  let h = "";
  for (const w of words) {
    if ((h + " " + w).trim().length > 44) break;
    h = (h + " " + w).trim();
  }
  return { head: `${h}…`, body: `…${text.slice(h.length).trim()}` };
}

/** A stat with its number ("Def 15", "Hit -20"), a signed number, a percentage or a multiplier. */
const STAT_NUM = new RegExp(
  String.raw`(\b(?:${STAT_ABBR}|Lv)\s?[+\u2212-]?\d+(?:\.\d+)?%?|(?<![\w-])[+\u2212]\d+%?|\b\d+(?:\.\d+)?%|\bx\d+(?:\.\d+)?\b)`,
  "g",
);

/**
 * A warning's text with its numbers in bold. Same chips as Rich (refs, gates, gold, names), and one `seen` set per
 * card so a name gets one portrait across headline and body.
 */
function Emph({ text, k, seen }: { text: string; k: string; seen: Set<string> }) {
  return (
    <>
      {splitRefs(text).map((seg, i) => {
        const key = `${k}.${i}`;
        if (typeof seg !== "string") {
          if ("unresolved" in seg) return <span key={key}>{seg.unresolved}</span>;
          if (seg.type === "unit") seen.add(seg.name);
          return <RefChip key={key} r={seg} />;
        }
        return seg.split(STAT_NUM).map((q, j) =>
          j % 2
            ? <b key={`${key}.${j}`} className="font-semibold whitespace-nowrap text-ink tabular-nums">{q}</b>
            : q && <Fragment key={`${key}.${j}`}>{enhance(q, seen, `${key}.${j}`)}</Fragment>
        );
      })}
    </>
  );
}

function warnIcon(head: string): ReactNode {
  if (/^weight\b/i.test(head)) return <Weight />;
  if (/^inventory\b/i.test(head)) return <Backpack />;
  if (/^(Def|Res|HP|Spd|Str|Mag|Dex)\b/.test(head)) return <ShieldAlert />;
  return <TriangleAlert />;
}

function WarnCard({ text, i, quiet }: { text: string; i: number; quiet?: string[] }) {
  const { head, note, body } = warnHead(text);
  const seen = new Set(quiet);
  const [open, setOpen] = useState(false);
  const long = body.length > 230;
  return (
    <li className="min-w-0 rounded-md bg-warn/60 px-3 py-2.5 shadow-[inset_3px_0_0_var(--color-blood-2),inset_0_0_0_1px_rgba(168,29,34,.18)]">
      <h3 className="m-0 flex items-start gap-1.5 text-[14.5px] leading-snug font-bold text-ink">
        <span aria-hidden="true" className="mt-[2px] text-blood-2 [&>svg]:size-4">{warnIcon(head)}</span>
        <span className="min-w-0">
          <Emph text={head} k={`wh${i}`} seen={seen} />
          {note && <>{" "}<span className="text-[12.5px] font-normal text-muted">({note})</span></>}
        </span>
      </h3>
      {body && (
        <div className="mt-1 pl-[22px] text-[13.5px] leading-snug text-ink-soft">
          <p className={cx("m-0", long && !open && "line-clamp-4")}>
            <Emph text={body} k={`wb${i}`} seen={seen} />
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-gold-lo hover:text-ink"
            >
              {open ? "less" : "more"}
              <ChevronDown aria-hidden="true" className={cx("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Watch out: one red card per warning with a headline, weight and stat lines first. */
export function WatchOut({ watch, self }: { watch: string[]; self?: string }) {
  if (!watch.length) return null;
  const sorted = [...watch].sort((a, b) => Number(NUMBERS_FIRST.test(b)) - Number(NUMBERS_FIRST.test(a)));
  return (
    <Panel id="watch-out" icon={<TriangleAlert />} tone="alert" title="Watch out" sub="Risks, weight budget and traps for this build">
      <ul
        className={cx(
          "m-0 grid list-none grid-cols-[minmax(0,1fr)] items-start gap-2.5 p-0",
          sorted.length > 1 && "md:grid-cols-2",
          sorted.length > 2 && "xl:grid-cols-3",
        )}
      >
        {sorted.map((w, i) => <WarnCard key={w} text={w} i={i} quiet={self ? [self] : undefined} />)}
      </ul>
    </Panel>
  );
}

/** The build's first warnings as one-line headlines, linking down to the Watch out panel (beside Supports). */
export function WatchPeek({ watch, max = 3 }: { watch: string[]; max?: number }) {
  if (!watch.length) return null;
  const sorted = [...watch].sort((a, b) => Number(NUMBERS_FIRST.test(b)) - Number(NUMBERS_FIRST.test(a)));
  return (
    <Panel icon={<TriangleAlert />} tone="alert" title="Watch out" aside={<a href="#watch-out" onClick={(e) => { e.preventDefault(); document.getElementById("watch-out")?.scrollIntoView({ behavior: "smooth" }); }} className="text-[12.5px] font-semibold text-gold-lo hover:text-ink">All {watch.length} ↓</a>}>
      <ul className="m-0 grid list-none gap-1 p-0">
        {sorted.slice(0, max).map((w) => {
          const { head, note } = warnHead(w);
          return (
            <li key={w} className="flex items-start gap-1.5 text-[13.5px] leading-snug font-semibold">
              <span aria-hidden="true" className="mt-[2px] text-blood-2 [&>svg]:size-3.5">{warnIcon(head)}</span>
              <span className="min-w-0">
                {head.replace(/\[\[(?:\w+:)?([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, n, l) => l ?? n)}
                {note && <>{" "}<span className="text-[12px] font-normal text-muted">({note})</span></>}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------ folds */

/** A section at the bottom of the page that opens on click, or on its own when the URL points at it. */
export function Fold(
  { id, title, aside, open, onToggle, children }: {
    id: string;
    title: string;
    aside?: ReactNode;
    open: boolean;
    onToggle: (open: boolean) => void;
    children: ReactNode;
  },
) {
  return (
    <section
      id={id}
      className="mt-4 scroll-mt-20 overflow-hidden rounded-lg bg-card shadow-[inset_0_0_0_1px_rgba(176,144,90,.45),0_1px_3px_-1px_rgba(60,40,10,.12)] first:mt-0"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        className={cx("flex w-full flex-wrap items-center gap-x-2.5 gap-y-0.5 px-4 py-2.5 text-left hover:bg-paper/50", open && "border-b border-gold/25")}
      >
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-(--c)/12 text-(--c)">
          <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} />
        </span>
        <span className="font-display text-[17.5px] leading-tight">{title}</span>
        {aside && <span className="text-[13px] text-muted">{aside}</span>}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </section>
  );
}

const RELATION: Record<string, string> = { home: "home", copy: "extra copy", filler: "filler", none: "" };

/** Requirements on every route as chips, with this unit's place in each army. */
export function Recruitment({ c, route }: { c: Character; route: RouteName | null }) {
  const home = c.homeRoute;
  const entry = home ? rosterEntry(c.name, home) : undefined;
  const r = c.recruit;
  if (c.isLord && home) {
    const info = META.routes[home];
    return (
      <div className="grid gap-1.5 text-[14px] leading-snug">
        <p className="m-0 font-semibold">{info.plays}</p>
        <p className="m-0"><b>Pick it if:</b> {info.pick}</p>
        <p className="m-0 text-warn-ink">{info.watch}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {(c.recruitOn || c.requirements) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ROUTE_NAMES.map((rt) => {
            const p = placementOn(c, rt);
            const rel = p.kind === "build" ? (p.variant.home ? "home" : "copy") : p.kind;
            const chips = gateChips(c.recruitOn?.[rt]);
            const fallback = c.requirements?.[rt];
            const none = !chips.length && !fallback;
            return (
              <a
                key={rt}
                href={href(routeSlug(rt), c.slug)}
                style={routeVars(rt)}
                className={cx(
                  "rounded-[3px] border-t-[3px] border-(--c) bg-card px-2.5 py-2 text-[13px] leading-snug shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)] hover:bg-[color-mix(in_srgb,var(--c)_8%,var(--color-card))]",
                  rt === route && "shadow-[inset_0_0_0_1.5px_var(--c)]",
                  none && "opacity-55",
                )}
              >
                <b className="block text-[13.5px]">
                  {rt}
                  {RELATION[rel] && <span className="ml-1 font-normal text-muted">· {RELATION[rel]}</span>}
                </b>
                <span className="mt-1 flex flex-wrap gap-1">
                  {chips.length
                    ? chips.map((x) => <Chip key={x}>{x}</Chip>)
                    : <span className="text-muted">{fallback ? requirementText(fallback) : "Not recruitable"}</span>}
                </span>
              </a>
            );
          })}
        </div>
      )}
      <div className="grid gap-1 text-[13.5px] leading-snug">
        {entry && home && (
          <p className="m-0">
            <b>Joins {home}:</b> {entry.estimate ? "~" : ""}Ch {entry.chapter}. <Rich text={entry.why} k="rw" />
          </p>
        )}
        {r?.extra && (
          <p className="m-0">
            <b>Also needs:</b> <Rich text={r.extra} k="rx" />
          </p>
        )}
        {r?.tip && r.tip !== r.extra && <p className="m-0 text-warn-ink"><Rich text={r.tip} k="rt" /></p>}
        {r?.why?.map((w, i) => <p key={i} className="m-0 text-ink-soft"><Rich text={w} k={`ry${i}`} /></p>)}
        {!r && c.joins && <p className="m-0"><Rich text={c.joins} k="rj" /></p>}
      </div>
    </div>
  );
}

/** Story, growths, arms (the personal skill sits in the page header) and sources. Supports have their own panel near the top. */
export function Profile({ c }: { c: Character }) {
  const chips = (arr: string[] | undefined, tone: "plain" | "route" | "warn") =>
    arr?.length ? arr.map((x) => <Chip key={x} tone={tone}>{x}</Chip>) : <span className="text-[13px] text-muted">None</span>;
  const top = c.growths ? [...STATS].sort((a, b) => (c.growths![b] ?? 0) - (c.growths![a] ?? 0)).slice(0, 3) : [];
  const sources = publicSources(c.sources);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
        {(c.personality || c.story) && (
          <div>
            <Label>Story</Label>
            {c.personality && <p className="m-0 mb-1 text-[14px] font-semibold">{c.personality}</p>}
            {c.story && <ClampText text={c.story} k="story" chars={260} className="text-[14px] leading-relaxed" />}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Weapons</Label>
            <div className="flex flex-wrap gap-1">{chips(c.weapons, "plain")}</div>
          </div>
          <div>
            <Label>Preferred</Label>
            <div className="flex flex-wrap gap-1">{chips(c.preferred, "route")}</div>
          </div>
          <div>
            <Label>Avoid</Label>
            <div className="flex flex-wrap gap-1">{chips(c.avoid, "warn")}</div>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
        {c.growths && (
          <div>
            <GrowthPanel personal={c.growths} row={null} title={`Personal growths · best ${top.join(", ")}`} />
          </div>
        )}
        {c.tiers?.length
          ? (
            <div>
              <Label>Published tier lists</Label>
              <div className="flex flex-wrap gap-3">
                {c.tiers.map((t) => (
                  <Tip
                    key={t.source}
                    className="items-center gap-1.5 text-[13px] text-muted"
                    tip={<><b>{t.source} rates {c.name} {t.tier}.</b> {TIER_SCALE}</>}
                  >
                    <TierGem tier={t.tier} size={24} title="" />
                    {t.source}
                  </Tip>
                ))}
              </div>
              {c.tierNotes && <ClampText text={c.tierNotes} k="tn" chars={160} className="mt-1 text-[12.5px] text-muted" />}
            </div>
          )
          : null}
        {sources.length > 0 && (
          <p className="m-0 text-[12px] text-muted">
            Sources: {sources.map((s, i) => (
              <span key={s}>
                {i > 0 && " · "}
                {/^https?:/.test(s)
                  ? (
                    <a href={s} target="_blank" rel="noopener" className="underline decoration-gold/50">
                      {s.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                    </a>
                  )
                  : s}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/** A unit recruited on this route only for an item or for supports: what to recruit it for, and the gate. */
export function FillerCard({ c, filler, route }: { c: Character; filler: Filler; route: RouteName }) {
  const chips = gateChips(c.recruitOn?.[route]);
  return (
    <Panel icon={<PackageOpen />} title="Filler" sub={`${filler.when} · stays on the bench, no build on ${route}'s route`} className="h-full">
      <p className="m-0 text-[17px] leading-snug font-bold">
        {filler.item ? <>Recruit for the <Rich text={filler.item} k="fi" /></> : "Recruit for supports"}
      </p>
      {chips.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{chips.map((x) => <Chip key={x}>{x}</Chip>)}</div>}
      {!chips.length && filler.cost && <p className="mt-1 mb-0 text-[13px]">{filler.cost}</p>}
      <p className="mt-2 mb-0 text-[14px] leading-snug text-ink-soft"><Rich text={filler.why} k="fw" /></p>
    </Panel>
  );
}
