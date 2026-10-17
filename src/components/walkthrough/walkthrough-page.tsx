import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Backpack, CircleHelp, ListChecks } from "lucide-react";
import { routeSlug } from "../../lib/data.ts";
import { routeVars } from "../../lib/route-style.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { walkthrough } from "../../lib/walkthrough/model.ts";
import { rememberOrigin } from "../../lib/router.ts";
import { TopBar } from "../army/top-bar.tsx";
import { type KitTab, type WalkContext, WalkCtx } from "./ctx.ts";
import { Dock, FieldKit, KIT_ALIASES, kitTabs, PANEL_MR, PANEL_W } from "./kit.tsx";
import { ChapterView } from "../chapter/view.tsx";
import { seedKit } from "../../lib/open-tasks.ts";
import { chapterFile } from "../../lib/chapter.ts";
import { RouteBand } from "./route-header.tsx";
import { RouteRules } from "./route-rules.tsx";
import { loadPlace, savePlace } from "../../lib/track.ts";
import type { MapFocus } from "./world-map.tsx";
import { ChapterSection } from "./sections.tsx";
import { ChapterRail, type RailExtra } from "./chapter-rail.tsx";
import { BeforePartTwo, OpenQuestions, planRetired, RouteArchive } from "./part-two.tsx";
import type { UnitFocus } from "../units/units-tab.tsx";
import { routeNotes } from "../../lib/walkthrough/route-files.ts";
import type { Section } from "../../lib/walkthrough/model.ts";

type Props = { route: RouteName; initialChapter?: number };

function useActiveSection(ids: string[], epoch: unknown): string {
  const [active, setActive] = useState(ids[0] ?? "plan");
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) =>
          a.boundingClientRect.top - b.boundingClientRect.top
        );
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids, epoch]);
  return active;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Keeps the address on the chapter being read, so a reload or a back link lands there. */
function syncUrl(route: RouteName, id: string) {
  const ch = id.match(/^ch-(\d+)$/)?.[1];
  const hash = `#/${routeSlug(route)}${ch ? `/ch/${ch}` : ""}`;
  if (globalThis.location.hash !== hash) history.replaceState(null, "", hash);
  rememberOrigin(hash);
}

