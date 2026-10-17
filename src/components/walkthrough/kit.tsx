import { memo, type ReactNode, useEffect, useRef, useState } from "react";
import {
  Activity,
  Anchor,
  Backpack,
  Bird,
  ChevronsDown,
  Crown,
  Eye,
  Feather,
  Flag,
  Flame,
  Gift,
  Landmark,
  Map as MapIcon,
  Music,
  Package,
  PawPrint,
  Pin,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Sparkles,
  Swords,
  Users,
  UtensilsCrossed,
  Wind,
  X,
} from "lucide-react";
import { META } from "../../lib/data.ts";
import { routeVars } from "../../lib/route-style.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { ravenGuide } from "../../lib/walkthrough/reference.ts";
import { Medal } from "../ui/medal.tsx";
import { closeHover } from "../ui/hover.tsx";
import { Fold, SearchBox } from "./fold.tsx";
import { GiftsTab } from "./gifts-tab.tsx";
import { MealsTab } from "./meals-tab.tsx";
import { Blocks } from "./blocks.tsx";
import type { KitTab } from "./ctx.ts";
import { TableMode } from "./table.tsx";
import { type MapFocus, WorldMap } from "./world-map.tsx";
import { MountsTab } from "./mounts-tab.tsx";
import { ArenaTab } from "./arena-tab.tsx";
import { hasStable } from "../../lib/mounts.ts";
import { type UnitFocus, UnitsTab } from "../units/units-tab.tsx";
import { Ledger } from "../ledger/ledger.tsx";
import { PinCount, PinsTab } from "../pins/pins-tab.tsx";
import { ItemsTab } from "../items/items-tab.tsx";
import { WarPrepTab } from "../parts/war-prep-tab.tsx";
import { SquadsTab } from "../parts/squads.tsx";
import { TemplesTab } from "../parts/temples-tab.tsx";
import { DiademTab } from "../parts/diadem-tab.tsx";
import { Arena3Tab } from "../parts/arena3-tab.tsx";

export const KIT_TABS: { id: KitTab; label: string; key: string; icon: ReactNode; parts?: (1 | 2 | 3)[] }[] = [
  { id: "units", label: "Units", key: "U", icon: <Backpack aria-hidden="true" className="size-[18px]" /> },
  { id: "ledger", label: "Ledger", key: "L", icon: <ScrollText aria-hidden="true" className="size-[18px]" /> },
  { id: "pins", label: "Pins", key: "P", icon: <Pin aria-hidden="true" className="size-[18px]" /> },
  { id: "items", label: "Items", key: "I", icon: <Package aria-hidden="true" className="size-[18px]" /> },
  { id: "gifts", label: "Gifts", key: "G", icon: <Gift aria-hidden="true" className="size-[18px]" /> },
  { id: "meals", label: "Meals", key: "E", icon: <UtensilsCrossed aria-hidden="true" className="size-[18px]" /> },
  { id: "raven", label: "Pale Raven", key: "R", icon: <Bird aria-hidden="true" className="size-[18px]" /> },
  { id: "arena", label: "Arena", key: "A", icon: <Swords aria-hidden="true" className="size-[18px]" /> },
  { id: "map", label: "Map", key: "M", icon: <MapIcon aria-hidden="true" className="size-[18px]" /> },
  { id: "mounts", label: "Mounts", key: "T", icon: <PawPrint aria-hidden="true" className="size-[18px]" /> },
  { id: "warprep", label: "War Prep", key: "W", icon: <Flag aria-hidden="true" className="size-[18px]" />, parts: [2] },
  { id: "squads", label: "Squads", key: "Q", icon: <Users aria-hidden="true" className="size-[18px]" />, parts: [3] },
  {
    id: "temples",
    label: "Temples",
    key: "O",
    icon: <Landmark aria-hidden="true" className="size-[18px]" />,
    parts: [3],
  },
  { id: "diadem", label: "Diadem", key: "D", icon: <Crown aria-hidden="true" className="size-[18px]" />, parts: [3] },
];

/**
 * Field Kit tabs per Part (D-125). Part II has no Free Time, World Map, Arena or meals; Part III brings the map back,
 * imports Cai's Stable and the Part III Arena (D-159), and hides Meals, Gifts and Pale Raven until their Part III
 * versions exist.
 */
export function partTabs(part: 1 | 2 | 3): KitTab[] {
  if (part === 2) return ["units", "ledger", "pins", "items", "warprep"];
  if (part === 3) return ["squads", "temples", "diadem", "arena", "units", "ledger", "pins", "items", "map", "mounts"];
  return KIT_TABS.filter((t) => !t.parts).map((t) => t.id);
}

/** Extra keys: B units (old Builds key). */
export const KIT_ALIASES: { key: string; id: KitTab }[] = [
  { key: "B", id: "units" },
];

/** Tabs for a route: the Mounts tab only exists where there's a Stable. */
export const kitTabs = (route: RouteName, only?: KitTab[]) =>
  (only ? only.map((id) => KIT_TABS.find((t) => t.id === id)!) : KIT_TABS.filter((t) => !t.parts)).filter((t) =>
    t && (t.id !== "mounts" || hasStable(route) || only?.includes("squads"))
  );

