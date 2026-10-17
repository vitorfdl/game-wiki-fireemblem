import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import {
  findGift,
  gift,
  giftNames,
  giftPicks,
  giftProfile,
  giftShop,
  giftTargets,
  type Pick,
  stallLabel,
  tierOf,
} from "../../lib/gifts.ts";
import { routeUnits } from "../../lib/walkthrough/builds.ts";
import { CHARACTERS, META } from "../../lib/data.ts";
import { SearchBox } from "./fold.tsx";
import { Gate } from "./inline.tsx";
import { RefName, UnitRef } from "../ref/rich.tsx";
import { GiftName, TierMark } from "../ref/gift.tsx";

/* Field Kit › Gifts (D-99). One table of every character with gift data, paginated: the route's recruit targets
   first, then the rest of its army and fillers, then characters you search often on this route, then everyone
   else. Each row: liked categories, the best Dagsion buy and the settlement gift worth a trip, all derived from
   gifts.json. Who to prioritize lives in the Meals tab (D-115). */

const PAGE = 15;
const COLS = "grid-cols-[minmax(165px,0.95fr)_minmax(120px,0.7fr)_minmax(0,1fr)_minmax(0,1.6fr)]";

type Kind = "target" | "army" | "searched" | "other";
type Row = { name: string; kind: Kind; support?: number; join?: number; filler?: boolean };

const KIND_LABEL: Record<Kind, (route: RouteName) => string> = {
  target: (r) => `${r}'s recruit targets`,
  army: (r) => `Rest of ${r}'s army and fillers`,
  searched: () => "You search these often",
  other: () => "Everyone else",
};

/* ------------------------------------------------------------ search memory (per viewer, per route) */

const SEARCH_KEY = "fw-gift-search-v1";
function readSearches(route: RouteName): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_KEY) ?? "{}")[route] ?? {};
  } catch {
    return {};
  }
}
function bumpSearches(route: RouteName, names: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(SEARCH_KEY) ?? "{}");
    const mine = all[route] ?? {};
    for (const n of names) mine[n] = (mine[n] ?? 0) + 1;
    all[route] = mine;
    localStorage.setItem(SEARCH_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the order just doesn't learn */
  }
}

/** Characters with any gift data, so a row is never empty. */
const GIFTED = Object.keys(CHARACTERS).filter((n) =>
  giftProfile(n)?.categories?.length || giftNames.some((g) => tierOf(n, g))
);

function buildRows(route: RouteName, ch: number, searches: Record<string, number>): Row[] {
  const targets = giftTargets(route).filter((t) => t.join >= ch);
  const taken = new Set<string>([route, ...targets.map((t) => t.name)]);
  const out: Row[] = targets.map((t) => ({
    name: t.name,
    kind: "target",
    support: t.support,
    join: t.join,
    filler: t.filler,
  }));
  const army = routeUnits(route).filter((u) => !taken.has(u.name)).map((u) => ({ name: u.name, join: u.join }));
  const fillers = (META.routes[route].fillers ?? []).filter((f) => !taken.has(f.name)).map((f) => ({
    name: f.name,
    join: Number(f.when.match(/Ch (\d+)/)?.[1] ?? 10),
    filler: true,
  }));
  for (const u of [...army, ...fillers].sort((a, b) => a.join - b.join)) {
    if (taken.has(u.name) || !GIFTED.includes(u.name)) continue;
    taken.add(u.name);
    out.push({ ...u, kind: "army" });
  }
  const often = Object.entries(searches).filter(([n, c]) => c >= 2 && !taken.has(n) && GIFTED.includes(n))
    .sort((a, b) => b[1] - a[1]);
  for (const [n] of often) {
    taken.add(n);
    out.push({ name: n, kind: "searched" });
  }
  for (const n of [...GIFTED].sort()) if (!taken.has(n)) out.push({ name: n, kind: "other" });
  return out;
}

/* ------------------------------------------------------------ cells */

function Taste({ name }: { name: string }) {
  const cats = giftProfile(name)?.categories ?? [];
  return (
    <div>
      {cats.length
        ? (
          <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-soft" title={cats.join(" · ")}>
            {cats.join(" · ")}
          </span>
        )
        : <span className="text-faint">—</span>}
    </div>
  );
}