/**
 * Reading anchor (lesson 11): the element under the reading line and its distance from the top of the window. Opening
 * or closing the side panel changes the column width and reflows the page; restoring this offset keeps the reader on
 * the same line, so the active chapter (and the Units tab's chapter) doesn't slip back.
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

/** The route's walkthrough: feature band, chapter rail, the chapters, Before Part II and notes, the side panel. */
export function WalkthroughPage({ route, initialChapter }: Props) {
  const wt = walkthrough(route);
  const chapters = wt.sections.filter((s) => s.kind === "chapter");
  const plan = wt.sections.filter((s) => s.kind === "plan");
  const exits = wt.sections.filter((s) => s.kind === "exit");
  const later = wt.sections.filter((s) => s.kind === "later");
  const notes = wt.sections.filter((s) => s.kind === "notes");
  const retired = planRetired(route, chapters);
  const hasNotes = Boolean(routeNotes(route)) || notes.length > 0;
  const tail: RailExtra[] = [
    { id: "before-part-2", label: "Before Part II", icon: <ListChecks /> },
    ...(hasNotes ? [{ id: "notes", label: "Open questions", icon: <CircleHelp /> }] : []),
  ];
  const ids = useMemo(() => ["plan", ...chapters.map((s) => s.id), ...tail.map((t) => t.id)], [route]);
  const [startCh] = useState(() => initialChapter ?? loadPlace(route)?.ch ?? 1);
  const [kit, setKit] = useState<KitTab | null>(null);
  const [kitChapter, setKitChapter] = useState(startCh);
  const main = useRef<HTMLElement>(null);
  // Before first paint: past chapters' gear counts as in hand the first time (D-139).
  useLayoutEffect(() => seedKit(route), [route]);
  // First paint mounts only the chapters around the one you land on; the rest mount over the next frames, nearest
  // first, two per frame. CSS scroll anchoring keeps the view still while placeholders above grow into chapters.
  const [radius, setRadius] = useState(1);
  const allMounted = radius >= 12;
  useEffect(() => {
    if (allMounted) return;
    const id = requestAnimationFrame(() => {
      setTimeout(() => setRadius((r) => r + 1), 0);
    });
    return () => cancelAnimationFrame(id);
  }, [radius, allMounted]);
  const active = useActiveSection(ids, allMounted);
  const activeChapter = Number(active.match(/^ch-(\d+)$/)?.[1] ?? 0);
  const near = (ch: number | undefined) => Math.abs((ch ?? 0) - (startCh)) <= radius;
  const anchor = useRef<Anchor | null>(null);

  useEffect(() => {
    if (activeChapter) setKitChapter(activeChapter);
  }, [activeChapter]);

  useEffect(() => {
    syncUrl(route, active);
  }, [route, active]);

  // Where to land (D-91): the URL's chapter, else the last chapter you read; same chapter → same line inside it.
  const [landing] = useState(() => {
    const saved = loadPlace(route);
    const ch = initialChapter ?? saved?.ch;
    return ch ? { ch, y: saved && saved.ch === ch ? saved.y ?? 0 : 0 } : null;
  });
  useEffect(() => {
    if (!landing) {
      globalThis.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    // Jump without the smooth-scroll animation, then again once web fonts settle the layout.
    const go = () => {
      const el = document.getElementById(`ch-${landing.ch}`);
      if (el) globalThis.scrollTo({ top: el.getBoundingClientRect().top + globalThis.scrollY + landing.y, behavior: "instant" });
    };
    const id = requestAnimationFrame(go);
    document.fonts?.ready.then(go);
    return () => cancelAnimationFrame(id);
  }, [route, landing]);

  // Remember the line you're on inside the active chapter.
  const activeRef = useRef(activeChapter);
  activeRef.current = activeChapter;
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const ch = activeRef.current;
        const el = ch && document.getElementById(`ch-${ch}`);
        if (el) savePlace(route, { ch, y: Math.round(-el.getBoundingClientRect().top) });
      });
    };
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener("scroll", onScroll);
    };
  }, [route]);

  // Keep the reading anchor fresh: on scroll, and just before any click or key that could open or close the panel.
  useEffect(() => {
    const take = () => {
      anchor.current = readingAnchor(main.current);
    };
    // Scroll: at most one measurement per frame.
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

  const open = Boolean(kit);
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a || !a.el.isConnected) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 1) globalThis.scrollBy({ top: delta, behavior: "instant" });
    anchor.current = readingAnchor(main.current);
  }, [open]);

  const openKit = useCallback((t: KitTab) => setKit(t), []);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const openMap = useCallback((f: { place?: string; item?: string }) => {
    setMapFocus({ ...f, nonce: Date.now() });
    setKit("map");
  }, []);
  const [mountFocus, setMountFocus] = useState<{ slug: string; nonce: number } | null>(null);
  const openMount = useCallback((slug: string) => {
    setMountFocus({ slug, nonce: Date.now() });
    setKit("mounts");
  }, []);
  const [unitFocus, setUnitFocus] = useState<UnitFocus | null>(null);
  const focusUnit = useCallback((name: string) => {
    setUnitFocus({ name, nonce: Date.now() });
    setKit("units");
  }, []);
  const ctx: WalkContext = useMemo(() => ({
    route,
    focusUnit,
    openKit,
    openMap,
    openMount,
  }), [route, focusUnit, openKit, openMap, openMount]);
  const goChapter = useCallback((ch: number) => {
    if (globalThis.innerWidth < 1024) setKit(null);
    scrollToSection(`ch-${ch}`);
  }, []);
  const closeKit = useCallback(() => setKit(null), []);
  // The panel stays mounted after its first opening (hidden when closed), so reopening it, the map above all, is
  // instant: no remount of the tab, no reload of the map tiles.
  const [lastTab, setLastTab] = useState<KitTab | null>(null);
  useEffect(() => {
    if (kit) setLastTab(kit);
  }, [kit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const tab = kitTabs(route).find((t) => t.key.toLowerCase() === e.key.toLowerCase()) ??
        KIT_ALIASES.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
      if (tab) {
        setKit((k) => (k === tab.id ? null : tab.id));
        return;
      }
      if (e.key === "Escape") setKit(null);
      else if (e.key === "j" || e.key === "k") {
        const i = ids.indexOf(active);
        const next = ids[Math.min(ids.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1)))];
        if (next) scrollToSection(next);
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [ids, active, route]);

  return (
    <WalkCtx.Provider value={ctx}>
      <div style={routeVars(route)} className="min-h-screen bg-paper">
        <TopBar back={{ to: "#/", label: "All lords" }} current={route} view="walk" />
        <MobileBar chapters={chapters} tail={tail} active={active} />
        {/* Closed, the dock sits on the right edge: the page keeps its width clear. */}
        <div className={kit ? PANEL_MR : "lg:pr-[80px]"}>
          <div className="mx-auto flex max-w-[1340px] gap-5 px-4 pt-5 pb-32 md:px-6">
            <ChapterRail route={route} chapters={chapters} extras={tail} active={active} compact={open} onGo={scrollToSection} />
            <main ref={main} className="min-w-0 flex-1 text-[16px] leading-[1.6]">
              <RouteBand route={route} />
              <div className="mt-3"><RouteRules route={route} /></div>
              {chapters.map((s) => {
                if (!near(s.chapter)) return <section key={s.id} id={s.id} data-section={s.id} className="min-h-[2400px]" />;
                const file = s.chapter ? chapterFile(route, s.chapter) : undefined;
                return file ? <ChapterView key={s.id} c={file} /> : <ChapterSection key={s.id} sec={s} />;
              })}
              <BeforePartTwo route={route} exits={exits} later={later} />
              <OpenQuestions route={route} sections={notes} />
              {!retired && <RouteArchive route={route} plan={plan} intro={wt.about} />}
            </main>
          </div>
        </div>
        <Dock route={route} open={kit} onOpen={(t) => setKit(t)} />
        {kit && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={closeKit} aria-hidden="true" />}
        {(kit ?? lastTab) && (
          <>
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
                chapter={kitChapter}
                mapFocus={mapFocus}
                mountFocus={mountFocus}
                unitFocus={unitFocus}
                onChapter={goChapter}
                setTab={setKit}
                setChapter={setKitChapter}
                onClose={closeKit}
              />
            </div>
          </>
        )}
      </div>
    </WalkCtx.Provider>
  );
}

/** Chapter picker for narrow screens, where the rail is hidden. */
function MobileBar({ chapters, tail, active }: { chapters: Section[]; tail: RailExtra[]; active: string }) {
  return (
    <div className="sticky top-[52px] z-20 flex items-center gap-2 bg-paper/95 px-4 py-2 shadow-[0_1px_0_rgba(176,144,90,.4)] backdrop-blur lg:hidden">
      <Backpack aria-hidden="true" className="size-4 text-(--c)" />
      <label className="sr-only" htmlFor="ch-pick">Jump to</label>
      <select
        id="ch-pick"
        value={active}
        onChange={(e) => scrollToSection(e.target.value)}
        className="min-w-0 flex-1 rounded-md bg-card px-2 py-1.5 text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]"
      >
        <option value="plan">Route overview</option>
        {chapters.map((s) => <option key={s.id} value={s.id}>Ch {s.chapter} · {s.name}</option>)}
        {tail.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
    </div>
  );
}