/** One panel width for every tab (V-8): the map's. */
export const PANEL_W = "lg:w-[min(900px,58vw)]";
export const PANEL_MR = "lg:mr-[min(900px,58vw)]";

/** Folds the legacy ids into the visible tabs (Gifts, Meals and Pale Raven are their own tabs, D-82). */
export function kitView(tab: KitTab): { tab: KitTab } {
  if (tab === "builds") return { tab: "units" };
  if (tab === "supports") return { tab: "gifts" };
  return { tab };
}

/* ---------------------------------------------------------------- Raven */

const ACTIONS: [RegExp, ReactNode][] = [
  [/gaze/i, <Eye key="i" className="size-4" />],
  [/nod/i, <ChevronsDown key="i" className="size-4" />],
  [/spread/i, <Feather key="i" className="size-4" />],
  [/flap/i, <Wind key="i" className="size-4" />],
  [/sing/i, <Music key="i" className="size-4" />],
  [/tilt/i, <RotateCcw key="i" className="size-4" />],
  [/intimidat/i, <Flame key="i" className="size-4" />],
  [/dance/i, <Sparkles key="i" className="size-4" />],
  [/somersault/i, <RefreshCw key="i" className="size-4" />],
  [/cling/i, <Anchor key="i" className="size-4" />],
  [/tremble/i, <Activity key="i" className="size-4" />],
];

const ACTION_TONE: [RegExp, string][] = [
  [/gaze/i, "bg-[#dbe6f5] text-[#24467f]"],
  [/nod/i, "bg-[#dcefe3] text-[#1f6a43]"],
  [/spread|flap/i, "bg-[#f3e7cf] text-[#7d5a17]"],
  [/sing|dance/i, "bg-[#f6dfe9] text-[#8c2a57]"],
  [/tilt/i, "bg-[#e9e2f5] text-[#4f3486]"],
  [/intimidat/i, "bg-[#f6dcd6] text-[#8a2a17]"],
];

export function RavenAnswer({ answer }: { answer: string }) {
  const icon = ACTIONS.find(([re]) => re.test(answer))?.[1];
  const tone = ACTION_TONE.find(([re]) => re.test(answer))?.[1] ?? "bg-paper-2 text-ink";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13.5px] font-bold whitespace-nowrap",
        tone,
      )}
    >
      {icon}
      {answer}
    </span>
  );
}

function RavenTab({ route }: { route: RouteName }) {
  const guide = ravenGuide();
  const [lord, setLord] = useState<RouteName>(route);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const lines = query
    ? META.order.flatMap((r) => (guide.lords[r] ?? []).map((l) => ({ ...l, lord: r }))).filter((l) =>
      l.line.toLowerCase().includes(query) || l.answer.toLowerCase().includes(query)
    )
    : (guide.lords[lord] ?? []).map((l) => ({ ...l, lord }));
  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder="Type a few words of the line" />
      {!query && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Lord">
          {META.order.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={r === lord}
              onClick={() => setLord(r)}
              style={routeVars(r)}
              className={cx(
                "flex items-center gap-1.5 rounded-full py-0.5 pr-3 pl-0.5 text-[14px] font-semibold",
                r === lord ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
              )}
            >
              <Medal flat name={r} route={r} size={24} ring="transparent" />
              {r}
            </button>
          ))}
        </div>
      )}
      {lines.length > 0 && (
        <div className="overflow-hidden rounded-md border border-gold/55 bg-card">
          <table className="w-full border-collapse text-left text-[14.5px] leading-snug">
            <thead>
              <tr className="border-b border-gold/60 bg-paper-2/70">
                {query && (
                  <th className="px-3 py-2 text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">
                    Lord
                  </th>
                )}
                <th className="px-3 py-2 text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">
                  Line opening
                </th>
                <th className="px-3 py-2 text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">
                  Answer
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={`${l.lord}${l.line}`}
                  className="border-b border-gold/25 align-middle last:border-0 even:bg-paper/40"
                >
                  {query && <td className="px-3 py-2 text-[13px] font-semibold text-muted">{l.lord}</td>}
                  <td className="px-3 py-2">“{l.line}”</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <RavenAnswer answer={l.answer} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lines.length === 0 && (
        <p className="text-[14px] text-muted">
          No lord line matches. Answers for the rest of the cast are not in the guide yet.
        </p>
      )}
      <Fold title="How Bird Time works">
        <Blocks tokens={guide.rules} k="rules" />
        <Blocks tokens={guide.why} k="why" />
      </Fold>
      <Fold title="Other characters">
        <Blocks tokens={guide.others} k="others" />
      </Fold>
    </>
  );
}

/* ---------------------------------------------------------------- Shell */

type Props = {
  route: RouteName;
  tab: KitTab;
  chapter: number;
  mapFocus: MapFocus | null;
  mountFocus: { slug: string; nonce: number } | null;
  /** Unit to open in the Units tab. */
  unitFocus?: UnitFocus | null;
  onChapter: (ch: number) => void;
  setTab: (t: KitTab) => void;
  setChapter: (n: number) => void;
  onClose: () => void;
  /** Limit the tabs, e.g. the Army page shows Units and Ledger only. */
  only?: KitTab[];
  /** Part on screen (D-122) and the War chapter or Section the Part tabs follow. */
  part?: 1 | 2 | 3;
  partN?: number;
};

