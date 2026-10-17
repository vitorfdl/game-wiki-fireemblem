import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CircleHelp, Dumbbell, Flag, Shield, Swords, Users } from "lucide-react";
import { char, routeSlug } from "../../lib/data.ts";
import { routeVars } from "../../lib/route-style.ts";
import { href, rememberOrigin } from "../../lib/router.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { isPartDone, loadPartPlace, nowIn, savePartPlace, useTrack } from "../../lib/track.ts";
import {
  P2,
  P3,
  PART_HOME,
  PART_OF,
  type PartKey,
  playsWar,
  section,
  shortBattle,
  warChapter,
} from "../../lib/parts.ts";
import { partEvents } from "../../lib/part-plan.ts";
import { firstListed, salvationArmy, squadOf } from "../../lib/part-army.ts";
import { missableId } from "../../lib/chapter.ts";
import { TopBar } from "../army/top-bar.tsx";
import { type KitTab, useWalk, type WalkContext, WalkCtx } from "../walkthrough/ctx.ts";
import { routeUnits } from "../../lib/walkthrough/builds.ts";
import { unitHref, UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { Dock, FieldKit, KIT_TABS, PANEL_MR, PANEL_W, partTabs } from "../walkthrough/kit.tsx";
import { Medallion } from "../walkthrough/chapter-rail.tsx";
import type { UnitFocus } from "../units/units-tab.tsx";
import type { MapFocus } from "../walkthrough/world-map.tsx";
import { Portrait } from "../ui/portrait.tsx";
import { PartSwitch } from "./part-switch.tsx";
import { WarChapterView } from "./war-chapter.tsx";
import { loseLine, SquadBadge } from "./shared.tsx";
import { SectionView } from "./salvation-section.tsx";
import { ConfText } from "../ui/conf-text.tsx";

/*
 * Part II (War) and Part III (Salvation) walkthroughs (D-122 to D-125): the same shell as Part I (rail, band, slot
 * panels, Field Kit), with the Part switch on top of the rail and the Part's own tabs.
 */

type Props = { route: RouteName; part: PartKey; initial?: number };

const anchor = (part: PartKey, n: number) => `${part === "war" ? "w" : "s"}-${n}`;
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Reading anchor (as on the Part I page): the element under the reading line and its distance from the top. Opening or
 * closing the Field Kit narrows the column and reflows the page; restoring the offset keeps the same line in view, so
 * the active Section (and the tabs that follow it) doesn't slip back.
 */
type Anchor = { el: Element; top: number };

function readingAnchor(main: HTMLElement | null): Anchor | null {
  if (!main) return null;
  const box = main.getBoundingClientRect();
  const x = Math.min(box.left + 40, box.right - 8);
  for (const y of [150, 190, 240, 300, 120]) {
    const el = document.elementFromPoint(x, y);
    if (el && main.contains(el) && el !== main) return { el, top: el.getBoundingClientRect().top };
  }
  return null;
}

function useActive(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) =>
        a.boundingClientRect.top - b.boundingClientRect.top
      );
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

export function PartPage({ route, part, initial }: Props) {
  if (!playsWar(route)) return <PartStub route={route} part={part} />;
  return <PartWalk route={route} part={part} initial={initial} />;
}

