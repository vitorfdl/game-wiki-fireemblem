import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlaceLoot } from "../ref/place-loot.tsx";
import { PinToggle, usePinFrom } from "../ui/pin-toggle.tsx";
import {
  Caravan,
  Castle,
  CircleHelp,
  DoorOpen,
  House,
  Landmark,
  Leaf,
  Lock,
  Maximize2,
  Minus,
  Plus,
  Search,
  Star,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cx } from "../../lib/cx.ts";
import { foldName, ITEM_BY_NAME, type MapKind, type MapNode, NODE, placeMentions, WORLD } from "../../lib/map.ts";
import { sectionPlaces } from "../../lib/part-plan.ts";
import type { RouteName } from "../../lib/types.ts";

export type MapFocus = { place?: string; item?: string; nonce: number };

const KINDS: Record<MapKind, { label: string; color: string; icon: (c: string) => ReactNode }> = {
  settlement: { label: "Towns", color: "#b0802a", icon: (c) => <Star className={c} /> },
  posthouse: { label: "Posthouses", color: "#1f6f78", icon: (c) => <Caravan className={c} /> },
  dungeon: { label: "Dungeons", color: "#a8452a", icon: (c) => <DoorOpen className={c} /> },
  stronghold: { label: "Strongholds", color: "#4a5560", icon: (c) => <Castle className={c} /> },
  temple: { label: "Temples", color: "#6a3fa0", icon: (c) => <Landmark className={c} /> },
  field: { label: "Fields", color: "#3d7a3a", icon: (c) => <Leaf className={c} /> },
  feast: { label: "Feast points", color: "#c2415f", icon: (c) => <UtensilsCrossed className={c} /> },
  base: { label: "Bases", color: "#10262a", icon: (c) => <House className={c} /> },
  unconfirmed: { label: "Unconfirmed", color: "#8a8170", icon: (c) => <CircleHelp className={c} /> },
};
const KIND_ORDER = Object.keys(KINDS) as MapKind[];

const W = WORLD.width;
const H = WORLD.height;
const MAX = 1.6;

type View = { s: number; x: number; y: number };

/** Pan and zoom state with wheel, drag, pinch and "fly to" helpers. Coordinates are mosaic pixels. */
function useViewport(box: React.RefObject<HTMLDivElement | null>) {
  const [view, setView] = useState<View>({ s: 0.1, x: 0, y: 0 });
  const [min, setMin] = useState(0.05);
  const clamp = useCallback((v: View, minS: number): View => {
    const el = box.current;
    if (!el) return v;
    const s = Math.min(MAX, Math.max(minS, v.s));
    const w = el.clientWidth;
    const h = el.clientHeight;
    const mx = Math.min(0, w - W * s);
    const my = Math.min(0, h - H * s);
    return {
      s,
      x: W * s < w ? (w - W * s) / 2 : Math.min(0, Math.max(mx, v.x)),
      y: H * s < h ? (h - H * s) / 2 : Math.min(0, Math.max(my, v.y)),
    };
  }, [box]);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const s = Math.min(el.clientWidth / W, el.clientHeight / H);
    setMin(s);
    setView(clamp({ s, x: 0, y: 0 }, s));
  }, [box, clamp]);

  useLayoutEffect(() => {
    fit();
    const ro = new ResizeObserver(() => setView((v) => clamp(v, min)));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
    // Fit once on mount; later resizes keep the current zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const s = Math.min(MAX, Math.max(min, v.s * factor));
      const k = s / v.s;
      return clamp({ s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }, min);
    });
  }, [clamp, min]);

  const flyTo = useCallback((px: number, py: number, s?: number) => {
    const el = box.current;
    if (!el) return;
    setView((v) => {
      const ns = Math.max(min, s ?? Math.max(v.s, 0.55));
      return clamp({ s: ns, x: el.clientWidth / 2 - px * ns, y: el.clientHeight / 2 - py * ns }, min);
    });
  }, [box, clamp, min]);

  const fitBounds = useCallback((pts: { x: number; y: number }[]) => {
    const el = box.current;
    if (!el || !pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 160;
    const s = Math.min(MAX * 0.6, el.clientWidth / (x1 - x0 + pad * 2), el.clientHeight / (y1 - y0 + pad * 2));
    flyTo((x0 + x1) / 2, (y0 + y1) / 2, s);
  }, [box, flyTo]);

  return { view, setView, clamp, min, fit, zoomAt, flyTo, fitBounds };
}

