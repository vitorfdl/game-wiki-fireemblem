import { type ReactNode, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Hammer, Package, RotateCcw, Skull, Users } from "lucide-react";
import { cx } from "../../lib/cx.ts";
import { META } from "../../lib/data.ts";
import { routeVars } from "../../lib/route-style.ts";
import { resolve } from "../../lib/refs.ts";
import { pinSources } from "../../lib/pins.ts";
import {
  CATALOG,
  type CatalogItem,
  CATS,
  type ItemCat,
  type ItemUser,
  sortItems,
  type SortKey,
  SORTS,
  SRC_KINDS,
  type SrcKind,
  srcKinds,
  usersOf,
} from "../../lib/item-catalog.ts";
import type { RouteName } from "../../lib/types.ts";
import { KIT, KitIcon, type KitType } from "../ui/kit-type.tsx";
import { TierGem } from "../ui/tier-gem.tsx";
import { PinToggle } from "../ui/pin-toggle.tsx";
import { RefChip, Rich, UnitPortrait } from "../ref/rich.tsx";
import { SourceRow } from "../pins/pins-tab.tsx";
import { SearchBox } from "../walkthrough/fold.tsx";

/*
 * Field Kit > Items (D-114): the whole item catalog as Pins-style cards, filtered and paged. Each card shows the
 * item's numbers, every way to get it (D-110, places open the map) and who plans it, this route first.
 */

const PER = 12;
const RANKS = ["E", "D", "C", "B", "A"];
const KIT_OF: Record<ItemCat, KitType> = { Weapon: "weapon", Equipment: "equipment", Item: "item" };

type Filters = {
  q: string;
  cat: ItemCat | "all";
  types: string[];
  ranks: string[];
  src: SrcKind[];
  planned: boolean;
  onRoute: boolean;
  sort: SortKey;
  page: number;
};

const START: Filters = {
  q: "",
  cat: "all",
  types: [],
  ranks: [],
  src: [],
  planned: false,
  onRoute: false,
  sort: "default",
  page: 0,
};
/** Filters survive switching tabs for the rest of the session. */
let saved: Filters = START;

function matches(it: CatalogItem, f: Filters, route: RouteName): boolean {
  if (f.cat !== "all" && it.kind !== f.cat) return false;
  if (f.types.length && !f.types.includes(it.type ?? "")) return false;
  if (f.ranks.length && !f.ranks.some((r) => new RegExp(`\\b${r}\\b`).test(it.rank ?? ""))) return false;
  if (f.planned && !usersOf(it.name).some((u) => u.route === route)) return false;
  if (f.onRoute && srcKinds(it.name, route).size === 0) return false;
  if (f.src.length) {
    const have = srcKinds(it.name, route);
    if (!f.src.some((s) => have.has(s))) return false;
  }
  const q = f.q.trim().toLowerCase();
  if (q) {
    const hay = [it.name, it.type, it.kind, it.fx, ...(it.eff ?? []), it.refine?.fx].filter(Boolean).join(" ")
      .toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

/* ---------------------------------------------------------------- filter bar */

function Chip(
  { on, onClick, children, count, color, title }: {
    on: boolean;
    onClick: () => void;
    children: ReactNode;
    count?: number;
    color?: string;
    title?: string;
  },
) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      disabled={!on && count === 0}
      style={on && color ? { background: color } : undefined}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold transition-colors disabled:opacity-35",
        on
          ? cx("text-white shadow-[0_2px_6px_-3px_rgba(0,0,0,.5)]", !color && "bg-(--c)")
          : "bg-card text-ink-soft shadow-[inset_0_0_0_1px_rgba(176,144,90,.55)] hover:bg-paper-3 hover:text-ink",
      )}
    >
      {children}
      {count !== undefined && <span className={cx("tabular-nums", on ? "opacity-80" : "text-muted")}>{count}</span>}
    </button>
  );
}

const FacetRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start gap-2">
    <span className="label w-[46px] shrink-0 pt-[5px] text-[10.5px] text-gold-lo">{label}</span>
    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</div>
  </div>
);

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/* ---------------------------------------------------------------- card */

const Stat = ({ k, v, hi }: { k: string; v: ReactNode; hi?: boolean }) =>
  v === undefined || v === null || v === "" ? null : (
    <span
      className={cx(
        "inline-flex items-baseline gap-1 rounded px-1.5 py-[1px] text-[12.5px]",
        hi ? "bg-(--c2) text-(--c)" : "bg-card shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]",
      )}
    >
      <span className="text-[11px] text-muted">{k}</span>
      <b className="tabular-nums">{v}</b>
    </span>
  );

function Mark({ it }: { it: CatalogItem }) {
  if (it.tier) return <TierGem tier={it.tier} size={24} title={`Tier ${it.tier} (item-tiers.json)`} />;
  return <KitIcon type={KIT_OF[it.kind]} size={24} />;
}