function PartWalk({ route, part, initial }: Props) {
  const p = PART_OF[part];
  const ns = [1, 2, 3, 4, 5, 6];
  const ids = useMemo(() => ["intro", ...ns.map((n) => anchor(part, n))], [part]);
  const active = useActive(ids);
  const activeN = Number(active.match(/-(\d+)$/)?.[1] ?? 0);
  const [kit, setKit] = useState<KitTab | null>(null);
  const [kitN, setKitN] = useState(() => initial ?? loadPartPlace(route, part)?.ch ?? nowIn(route, part));
  useEffect(() => {
    if (activeN) setKitN(activeN);
  }, [activeN]);

  // URL and reading place follow the chapter or Section in view (D-122).
  useEffect(() => {
    const hash = `#/${routeSlug(route)}/${part}${activeN ? `/${part === "war" ? "ch" : "s"}/${activeN}` : ""}`;
    if (globalThis.location.hash !== hash) history.replaceState(null, "", hash);
    rememberOrigin(hash);
    // The Section in view is the reading place even before the first scroll (a landing from a link).
    const el = activeN && document.getElementById(anchor(part, activeN));
    if (el) savePartPlace(route, part, { ch: activeN, y: Math.round(-el.getBoundingClientRect().top) });
  }, [route, part, activeN]);
  useEffect(() => {
    let frame = 0;
    const on = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const n = Number(document.querySelector<HTMLElement>("[data-part-active]")?.dataset.partActive ?? 0);
        const el = n && document.getElementById(anchor(part, n));
        if (el) savePartPlace(route, part, { ch: n, y: Math.round(-el.getBoundingClientRect().top) });
      });
    };
    globalThis.addEventListener("scroll", on, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener("scroll", on);
    };
  }, [route, part]);
  // Landing: the URL's chapter, else the saved place, else the one you're playing.
  const [landing] = useState(() => {
    const saved = loadPartPlace(route, part);
    const n = initial ?? saved?.ch ?? nowIn(route, part);
    return n ? { n, y: saved && saved.ch === n ? saved.y ?? 0 : 0 } : null;
  });
  useEffect(() => {
    if (!landing) {
      globalThis.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const go = () => {
      const el = document.getElementById(anchor(part, landing.n));
      if (el) {
        globalThis.scrollTo({
          top: el.getBoundingClientRect().top + globalThis.scrollY + (landing.y || -24),
          behavior: "instant",
        });
      }
    };
    const id = requestAnimationFrame(go);
    document.fonts?.ready.then(go);
    return () => cancelAnimationFrame(id);
  }, [landing, part]);

  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [mountFocus, setMountFocus] = useState<{ slug: string; nonce: number } | null>(null);
  const [unitFocus, setUnitFocus] = useState<UnitFocus | null>(null);
  const ctx: WalkContext = useMemo(() => ({
    route,
    part: p,
    focusUnit: (name: string) => {
      // Part III lists every army in the Units tab; a unit outside it opens its build (the picked copy) instead.
      const listed = p === 3
        ? salvationArmy().some((u) => u.name === name)
        : routeUnits(route).some((u) => u.name === name);
      if (!listed) {
        location.hash = unitHref(name, null, p);
        return;
      }
      setUnitFocus({ name, nonce: Date.now() });
      setKit("units");
    },
    openKit: (t: KitTab) => setKit(t),
    openMap: (f: { place?: string; item?: string }) => {
      setMapFocus({ ...f, nonce: Date.now() });
      setKit("map");
    },
    openMount: (slug: string) => {
      setMountFocus({ slug, nonce: Date.now() });
      setKit("mounts");
    },
  }), [route, p]);
  const only = partTabs(p);
  const [lastTab, setLastTab] = useState<KitTab | null>(null);
  useEffect(() => {
    if (kit) setLastTab(kit);
  }, [kit]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const tab = KIT_TABS.find((t) => only.includes(t.id) && t.key.toLowerCase() === e.key.toLowerCase());
      if (tab) setKit((k) => (k === tab.id ? null : tab.id));
      else if (e.key === "Escape") setKit(null);
      else if (e.key === "j" || e.key === "k") {
        const i = ids.indexOf(active);
        const next = ids[Math.min(ids.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1)))];
        if (next) scrollTo(next);
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [ids, active, only]);
  const closeKit = useCallback(() => setKit(null), []);
  const open = Boolean(kit);
  // Keep the reading anchor fresh: on scroll, and just before any click or key that could open or close the kit.
  const mainRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<Anchor | null>(null);
  useEffect(() => {
    const take = () => {
      anchorRef.current = readingAnchor(mainRef.current);
    };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        take();
      });
    };
    take();
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    globalThis.addEventListener("pointerdown", take, true);
    globalThis.addEventListener("keydown", take, true);
    return () => {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener("scroll", onScroll);
      globalThis.removeEventListener("pointerdown", take, true);
      globalThis.removeEventListener("keydown", take, true);
    };
  }, []);
  useLayoutEffect(() => {
    const a = anchorRef.current;
    if (!a || !a.el.isConnected) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 1) globalThis.scrollBy({ top: delta, behavior: "instant" });
    anchorRef.current = readingAnchor(mainRef.current);
  }, [open]);
  // The Units tab reads the campaign scale (War Ch N = 12 + N, Section N = 18 + N).
  const unitPos = (p === 2 ? 12 : 18) + kitN;

  return (
    <WalkCtx.Provider value={ctx}>
      <div style={routeVars(route)} className="min-h-screen bg-paper">
        <TopBar back={{ to: "#/", label: "All lords" }} current={route} view="walk" part={part} />
        <div className={kit ? PANEL_MR : "lg:pr-[80px]"}>
          <div className="mx-auto flex max-w-[1340px] gap-5 px-4 pt-5 pb-32 md:px-6">
            <PartRail route={route} part={part} active={active} compact={open} />
            <main
              ref={mainRef}
              className="min-w-0 flex-1 text-[16px] leading-[1.6]"
              data-part-active={activeN || undefined}
            >
              {part === "war" ? <WarBand route={route} /> : <SalvationBand route={route} />}
              {ns.map((n) =>
                part === "war"
                  ? <WarChapterView key={n} route={route} ch={n} />
                  : <SectionView key={n} route={route} n={n} />
              )}
              <PartNotes part={part} />
            </main>
          </div>
        </div>
        <Dock route={route} open={kit} onOpen={setKit} only={only} />
        {kit && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={closeKit} aria-hidden="true" />}
        {(kit ?? lastTab) && (
          <div
            className={cx(
              "fixed inset-x-0 bottom-0 z-50 h-[85vh] overflow-hidden rounded-t-xl lg:inset-x-auto lg:top-[60px] lg:right-0 lg:h-auto lg:rounded-none",
              PANEL_W,
              !kit && "hidden",
            )}
          >
            <FieldKit
              route={route}
              tab={(kit ?? lastTab)!}
              chapter={unitPos}
              part={p}
              partN={kitN}
              mapFocus={mapFocus}
              mountFocus={mountFocus}
              unitFocus={unitFocus}
              onChapter={(n) => scrollTo(anchor(part, n))}
              setTab={setKit}
              setChapter={setKitN}
              onClose={closeKit}
              only={only}
            />
          </div>
        )}
      </div>
    </WalkCtx.Provider>
  );
}

