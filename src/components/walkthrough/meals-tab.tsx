import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { CHARACTERS } from "../../lib/data.ts";
import { routeVars } from "../../lib/route-style.ts";
import { everyone, mealQueue, type MealTarget, partnersOf, routeCast, supportGraph } from "../../lib/meals.ts";
import { DISH_LIST, dislikes, hasDishes, perfectFor, rankDishes, type Taste, taste } from "../../lib/dishes.ts";
import { Medal } from "../ui/medal.tsx";
import { UnitRef } from "../ref/rich.tsx";
import { Fold } from "./fold.tsx";
import { Gate } from "./inline.tsx";

/* Field Kit › Meals (D-115, D-116): who to seat first (the recruit-Support queue), who can sit with whom (the support
   map) and which dish to order (dish check and reactions, from repo-root dishes.json). Derived in src/lib/meals.ts
   and src/lib/dishes.ts; no per-chapter meal tables here. */

const COLS = "grid-cols-[34px_minmax(135px,1fr)_58px_84px_78px_150px_minmax(0,1.3fr)]";

const STATUS: Record<MealTarget["status"], { label: string; cls: string }> = {
  now: { label: "Recruit this chapter", cls: "bg-[#c2415f] text-white" },
  soon: { label: "Within 2 chapters", cls: "bg-[#f6dfe3] text-[#8c2a43]" },
  later: { label: "Later", cls: "bg-paper-3 text-ink-soft" },
  done: { label: "Recruited", cls: "bg-paper-3 text-muted" },
};

function weeks(t: MealTarget): string {
  if (t.status === "now") return "This chapter";
  if (t.days === undefined) return "?";
  const w = Math.round(t.days / 7);
  return w < 1 ? "< 1 wk" : `~${w} wk`;
}

/** Dish names fit a column: "Sweet-and-Sour Stick Bugs" -> "Stick Bugs". */
const SHORT: Record<string, string> = {
  "Coffee-Berry Paste": "Coffee Paste",
  "Honey-Poached Pear": "Pear",
  "Cheese-Coated Crayfish": "Crayfish",
  "Salt-Crusted Ham": "Ham",
  "Sand Boar and Beans": "Boar & Beans",
  "Sweet-and-Sour Stick Bugs": "Stick Bugs",
  "Charred Fish Grill": "Fish Grill",
  "Fish-Sauce Soup": "Fish-Sauce Soup",
  "Garlic Seared Scallops": "Scallops",
};
const short = (d: string) => SHORT[d] ?? d;

const TASTE: Record<Taste, { mark: string; word: string; cls: string }> = {
  love: { mark: "♫", word: "loves", cls: "bg-(--c) text-white" },
  like: { mark: "♪", word: "likes", cls: "bg-(--c2) text-(--c)" },
  neutral: { mark: "·", word: "neutral", cls: "text-faint" },
  dislike: { mark: "✕", word: "dislikes", cls: "bg-[#f6dfe3] text-[#8c2a43]" },
};

function TasteMark({ t, who, dish }: { t: Taste | undefined; who: string; dish: string }) {
  const v = t ? TASTE[t] : undefined;
  return (
    <span
      title={`${who} ${v?.word ?? "has no record for"} ${dish}`}
      className={cx(
        "grid h-[22px] w-[26px] place-items-center rounded-[4px] text-[13px] leading-none font-bold",
        v?.cls ?? "text-faint",
      )}
    >
      {v?.mark ?? "?"}
    </span>
  );
}

/* ------------------------------------------------------------ queue */