function Picks({ picks, road }: { picks: Pick[]; road?: boolean }) {
  if (!picks.length) {
    return <span className="text-[13px] text-faint">{road ? "—" : "Nothing liked here: meals only"}</span>;
  }
  return (
    <span className="flex min-w-0 flex-col">
      {picks.map((p, i) => (
        <span
          key={p.name}
          className={cx("flex min-w-0 items-baseline gap-1.5 leading-[1.45]", i > 0 && "text-[13.5px] opacity-75")}
        >
          <GiftName name={p.name} tier={p.tier} unsure={p.sale?.conf === "unconfirmed"} />
          {road && p.road?.length
            ? (
              <span className="min-w-0 truncate text-[12.5px] text-muted" title={p.road.join(", ")}>
                <RefName name={p.road[0]} types={["place"]} />
                {p.road.length > 1 && ` +${p.road.length - 1}`}
              </span>
            )
            : null}
        </span>
      ))}
    </span>
  );
}

function UnitCell({ r, route }: { r: Row; route: RouteName }) {
  const gate = CHARACTERS[r.name]?.recruitOn?.[route];
  return (
    <span className="min-w-0">
      <span className="block truncate text-[15px]">
        <UnitRef name={r.name} />
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
        {r.support ? <Gate kind="S" n={r.support} /> : null}
        {r.join && r.kind !== "other" && r.kind !== "searched" ? <span>Ch {r.join}</span> : null}
        {r.filler && <span className="text-[10.5px] tracking-wide text-faint uppercase">filler</span>}
        {r.kind === "army" && !r.filler && (
          <span className="text-[10.5px] tracking-wide text-faint uppercase">army</span>
        )}
        {(r.kind === "other" || r.kind === "searched") && (
          <span className="text-[10.5px] tracking-wide text-faint uppercase">
            {gate?.how === "recruit"
              ? `recruitable${gate.support && gate.support > 1 ? ` · S${gate.support}` : ""}`
              : "not on this route"}
          </span>
        )}
      </span>
    </span>
  );
}

function TableRow({ r, ch, route, odd }: { r: Row; ch: number; route: RouteName; odd: boolean }) {
  const { dagsion, road } = giftPicks(r.name, ch, route);
  return (
    <div
      className={cx(
        "grid items-start gap-x-0 border-t border-gold/25 text-[14.5px] [&>*]:px-3 [&>*]:py-1.5 [&>*+*]:border-l [&>*+*]:border-gold/15",
        COLS,
        odd && "bg-paper-2/45",
      )}
    >
      <UnitCell r={r} route={route} />
      <Taste name={r.name} />
      <Picks picks={dagsion} />
      <Picks picks={road} road />
    </div>
  );
}

/* ------------------------------------------------------------ gift search hits */