/* ------------------------------------------------------------ rail */

function RailItem(
  { route, part, n, active, compact }: {
    route: RouteName;
    part: PartKey;
    n: number;
    active: boolean;
    compact: boolean;
  },
) {
  const t = useTrack();
  const ev = partEvents(route, part, n);
  const miss = ev.missables.filter((m) => !t.done[missableId(route, m)]).length;
  const finished = isPartDone(route, part, n, t);
  const now = nowIn(route, part, t) === n;
  const info = { done: ev.ids.filter((i) => t.done[i]).length, total: ev.ids.length, miss, finished };
  const name = part === "war" ? warChapter(n)?.name : section(n)?.name;
  const s = section(n);
  const sub = part === "war"
    ? shortBattle(warChapter(n)?.battles[0]?.name ?? "")
    : s?.free_time
    ? `${s.free_time.from}–${(s.mission_time ?? s.free_time).to}`
    : "battle only";
  const id = anchor(part, n);
  return (
    <li>
      <a
        href={`#/${routeSlug(route)}/${part}/${part === "war" ? "ch" : "s"}/${n}`}
        onClick={(e) => {
          e.preventDefault();
          scrollTo(id);
        }}
        aria-current={active ? "location" : undefined}
        title={`${part === "war" ? "Ch" : "Section"} ${n} · ${name}`}
        className={cx(
          "flex min-w-0 items-center gap-2.5 rounded-md py-1 text-left",
          compact ? "justify-center px-0.5" : "pr-2 pl-1.5",
          active ? "bg-white/15 ring-1 ring-gold-hi/60" : "hover:bg-white/10",
        )}
      >
        <Medallion n={n} info={info} now={now} />
        {!compact && (
          <span className="min-w-0 flex-1 leading-tight">
            <b className={cx("block truncate text-[13px] font-semibold", active ? "text-gold-hi" : "text-white")}>
              {name}
            </b>
            <span className="flex items-center gap-1.5 text-[11px] text-parchment/55 tabular-nums">
              {now && <span className="font-bold tracking-[0.08em] text-gold-hi uppercase">Playing</span>}
              {finished && !now && <span className="font-semibold text-parchment/70">Done</span>}
              <span className="truncate">{sub}</span>
            </span>
          </span>
        )}
      </a>
    </li>
  );
}