function Pin(
  { n, s, on, hot, onPick }: {
    n: MapNode;
    s: number;
    on: boolean;
    hot: boolean;
    onPick: () => void;
  },
) {
  const k = KINDS[n.kind];
  const major = n.kind === "settlement" || n.kind === "dungeon" || n.kind === "posthouse";
  // Past ~0.45 the mosaic's own painted labels are readable, so ours would only double them.
  const showLabel = on || hot || (s < 0.45 && (s >= 0.32 || (major && s >= 0.22)));
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title={n.name}
      className={cx(
        "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
        (on || hot) && "z-10",
      )}
      style={{ left: n.x * s, top: n.y * s }}
    >
      {s < 0.22 && !on && !hot
        ? (
          <span
            className="block size-[10px] rounded-full shadow-[0_0_0_1.5px_#fffaf0,0_1px_3px_rgba(0,0,0,.5)]"
            style={{ background: k.color }}
          />
        )
        : (
          <span
            className={cx(
              "relative grid place-items-center rounded-full text-white",
              on || hot
                ? "size-9 shadow-[0_0_0_3px_#fffaf0,0_0_0_6px_rgba(0,0,0,.35),0_4px_14px_rgba(0,0,0,.6)]"
                : "size-[22px] shadow-[0_0_0_2px_#fffaf0,0_2px_6px_rgba(0,0,0,.45)]",
            )}
            style={{ background: k.color }}
          >
            {(on || hot) && (
              <span
                aria-hidden="true"
                className="absolute -inset-2 animate-ping rounded-full border-2 border-gold-hi [animation-duration:1.8s]"
              />
            )}
            {k.icon(on || hot ? "size-[18px]" : "size-3")}
            {n.gated && (
              <Lock
                aria-hidden="true"
                className="absolute -right-1 -bottom-1 size-3 rounded-full bg-ink p-[1px] text-gold-hi"
              />
            )}
          </span>
        )}
      {showLabel && (
        <span
          className={cx(
            "mt-1 rounded-[3px] leading-tight font-semibold whitespace-nowrap",
            on || hot
              ? "bg-ink px-1.5 py-0.5 text-[13px] text-gold-hi shadow-[0_2px_8px_rgba(0,0,0,.5)]"
              : "bg-[rgba(255,250,240,.88)] px-1 text-[11.5px] text-ink",
          )}
        >
          {n.name}
        </span>
      )}
    </button>
  );
}