/** The Field Kit: reference tables that stay open beside the walkthrough. Memoized: the page re-renders on scroll. */
export const FieldKit = memo(function FieldKit(
  {
    route,
    tab,
    chapter,
    mapFocus,
    mountFocus,
    unitFocus,
    onChapter,
    setTab,
    setChapter,
    onClose,
    only,
    part = 1,
    partN = 1,
  }: Props,
) {
  // The map is the heaviest tab: once opened it stays mounted (hidden on other tabs).
  const [mapSeen, setMapSeen] = useState(tab === "map");
  useEffect(() => {
    if (tab === "map") setMapSeen(true);
  }, [tab]);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
    body.current?.scrollTo({ top: 0 });
    closeHover(); // a card left open on the page would sit over the panel (D-87)
  }, [tab, mapFocus?.nonce, unitFocus?.nonce]);
  const tabs = kitTabs(route, only);
  const view = kitView(tab);
  const [narrow, setNarrow] = useState(() => globalThis.innerWidth < 700);
  useEffect(() => {
    const on = () => setNarrow(globalThis.innerWidth < 700);
    globalThis.addEventListener("resize", on);
    return () => globalThis.removeEventListener("resize", on);
  }, []);
  return (
    <aside
      aria-label="Field kit"
      className="flex h-full flex-col bg-card shadow-[-12px_0_40px_-20px_rgba(16,38,42,.5),inset_1px_0_0_rgba(176,144,90,.6)]"
    >
      <div className="flex items-center gap-1 bg-teal px-2 pt-2 text-parchment">
        <div role="tablist" aria-label="Field kit" className="flex min-w-0 flex-1 gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === view.tab}
              onClick={() => setTab(t.id)}
              title={`${t.label} (${t.key})`}
              className={cx(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-t-md px-1 pt-1.5 pb-1.5 text-[12px] font-semibold",
                t.id === view.tab ? "bg-card text-ink" : "text-parchment/80 hover:bg-white/10",
              )}
            >
              <span className="relative">
                {t.icon}
                {t.id === "pins" && <PinCount />}
              </span>
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close field kit (Esc)"
          className="p-2 text-parchment/80 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>
      {(mapSeen || tab === "map") && (
        <div className={cx("min-h-0 flex-1", tab !== "map" && "hidden")}>
          <WorldMap route={route} chapter={chapter} focus={mapFocus} onChapter={onChapter} />
        </div>
      )}
      {view.tab !== "map" && (
        <div
          ref={body}
          data-kit-scroll
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-10 text-[15px]"
        >
          <TableMode.Provider value={narrow ? "cards" : "table"}>
            <div className="pt-3">
              {view.tab === "gifts" && <GiftsTab route={route} chapter={chapter} />}
              {view.tab === "meals" && <MealsTab route={route} chapter={chapter} />}
              {view.tab === "raven" && <RavenTab route={route} />}
              {view.tab === "units" && <UnitsTab route={route} chapter={chapter} focus={unitFocus} />}
              {view.tab === "ledger" && <Ledger route={route} part={part} />}
              {view.tab === "pins" && <PinsTab route={route} onChapter={onChapter} />}
              {view.tab === "items" && <ItemsTab route={route} />}
              {tab === "arena" && (part === 3
                ? <Arena3Tab n={partN} setN={setChapter} />
                : <ArenaTab route={route} chapter={chapter} setChapter={setChapter} />)}
              {tab === "mounts" && <MountsTab route={route} focus={mountFocus} />}
              {tab === "warprep" && <WarPrepTab route={route} ch={partN} setCh={setChapter} />}
              {tab === "squads" && <SquadsTab route={route} n={partN} setN={setChapter} />}
              {tab === "temples" && <TemplesTab route={route} />}
              {tab === "diadem" && <DiademTab route={route} />}
            </div>
          </TableMode.Provider>
        </div>
      )}
    </aside>
  );
});

/** Kit launcher: a column on the right edge on desktop, a bar along the bottom on phones. */
export function Dock(
  { route, open, onOpen, only }: {
    route: RouteName;
    open: KitTab | null;
    onOpen: (t: KitTab) => void;
    only?: KitTab[];
  },
) {
  if (open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-around bg-teal px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] text-parchment lg:inset-x-auto lg:top-1/2 lg:right-0 lg:bottom-auto lg:-translate-y-1/2 lg:flex-col lg:gap-1 lg:rounded-l-lg lg:px-1.5 lg:py-2 lg:shadow-[0_10px_30px_-10px_rgba(16,38,42,.6)]">
      {kitTabs(route, only).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onOpen(t.id)}
          title={`${t.label} (${t.key})`}
          className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-semibold text-parchment/85 hover:bg-white/10 hover:text-white"
        >
          <span className="relative text-gold-hi">
            {t.icon}
            {t.id === "pins" && <PinCount />}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