function PartRail(
  { route, part, active, compact }: { route: RouteName; part: PartKey; active: string; compact: boolean },
) {
  return (
    <nav
      aria-label={part === "war" ? "War chapters" : "Sections"}
      className={cx(
        "sticky top-[72px] z-20 hidden max-h-[calc(100vh-88px)] shrink-0 flex-col self-start rounded-xl bg-teal text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] lg:flex",
        compact ? "w-[52px]" : "w-[216px]",
      )}
    >
      <PartSwitch route={route} part={PART_OF[part]} compact={compact} />
      {!compact && (
        <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold tracking-[0.12em] text-gold-hi uppercase">
          {part === "war" ? "War chapters" : "Sections"}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-2">
        <ol className="m-0 list-none space-y-0.5 p-0">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <RailItem key={n} route={route} part={part} n={n} active={active === anchor(part, n)} compact={compact} />
          ))}
        </ol>
        <ul className="m-0 mt-2 list-none border-t border-gold-hi/15 p-0 pt-2">
          <li>
            <a
              href={`#/${routeSlug(route)}/${part}`}
              onClick={(e) => {
                e.preventDefault();
                scrollTo("part-notes");
              }}
              className={cx(
                "flex items-center gap-2.5 rounded-md py-1 text-[13px] font-semibold text-white hover:bg-white/10",
                compact ? "justify-center" : "pr-2 pl-1.5",
              )}
            >
              <span className="grid size-[30px] shrink-0 place-items-center rounded-full text-gold-hi ring-[2.5px] ring-white/15 ring-inset [&>svg]:size-4">
                <CircleHelp />
              </span>
              {!compact && <span className="truncate">Open questions</span>}
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------ bands */

const PILL =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ring-white/15 bg-white/10 text-parchment hover:bg-white/20";

/** A dark stat tile on a band: big number, label, one muted line. */
function BandStat({ k, v, sub }: { k: string; v: string | number; sub?: string }) {
  return (
    <div className="min-w-[120px] flex-1 rounded-lg bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
      <div className="text-[10.5px] font-semibold tracking-[0.1em] text-gold-hi/85 uppercase">{k}</div>
      <div className="font-logo text-[24px] leading-tight font-bold text-white tabular-nums">{v}</div>
      {sub && <div className="text-[12px] leading-snug text-parchment/65">{sub}</div>}
    </div>
  );
}

function BandShell(
  { kicker, title, hook, children, art }: {
    kicker: string;
    title: string;
    hook: string;
    children: React.ReactNode;
    art: string;
  },
) {
  return (
    <header
      id="intro"
      className="@container relative scroll-mt-20 overflow-hidden rounded-xl bg-teal px-5 pt-5 pb-5 text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] sm:px-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_95%_0%,color-mix(in_srgb,var(--c)_55%,transparent),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 hidden h-[210px] w-[240px] @3xl:block"
      >
        <Portrait
          name={art}
          eager
          className="absolute right-6 bottom-0 h-full w-auto max-w-none [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]"
          opaqueClassName="!h-[85%] rounded-lg"
        />
      </div>
      <div className="relative @3xl:pr-[230px]">
        <div className="text-[11.5px] font-semibold tracking-[0.12em] text-gold-hi uppercase">{kicker}</div>
        <h1 className="m-0 mt-0.5 font-display text-[clamp(28px,4cqi,40px)] leading-tight text-white">{title}</h1>
        <p className="mt-1 mb-0 max-w-[68ch] text-[15px] leading-snug text-parchment/85">{hook}</p>
      </div>
      <div className="relative">{children}</div>
    </header>
  );
}

function WarBand({ route }: { route: RouteName }) {
  const { openKit } = useWalk();
  const now = nowIn(route, "war", useTrack());
  const deploy = P2.chapters.map((c) => c.battles[0]?.max_units ?? 0);
  return (
    <BandShell
      kicker={`Part II walkthrough · ${route}'s War Path`}
      title="War"
      hook="Six battles back to back. No Free Time, shops or World Map: the kit you held at the end of Ch 12 is the kit you fight with, and the base refills Licenses and Divine Sand every chapter."
      art={route}
    >
      <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
        <button
          type="button"
          onClick={() => scrollTo(anchor("war", now))}
          className="inline-flex items-center gap-1 rounded-full bg-gold-hi px-3 py-1 text-teal hover:bg-white"
        >
          {now > 1 ? "Resume" : "Start"} Ch {now} <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
        <button type="button" onClick={() => openKit("warprep")} className={PILL}>
          <Flag className="size-3.5 text-gold-hi" />War Prep · W
        </button>
        <button type="button" onClick={() => openKit("units")} className={PILL}>
          <Users className="size-3.5 text-gold-hi" />Units · U
        </button>
        <a href={href(routeSlug(route), "army", "war")} className={PILL}>
          <Shield className="size-3.5 text-gold-hi" />Army at War
        </a>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <BandStat k="Chapters" v={6} sub="Ch 5 and 6: no facilities" />
        <BandStat k="Deploy" v={`${Math.min(...deploy)}–${Math.max(...deploy)}`} sub="Ch 1 caps at 10, then 13" />
        <BandStat k="Licenses" v="5·5·5" sub="Beginner, Specialty, Advanced, refilled" />
        <BandStat k="Level floor" v="37→42" sub="Training Drills, Ch 1 to 4" />
        <BandStat k="Lose if" v={route === "Theodora" ? 2 : 3} sub={loseLine(route)} />
      </div>
    </BandShell>
  );
}

function SalvationBand({ route }: { route: RouteName }) {
  const { openKit } = useWalk();
  const now = nowIn(route, "salvation", useTrack());
  const gates = P3.sections.flatMap((s) => s.battles.filter((b) => !b.kind));
  return (
    <BandShell
      kicker="Part III walkthrough · every army, Theodora's as the base (D-118)"
      title="Salvation"
      hook="Six Sections from 2/1 to 6/6. Free Time repairs the map and works the god requests; Mission Time sends squads through the miasma gates. Every battle is lost if Eshmel falls."
      art="Eshmel"
    >
      <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
        <button
          type="button"
          onClick={() => scrollTo(anchor("salvation", now))}
          className="inline-flex items-center gap-1 rounded-full bg-gold-hi px-3 py-1 text-teal hover:bg-white"
        >
          {now > 1 ? "Resume" : "Start"} Section {now} <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
        <button type="button" onClick={() => openKit("squads")} className={PILL}>
          <Users className="size-3.5 text-gold-hi" />Squads · Q
        </button>
        <button type="button" onClick={() => openKit("temples")} className={PILL}>
          <Swords className="size-3.5 text-gold-hi" />Temples · O
        </button>
        <button type="button" onClick={() => openKit("diadem")} className={PILL}>
          <Shield className="size-3.5 text-gold-hi" />Diadem · D
        </button>
        <button type="button" onClick={() => openKit("arena")} className={PILL}>
          <Dumbbell className="size-3.5 text-gold-hi" />Arena · A
        </button>
        <a href={href(routeSlug(route), "army", "salvation")} className={PILL}>
          <Users className="size-3.5 text-gold-hi" />Army of Salvation
        </a>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <BandStat k="Calendar" v="2/1–6/6" sub="all quests end 6/6" />
        <BandStat k="Gates" v={gates.length} sub={gates.map((b) => shortBattle(b.name)).slice(1, 5).join(", ") + "…"} />
        <BandStat k="Squads" v="2→5" sub="8 units each, Eshmel apart" />
        <BandStat k="Quests" v={P3.quests.length} sub="6 god requests open Master classes" />
        <BandStat k="Finale" v={25} sub="units against Balor" />
      </div>
    </BandShell>
  );
}

/* ------------------------------------------------------------ notes */

function PartNotes({ part }: { part: PartKey }) {
  const qs = part === "war" ? P2.open_questions : P3.open_questions;
  return (
    <section
      id="part-notes"
      className="mt-10 scroll-mt-20 rounded-lg bg-card px-4 py-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]"
    >
      <h2 className="m-0 flex items-center gap-2 font-display text-[17.5px]">
        <CircleHelp className="size-4 text-(--c)" /> Open questions
        <span className="font-sans text-[13px] font-normal text-muted">
          sources disagree or say nothing; check in game
        </span>
      </h2>
      <ul className="mt-2 mb-0 grid gap-1 pl-5 text-[14px] leading-snug text-ink-soft">
        {qs.map((q, i) => (
          <li key={i}>
            <ConfText text={q} k={`oq${i}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------ other routes */

/** Dietrich, Cai and Leda skip their War Path after Theodora's (D-118); Part III lives on Theodora's page (D-123). */
function PartStub({ route, part }: { route: RouteName; part: PartKey }) {
  const home = routeSlug(PART_HOME);
  const playing = nowIn(PART_HOME, "salvation", useTrack());
  // Who rides in Part III from this army: the units squads.json lists, recruited from this copy or merged into another.
  const units = salvationArmy().filter((u) => u.copies.includes(route) && firstListed(u.name) !== undefined)
    .sort((a, b) =>
      Number(b.name === route) - Number(a.name === route) || Number(b.origin === route) - Number(a.origin === route)
    );
  const squadLetter = (name: string) => {
    for (const n of [2, 3, 4, 5]) {
      const s = squadOf(n, name);
      if (s && s !== "bench") return { s, n };
    }
    return undefined;
  };
  const lord = char(route);
  return (
    <div style={routeVars(route)} className="min-h-screen bg-paper">
      <TopBar back={{ to: "#/", label: "All lords" }} current={route} view="walk" part={part} />
      <div className="mx-auto flex max-w-[1100px] gap-5 px-4 pt-5 pb-32 md:px-6">
        <nav className="sticky top-[72px] hidden w-[216px] shrink-0 self-start rounded-xl bg-teal pb-2 text-parchment lg:block">
          <PartSwitch route={route} part={PART_OF[part]} />
        </nav>
        <main className="min-w-0 flex-1">
          <BandShell
            kicker={part === "war" ? `Part II · ${route}'s War Path` : "Part III · Salvation"}
            title={part === "war" ? "Skipped" : "Played on Theodora's page"}
            hook={part === "war"
              ? `${route}'s War Path is skipped after Theodora's (D-118): a skip counts as done, adds about 5 levels and lets this army join Part III in Section 2. A unit with copies on several routes is recruited from one copy and the others merge into it (D-145).`
              : "Part III is one campaign for every army. Theodora's army is the base, so the Sections, squads and gates live on her walkthrough."}
            art={route}
          >
            <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
              <a
                href={part === "war" ? href(home, "war", "ch", "1") : href(home, "salvation", "s", String(playing))}
                className="inline-flex items-center gap-1 rounded-full bg-gold-hi px-3 py-1 text-teal hover:bg-white"
              >
                {part === "war" ? "Theodora's War" : `Open Salvation · Section ${playing}`}{" "}
                <ArrowRight className="size-3.5" />
              </a>
              {lord && <a href={href(routeSlug(route), lord.slug)} className={PILL}>{route}'s build</a>}
            </div>
          </BandShell>
          {units.length > 0 && (
            <section className="mt-4 rounded-lg bg-card px-4 py-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]">
              <h2 className="m-0 font-display text-[17.5px]">Who comes to Part III from {route}'s army</h2>
              <p className="m-0 mt-0.5 text-[13.5px] text-muted">
                They wait in Dagsion from Section 2. Recruit: talk to this copy. Merge: recruit the other copy, then
                merge this one in (300 Karma Shards). Letter: the squad they first ride in.
              </p>
              <RouteCtx.Provider value={route}>
                <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1.5">
                  {units.map((u) => {
                    const sq = squadLetter(u.name);
                    const mine = u.origin === route;
                    return (
                      <span
                        key={u.name}
                        className="flex items-center gap-1.5 rounded-md bg-paper-2/70 py-1 pr-2 pl-1 text-[14px]"
                      >
                        <UnitPortrait name={u.name} size={30} flat />
                        <span className="min-w-0 flex-1 leading-tight">
                          <b className="block truncate font-semibold">
                            <UnitRef name={u.name} avatar={false} />
                          </b>
                          <span className={cx("block truncate text-[12px]", mine ? "text-ink-soft" : "text-muted")}>
                            {u.name === route
                              ? "lord"
                              : !mine
                              ? `merges into ${u.origin}'s copy`
                              : u.copies.length > 1
                              ? "recruit this copy"
                              : "recruit"}
                          </span>
                        </span>
                        {sq
                          ? <SquadBadge id={sq.s} size={20} title={`Squad ${sq.s} from Section ${sq.n}`} />
                          : (
                            <span className="text-[11px] font-semibold text-muted" title="Outside the squads">out</span>
                          )}
                      </span>
                    );
                  })}
                </div>
              </RouteCtx.Provider>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