function GiftHits({ query, route }: { query: string; route: RouteName }) {
  const hits = giftNames.filter((n) => n.toLowerCase().includes(query)).slice(0, 6);
  if (!hits.length) return null;
  const army = new Set([
    ...routeUnits(route).map((u) => u.name),
    ...(META.routes[route].fillers ?? []).map((f) => f.name),
  ]);
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-gold/50 bg-card">
      <h3 className="label m-0 border-b border-gold/40 bg-paper-2/70 px-3 py-1.5 text-gold-lo">Gifts</h3>
      {hits.map((n) => {
        const fans = GIFTED.filter((u) => army.has(u) && tierOf(u, n));
        const g = gift(n);
        const where = (g?.sold ?? []).map((s) => (giftShop(s.shop)?.dagsion ? stallLabel(s.shop) : s.shop));
        return (
          <div
            key={n}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-gold/20 px-3 py-1.5 text-[14px] first:border-0"
          >
            <GiftName name={n} />
            <span className="text-[12.5px] text-muted">{where.join(", ") || g?.other || "Source unknown"}</span>
            {fans.map((u) => (
              <span key={u} className="whitespace-nowrap">
                <TierMark tier={tierOf(u, n)} />
                <UnitRef name={u} />
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ tab */

export function GiftsTab({ route, chapter }: { route: RouteName; chapter: number }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [searches, setSearches] = useState(() => readSearches(route));
  const ch = Math.max(chapter, 4);
  const query = q.trim().toLowerCase();
  const rows = useMemo(() => buildRows(route, ch, searches), [route, ch, searches]);
  const shown = useMemo(
    () =>
      !query ? rows : rows.filter((r) => {
        if (r.name.toLowerCase().includes(query)) return true;
        if ((giftProfile(r.name)?.categories ?? []).some((c) => c.toLowerCase().includes(query))) return true;
        const p = giftPicks(r.name, ch, route);
        return [...p.dagsion, ...p.road].some((x) => x.name.toLowerCase().includes(query));
      }),
    [rows, query, ch, route],
  );
  useEffect(() => setPage(0), [query, route]);
  useEffect(() => setSearches(readSearches(route)), [route]);
  // A search that settles on one to three characters counts as a visit to them; often-searched names move up.
  useEffect(() => {
    if (!query) return;
    const names = shown.filter((r) => r.name.toLowerCase().includes(query)).map((r) => r.name);
    if (!names.length || names.length > 3) return;
    const t = setTimeout(() => bumpSearches(route, names), 1500);
    return () => clearTimeout(t);
  }, [query, shown, route]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages - 1);
  const slice = shown.slice(at * PAGE, at * PAGE + PAGE);

  return (
    <>
      <SearchBox
        prominent
        value={q}
        onChange={setQ}
        placeholder={`Search ${GIFTED.length} characters, a gift or a taste (coffee, books…)`}
      />
      {query && (findGift(query) || giftNames.some((n) => n.toLowerCase().includes(query))) && (
        <GiftHits query={query} route={route} />
      )}

      <div className="overflow-hidden rounded-lg border border-gold/55 bg-card shadow-[0_1px_3px_rgba(90,60,20,.08)]">
        <div
          className={cx(
            "grid border-b-2 border-gold/50 bg-paper-2/80 [&>*]:px-3 [&>*]:py-1.5 [&>*+*]:border-l [&>*+*]:border-gold/20",
            COLS,
          )}
        >
          {["Character", "Likes", "Buy in Dagsion", "Worth a trip"].map((h) => (
            <span key={h} className="text-[11.5px] font-semibold tracking-[0.06em] text-ink-soft uppercase">{h}</span>
          ))}
        </div>
        {slice.length
          ? slice.map((r, i) => {
            const prev = i ? slice[i - 1] : at ? shown[at * PAGE - 1] : undefined;
            const head = !prev || prev.kind !== r.kind;
            return (
              <Fragment key={r.name}>
                {head && (
                  <div className="border-t border-gold/40 bg-gold/10 px-3 py-1 text-[11.5px] font-semibold tracking-[0.08em] text-gold-lo uppercase">
                    {KIND_LABEL[r.kind](route)}
                    {r.kind === "target" && <span className="ml-1 font-normal normal-case">· from Ch {ch}</span>}
                  </div>
                )}
                <TableRow r={r} ch={ch} route={route} odd={i % 2 === 1} />
              </Fragment>
            );
          })
          : <p className="m-0 px-3 py-3 text-[14px] text-muted">No character matches.</p>}
        {pages > 1 && (
          <div className="flex items-center gap-1 border-t-2 border-gold/40 bg-paper-2/60 px-3 py-1.5 text-[13px]">
            <button
              type="button"
              disabled={at === 0}
              onClick={() => setPage(at - 1)}
              className="flex items-center gap-0.5 rounded px-2 py-0.5 font-semibold text-ink-soft hover:bg-paper-3 disabled:opacity-35"
            >
              <ChevronLeft className="size-4" aria-hidden="true" /> Prev
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-current={i === at ? "page" : undefined}
                className={cx(
                  "min-w-7 rounded px-1.5 py-0.5 font-semibold tabular-nums",
                  i === at ? "bg-(--c) text-white" : "text-ink-soft hover:bg-paper-3",
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={at === pages - 1}
              onClick={() => setPage(at + 1)}
              className="flex items-center gap-0.5 rounded px-2 py-0.5 font-semibold text-ink-soft hover:bg-paper-3 disabled:opacity-35"
            >
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </button>
            <span className="ml-auto text-muted tabular-nums">
              {at * PAGE + 1}–{Math.min(shown.length, at * PAGE + PAGE)} of {shown.length}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