function QueueRow(
  { t, odd, focus, setFocus, route, onDish }: {
    t: MealTarget;
    odd: boolean;
    focus: string | null;
    setFocus: (n: string | null) => void;
    route: RouteName;
    onDish: (name: string) => void;
  },
) {
  const st = STATUS[t.status];
  return (
    <div
      onMouseEnter={() => setFocus(t.name)}
      className={cx(
        "grid items-center border-t border-gold/25 text-[14px] [&>*]:px-2.5 [&>*]:py-1.5 [&>*+*]:border-l [&>*+*]:border-gold/15",
        COLS,
        odd && "bg-paper-2/45",
        focus === t.name && "bg-(--c2)/70",
      )}
    >
      <span
        className={cx(
          "grid size-6 place-items-center justify-self-center rounded-full !p-0 font-logo text-[13px] font-bold tabular-nums",
          t.status === "now"
            ? "bg-[#c2415f] text-white"
            : t.rank <= 3
            ? "bg-(--c) text-white"
            : "bg-paper-3 text-ink-soft",
        )}
      >
        {t.rank}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px]">
          <UnitRef name={t.name} />
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-muted">
          {t.filler && <span className="tracking-wide text-faint uppercase">filler</span>}
          {t.extra && <span className="tracking-wide text-faint uppercase">extra</span>}
          {t.from && <span>in Dagsion from {t.from}</span>}
        </span>
      </span>
      <span>
        <Gate kind="S" n={t.support} />
      </span>
      <span className="leading-tight">
        <b className="block text-[14px]">Ch {t.join}{t.estimate ? "?" : ""}</b>
        {t.renown ? <span className="text-[11.5px] text-muted">Renown {t.renown}</span> : null}
      </span>
      <span className="leading-tight">
        <span
          className={cx("inline-block rounded px-1.5 py-[1px] text-[11.5px] font-semibold whitespace-nowrap", st.cls)}
        >
          {weeks(t)}
        </span>
      </span>
      <DishCell name={t.name} route={route} onClick={() => onDish(t.name)} />
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px]">
        {t.targets.map((p) => (
          <span key={p} className="whitespace-nowrap" title={`${p} is also a target: one meal grows both`}>
            <span className="mr-0.5 text-[#c2415f]">◆</span>
            <UnitRef name={p} />
          </span>
        ))}
        {t.army.slice(0, 4).map((p) => (
          <span key={p} className="whitespace-nowrap opacity-75">
            <UnitRef name={p} />
          </span>
        ))}
        {!t.targets.length && !t.army.length && (
          <span className="text-[12.5px] text-faint">No partner here: any seat</span>
        )}
      </span>
    </div>
  );
}