function Detail(
  { n, route, onPlace, onItem, onChapter, onClose }: {
    n: MapNode;
    route: RouteName;
    onPlace: (slug: string) => void;
    onItem: (key: string) => void;
    onChapter: (ch: number) => void;
    onClose: () => void;
  },
) {
  const k = KINDS[n.kind];
  const chapters = placeMentions(route).get(n.slug) ?? [];
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="animate-rise max-h-full overflow-y-auto rounded-lg bg-card px-3 py-2 text-[13px] leading-snug shadow-[0_18px_40px_-12px_rgba(0,0,0,.6),inset_0_0_0_1px_rgba(176,144,90,.6)]"
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white"
          style={{ background: k.color }}
        >
          {k.icon("size-3.5")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold leading-tight">{n.name}</div>
          <div className="text-[11.5px] text-muted">
            {k.label.replace(/s$/, "")}
            {n.region ? ` · ${n.region}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close place"
          className="-mt-0.5 -mr-1 p-0.5 text-muted hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {n.unlock && (
        <p className="mt-1.5 mb-0 flex gap-1.5 text-[12px] text-warn-ink">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {n.unlock}
        </p>
      )}
      {n.items?.length
        ? (
          <div className="mt-1.5">
            <div className="label mb-0.5 text-[10px] text-gold-lo">Gather here</div>
            <div className="flex flex-wrap gap-0.5">
              {n.items.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onItem(key)}
                  className="rounded-full bg-paper-2 px-1.5 py-0 text-[12px] font-semibold hover:bg-paper-3"
                >
                  {WORLD.items[key]?.name ?? key}
                </button>
              ))}
            </div>
          </div>
        )
        : null}
      <PlaceLoot name={n.name} />
      {chapters.length > 0 && (
        <div className="mt-1.5">
          <div className="label mb-0.5 text-[10px] text-gold-lo">In {route}'s walkthrough</div>
          <div className="flex flex-wrap gap-0.5">
            {chapters.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChapter(c)}
                className="rounded bg-(--c) px-1.5 py-0 text-[12px] font-bold text-white hover:opacity-90"
              >
                Ch {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {n.post && (
        <p className="mt-1.5 mb-0 text-[12px] text-ink-soft">
          <b className="label mr-1 text-[10px] text-gold-lo">Nearest posthouse</b>
          <button type="button" onClick={() => onPlace(slugOf(n.post!.name))} className="font-semibold underline">
            {n.post.name}
          </button>
          {n.post.via.length > 0 && <span>, via {n.post.via.join(", ")}</span>}
        </p>
      )}
      {n.links?.length
        ? (
          <div className="mt-1.5">
            <div className="label mb-0.5 text-[10px] text-gold-lo">Roads to</div>
            <div className="flex flex-wrap gap-0.5">
              {n.links.map((l) =>
                NODE[l] && (
                  <button
                    key={l}
                    type="button"
                    onClick={() => onPlace(l)}
                    className="rounded-full border border-gold/50 px-1.5 py-0 text-[12px] hover:bg-paper-2"
                  >
                    {NODE[l].name}
                  </button>
                )
              )}
            </div>
          </div>
        )
        : null}
    </div>
  );
}

const CARD_W = 236;

/**
 * Place card floating next to its pin, inside the map, so opening it never resizes the map. It sits on whichever
 * side of the pin has room and stays inside the map; on narrow panels it docks to the top.
 */
function FloatingCard(
  { box, px, py, children }: {
    box: React.RefObject<HTMLDivElement | null>;
    px: number;
    py: number;
    children: ReactNode;
  },
) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    setH(ref.current?.offsetHeight ?? 0);
  });
  const w = box.current?.clientWidth ?? 0;
  const bh = box.current?.clientHeight ?? 0;
  const narrow = w < CARD_W * 2;
  const style: React.CSSProperties = narrow ? { left: 8, right: 8, top: 8, maxHeight: bh * 0.55 } : {
    width: CARD_W,
    left: px + 28 + CARD_W < w - 8 ? px + 28 : Math.max(8, px - 28 - CARD_W),
    top: Math.min(Math.max(8, py - 40), Math.max(8, bh - h - 8)),
    maxHeight: bh - 16,
  };
  return (
    <div ref={ref} className="absolute z-30 flex flex-col" style={style}>
      {children}
    </div>
  );
}

const slugOf = (name: string) => WORLD.nodes.find((n) => foldName(n.name) === foldName(name))?.slug ?? "";

/** The world map: pan and zoom the mosaic, filter pins by kind, search places and gathering items. */
export function WorldMap(
  { route, chapter, focus, onChapter }: {
    route: RouteName;
    chapter: number;
    focus: MapFocus | null;
    onChapter: (ch: number) => void;
  },
) {
  const box = useRef<HTMLDivElement>(null);
  const { view, setView, clamp, min, fit, zoomAt, flyTo, fitBounds } = useViewport(box);
  const [kinds, setKinds] = useState<Set<MapKind>>(() => new Set(KIND_ORDER));
  const [sel, setSel] = useState<string | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [onlyChapter, setOnlyChapter] = useState(false);
  const [q, setQ] = useState("");
  const drag = useRef<{ id: number; x: number; y: number; vx: number; vy: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const moved = useRef(false);
  // A gathering item pinned from the map remembers the open place, else the map itself (D-108).
  const mapFrom = usePinFrom(sel && NODE[sel] ? { place: NODE[sel].name } : { slot: "World map" });

  const mentions = placeMentions(route);
  // Part III (positions 19–24): the places the Section's plan and facts mention.
  const here = useMemo(
    () =>
      chapter > 18
        ? sectionPlaces(route, chapter - 18)
        : new Set([...mentions].filter(([, chs]) => chs.includes(chapter)).map(([slug]) => slug)),
    [mentions, chapter, route],
  );
  const itemPlaces = useMemo(() => new Set(item ? WORLD.items[item]?.places ?? [] : []), [item]);

  const pickPlace = useCallback((slug: string) => {
    const n = NODE[slug];
    if (!n) return;
    setSel(slug);
    flyTo(n.x, n.y);
  }, [flyTo]);

  const pickItem = useCallback((key: string) => {
    setItem(key);
    setSel(null);
    fitBounds((WORLD.items[key]?.places ?? []).map((s) => NODE[s]).filter(Boolean));
  }, [fitBounds]);

  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      if (focus.place) pickPlace(focus.place);
      else if (focus.item) pickItem(focus.item);
    }, 30);
    return () => clearTimeout(t);
  }, [focus, pickPlace, pickItem]);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setSel(null);
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [sel]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moved.current = false;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
      drag.current = null;
    } else drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pts.current.size === 2 && box.current) {
      const [a, b] = [...pts.current.values()];
      const r = box.current.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = pinch.current.s * (d / pinch.current.d);
      zoomAt(target / view.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    const d = drag.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) moved.current = true;
    if (d && d.id === e.pointerId) {
      setView(clamp({ s: view.s, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }, min));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const query = foldName(q.trim());
  const placeHits = query
    ? WORLD.nodes.filter((n) => foldName(n.name).includes(query) || foldName(n.region ?? "").includes(query)).slice(
      0,
      8,
    )
    : [];
  const itemHits = query
    ? [...ITEM_BY_NAME.entries()].filter(([name]) => name.includes(query)).slice(0, 8).map(([, key]) => key)
    : [];

  const counts = useMemo(() => {
    const c: Partial<Record<MapKind, number>> = {};
    for (const n of WORLD.nodes) c[n.kind] = (c[n.kind] ?? 0) + 1;
    return c;
  }, []);

  const focusing = item !== null || onlyChapter;
  const visible = WORLD.nodes.filter((n) => kinds.has(n.kind) || n.slug === sel || itemPlaces.has(n.slug));
  const node = sel ? NODE[sel] : null;
  const it = item ? WORLD.items[item] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative z-20 border-b border-gold/40 bg-card px-3 py-2">
        <label className="flex items-center gap-2 rounded-md bg-paper px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]">
          <Search aria-hidden="true" className="size-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (placeHits[0]) pickPlace(placeHits[0].slug);
              else if (itemHits[0]) pickItem(itemHits[0]);
              else return;
              setQ("");
            }}
            placeholder="Find a place or a gathering item"
            className="w-full bg-transparent text-[14.5px] outline-none placeholder:text-muted"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="text-muted">
              <X className="size-4" />
            </button>
          )}
        </label>
        {(placeHits.length > 0 || itemHits.length > 0) && (
          <div className="absolute inset-x-3 top-full z-30 mt-1 max-h-[300px] overflow-y-auto rounded-md bg-card p-1 shadow-[0_12px_30px_-10px_rgba(16,38,42,.5),inset_0_0_0_1px_rgba(176,144,90,.5)]">
            {placeHits.map((n) => (
              <button
                key={n.slug}
                type="button"
                onClick={() => {
                  pickPlace(n.slug);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[14px] hover:bg-paper-2"
              >
                <span
                  className="grid size-5 place-items-center rounded-full text-white"
                  style={{ background: KINDS[n.kind].color }}
                >
                  {KINDS[n.kind].icon("size-3")}
                </span>
                <span className="font-semibold">{n.name}</span>
                <span className="ml-auto text-[12px] text-muted">{n.region ?? KINDS[n.kind].label}</span>
              </button>
            ))}
            {itemHits.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  pickItem(key);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[14px] hover:bg-paper-2"
              >
                <Leaf aria-hidden="true" className="size-4 text-[#3d7a3a]" />
                <span className="font-semibold">{WORLD.items[key].name}</span>
                <span className="ml-auto text-[12px] text-muted">
                  {WORLD.items[key].places.length} spot{WORLD.items[key].places.length === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            aria-pressed={onlyChapter}
            onClick={() => {
              const next = !onlyChapter;
              setOnlyChapter(next);
              if (next) fitBounds([...here].map((slug) => NODE[slug]).filter(Boolean));
            }}
            className={cx(
              "rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold",
              onlyChapter ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
            )}
            title={chapter > 18
              ? "Highlight the places this Section's plan mentions"
              : "Highlight the places this chapter's steps mention"}
          >
            {chapter > 18 ? `Section ${chapter - 18}` : `Ch ${chapter}`} places · {here.size}
          </button>
          {KIND_ORDER.filter((k) => counts[k]).map((k) => {
            const on = kinds.has(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(kinds);
                  if (on) next.delete(k);
                  else next.add(k);
                  setKinds(next);
                }}
                className={cx(
                  "flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-[12px] font-semibold",
                  on ? "bg-paper-2 text-ink" : "bg-transparent text-muted line-through opacity-60",
                )}
              >
                <span
                  className="grid size-4 place-items-center rounded-full text-white"
                  style={{ background: KINDS[k].color }}
                >
                  {KINDS[k].icon("size-2.5")}
                </span>
                {KINDS[k].label}
              </button>
            );
          })}
        </div>
        {it && (
          <div className="mt-2 flex items-center gap-2 rounded bg-[#e3f0df] px-2 py-1 text-[13px]">
            <Leaf aria-hidden="true" className="size-4 shrink-0 text-[#3d7a3a]" />
            <span className="min-w-0 flex-1">
              <b>{it.name}</b> · {it.places.length} spot{it.places.length === 1 ? "" : "s"}
              {it.neededBy.length > 0 && <span className="text-muted">· needed by {it.neededBy.join(", ")}</span>}
              {it.other.length > 0 && (
                <span className="block text-[12px] text-muted">
                  Also: {it.other.map((o) => `${o.where}${o.detail ? ` (${o.detail})` : ""}`).join("; ")}
                </span>
              )}
            </span>
            <PinToggle kind="gather" name={it.name} from={mapFrom} variant="icon" />
            <button type="button" onClick={() => setItem(null)} aria-label="Clear item" className="text-muted">
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={box}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => {
          const r = box.current!.getBoundingClientRect();
          zoomAt(1.8, e.clientX - r.left, e.clientY - r.top);
        }}
        onClick={() => {
          if (!moved.current) setSel(null);
        }}
        className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-[#1c2a2c] select-none active:cursor-grabbing"
      >
        <div className="absolute top-0 left-0" style={{ transform: `translate(${view.x}px, ${view.y}px)` }}>
          <img
            src="img/map/overworld.webp"
            alt="World map of Dagda"
            draggable={false}
            className="pointer-events-none block max-w-none transition-[filter] duration-300"
            style={{
              width: W * view.s,
              height: H * view.s,
              // While filtering, the colorful mosaic steps back so the matching pins stand out.
              filter: focusing ? "grayscale(.85) brightness(.5) contrast(.9)" : undefined,
            }}
          />
          {visible.filter((n) =>
            !focusing || n.slug === sel || itemPlaces.has(n.slug) || (onlyChapter && here.has(n.slug))
          ).map((n) => (
            <Pin
              key={n.slug}
              n={n}
              s={view.s}
              on={sel === n.slug}
              hot={itemPlaces.has(n.slug) || (onlyChapter && here.has(n.slug))}
              onPick={() => pickPlace(n.slug)}
            />
          ))}
        </div>
        {node && (
          <FloatingCard box={box} px={node.x * view.s + view.x} py={node.y * view.s + view.y}>
            <Detail
              n={node}
              route={route}
              onPlace={pickPlace}
              onItem={pickItem}
              onChapter={onChapter}
              onClose={() => setSel(null)}
            />
          </FloatingCard>
        )}
        <div className="absolute right-2 bottom-2 flex flex-col gap-1">
          {[
            {
              label: "Zoom in",
              icon: <Plus className="size-4" />,
              act: () => zoomAt(1.5, box.current!.clientWidth / 2, box.current!.clientHeight / 2),
            },
            {
              label: "Zoom out",
              icon: <Minus className="size-4" />,
              act: () => zoomAt(1 / 1.5, box.current!.clientWidth / 2, box.current!.clientHeight / 2),
            },
            { label: "Whole map", icon: <Maximize2 className="size-4" />, act: fit },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              title={b.label}
              aria-label={b.label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                b.act();
              }}
              className="grid size-8 place-items-center rounded-md bg-card text-ink shadow-[0_2px_8px_rgba(0,0,0,.35)] hover:bg-white"
            >
              {b.icon}
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-1 left-2 text-[10.5px] text-parchment/70">
          Map: fortunesweave.co.uk
        </span>
      </div>
    </div>
  );
}
