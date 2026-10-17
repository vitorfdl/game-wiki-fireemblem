import { placeLoot } from "../ref/place-loot.tsx";
import { barterText } from "../../lib/sources.ts";
import { Fragment, memo, type ReactNode, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Gem,
  Gift,
  GraduationCap,
  ListChecks,
  ScrollText,
  Swords,
  TriangleAlert,
  UserPlus,
  UtensilsCrossed,
  CheckCheck,
} from "lucide-react";
import { Panel, Sub } from "../ui/panel.tsx";
import { char, CLASSES, META, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { cx } from "../../lib/cx.ts";
import type { ChapterFile, Missable, QuestRow, RouteName } from "../../lib/types.ts";
import { chapterQuestIds, dayOf, itemKey, effectiveDue, examsFor, exitText, missableId, expiring, ids, joinsIn, kitFor, deployFor, quest, recruitGate, trainingFor } from "../../lib/chapter.ts";
import { rotation } from "../../lib/arena.ts";
import { isChapterDone, setChapterDone, setFork, useTrack } from "../../lib/track.ts";
import { ChapterCtx, useChapter, useWalk } from "../walkthrough/ctx.ts";
import { Gate, Gold } from "../walkthrough/inline.tsx";
import { Hover } from "../ui/hover.tsx";
import { routeVars } from "../../lib/route-style.ts";
import { RefChip, Rich, UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { ClassChip, classKey, isClass } from "../ui/class-chip.tsx";
import { ItemMini } from "../ui/item-mini.tsx";
import { PinScope } from "../ui/pin-toggle.tsx";
import { STATUS_BORDER, STATUS_NAME, unitStatus } from "../ui/status-border.ts";
import { nowChapter } from "../../lib/track.ts";
import { itemRef, resolve } from "../../lib/refs.ts";
import { dagsionSale, findGift, gift, roadShops, stallLabel, tierOf } from "../../lib/gifts.ts";
import { GiftName, TierMark } from "../ref/gift.tsx";
import { CalloutBox, CheckAll, ConfMark, Detail, Lines, LineRow, Row, SubHead, Tag, Tick, useIsDone } from "./bits.tsx";
import { exitTasks, kitTask, taskById, waitingOn } from "../../lib/open-tasks.ts";
import { CarriedGroup, useCarried, WaitsFor } from "./carried.tsx";

/*
 * The chapter template (redesign/02-templates.md §1, 10-visual-language.md): a dark header band (identity and time
 * only), then nine slots, each its own panel (V-13). Empty slots keep their place as a one-line panel.
 */

type SlotProps = {
  n: number;
  id: string;
  title: string;
  empty?: string | false;
  aside?: ReactNode;
  alert?: boolean;
  fold?: boolean;
  children?: ReactNode;
};

const SLOT_ICON: Record<number, ReactNode> = {
  1: <CalendarDays />,
  2: <TriangleAlert />,
  3: <GraduationCap />,
  4: <Gem />,
  5: <UserPlus />,
  6: <ScrollText />,
  7: <Compass />,
  8: <Swords />,
  9: <ListChecks />,
};

/** One slot = one panel (V-13): icon, number and title on top, the body below. Empty slots stay as a header line. */
function Slot({ n, id, title, empty, aside, alert, fold, children }: SlotProps) {
  const ch = useChapter();
  return (
    <PinScope from={{ ch: ch ?? undefined, slot: title }}>
    <Panel
      id={id}
      n={n}
      icon={SLOT_ICON[n]}
      title={title}
      empty={empty || undefined}
      aside={empty ? aside : (
        <span className="flex items-center gap-2">
          {aside}
          <CheckAll sectionId={id} />
        </span>
      )}
      tone={alert ? "alert" : undefined}
      fold={fold ? { open: false } : undefined}
      bodyClassName="text-[15px] leading-[1.5]"
    >
      {children}
    </Panel>
    </PinScope>
  );
}

/** Label column for one-line routine rows (Arena, Raven, Weekly). */
const RowLabel = ({ children }: { children: ReactNode }) => (
  <span className="pt-[2px] text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">{children}</span>
);

/** Two guests at a table: small flat avatars and names. */
const Pair = ({ names }: { names: string[] }) => (
  <span className="inline-flex min-w-0 items-center gap-1.5">
    <span className="flex shrink-0 -space-x-1.5">
      {names.map((n) => <UnitPortrait key={n} name={n} size={26} ring="var(--color-card)" />)}
    </span>
    <span className="min-w-0 truncate">
      {names.map((n, i) => (
        <span key={n}>
          {i > 0 && <span className="text-faint"> & </span>}
          <UnitRef name={n} avatar={false} />
        </span>
      ))}
    </span>
  </span>
);

const ColHead = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <span className={cx("pb-1 text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase", className)}>{children}</span>
);

/**
 * A unit as the subject of a row (classes, recruits): framed portrait, name, a title line, details below, and the
 * tracked checkbox in the card's corner (V-5). The left border is the unit's army status (D-58). Done cards dim.
 */
export function UnitCard(
  { name, route, tick, done, title, size = 40, draft, children }: {
    name: string;
    route: RouteName;
    tick?: { id: string; label: string };
    done?: boolean;
    /** A chained step whose previous step is open (D-139): dashed card, no checkbox, this "waits for" line. */
    draft?: ReactNode;
    title?: ReactNode;
    size?: number;
    children?: ReactNode;
  },
) {
  const c = char(name);
  const status = unitStatus(route, name);
  return (
    <div
      style={routeVars(c?.homeRoute)}
      title={STATUS_NAME[status]}
      className={cx(
        "relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-md border-l-[3px] bg-paper/60 py-2.5 pr-3 pl-2.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)] transition-colors hover:bg-paper",
        STATUS_BORDER[status],
        done && "opacity-60",
        Boolean(draft) && "border-dashed bg-transparent shadow-[inset_0_0_0_1px_rgba(176,144,90,.55)]",
      )}
    >
      <UnitPortrait name={name} size={size} ring="var(--color-card)" />
      <div className="min-w-0 pr-6 text-[13.5px] leading-snug">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold"><UnitRef name={name} avatar={false} /></span>
          {title}
        </div>
        <div className="mt-1">{children}</div>
        {draft && <div className="mt-1">{draft}</div>}
      </div>
      {tick && !draft && <span className="absolute top-2.5 right-2.5"><Tick id={tick.id} label={tick.label} /></span>}
    </div>
  );
}

/* ------------------------------------------------------------ 1 Routine */

type GiftRowData = NonNullable<NonNullable<ChapterFile["routine"]>["gifts"]>[number];

/**
 * The chapter's gift sheet: one line per gift to buy, with everyone who gets it this week (D-97). Rows come from
 * `routine.gifts` (one per unit); price, shop and each unit's tier come from gifts.json.
 */
function GiftSheet({ rows, c }: { rows: GiftRowData[]; c: ChapterFile }) {
  const groups = new Map<string, GiftRowData[]>();
  // Rows without a gift: nothing the unit likes is buyable this chapter, so only meals raise their Support.
  const mealsOnly = rows.filter((g) => !g.gift);
  for (const g of rows.filter((x) => x.gift)) {
    const k = findGift(g.gift)!;
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  const shop = (name: string) => {
    const sale = dagsionSale(name, c.ch);
    return sale ? stallLabel(sale.shop) + (sale.conf === "unconfirmed" ? "?" : "") : roadShops(name, c.route).join(", ");
  };
  const firsts = rows.filter((g) => g.first);
  const total = rows.reduce((n, g) => n + (g.gift ? gift(findGift(g.gift)!)?.price ?? 0 : 0), 0);
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || (gift(a[0])?.price ?? 0) - (gift(b[0])?.price ?? 0));
  return (
    <>
      <Sub icon={<Gift />}>
        Weekly gifts · {rows.length} units · about {total.toLocaleString("en-US")}G a week
      </Sub>
      {firsts.length > 0 && (
        <p className="m-0 mb-1 text-[13.5px] text-ink-soft">
          New this chapter, a 30G pastry first (it opens the bond):{" "}
          {firsts.map((g, i) => (
            <Fragment key={g.unit}>
              {i > 0 && ", "}
              <UnitRef name={g.unit} avatar={false} />
            </Fragment>
          ))}
        </p>
      )}
      <div className="text-[14.5px]">
        {sorted.map(([name, who]) => {
          // Identical notes collapse to one line: "Seteth, Nydine: buy several on the Alecto trip".
          const notes = [...new Map(who.filter((g) => g.note).map((g) => [g.note!, who.filter((x) => x.note === g.note).map((x) => x.unit)])).entries()];
          return (
            <div key={name} className="grid grid-cols-[minmax(190px,0.8fr)_minmax(0,2fr)] gap-x-3 border-t border-gold/15 py-1.5 first:border-0">
              <span className="leading-snug">
                <GiftName name={name} unsure={dagsionSale(name, c.ch)?.conf === "unconfirmed"} />
                <span className="block text-[12.5px] text-muted">{shop(name)}</span>
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {who.map((g) => {
                    const sup = g.until?.match(/Support (\d)/)?.[1];
                    const join = g.until?.match(/recruit Ch (\d+)/)?.[1];
                    const filler = /filler/i.test(g.until ?? "");
                    const alt = g.alt ? findGift(g.alt) : undefined;
                    return (
                      <span key={g.unit} title={g.until} className="inline-flex flex-wrap items-baseline gap-x-1">
                        <TierMark tier={tierOf(g.unit, name)} />
                        <UnitRef name={g.unit} />
                        {sup && <Gate kind="S" n={Number(sup)} />}
                        {join && <span className="text-[12px] text-muted">Ch {join}</span>}
                        {filler && <span className="text-[11px] tracking-wide text-faint uppercase">filler</span>}
                        {alt && (
                          <span className="text-[12.5px] text-muted">
                            or <GiftName name={alt} price={false} unsure={dagsionSale(alt, c.ch)?.conf === "unconfirmed"} />
                          </span>
                        )}
                      </span>
                    );
                  })}
                </span>
                {notes.length > 0 && (
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
                    {notes.map(([note, units], i) => (
                      <Fragment key={note}>
                        {i > 0 && " · "}
                        <b className="font-semibold text-ink-soft">{units.join(", ")}</b>: <Rich text={note} k={`gn${i}`} quiet={units} />
                      </Fragment>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {mealsOnly.length > 0 && (
        <p className="m-0 mt-1 border-t border-gold/15 pt-1.5 text-[13.5px] text-ink-soft">
          Meals only this chapter (nothing they like is buyable yet):{" "}
          {mealsOnly.map((g, i) => (
            <Fragment key={g.unit}>
              {i > 0 && ", "}
              <UnitRef name={g.unit} avatar={false} />
              {g.until?.match(/Support (\d)/) && <> <Gate kind="S" n={Number(g.until.match(/Support (\d)/)![1])} /></>}
            </Fragment>
          ))}
        </p>
      )}
    </>
  );
}

/**
 * A routine gift row. A row that names a catalog gift (gifts.json) gets its chip, the unit's tier, price and shop
 * from the catalog (one owner); free-text rows from finished routes render as written.
 */
function giftLine(g: GiftRowData, c: ChapterFile): { gift: ReactNode; cost?: string; where?: string; sub?: string } {
  const main = findGift(g.gift);
  const alt = g.alt ? findGift(g.alt) : undefined;
  const sub = [g.until, g.note].filter(Boolean).join(" · ") || undefined;
  if (!main) return { gift: g.gift, cost: g.cost, where: g.where, sub };
  const shop = (name: string) => {
    const sale = dagsionSale(name, c.ch);
    return sale ? stallLabel(sale.shop) + (sale.conf === "unconfirmed" ? "?" : "") : roadShops(name, c.route).join(", ");
  };
  const price = (name: string) => gift(name)?.price;
  const cost = [...new Set([main, alt].filter((x): x is string => Boolean(x)).map((x) => price(x) ? `${price(x)}G` : "?"))]
    .join(" / ");
  const where = g.where ?? [...new Set([main, alt].filter((x): x is string => Boolean(x)).map(shop))].join("; ");
  return {
    gift: (
      <>
        <GiftName name={main} tier={tierOf(g.unit, main)} price={false} unsure={dagsionSale(main, c.ch)?.conf === "unconfirmed"} />
        {alt && (
          <>
            <span className="text-muted"> or </span>
            <GiftName name={alt} tier={tierOf(g.unit, alt)} price={false} unsure={dagsionSale(alt, c.ch)?.conf === "unconfirmed"} />
          </>
        )}
      </>
    ),
    cost,
    where,
    sub,
  };
}

function Routine({ c }: { c: ChapterFile }) {
  useTrack(); // reported skill ranks re-plan the Arena line (D-140)
  const r = c.routine;
  if (!r) {
    return (
      <Slot
        n={1}
        id={`ch-${c.ch}-routine`}
        title="Routine"
        empty={c.free ? "One day of exploration: no weekly routine." : "No free time."}
      />
    );
  }
  const weeks = rotation(c.route, c.ch);
  const arena = weeks[0];
  return (
    <Slot n={1} id={`ch-${c.ch}-routine`} title="Routine">
      {r.same && (
        <p className="m-0 text-[13.5px] text-muted">
          Same as Ch {r.same}
          {r.meals?.length || r.gifts?.length || r.raven || r.weekly?.length || r.drop?.length ? ", with these changes." : "."}
        </p>
      )}
      {r.meals?.length
        ? (
          <>
            <Sub icon={<UtensilsCrossed />}>Sunday meals · {c.route} plus two</Sub>
            {/* Container queries: a table when the column is wide, stacked rows beside the open side panel. */}
            <div className="@container text-[14.5px]">
              <div className="hidden grid-cols-[118px_repeat(3,minmax(0,1fr))] gap-x-2 @[600px]:grid">
                {["Week", "Meal 1", "Meal 2", "Meal 3"].map((h) => <ColHead key={h}>{h}</ColHead>)}
              </div>
              {r.meals.map((m, i) => (
                <div key={i} className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-2 gap-y-1 border-t border-gold/15 py-1 @[600px]:grid-cols-[118px_repeat(3,minmax(0,1fr))]">
                  <span className="col-span-full text-[13px] leading-tight text-ink-soft @max-[600px]:font-semibold @[600px]:col-span-1">{m.week}</span>
                  {m.tables.map((t, j) => (
                    <span key={j} className="min-w-0 overflow-hidden">
                      <Pair names={t.filter((n) => n !== c.route)} />
                    </span>
                  ))}
                  {m.note && (
                    <span className="col-span-full text-[13px] leading-snug text-ink-soft @[600px]:col-start-2 @[600px]:col-end-5">
                      <ConfText text={m.note} k={`mn${i}`} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )
        : null}
      {r.gifts?.length && r.gifts.every((g) => !g.gift || findGift(g.gift))
        ? <GiftSheet rows={r.gifts} c={c} />
        : r.gifts?.length
        ? (
          <>
            <Sub icon={<Gift />}>Weekly gifts</Sub>
            <div className="@container text-[14.5px]">
              <div className="hidden grid-cols-[130px_minmax(0,1fr)_max-content_minmax(0,0.9fr)] gap-x-3 @[600px]:grid">
                <ColHead>Unit</ColHead>
                <ColHead>Gift</ColHead>
                <ColHead className="text-right">Cost</ColHead>
                <ColHead>Where</ColHead>
                {r.gifts.map((g) => {
                  const d = giftLine(g, c);
                  return (
                    <Fragment key={g.unit}>
                      <span className="border-t border-gold/15 py-1"><UnitRef name={g.unit} /></span>
                      <span className="border-t border-gold/15 py-1">
                        {d.gift}
                        {d.sub && <span className="block text-[12.5px] text-muted"><Rich text={d.sub} k={`gs${g.unit}`} /></span>}
                      </span>
                      <span className="border-t border-gold/15 py-1 text-right text-[13px] whitespace-nowrap text-muted tabular-nums">{d.cost}</span>
                      <span className="border-t border-gold/15 py-1 text-[13.5px] text-ink-soft">{d.where}</span>
                    </Fragment>
                  );
                })}
              </div>
              <ul className="m-0 list-none p-0 @[600px]:hidden">
                {r.gifts.map((g) => {
                  const d = giftLine(g, c);
                  return (
                    <li key={g.unit} className="border-t border-gold/15 py-1 first:border-0">
                      <span className="flex items-baseline gap-2">
                        <UnitRef name={g.unit} />
                        <span className="flex-1" />
                        <span className="text-[13px] whitespace-nowrap text-muted tabular-nums">{d.cost}</span>
                      </span>
                      <span className="block pl-6 leading-snug">
                        {d.gift}
                        <span className="text-[13px] text-ink-soft"> · {d.where}</span>
                        {d.sub && <span className="block text-[12.5px] text-muted"><Rich text={d.sub} k={`gs${g.unit}`} /></span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )
        : null}
      {(arena.length > 0 || r.raven || r.weekly?.length) && <Sub icon={<Swords />}>Arena, raven and weekly</Sub>}
      <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[14.5px]">
        {arena.length > 0 && weeks.map((list, w) => (
          <Fragment key={w}>
            <RowLabel>{weeks.length > 1 ? `Arena ${"ABC"[w]}` : "Arena"}</RowLabel>
            <p className="m-0 flex flex-wrap gap-x-0">
              {list.map((s, i) => (
                <span key={i} className="whitespace-nowrap">
                  {i > 0 && <span className="mx-1.5 text-faint">·</span>}
                  <UnitRef name={s.a.unit.name} avatar={false} />
                  {(s.b ?? s.partner) && (
                    <>
                      <span className="text-faint"> & </span>
                      <UnitRef name={(s.b ?? s.partner)!.unit.name} avatar={false} />
                    </>
                  )}
                  <span className="text-[12.5px] text-muted"> ({s.course})</span>
                </span>
              ))}
            </p>
          </Fragment>
        ))}
        {r.raven && (
          <>
            <RowLabel>Raven</RowLabel>
            <p className="m-0"><Rich text={r.raven} k="raven" /></p>
          </>
        )}
        {r.weekly?.map((l, i) => (
          <Fragment key={i}>
            <RowLabel>Weekly</RowLabel>
            <p className="m-0">
              <Rich text={l.text} k={`wk${i}`} />
              <Detail items={l.detail} k={`wkd${i}`} />
            </p>
          </Fragment>
        ))}
      </div>
    </Slot>
  );
}

/* ------------------------------------------------------------ 2 Missables */

const KIND_LABEL: Record<Missable["kind"], string> = {
  scene: "Scene",
  choice: "Choice",
  "support-chain": "Support chain",
  "recruit-window": "Recruit window",
  item: "Item",
  timing: "Timing",
};

export function MissableRow({ m, k, route }: { m: Missable; k: string; route: RouteName }) {
  const track = useTrack();
  const id = missableId(route, m);
  const done = Boolean(track.done[id]);
  const picked = track.forks[m.id];
  return (
    <Row tick={m.kind === "choice" ? undefined : { id, label: m.text }} done={done && m.kind !== "choice"}>
      <Tag tone="red">{KIND_LABEL[m.kind]}</Tag> <ConfText text={m.text} k={k} />
      <ConfMark conf={m.conf} />
      <div className="text-[13px] text-muted">
        {m.when && <>When {m.when} · </>}
        Lose: <ConfText text={m.lose} k={`${k}.l`} /> · Recover: <ConfText text={m.recover} k={`${k}.r`} />
      </div>
      {m.options && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {m.options.map((o) => (
            <button
              key={o.pick}
              type="button"
              onClick={() => setFork(m.id, picked === o.pick ? null : o.pick)}
              aria-pressed={picked === o.pick}
              className={cx(
                "rounded-md px-2 py-0.5 text-left text-[13.5px]",
                picked === o.pick ? "bg-(--c) text-white" : "shadow-[inset_0_0_0_1px_rgba(125,100,53,.4)] hover:bg-paper-2",
              )}
            >
              <b className="font-semibold">{o.pick}</b> <span className="opacity-75">· {o.gives}</span>
            </button>
          ))}
        </div>
      )}
      <Detail items={m.detail} k={`${k}.d`} />
    </Row>
  );
}

function Missables({ c }: { c: ChapterFile }) {
  const carried = useCarried(c.route, c.ch, ["missable"]);
  return (
    <Slot
      n={2}
      id={`ch-${c.ch}-missables`}
      title="Missables & choices"
      alert
      empty={c.missables.length || carried.length ? false : "Nothing missable this chapter."}
    >
      <CarriedGroup route={c.route} items={carried} />
      {c.missables.map((m, i) => <MissableRow key={m.id} m={m} k={`ms${i}`} route={c.route} />)}
    </Slot>
  );
}

/* ------------------------------------------------------------ 3 Classes */

export function LedgerLink({ tab, children }: { tab: string; children: ReactNode }) {
  const { openKit } = useWalk();
  return (
    <button
      type="button"
      onClick={() => {
        openKit("ledger");
        setTimeout(() => globalThis.dispatchEvent(new CustomEvent("fw-ledger-tab", { detail: tab })), 0);
      }}
      className="flex items-center gap-0.5 text-[12.5px] font-semibold text-gold-lo hover:text-ink"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </button>
  );
}

export const ClassName = ({ name }: { name: string }) => {
  const r = resolve(name, "class");
  return r ? <RefChip r={r} /> : <span>{name}</span>;
};

function Classes({ c }: { c: ChapterFile }) {
  const t = useTrack();
  const exams = examsFor(c.route, c.ch);
  const budget = META.routes[c.route].ledger?.licenseBudget?.find((b) => b.ch === c.ch);
  const training = trainingFor(c.route, c.ch);
  const overrides = new Map((c.classes.override ?? []).map((o) => [o.unit, o.text]));
  // License use from the exam cards themselves (per class tier); the ledger budget only caps it ("up to").
  const tierOf = (cls: string) => CLASSES[classKey(cls) ?? ""]?.tier;
  const count = (tier: string) => exams.filter((e) => !e.onJoin && tierOf(e.to) === tier).length;
  const parts = (["Beginner", "Specialty", "Advanced"] as const).flatMap((tier) => {
    const d = count(tier);
    const b = budget?.[tier.toLowerCase() as "beginner" | "specialty" | "advanced"] ?? 0;
    // No card of this tier: nothing to claim. A card count above the budget can't happen in game: cap it.
    return d ? [`${b && d > b ? b : d} ${tier}`] : [];
  });
  const licenses = parts.length ? parts.map((p) => Number(p.match(/\d+/)?.[0] ?? 0)).reduce((a, b) => a + b, 0) : 0;
  const carried = useCarried(c.route, c.ch, ["exam"]);
  const waits = (id: string) => {
    const task = taskById(c.route, id);
    return task ? waitingOn(c.route, task, t.done) : [];
  };
  return (
    <Slot
      n={3}
      id={`ch-${c.ch}-classes`}
      title="Classes"
      empty={exams.length || c.classes.note || carried.length
        ? false
        : training.length
        ? `No class changes. Keep training: ${training.slice(0, 4).map((x) => `${x.unit} (${x.ranks.join(", ")})`).join("; ")}`
        : "No class changes this chapter."}
      aside={<LedgerLink tab="classes">{parts.length ? `${parts.join(" · ")} License${licenses === 1 ? "" : "s"}` : "License order"}</LedgerLink>}
    >
      <CarriedGroup route={c.route} items={carried} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] gap-2">
        {exams.map((e) => {
          const w = e.onJoin ? [] : waits(e.id);
          return (
          <UnitCard
            key={e.id}
            name={e.unit.name}
            route={c.route}
            tick={!e.onJoin && isClass(e.to) ? { id: e.id, label: `${e.unit.name} reached ${e.to}` } : undefined}
            done={Boolean(t.done[e.id])}
            draft={w.length ? <WaitsFor waits={w} /> : undefined}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {e.from && !e.onJoin && (
                <>
                  {joinsIn(c.route, c.ch).some((u) => u.name === e.unit.name) && <Tag tone="route">joins</Tag>}
                </>
              )}
              {e.from && !e.onJoin && (
                <>
                  <ClassChip name={e.from} muted />
                  <ArrowRight aria-hidden="true" className="size-3.5 text-faint" />
                </>
              )}
              <ClassChip name={e.to} side={e.kind === "detour"} />
              {e.kind !== "core" && <Tag tone="route">{e.kind === "detour" ? "side trip" : e.kind}</Tag>}
            </div>
            {e.ranks.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {e.ranks.map((r) => (
                  <span key={r} className="rounded-[3px] bg-(--c)/10 px-1.5 text-[12px] font-semibold text-ink">{r}</span>
                ))}
              </div>
            )}
            {!e.onJoin && exitText(e.stage.stage.exit) && (
              <p className="m-0 mt-1 text-muted">
                <span className="mr-1 text-[10.5px] font-semibold tracking-[0.06em] text-gold-lo uppercase">Leave when</span>
                <ConfText text={exitText(e.stage.stage.exit)} k={`ex${e.id}`} />
              </p>
            )}
            {overrides.get(e.unit.name) && (
              <p className="m-0 mt-0.5 text-ink-soft"><ConfText text={overrides.get(e.unit.name)!} k={`ov${e.id}`} /></p>
            )}
          </UnitCard>
          );
        })}
      </div>
      {c.classes.note && <LineRow line={c.classes.note} k="cn" />}
    </Slot>
  );
}

/* ------------------------------------------------------------ 4 Gear */

export function ItemName({ name }: { name: string }) {
  const r = resolve(name, "item");
  return r ? <RefChip r={r} /> : <span>{name}</span>;
}


/**
 * Slot 4. New kit per unit as item cards; a give-out or barter for the same unit and item becomes the card's second
 * line (with the unique's checkbox), so an item never shows twice. Give out and Barter keep only the rest.
 */
function GearSlot({ c }: { c: ChapterFile }) {
  const t = useTrack();
  const kit = kitFor(c.route, c.ch);
  const g = c.gear;
  const carried = useCarried(c.route, c.ch, ["kit", "unique"]);
  const any = kit.length || g.buy?.length || g.barter?.length || g.assign?.length || g.note?.length || carried.length;
  // A task waiting on an open step (D-139): its exam, or the unit's recruit.
  const waits = (id: string | undefined) => {
    const task = id ? taskById(c.route, id) : undefined;
    return task ? waitingOn(c.route, task, t.done) : [];
  };
  const onCard = new Set(kit.flatMap(({ unit, gear }) => gear.map((x) => `${unit.name}|${itemKey(x.g.item)}`)));
  const assignFor = (unit: string, item: string) => g.assign?.find((a) => a.to === unit && itemKey(a.item) === itemKey(item));
  const barterFor = (unit: string, item: string) =>
    g.barter?.find((b) => itemKey(b.item) === itemKey(item) && b.for.replace(/\[\[unit:([^\]|]+)[^\]]*\]\]/g, "$1").startsWith(unit));
  const assigns = (g.assign ?? []).filter((a) => !onCard.has(`${a.to}|${itemKey(a.item)}`));
  const barters = (g.barter ?? []).filter((b) => !kit.some(({ unit, gear }) => gear.some((x) => barterFor(unit.name, x.g.item) === b)));
  return (
    <Slot
      n={4}
      id={`ch-${c.ch}-gear`}
      title="Gear"
      empty={any ? false : "No kit changes this chapter."}
      aside={<LedgerLink tab="gear">Uniques and refines</LedgerLink>}
    >
      <CarriedGroup route={c.route} items={carried} />
      {kit.length > 0 && (
        <>
          <SubHead>New in each build</SubHead>
          <div className="@container grid gap-1.5">
            {kit.map(({ unit, gear }) => (
              <PinScope key={unit.name} from={{ unit: unit.name }}>
              <div className="grid items-start gap-x-3 gap-y-1 @lg:grid-cols-[150px_minmax(0,1fr)]">
                <span className="flex min-w-0 items-center gap-1.5 pt-1 text-[14px]">
                  <UnitPortrait name={unit.name} size={24} flat />
                  <UnitRef name={unit.name} avatar={false} />
                </span>
                <span className="flex min-w-0 flex-wrap items-start gap-1.5">
                  {gear.map((x) => {
                    const a = assignFor(unit.name, x.g.item);
                    const b = barterFor(unit.name, x.g.item);
                    // The give-out's tick when there is one (D-64), else the gear's own tick; consumables have none.
                    const kitId = x.kind === "Item" ? undefined : kitTask(c.route, unit.name, x.g.item, c.ch)?.id;
                    const id = a ? ids.unique(c.route, a.item, a.to) : kitId;
                    const w = waits(id);
                    const why = a?.why
                      ? <ConfText text={a.why} k={`aw${id}`} />
                      : b
                      ? <>Barter <Rich text={barterText(b, c.route)} k={`bm${b.item}`} /></>
                      : undefined;
                    const sub = w.length ? <><WaitsFor waits={w} />{why && <span className="block">{why}</span>}</> : why;
                    return (
                      <PinScope key={x.g.item} from={b ? { note: `Barter: ${barterText(b, c.route)}` } : {}}>
                      <ItemMini
                        item={x.g.item}
                        kind={x.kind}
                        change={x.change}
                        sub={sub}
                        draft={w.length > 0}
                        tick={id && !w.length
                          ? { id, label: a ? `${a.item} given to ${a.to}` : `${unit.name} has ${x.g.item}` }
                          : undefined}
                      />
                      </PinScope>
                    );
                  })}
                </span>
              </div>
              </PinScope>
            ))}
          </div>
        </>
      )}
      {assigns.length
        ? (
          <>
            <SubHead>Give out</SubHead>
            {assigns.map((a) => {
              const id = ids.unique(c.route, a.item, a.to);
              const w = waits(id);
              return (
                <Row key={id} tick={w.length ? undefined : { id, label: `${a.item} given to ${a.to}` }}>
                  <ItemName name={a.item} /> <span className="text-faint">→</span> <UnitRef name={a.to} />
                  {a.why && <span className="text-[13px] text-muted"> · <ConfText text={a.why} k={`aw${id}`} /></span>}
                  {w.length > 0 && <div><WaitsFor waits={w} /></div>}
                </Row>
              );
            })}
          </>
        )
        : null}
      {g.buy?.length
        ? (
          <>
            <SubHead>Buy</SubHead>
            <Lines lines={g.buy} k="buy" />
          </>
        )
        : null}
      {barters.length
        ? (
          <>
            <SubHead>Barter</SubHead>
            <div className="@container">
              {barters.map((b) => (
                <PinScope key={b.item} from={{ note: `Barter: ${barterText(b, c.route)}` }}>
                <div className="grid gap-x-3 border-t border-gold/15 py-1 pl-[28px] text-[14.5px] first:border-0 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
                  <span className="whitespace-nowrap"><ItemName name={b.item} /></span>
                  <span className="text-ink-soft"><Rich text={b.for} k={`bf${b.item}`} /></span>
                  <span className="text-[13.5px] text-muted"><Rich text={barterText(b, c.route)} k={`bm${b.item}`} /></span>
                </div>
                </PinScope>
              ))}
            </div>
          </>
        )
        : null}
      {g.note?.length ? <div className="mt-1"><Lines lines={g.note} k="gn" /></div> : null}
    </Slot>
  );
}

/* ------------------------------------------------------------ 5 Recruits */

function GateChips({ route, unit }: { route: RouteName; unit: string }) {
  const g = recruitGate(route, unit);
  if (!g || g.how !== "recruit") return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {g.support !== undefined && <Gate kind="S" n={g.support} />}
      {g.renown !== undefined && <Gate kind="R" n={g.renown} />}
      {g.gold !== undefined && <Gold amount={`${g.gold.toLocaleString("en-US")}G`} />}
    </span>
  );
}

function Recruits({ c }: { c: ChapterFile }) {
  const t = useTrack();
  const joins = joinsIn(c.route, c.ch).filter((u) => recruitGate(c.route, u.name)?.how === "auto");
  const carried = useCarried(c.route, c.ch, ["recruit"]);
  const any = joins.length || c.recruits.length || c.prep?.length || carried.length;
  return (
    <Slot
      n={5}
      id={`ch-${c.ch}-recruits`}
      title="Recruits"
      empty={any ? false : "Nobody joins or can be recruited this chapter."}
      aside={<LedgerLink tab="recruits">All recruits</LedgerLink>}
    >
      <CarriedGroup route={c.route} items={carried} />
      {joins.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
          {joins.map((u) => (
            <span key={u.name} className="inline-flex items-center gap-1.5">
              <UnitPortrait name={u.name} size={30} ring="var(--color-card)" />
              <UnitRef name={u.name} avatar={false} />
            </span>
          ))}
          <span className="text-muted">join{joins.length > 1 ? "" : "s"} automatically.</span>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-2">
        {c.recruits.map((r, i) => {
          const id = ids.recruit(c.route, r.unit);
          return (
            <UnitCard
              key={r.unit}
              name={r.unit}
              route={c.route}
              size={48}
              tick={{ id, label: `${r.unit} recruited` }}
              done={Boolean(t.done[id])}
              title={<GateChips route={c.route} unit={r.unit} />}
            >
              <span className="text-[14.5px] text-ink">
                <ConfText text={r.action} k={`rc${i}`} quiet={[r.unit]} />
              </span>
              <ConfMark conf={r.conf} />
              {r.when && <span className="text-muted"> · {r.when}</span>}
              <Detail items={r.detail} k={`rc${i}.d`} />
              {r.callout && <CalloutBox c={r.callout} k={`rc${i}.c`} />}
            </UnitCard>
          );
        })}
      </div>
      {c.prep?.length
        ? (
          <>
            <SubHead>For later recruits</SubHead>
            <Lines lines={c.prep} k="prep" />
          </>
        )
        : null}
    </Slot>
  );
}

/* ------------------------------------------------------------ 6 Quests */

function QuestLine({ c, q, k }: { c: ChapterFile; q: QuestRow; k: string }) {
  const data = quest(q.quest);
  const id = ids.quest(c.route, q.quest);
  const done = useIsDone(id);
  if (!data) return <Row><span className="text-blood">Unknown quest: {q.quest}</span></Row>;
  const r = data.routes[c.route];
  const ref = resolve(q.quest, "quest");
  const urgent = expiring(c).some((x) => x.id === id);
  // The listed due date is the catalog's; a stretch without free time can pull it earlier.
  const eff = r?.due ? effectiveDue(c.route, r.due) : undefined;
  return (
    <Row tick={{ id, label: `${data.name} done` }} done={done}>
      <div className="grid gap-x-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <span className="min-w-0">
          <span className={cx(done && "line-through decoration-gold/50")}>{ref ? <RefChip r={ref} /> : data.name}</span>
          <span className="text-[13.5px] text-muted"> · {data.task}</span>
          {q.offered === "if-offered" && <> <Tag>if offered</Tag></>}
          {q.skip && <> <Tag>plan skips it</Tag></>}
          {r?.window && (
            <span
              title="Accept window"
              className="ml-1.5 inline-flex items-center gap-1 rounded-[3px] bg-gold-hi/30 px-1.5 align-[0.06em] text-[12px] font-semibold whitespace-nowrap text-[#5d4512] tabular-nums"
            >
              accept {r.window.from === r.window.to ? r.window.from : `${r.window.from}–${r.window.to}`}
            </span>
          )}
          {r?.fight && <span className="ml-1.5 text-[12.5px] whitespace-nowrap text-muted tabular-nums">fight {r.fight}</span>}
          <ConfMark conf={data.conf} />
          {q.note && <span className="block text-[13.5px] leading-snug text-ink-soft"><ConfText text={q.note} k={`${k}.n`} /></span>}
          <Detail items={q.detail} k={`${k}.d`} />
        </span>
        {r?.due && (
          <span className={cx("text-right text-[13px] whitespace-nowrap tabular-nums", urgent ? "font-semibold text-blood" : "text-muted")}>
            due {eff}
            {eff !== r.due && <span className="block text-[11.5px] font-normal text-muted">listed {r.due}</span>}
          </span>
        )}
      </div>
    </Row>
  );
}

function Quests({ c }: { c: ChapterFile }) {
  const groups: [string, QuestRow[]][] = [
    ["Route quests", c.quests.route],
    ["Subquests", c.quests.sub],
    ["Paralogues", c.quests.paralogue],
  ];
  const carried = useCarried(c.route, c.ch, ["quest"]);
  const any = groups.some(([, list]) => list.length) || carried.length;
  return (
    <Slot
      n={6}
      id={`ch-${c.ch}-quests`}
      title="Quests"
      empty={any ? false : "No quests this chapter."}
      aside={<LedgerLink tab="calendar">Calendar</LedgerLink>}
    >
      <CarriedGroup route={c.route} items={carried} />
      {(() => {
        const full = groups.filter(([, list]) => list.length);
        const none = groups.filter(([, list]) => !list.length).map(([t]) => t);
        return (
          <>
            <div className={cx("grid gap-x-6", full.length > 1 && "xl:grid-cols-2")}>
              {full.map(([title, list]) => (
                <div key={title} className="min-w-0">
                  <SubHead>{title}</SubHead>
                  {list.map((q, i) => <QuestLine key={q.quest} c={c} q={q} k={`${title}${i}`} />)}
                </div>
              ))}
            </div>
            {none.length > 0 && <p className="m-0 mt-2 text-[13px] text-faint">No {none.join(" or ").toLowerCase()} this chapter.</p>}
          </>
        );
      })()}
    </Slot>
  );
}

/* ------------------------------------------------------------ 7 Explore */

/**
 * A dungeon row gets its Part I chest list from `dungeon_chests` (D-110), first in its details. Authored details keep
 * only plan notes (who takes what).
 */
function withChests(text: string, detail?: string[]): string[] | undefined {
  const place = text.match(/\[\[place:([^\]|]+)/)?.[1];
  const p1 = place ? placeLoot(place)?.chests?.p1 : undefined;
  if (!p1?.length) return detail;
  const n = new Map<string, number>();
  for (const x of p1) n.set(x, (n.get(x) ?? 0) + 1);
  const list = [...n].map(([x, k]) => `${itemRef(x.replace(/\s+\+\d+$/, "")) ? `[[item:${x}]]` : x}${k > 1 ? ` ×${k}` : ""}`);
  return [`Chests: ${list.join(", ")}.`, ...(detail ?? [])];
}

function Explore({ c }: { c: ChapterFile }) {
  const groups = new Map<string, typeof c.explore>();
  for (const l of c.explore) {
    const g = l.group ?? "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ ...l, task: Boolean(l.loot && l.id), detail: withChests(l.text, l.detail) });
  }
  const carried = useCarried(c.route, c.ch, ["dungeon"]);
  return (
    <Slot
      n={7}
      id={`ch-${c.ch}-explore`}
      title="Explore"
      empty={c.explore.length || carried.length ? false : "Nothing to explore this chapter."}
      fold={c.explore.length > 6}
    >
      <CarriedGroup route={c.route} items={carried} />
      {[...groups].map(([g, lines]) => (
        <div key={g}>
          {g && <SubHead>{g}</SubHead>}
          <Lines lines={lines} k={`ex${g}`} />
        </div>
      ))}
    </Slot>
  );
}

/* ------------------------------------------------------------ 8 Battle */

function Battle({ c }: { c: ChapterFile }) {
  const b = c.battle;
  const phase = deployFor(c.route, c.ch);
  return (
    <Slot n={8} id={`ch-${c.ch}-battle`} title={`Battle · ${b.title}`}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {(() => {
          const boss = b.objective.match(/^boss:\s*(.+)$/i)?.[1];
          if (boss) return <Fact label="Boss"><ConfText text={boss} k="bo" /></Fact>;
          if (/^(not documented|unknown)/i.test(b.objective)) return null;
          const win = b.objective.replace(/\s*\((?:the )?objective (?:is )?not in the sources\)/i, "");
          return <Fact label="Win"><ConfText text={win} k="bo" /></Fact>;
        })()}
        {b.lose && (
          <Fact label="Lose if" tone="red">
            <ConfText text={b.lose} k="bl" />
          </Fact>
        )}
        {b.guests?.length
          ? (
            <Fact label="Guests">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {b.guests.map((g) => <UnitRef key={g} name={g} />)}
              </span>
            </Fact>
          )
          : null}
        {phase && (
          <Fact
            label={`Deploy about ${phase.slots}`}
            aside={
              <a href={href(routeSlug(c.route), "army")} className="text-[12px] font-semibold text-gold-lo normal-case tracking-normal hover:text-ink">
                Lineup →
              </a>
            }
          >
            <span className="flex flex-wrap gap-1">
              {phase.units.map((n) => <UnitPortrait key={n} name={n} size={26} flat />)}
            </span>
          </Fact>
        )}
      </div>
      {b.tips.length > 0 && (
        <>
          <SubHead>Tips</SubHead>
          <Lines lines={b.tips} k="bt" stats />
        </>
      )}
      {b.loot?.length
        ? (
          <>
            <SubHead>Loot</SubHead>
            {b.loot.map((l, i) => <LineRow key={i} line={l} k={`blt${i}`} />)}
          </>
        )
        : null}
      {b.callout && <Row><CalloutBox c={b.callout} k="bc" /></Row>}
    </Slot>
  );
}

/** A labelled fact tile in the battle slot: Win, Lose if, Guests, Deploy. */
export function Fact({ label, tone, aside, children }: { label: string; tone?: "red"; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-paper/60 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]">
      <div className={cx("mb-0.5 flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase", tone === "red" ? "text-blood-2" : "text-gold-lo")}>
        {label}
        <span className="flex-1" />
        {aside}
      </div>
      <div className="text-[14.5px] leading-snug">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------ 9 Before you move on */

function QuestName({ quest: id }: { quest: string }) {
  const r = resolve(id, "quest");
  return r ? <RefChip r={r} /> : <>{quest(id)?.name ?? id}</>;
}

type ExitRow =
  | { kind: "missable"; id: string; label: string; due?: string; tick: boolean }
  | { kind: "quest"; id: string; quest: string; due: string }
  | { kind: "supplies"; ids: string[]; due: string };

/**
 * Slot 9: unticked missables of this chapter, then quests whose effective due date falls before the next chapter's
 * free time (skipped quests and unpicked fork branches left out), Send Supplies quests folded into one row.
 */
function Exit({ c }: { c: ChapterFile }) {
  const t = useTrack();
  const [all, setAll] = useState(false);
  const rows: ExitRow[] = [];
  // One source with the carried rows (D-139): own and earlier missables, then quests due before the next free time.
  const open = exitTasks(c.route, c.ch, t.done, t.forks);
  for (const { task, missed } of open) {
    if (task.kind !== "missable") continue;
    const m = task.m;
    const from = task.start < c.ch ? ` (Ch ${task.start}${missed ? ", missed?" : ""})` : "";
    if (m.kind === "choice") rows.push({ kind: "missable", id: m.id, label: `Choose: ${m.text}${from}`, due: m.when, tick: false });
    else rows.push({ kind: "missable", id: task.id, label: `${m.text}${from}`, due: task.due ?? m.when, tick: true });
  }
  const quests = open.flatMap(({ task }) => task.kind === "quest" ? [{ id: task.id, quest: task.quest, due: task.due ?? "", kind: quest(task.quest)?.kind }] : []);
  const supplies = quests.filter((q) => q.kind === "send-supplies");
  if (supplies.length) rows.push({ kind: "supplies", ids: supplies.map((q) => q.id), due: supplies[0].due });
  for (const q of quests) if (q.kind !== "send-supplies") rows.push({ kind: "quest", id: q.id, quest: q.quest, due: q.due });
  const extra = c.exitExtra ?? [];
  const clear = !rows.length && !extra.length;
  return (
    <Slot n={9} id={`ch-${c.ch}-exit`} title="Before you move on" alert={!clear} empty={clear ? "All clear." : false}>
      {(all || rows.length <= EXIT_MAX + 2 ? rows : rows.slice(0, EXIT_MAX)).map((o) =>
        o.kind === "supplies"
          ? (
            <Row key="supplies">
              <span className="font-semibold">{o.ids.length} Send Supplies quest{o.ids.length > 1 ? "s" : ""}</span>
              <span className="text-[13.5px] text-muted"> · tick them in the Quests slot</span>
              <span className="ml-1.5 text-[13px] font-semibold text-blood tabular-nums">first ends {o.due}</span>
            </Row>
          )
          : (
            <Row key={o.id} tick={o.kind === "quest" || o.tick ? { id: o.id, label: o.kind === "quest" ? o.quest : o.label } : undefined}>
              {o.kind === "quest" ? <QuestName quest={o.quest} /> : <ConfText text={o.label} k={o.id} />}
              <DueLabel due={o.due} text={o.kind === "quest" ? undefined : o.label} />
            </Row>
          )
      )}
      {!all && rows.length > EXIT_MAX + 2 && (
        <Row>
          <button type="button" onClick={() => setAll(true)} className="text-[13px] font-semibold text-gold-lo hover:text-ink">
            {rows.length - EXIT_MAX} more ending by {rows.at(-1)!.due ?? "the end of the chapter"}
          </button>
        </Row>
      )}
      {extra.map((l, i) => <LineRow key={i} line={l} k={`xx${i}`} />)}
    </Slot>
  );
}

/**
 * The date part of an exit row: "ends 5/20" for a plain date, "9/17–9/25" for a range, "when: Renown 8" for free-form
 * text, nothing when the row's own text already names it.
 */
export function DueLabel({ due, text }: { due?: string; text?: string }) {
  if (!due) return null;
  const range = due.replace(/\s+(?:to|-)\s+/g, "–");
  if (text && (text.includes(due) || text.includes(range))) return null;
  const date = /^(?:by |until )?\d{1,2}\/\d{1,2}$/i.test(due);
  const isRange = /^\d{1,2}\/\d{1,2}–\d{1,2}\/\d{1,2}$/.test(range);
  return (
    <span className={cx("ml-1.5 text-[13px] tabular-nums", date || isRange ? "font-semibold text-blood" : "text-muted")}>
      {date ? `ends ${due.replace(/^(by|until) /i, "")}` : isRange ? range : `when: ${due}`}
    </span>
  );
}

/** Rows the exit slot shows before a "N more" line. */
const EXIT_MAX = 10;

/* ------------------------------------------------------------ Header */

export type Mark = { day: number; date: string; label: string; kind: "quest" | "missable"; target: string };

/** Dated things inside this free time: quest deadlines and dated missables, for the header ribbon. */
function marks(c: ChapterFile): Mark[] {
  if (!c.free) return [];
  const a = dayOf(c.free.from);
  const b = dayOf(c.free.to);
  const out: Mark[] = [];
  for (const id of chapterQuestIds(c)) {
    const due = quest(id)?.routes[c.route]?.due;
    if (due && dayOf(due) >= a && dayOf(due) <= b) {
      out.push({ day: dayOf(due), date: due, label: quest(id)!.name, kind: "quest", target: `ch-${c.ch}-quests` });
    }
  }
  for (const m of c.missables) {
    const d = m.when?.match(/\d+\/\d+/)?.[0];
    if (d && dayOf(d) >= a && dayOf(d) <= b) {
      out.push({ day: dayOf(d), date: d, label: m.text.replace(/\[\[[^:]+:([^|\]]+)(\|([^\]]+))?\]\]/g, (_, n, __, l) => l ?? n), kind: "missable", target: `ch-${c.ch}-missables` });
    }
  }
  return out.sort((x, y) => x.day - y.day);
}

/** The free time as a ribbon: start and end dates, a dot per deadline (hover for what, click to jump). */
function Ribbon({ free, list }: { free: { from: string; to: string }; list: Mark[] }) {
  const a = dayOf(free.from);
  const span = Math.max(1, dayOf(free.to) - a);
  const weeks = Math.floor(span / 7);
  return (
    <div className="mt-3">
      <div className="relative h-6">
        <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-gold-hi/70 via-gold-hi/40 to-gold-hi/70" />
        {Array.from({ length: weeks }, (_, w) => (
          <span
            key={w}
            aria-hidden="true"
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-gold-hi/50"
            style={{ left: `${(((w + 1) * 7) / span) * 100}%` }}
          />
        ))}
        {list.map((m, i) => (
          <Hover
            key={i}
            label={`${m.date}: ${m.label}`}
            card={() => (
              <div className="pr-4">
                <div className={cx("text-[12px] font-semibold", m.kind === "missable" ? "text-blood-2" : "text-gold-lo")}>
                  {m.kind === "missable" ? "Missable" : "Quest deadline"} · {m.date}
                </div>
                <div className="text-[14px]">{m.label}</div>
              </div>
            )}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${((m.day - a) / span) * 100}%` }}
          >
            <button
              type="button"
              onClick={() => document.getElementById(m.target)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={cx(
                "block size-3.5 rounded-full ring-2 ring-teal transition-transform hover:scale-125",
                m.kind === "missable" ? "bg-[#f0857a]" : "bg-gold-hi",
              )}
            />
          </Hover>
        ))}
      </div>
      <div className="flex justify-between text-[12px] text-parchment/70 tabular-nums">
        <span>{free.from}</span>
        <span>{span + 1} days{list.length ? ` · ${list.length} dated` : ""}</span>
        <span>{free.to}</span>
      </div>
    </div>
  );
}

/**
 * Chapter feature band (V-6, V-14), shared by JSON and Markdown chapters: number medallion, name, dates and what
 * opens; who joins as portraits (click: the Units panel); the free time as a ribbon. "Now" marks the chapter you are playing.
 */
export function ChapterBand(
  { route, ch, name, free, note, unlocks, joining, marks: list = [] }: {
    route: RouteName;
    ch: number;
    name: string;
    free: { from: string; to: string } | null;
    note?: string;
    unlocks?: string[];
    joining: string[];
    marks?: Mark[];
  },
) {
  const track = useTrack();
  const now = nowChapter(route, track) === ch;
  return (
    <header className="relative overflow-hidden rounded-lg bg-teal px-5 pt-4 pb-3 text-parchment shadow-[0_10px_28px_-14px_rgba(16,38,42,.75)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--c)_45%,transparent),transparent_60%)]"
      />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          aria-hidden="true"
          className={cx(
            "grid size-14 shrink-0 place-items-center rounded-full font-logo text-[30px] leading-none font-bold",
            now ? "bg-gold-hi text-teal" : "text-gold-hi shadow-[inset_0_0_0_2px_rgba(231,200,128,.7)]",
          )}
        >
          {ch}
        </span>
        <div className="min-w-[240px] flex-1">
          <h2 className="m-0 flex flex-wrap items-baseline gap-x-2.5 font-display text-[clamp(22px,2.6vw,30px)] leading-tight text-white">
            {name}
            {now && (
              <span className="rounded-full bg-gold-hi/20 px-2 py-px font-sans text-[11px] font-bold tracking-[0.1em] text-gold-hi uppercase ring-1 ring-gold-hi/50">
                Now
              </span>
            )}
          </h2>
          <p className="m-0 mt-0.5 text-[13.5px] text-parchment/75">
            {free ? <>Free time <b className="font-semibold text-parchment">{free.from} to {free.to}</b></> : "Battle only, no free time"}
            {unlocks?.length ? <> · New: {unlocks.join(", ")}</> : null}
            {note && <> · {note}</>}
          </p>
        </div>
        {joining.length > 0 && (
          <div className="ml-auto hidden shrink-0 flex-col items-end gap-1 sm:flex">
            <span className="text-[10.5px] font-semibold tracking-[0.1em] text-gold-hi/80 uppercase">Joining</span>
            <span className="flex -space-x-2">
              {joining.slice(0, joining.length > 5 ? 4 : 5).map((n) => (
                <UnitPortrait key={n} name={n} size={40} ring="var(--color-teal)" className="hover:z-10" />
              ))}
              {joining.length > 5 && (
                <span
                  title={joining.slice(4).join(", ")}
                  className="relative grid size-10 place-items-center rounded-full bg-teal-2 text-[13px] font-bold text-gold-hi shadow-[0_0_0_2px_var(--color-teal),0_0_0_3.5px_var(--color-gold)]"
                >
                  +{joining.length - 4}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      {free && <div className="relative"><Ribbon free={free} list={list} /></div>}
    </header>
  );
}

function Header({ c }: { c: ChapterFile }) {
  const joining = [
    ...joinsIn(c.route, c.ch).map((u) => u.name),
    ...c.recruits.map((r) => r.unit),
  ].filter((n, i, a) => a.indexOf(n) === i);
  return (
    <ChapterBand route={c.route} ch={c.ch} name={c.name} free={c.free} unlocks={c.unlocks} joining={joining} marks={marks(c)} />
  );
}

/**
 * End-of-chapter bar (D-91, D-92): you finish a chapter by hand, with or without ticks. You're playing the chapter after
 * the latest finished one.
 */
function FinishBar({ route, ch }: { route: RouteName; ch: number }) {
  const t = useTrack();
  const done = isChapterDone(route, ch, t);
  const playing = nowChapter(route, t) === ch;
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5 text-[14px]",
        done ? "bg-(--c)/10 text-ink-soft shadow-[inset_0_0_0_1px_var(--c)]" : "bg-paper-2/70 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]",
      )}
    >
      {done
        ? (
          <>
            <CheckCheck className="size-4 text-(--c)" />
            <b>Chapter {ch} finished</b>
            <span className="flex-1" />
            <button type="button" onClick={() => setChapterDone(route, ch, false)} className="text-[13px] font-semibold text-muted underline hover:text-ink">
              Undo
            </button>
          </>
        )
        : (
          <>
            <button
              type="button"
              onClick={() => setChapterDone(route, ch, true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--c) px-3.5 py-1 font-semibold text-white hover:opacity-90"
            >
              <CheckCheck className="size-4" /> Finish Chapter {ch}
            </button>
            <span className="text-[13px] text-muted">
              {playing ? "You're playing this chapter." : "Marks it done; open ticks stay as they are."}
            </span>
          </>
        )}
    </div>
  );
}

/** A migrated chapter (JSON). Same anchor id as the Markdown version so the rail and URLs keep working. */
/** Memoized: the chapter data never changes at run time, so panel toggles and scrolling don't re-render it. */
export const ChapterView = memo(function ChapterView({ c }: { c: ChapterFile }) {
  return (
    <ChapterCtx.Provider value={c.ch}>
      <section id={`ch-${c.ch}`} data-section={`ch-${c.ch}`} className="scroll-mt-20 pt-10 pb-2 [content-visibility:auto] [contain-intrinsic-size:auto_2600px]">
        <Header c={c} />
        {/* Routine first, then empty slots (nothing to do), then the rest (D-84). */}
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 [&>[data-empty]]:order-[-1] [&>:first-child]:!order-[-2]">
          <Routine c={c} />
          <Missables c={c} />
          <Classes c={c} />
          <GearSlot c={c} />
          <Recruits c={c} />
          <Quests c={c} />
          <Explore c={c} />
          <Battle c={c} />
          <Exit c={c} />
          <FinishBar route={c.route} ch={c.ch} />
        </div>
      </section>
    </ChapterCtx.Provider>
  );
});