/** Queue cell: how many dishes this target and the lord both like, and the target's dislikes. Click opens the check. */
function DishCell({ name, route, onClick }: { name: string; route: RouteName; onClick: () => void }) {
  if (!hasDishes(name)) return <span className="text-[12px] text-faint">No dish data</span>;
  const both = perfectFor([route, name]);
  const no = dislikes(name);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Liked by both: ${both.join(", ") || "none"}\nDislikes: ${
        no.join(", ") || "none"
      }\nClick to check a table`}
      className="min-w-0 text-left leading-tight hover:underline"
    >
      <span className="block text-[12.5px] font-semibold text-(--c)">
        ♪ {both.length}/{DISH_LIST.length} both like
      </span>
      <span className="block truncate text-[11.5px] text-[#8c2a43]">
        {no.length ? `✕ ${no.map(short).join(", ")}` : "dislikes nothing"}
      </span>
    </button>
  );
}

function Queue(
  { route, chapter, focus, setFocus, onDish }: {
    route: RouteName;
    chapter: number;
    focus: string | null;
    setFocus: (n: string | null) => void;
    onDish: (name: string) => void;
  },
) {
  const all = useMemo(() => mealQueue(route, chapter), [route, chapter]);
  const open = all.filter((t) => t.status !== "done");
  const done = all.filter((t) => t.status === "done");
  return (
    <div
      onMouseLeave={() => setFocus(null)}
      className="overflow-hidden rounded-lg border border-gold/55 bg-card shadow-[0_1px_3px_rgba(90,60,20,.08)]"
    >
      <div
        className={cx(
          "grid border-b-2 border-gold/50 bg-paper-2/80 [&>*]:px-2.5 [&>*]:py-1.5 [&>*+*]:border-l [&>*+*]:border-gold/20",
          COLS,
        )}
      >
        {["#", "Target", "Needs", "Recruit by", "Time left", `Dishes with ${route}`, "Seat with"].map((h) => (
          <span key={h} className="text-[11px] font-semibold tracking-[0.06em] text-ink-soft uppercase">{h}</span>
        ))}
      </div>
      {open.length
        ? open.map((t, i) => (
          <QueueRow
            key={t.name}
            t={t}
            odd={i % 2 === 1}
            focus={focus}
            setFocus={setFocus}
            route={route}
            onDish={onDish}
          />
        ))
        : (
          <p className="m-0 px-3 py-3 text-[14px] text-muted">
            Every Support recruit is in. Meals now only grow pairs.
          </p>
        )}
      {done.length > 0 && (
        <p className="m-0 border-t-2 border-gold/40 bg-paper-2/60 px-3 py-1.5 text-[12.5px] text-muted">
          <span className="mr-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Recruited</span>
          {done.map((t, i) => (
            <span key={t.name}>
              {i > 0 && ", "}
              <UnitRef name={t.name} avatar={false} />
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ support map */

type Role = "lord" | "target" | "army" | "other";

function SupportMap(
  { route, chapter, focus, setFocus, onSeat }: {
    route: RouteName;
    chapter: number;
    focus: string | null;
    setFocus: (n: string | null) => void;
    onSeat: (a: string, b: string) => void;
  },
) {
  const [scope, setScope] = useState<"army" | "all">("army");
  const [pinned, setPinned] = useState<string | null>(null);
  const queue = useMemo(() => mealQueue(route, chapter), [route, chapter]);
  const rank = new Map(queue.filter((t) => t.status !== "done").map((t) => [t.name, t]));
  const cast = useMemo(() => new Set(routeCast(route)), [route]);
  const names = useMemo(
    () => (scope === "army" ? [...cast] : [...new Set([route, ...everyone()])]),
    [scope, cast, route],
  );
  const g = useMemo(() => supportGraph(route, names), [route, names]);
  const at = new Map(g.nodes.map((n) => [n.name, n]));
  const role = (n: string): Role => n === route ? "lord" : rank.has(n) ? "target" : cast.has(n) ? "army" : "other";

  const active = pinned ?? focus;
  const near = new Set(active ? [active, ...partnersOf(active)] : []);
  const dim = (n: string) => Boolean(active) && !near.has(n);

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="m-0 text-[15px] font-bold">Who can sit with whom</h3>
        <span className="text-[12.5px] text-muted">
          Lines are support pairs. Hover or click a portrait to isolate its partners.
        </span>
        <span className="ml-auto flex gap-0.5 rounded-md bg-paper-2 p-0.5 text-[12px] font-semibold">
          {(["army", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setScope(s);
                setPinned(null);
              }}
              aria-pressed={scope === s}
              className={cx(
                "rounded px-2 py-0.5",
                scope === s ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink",
              )}
            >
              {s === "army" ? `${route}'s cast` : "Everyone"}
            </button>
          ))}
        </span>
      </div>

      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <i className="block h-[3px] w-6 rounded bg-(--c)" /> both open targets
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-[2px] w-6 rounded bg-(--c) opacity-55" /> one open target
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-[1.5px] w-6 rounded bg-gold opacity-60" /> pair only
        </span>
        <span className="flex items-center gap-1.5">
          <span className="grid size-4 place-items-center rounded-full bg-(--c) font-logo text-[10px] font-bold text-white">
            1
          </span>
          queue rank
        </span>
      </div>

      <div
        className="relative w-full select-none overflow-hidden rounded-lg border border-gold/45 bg-[radial-gradient(circle_at_50%_50%,var(--color-card),var(--color-paper-2))]"
        style={{ aspectRatio: `${g.w} / ${g.h}` }}
        onClick={(e) => e.target === e.currentTarget && setPinned(null)}
      >
        <svg viewBox={`0 0 ${g.w} ${g.h}`} className="pointer-events-none absolute inset-0 h-full w-full">
          {g.edges.map((e) => {
            const a = at.get(e.a)!, b = at.get(e.b)!;
            const hot = (rank.has(e.a) ? 1 : 0) + (rank.has(e.b) ? 1 : 0);
            const on = !active || e.a === active || e.b === active;
            return (
              <line
                key={`${e.a}|${e.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={hot ? "var(--c)" : "var(--color-gold)"}
                strokeWidth={hot === 2 ? 3.2 : hot === 1 ? 2 : 1.4}
                strokeOpacity={on ? (hot === 2 ? 0.95 : hot === 1 ? 0.55 : 0.5) : 0.07}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        {g.nodes.map((n) => {
          const r = role(n.name);
          const t = rank.get(n.name);
          const size = r === "lord" ? 54 : r === "target" ? 40 : 32;
          return (
            <button
              key={n.name}
              type="button"
              onMouseEnter={() => setFocus(n.name)}
              onMouseLeave={() => setFocus(null)}
              onClick={() => setPinned(pinned === n.name ? null : n.name)}
              title={`${n.name}: ${partnersOf(n.name).filter((p) => at.has(p)).join(", ") || "no partner here"}`}
              className={cx(
                "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity",
                dim(n.name) && "opacity-20",
                active === n.name && "z-10",
              )}
              style={{ left: `${(n.x / g.w) * 100}%`, top: `${(n.y / g.h) * 100}%` }}
            >
              <span className="relative">
                <Medal
                  name={n.name}
                  route={CHARACTERS[n.name]?.homeRoute}
                  size={size}
                  flat={r === "other"}
                  ring={r === "target" ? `var(--color-${route.toLowerCase()})` : undefined}
                />
                {t && (
                  <span
                    className={cx(
                      "absolute -top-1 -left-1 grid size-[18px] place-items-center rounded-full font-logo text-[10.5px] font-bold text-white shadow",
                      t.status === "now" ? "bg-[#c2415f]" : "bg-(--c)",
                    )}
                  >
                    {t.rank}
                  </span>
                )}
                {t && (
                  <span className="absolute -right-1.5 -bottom-0.5 rounded-[3px] bg-[#f6dfe3] px-1 text-[9.5px] leading-[14px] font-bold text-[#8c2a43] shadow-sm">
                    S{t.support}
                  </span>
                )}
              </span>
              <span
                className={cx(
                  "mt-0.5 rounded bg-card/85 px-1 text-[11px] leading-[15px] whitespace-nowrap",
                  r === "target" || r === "lord" ? "font-bold text-ink" : "text-ink-soft",
                )}
              >
                {n.name}
              </span>
            </button>
          );
        })}
      </div>

      {active && <FocusLine name={active} route={route} rank={rank} shown={at} onSeat={onSeat} />}

      {g.loners.length > 0 && (
        <p className="mt-2 mb-0 text-[12.5px] text-muted">
          <span className="mr-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
            No partner in this view
          </span>
          {g.loners.map((n, i) => (
            <span key={n}>
              {i > 0 && ", "}
              <UnitRef name={n} avatar={false} />
              {rank.has(n) && <b className="ml-1 text-[#8c2a43]">(target)</b>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function FocusLine(
  { name, route, rank, shown, onSeat }: {
    name: string;
    route: RouteName;
    rank: Map<string, MealTarget>;
    shown: Map<string, unknown>;
    onSeat: (a: string, b: string) => void;
  },
) {
  const perfect = (p: string) => (hasDishes(name) && hasDishes(p) ? perfectFor([route, name, p]).length : undefined);
  const Seat = ({ p }: { p: string }) => {
    const n = perfect(p);
    return (
      <button
        type="button"
        onClick={() => onSeat(name, p)}
        title={`Check dishes for ${route} + ${name} + ${p}`}
        className="ml-0.5 rounded bg-card/80 px-1 text-[11px] font-semibold text-(--c) hover:bg-card"
      >
        {n === undefined ? "dishes ?" : `${n} Perfect`}
      </button>
    );
  };
  const ps = partnersOf(name).filter((p) => shown.has(p) && p !== route);
  const hot = ps.filter((p) => rank.has(p));
  const rest = ps.filter((p) => !rank.has(p));
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-(--c2)/60 px-3 py-2 text-[13.5px]">
      <UtensilsCrossed aria-hidden="true" className="size-4 text-(--c)" />
      {name === route ? <span>{route} sits at every meal; recruit Support only grows with {route}.</span> : (
        <>
          <span>
            <b>{route}</b> + <UnitRef name={name} /> +
          </span>
          {hot.map((p) => (
            <span key={p} className="whitespace-nowrap">
              <span className="mr-0.5 text-[#c2415f]">◆</span>
              <UnitRef name={p} />
              <span className="text-[11.5px] text-muted">#{rank.get(p)!.rank}</span>
              <Seat p={p} />
            </span>
          ))}
          {rest.map((p) => (
            <span key={p} className="whitespace-nowrap">
              <span className="opacity-80">
                <UnitRef name={p} />
              </span>
              <Seat p={p} />
            </span>
          ))}
          {!ps.length && <span className="text-muted">anyone (no support pair in this view)</span>}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ dishes */

/** Who can sit: the route's cast with dish data, open targets first in queue order, then the rest by name. */
function seatOptions(route: RouteName, queue: MealTarget[]): string[] {
  const open = queue.filter((t) => t.status !== "done").map((t) => t.name);
  const rest = routeCast(route).filter((n) => n !== route && !open.includes(n)).sort();
  return [...open, ...rest].filter(hasDishes);
}

/**
 * Default second seat for a target: the highest-ranked open target that makes at least 3 of the 12 dishes Perfect
 * (the weekly menu shows only a few), else the open target with the most Perfect dishes, else the cast member with the
 * most.
 */
function bestMate(route: RouteName, name: string, queue: MealTarget[]): string | undefined {
  const n = (p: string) => perfectFor([route, name, p]).length;
  const open = queue.filter((x) => x.status !== "done" && x.name !== name && hasDishes(x.name))
    .map((x) => ({ p: x.name, n: n(x.name) }));
  const ok = open.find((x) => x.n >= 3);
  if (ok) return ok.p;
  const most = [...open].sort((a, b) => b.n - a.n)[0];
  if (most?.n) return most.p;
  const cast = routeCast(route).filter((p) => p !== route && p !== name && hasDishes(p))
    .map((p) => ({ p, n: n(p) })).sort((a, b) => b.n - a.n);
  return cast[0]?.n ? cast[0].p : open[0]?.p;
}

function SeatPick(
  { value, options, onChange, rank }: {
    value: string;
    options: string[];
    onChange: (v: string) => void;
    rank: Map<string, MealTarget>;
  },
) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gold/50 bg-card px-2 py-1 text-[14px] font-semibold"
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {rank.has(n) ? `#${rank.get(n)!.rank} ${n} (S${rank.get(n)!.support})` : n}
        </option>
      ))}
    </select>
  );
}