/** A unit avatar with its start chapter under it; the refine it names sits on the corner. */
function UserMedal({ u, size, here }: { u: ItemUser; size: number; here: boolean }) {
  const tip = `${u.name} · ${u.cls} from ${u.when}${u.plus ? ` · +${u.plus}` : ""}${
    u.stages > 1 ? ` · ${u.stages} stages` : ""
  }${here ? "" : ` · ${u.route}'s army`}`;
  return (
    <span className="relative flex flex-col items-center" title={tip}>
      <UnitPortrait name={u.name} size={size} title={tip} ring="var(--color-card)" />
      {u.plus && (
        <span className="absolute -top-1 -right-1.5 rounded-full bg-gold-lo px-1 text-[9.5px] leading-[14px] font-bold text-white tabular-nums">
          +{u.plus}
        </span>
      )}
      {here && (
        <span className="mt-0.5 text-[10.5px] leading-none font-semibold whitespace-nowrap text-muted tabular-nums">
          {u.when.replace(/^Part III$/, "P3").replace(/^Part II Ch /, "P2 Ch ").replace(/^Part II$/, "P2")}
        </span>
      )}
    </span>
  );
}

function Builders({ name, route }: { name: string; route: RouteName }) {
  const all = usersOf(name);
  const mine = all.filter((u) => u.route === route);
  const others = META.order.filter((r) => r !== route).map((r) => ({ r, us: all.filter((u) => u.route === r) }))
    .filter((x) => x.us.length);
  return (
    <div className="min-w-0">
      <div className="label mb-1.5 flex items-center gap-1 text-[10.5px] text-gold-lo">
        <Users aria-hidden="true" className="size-3" /> In builds
        {mine.length > 0 && <span className="text-muted tabular-nums">{mine.length}</span>}
      </div>
      {mine.length
        ? (
          <div className="flex flex-wrap gap-x-2 gap-y-1.5">
            {mine.map((u) => <UserMedal key={u.name} u={u} size={30} here />)}
          </div>
        )
        : <p className="m-0 text-[12.5px] text-muted">No {route} build uses it.</p>}
      {others.length > 0 && (
        <div className="mt-2 grid gap-1 border-t border-gold/25 pt-1.5">
          {others.map(({ r, us }) => (
            <div key={r} className="flex items-start gap-1.5 opacity-70 hover:opacity-100" style={routeVars(r)}>
              <span className="w-[50px] shrink-0 pt-[3px] text-[10.5px] font-semibold text-(--c)">{r}</span>
              <span className="flex flex-wrap gap-1">
                {us.slice(0, 7).map((u) => <UserMedal key={u.name} u={u} size={20} here={false} />)}
                {us.length > 7 && <span className="text-[11px] text-muted">+{us.length - 7}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SHOW = 3;

function ItemCard({ it, route }: { it: CatalogItem; route: RouteName }) {
  const [all, setAll] = useState(false);
  const sources = pinSources("item", it.name, route);
  const shown = all ? sources : sources.slice(0, SHOW);
  const r = resolve(it.name, "item");
  const kit = KIT_OF[it.kind];
  const kicker = [it.type, it.rank && `Rank ${it.rank}`, it.price ? `${it.price.toLocaleString("en-US")}G` : ""]
    .filter(Boolean).join(" · ");
  return (
    <li
      className="@container overflow-hidden rounded-lg bg-card"
      style={{
        boxShadow: `inset 5px 0 0 ${
          KIT[kit].color
        }, inset 0 0 0 1.5px rgba(176,144,90,.75), 0 3px 10px -4px rgba(60,40,10,.35)`,
      }}
    >
      <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_196px]">
        <div className="min-w-0 bg-paper-2/80 py-2.5 pr-3 pl-[17px] shadow-[inset_0_-1px_0_rgba(176,144,90,.35)] @2xl:shadow-[inset_-1px_0_0_rgba(176,144,90,.45)]">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-[1px]">
              <Mark it={it} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[16.5px] leading-tight font-bold">
                {r ? <RefChip r={r} bare /> : it.name}
              </span>
              <span className="block text-[11.5px] leading-tight text-muted">{kicker || KIT[kit].label}</span>
            </span>
            <PinToggle kind="item" name={it.name} variant="icon" from={{ route }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1 pl-8">
            <Stat k="Mt" v={it.mt} hi />
            <Stat k="Hit" v={it.hit} />
            <Stat k="Crit" v={it.crit} />
            <Stat k="Wt" v={it.wt} />
            <Stat k="Rng" v={it.rng} />
            <Stat k="Dur" v={it.dur} />
            <Stat k="Uses" v={it.uses} />
          </div>
          {it.fx && (
            <p className="m-0 mt-1.5 pl-8 text-[13px] leading-snug">
              <Rich text={it.fx} k={`it-${it.name}`} stats />
            </p>
          )}
          {(it.eff?.length || it.curse || it.refine?.lv) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8 text-[11.5px]">
              {it.eff?.map((e) => (
                <span key={e} className="rounded bg-[#f6dcd6] px-1.5 py-[1px] font-bold text-[#8a2a17]">
                  Effective vs {e}
                </span>
              ))}
              {it.curse
                ? (
                  <span className="inline-flex items-center gap-1 rounded bg-[#e9e2f5] px-1.5 py-[1px] font-bold text-[#4f3486]">
                    <Skull aria-hidden="true" className="size-3" /> Curse {it.curse}
                  </span>
                )
                : null}
              {it.refine?.lv && (
                <span
                  className="inline-flex items-center gap-1 rounded bg-[#f3e7cf] px-1.5 py-[1px] text-[#7d5a17]"
                  title="Max refine and its effect at max (YouTube forge test)"
                >
                  <Hammer aria-hidden="true" className="size-3" />
                  <b>Max {it.refine.lv}</b>
                  {it.refine.fx && <span>· {it.refine.fx}</span>}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="min-w-0 py-2.5 pr-3 pl-[17px] shadow-[inset_0_-1px_0_rgba(176,144,90,.25)] @2xl:pl-4 @2xl:shadow-[inset_-1px_0_0_rgba(176,144,90,.3)]">
          <div className="label mb-1.5 flex items-center gap-1 text-[10.5px] text-gold-lo">
            <Package aria-hidden="true" className="size-3" /> Get
            {sources.length > 0 && <span className="text-muted tabular-nums">{sources.length}</span>}
          </div>
          {sources.length
            ? (
              <ul className="m-0 grid list-none gap-1 p-0">
                {shown.map((s, i) => <SourceRow key={i} s={s} kind="item" name={it.name} forWho={{ route }} />)}
              </ul>
            )
            : <p className="m-0 text-[12.5px] text-muted">No source in the item data yet.</p>}
          {sources.length > SHOW && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="mt-1 pl-[58px] text-[12px] font-semibold text-(--c) hover:underline"
            >
              {all ? "Fewer" : `+${sources.length - SHOW} more`}
            </button>
          )}
        </div>
        <div className="min-w-0 py-2.5 pr-3 pl-[17px] @2xl:pl-3">
          <Builders name={it.name} route={route} />
        </div>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- pager */

function pages(n: number, at: number): (number | null)[] {
  if (n <= 7) return Array.from({ length: n }, (_, i) => i);
  const keep = new Set([0, n - 1, at - 1, at, at + 1].filter((i) => i >= 0 && i < n));
  const out: (number | null)[] = [];
  [...keep].sort((a, b) => a - b).forEach((i, k, arr) => {
    if (k && i - arr[k - 1] > 1) out.push(null);
    out.push(i);
  });
  return out;
}

function Pager({ n, at, go }: { n: number; at: number; go: (p: number) => void }) {
  if (n <= 1) return null;
  const btn = "grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[13px] font-semibold tabular-nums";
  return (
    <nav aria-label="Pages" className="flex items-center gap-1">
      <button
        type="button"
        disabled={at === 0}
        onClick={() => go(at - 1)}
        aria-label="Previous page"
        className={cx(btn, "text-ink-soft hover:bg-paper-2 disabled:opacity-30")}
      >
        <ChevronLeft className="size-4" />
      </button>
      {pages(n, at).map((p, i) =>
        p === null ? <span key={`g${i}`} className="px-0.5 text-muted">…</span> : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === at ? "page" : undefined}
            className={cx(
              btn,
              p === at
                ? "bg-(--c) text-white shadow-[0_2px_6px_-3px_rgba(0,0,0,.5)]"
                : "text-ink-soft shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)] hover:bg-paper-2",
            )}
          >
            {p + 1}
          </button>
        )
      )}
      <button
        type="button"
        disabled={at >= n - 1}
        onClick={() => go(at + 1)}
        aria-label="Next page"
        className={cx(btn, "text-ink-soft hover:bg-paper-2 disabled:opacity-30")}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

/* ---------------------------------------------------------------- tab */

export function ItemsTab({ route }: { route: RouteName }) {
  const [f, setF] = useState<Filters>(saved);
  const root = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch, page: patch.page ?? 0 };
    saved = next;
    setF(next);
    if (patch.page !== undefined) root.current?.closest("[data-kit-scroll]")?.scrollTo({ top: 0 });
  };
  const list = useMemo(() => sortItems(CATALOG.filter((it) => matches(it, f, route)), f.sort, route), [f, route]);
  /** Matches if this option replaced the facet's current choice. */
  const count = (extra: Partial<Filters>) => CATALOG.filter((it) => matches(it, { ...f, ...extra }, route)).length;
  const typesHere = f.cat === "all"
    ? []
    : [...new Set(CATALOG.filter((it) => it.kind === f.cat).map((it) => it.type ?? ""))].filter(Boolean);
  const n = Math.max(1, Math.ceil(list.length / PER));
  const at = Math.min(f.page, n - 1);
  const shown = list.slice(at * PER, at * PER + PER);
  const dirty = JSON.stringify({ ...f, page: 0, sort: "default" }) !== JSON.stringify({ ...START, sort: "default" });
  const totals = CATS.map((c) => `${CATALOG.filter((it) => it.kind === c.id).length} ${c.label.toLowerCase()}`);
  return (
    <div ref={root} style={routeVars(route)}>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 font-display text-[17px] font-bold">Item catalog</h2>
        <span className="text-[13px] text-muted tabular-nums">{totals.join(" · ")}</span>
      </div>
      <SearchBox
        prominent
        value={f.q}
        onChange={(q) => set({ q })}
        placeholder={`Search ${CATALOG.length} items by name, type or effect (cavalry, Def +3, Healing…)`}
      />
      <div className="mb-3 grid gap-2 rounded-lg border border-gold/55 bg-paper-2/60 p-2.5 shadow-[0_1px_3px_rgba(90,60,20,.08)]">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            on={f.cat === "all"}
            onClick={() => set({ cat: "all", types: [], ranks: [] })}
            count={count({ cat: "all", types: [], ranks: [] })}
          >
            All
          </Chip>
          {CATS.map((c) => (
            <Chip
              key={c.id}
              on={f.cat === c.id}
              color={KIT[KIT_OF[c.id]].color}
              onClick={() => set({ cat: f.cat === c.id ? "all" : c.id, types: [], ranks: [] })}
              count={count({ cat: c.id, types: [], ranks: [] })}
            >
              <KitIcon type={KIT_OF[c.id]} size={16} />
              {c.label}
            </Chip>
          ))}
        </div>
        {typesHere.length > 0 && (
          <FacetRow label="Type">
            {typesHere.map((t) => (
              <Chip
                key={t}
                on={f.types.includes(t)}
                onClick={() => set({ types: toggle(f.types, t) })}
                count={count({ types: [t] })}
              >
                {t}
              </Chip>
            ))}
          </FacetRow>
        )}
        {f.cat === "Weapon" && (
          <FacetRow label="Rank">
            {RANKS.map((r) => (
              <Chip
                key={r}
                on={f.ranks.includes(r)}
                onClick={() => set({ ranks: toggle(f.ranks, r) })}
                count={count({ ranks: [r] })}
              >
                {r}
              </Chip>
            ))}
          </FacetRow>
        )}
        <FacetRow label="Get">
          {SRC_KINDS.map((s) => (
            <Chip
              key={s.id}
              on={f.src.includes(s.id)}
              onClick={() => set({ src: toggle(f.src, s.id) })}
              count={count({ src: [s.id] })}
              title={`Has a ${s.label.toLowerCase()} source on ${route}'s route`}
            >
              {s.label}
            </Chip>
          ))}
        </FacetRow>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gold/30 pt-2">
          <Chip
            on={f.planned}
            onClick={() => set({ planned: !f.planned })}
            count={count({ planned: true })}
            title={`Items a ${route} build carries at some stage`}
          >
            <Users aria-hidden="true" className="size-3.5" /> In {route}'s builds
          </Chip>
          <Chip
            on={f.onRoute}
            onClick={() => set({ onRoute: !f.onRoute })}
            count={count({ onRoute: true })}
            title={`Hide items whose only sources are on other routes`}
          >
            Gettable on {route}
          </Chip>
          <span className="flex-1" />
          {dirty && (
            <button
              type="button"
              onClick={() => set({ ...START, sort: f.sort })}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-blood"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> Reset
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft">
            <ArrowDownUp aria-hidden="true" className="size-3.5 text-gold-lo" />
            <select
              value={f.sort}
              onChange={(e) => set({ sort: e.target.value as SortKey })}
              className="rounded-md border border-gold/55 bg-card px-1.5 py-[3px] text-[12.5px] font-semibold"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-muted tabular-nums">
          {list.length ? `${at * PER + 1}–${at * PER + shown.length} of ${list.length}` : "No item matches"}
        </span>
        <Pager n={n} at={at} go={(page) => set({ page })} />
      </div>
      <ul className="m-0 grid list-none gap-3 p-0">
        {shown.map((it) => <ItemCard key={it.name} it={it} route={route} />)}
      </ul>
      {n > 1 && (
        <div className="mt-4 flex justify-center">
          <Pager n={n} at={at} go={(page) => set({ page })} />
        </div>
      )}
    </div>
  );
}