function DishCheck(
  { route, seats, setSeats, queue, box }: {
    route: RouteName;
    seats: [string, string];
    setSeats: (s: [string, string]) => void;
    queue: MealTarget[];
    box: RefObject<HTMLDivElement | null>;
  },
) {
  const options = seatOptions(route, queue);
  const rank = new Map(queue.filter((t) => t.status !== "done").map((t) => [t.name, t]));
  const diners = [route, ...seats];
  const picks = rankDishes(diners);
  const nPerfect = picks.filter((p) => p.perfect).length;
  if (!hasDishes(route)) {
    return <p className="mt-6 text-[13.5px] text-muted">No dish data for {route}.</p>;
  }
  return (
    <div ref={box} className="mt-6 scroll-mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="m-0 mr-2 text-[15px] font-bold">Which dish</h3>
        <b className="text-[14px]">{route}</b> +
        <SeatPick value={seats[0]} options={options} rank={rank} onChange={(v) => setSeats([v, seats[1]])} /> +
        <SeatPick value={seats[1]} options={options} rank={rank} onChange={(v) => setSeats([seats[0], v])} />
        <span className="ml-auto text-[12.5px] text-muted">
          {nPerfect} of {DISH_LIST.length} dishes Perfect. Order the first one on this week's menu.
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-gold/55 bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,96px)_110px] border-b-2 border-gold/50 bg-paper-2/80 px-3 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-soft uppercase">
          <span>Dish</span>
          {diners.map((d) => <span key={d} className="truncate text-center normal-case tracking-normal">{d}</span>)}
          <span className="text-right">Result</span>
        </div>
        {picks.map((p, i) => (
          <div
            key={p.dish}
            className={cx(
              "grid grid-cols-[minmax(0,1fr)_repeat(3,96px)_110px] items-center border-t border-gold/20 px-3 py-1 text-[14px]",
              i % 2 === 1 && "bg-paper-2/45",
              p.bad && "opacity-70",
            )}
          >
            <span className={cx("truncate", p.perfect && "font-bold")}>{p.dish}</span>
            {p.tastes.map((t, j) => (
              <span key={j} className="justify-self-center">
                <TasteMark t={t} who={diners[j]} dish={p.dish} />
              </span>
            ))}
            <span
              className={cx(
                "justify-self-end rounded px-1.5 py-[1px] text-[11.5px] font-semibold",
                p.perfect ? "bg-(--c) text-white" : p.bad ? "bg-[#f6dfe3] text-[#8c2a43]" : "text-muted",
              )}
            >
              {p.perfect ? "Perfect" : p.bad ? "Avoid" : "Plain"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DishMatrix({ route, queue }: { route: RouteName; queue: MealTarget[] }) {
  const open = queue.filter((t) => t.status !== "done").map((t) => t.name);
  const cast = [route, ...open, ...routeCast(route).filter((n) => n !== route && !open.includes(n)).sort()];
  const rows = cast.filter(hasDishes);
  const missing = cast.filter((n) => !hasDishes(n));
  // Dishes the lord likes first: only those can be Perfect.
  const SCORE = { love: 0, like: 1, neutral: 2, dislike: 3 } as const;
  const cols = [...DISH_LIST].sort((a, b) => SCORE[taste(route, a) ?? "neutral"] - SCORE[taste(route, b) ?? "neutral"]);
  return (
    <Fold title={`Every dish, ${route}'s cast (${rows.length})`}>
      <div className="overflow-x-auto">
        <table className="border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card" />
              {cols.map((d) => (
                <th
                  key={d}
                  title={d}
                  className="h-[92px] w-[34px] px-0 pb-1 align-bottom text-[11px] leading-tight font-semibold text-ink-soft"
                >
                  <span className="inline-block [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                    {short(d)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n} className={cx("border-t border-gold/20", n === route && "bg-(--c2)/50")}>
                <td className="sticky left-0 bg-card/95 py-0.5 pr-4 whitespace-nowrap">
                  <UnitRef name={n} />
                  {open.includes(n) && <span className="ml-1 text-[11px] text-[#c2415f]">◆</span>}
                </td>
                {cols.map((d) => (
                  <td key={d} className="px-[2px] py-[2px]">
                    <TasteMark t={taste(n, d)} who={n} dish={d} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 mb-0 text-[12px] text-muted">
        ♫ loves · ♪ likes · ✕ dislikes. One player's save (fortunesweave.co.uk, Dietrich route); reactions are per
        character, so they hold on every route.
        {missing.length > 0 && ` No record: ${missing.join(", ")}.`}
      </p>
    </Fold>
  );
}

/* ------------------------------------------------------------ tab */

export function MealsTab({ route, chapter }: { route: RouteName; chapter: number }) {
  const [focus, setFocus] = useState<string | null>(null);
  const queue = useMemo(() => mealQueue(route, chapter), [route, chapter]);
  const box = useRef<HTMLDivElement | null>(null);
  const first = queue.find((t) => t.status !== "done" && hasDishes(t.name))?.name ?? seatOptions(route, queue)[0] ?? "";
  const [seats, setSeats] = useState<[string, string]>(() => [first, bestMate(route, first, queue) ?? first]);
  useEffect(() => setSeats([first, bestMate(route, first, queue) ?? first]), [route, first, queue]);
  const seat = (a: string, b?: string) => {
    if (!hasDishes(a)) return;
    setSeats([a, b && hasDishes(b) ? b : bestMate(route, a, queue) ?? a]);
    requestAnimationFrame(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <div style={routeVars(route)}>
      <p className="mt-0 mb-2 text-[13.5px] text-ink-soft">
        3 meals a week at the Dagsion Inn, 150G each on Sunday. Seat{" "}
        <b>{route} + 2 targets</b>; take the queue from the top and pair a target with a{" "}
        <span className="text-[#c2415f]">◆</span> partner when one is open. Ranked from Chapter {chapter}.
      </p>
      <Queue route={route} chapter={chapter} focus={focus} setFocus={setFocus} onDish={(n) => seat(n)} />
      <SupportMap route={route} chapter={chapter} focus={focus} setFocus={setFocus} onSeat={seat} />
      <DishCheck route={route} seats={seats} setSeats={setSeats} queue={queue} box={box} />
      <DishMatrix route={route} queue={queue} />
    </div>
  );
}
