import { ConfText, stripConf } from "../ui/conf-text.tsx";
import { Lightbulb } from "lucide-react";
import { itemWeight } from "../../lib/items.ts";
import { itemTier } from "../../lib/growth.ts";
import type { Gear, Note, RouteName, Training } from "../../lib/types.ts";
import { heldBy } from "../../lib/holders.ts";
import type { Change } from "../../lib/snapshot.ts";
import type { KitKind } from "../../lib/inventory.ts";
import { INVENTORY_CAP } from "../../lib/inventory.ts";
import { cx } from "../../lib/cx.ts";
import { TierGem } from "../ui/tier-gem.tsx";
import { KIT, KitIcon, type KitType, SITUATIONAL_BG, SituationalTag } from "../ui/kit-type.tsx";
import { TIER_SCALE, Tip } from "../ui/tooltip.tsx";
import { RefChip, Rich } from "../ref/rich.tsx";
import { PinToggle, usePinFrom } from "../ui/pin-toggle.tsx";
import { type RefType, resolve } from "../../lib/refs.ts";
import { GetLine } from "../ref/get-line.tsx";

const CHANGE_STYLE: Record<Change, string> = {
  new: "bg-(--c) text-white",
  upgraded: "bg-teal-3 text-gold-hi",
  kept: "text-faint",
};
const CHANGE_LABEL: Record<Change, string> = { new: "New", upgraded: "Upgrade", kept: "Kept" };

/** Filled "New" or "Upgrade" tag against the previous stage. Kept entries get no tag. */
export function ChangeTag({ change }: { change?: Change }) {
  if (!change || change === "kept") return null;
  return (
    <span
      className={cx(
        "rounded-[2px] px-1 py-[2px] font-logo text-[9.5px] leading-none font-bold tracking-[0.12em] uppercase",
        CHANGE_STYLE[change],
      )}
    >
      {CHANGE_LABEL[change]}
    </span>
  );
}

export type KitRow = { g: Gear; kind: KitKind; change?: Change };

const typeOf = (kind: KitKind): KitType => kind === "Weapon" ? "weapon" : kind === "Item" ? "item" : "equipment";

/** Weapon tier gem when the tier list rates it, else the round kit-type icon. */
function KitMark({ g, kind }: { g: Gear; kind: KitKind }) {
  const tier = kind === "Weapon" ? itemTier(g.item) : "";
  if (!tier) return <KitIcon type={typeOf(kind)} size={22} />;
  return (
    <Tip
      align="start"
      tip={
        <>
          <b>Weapon tier {tier}</b> from the community weapon tier list. {TIER_SCALE}
        </>
      }
    >
      <TierGem tier={tier} size={22} title="" />
    </Tip>
  );
}

const refOf = (name: string, t?: RefType) => resolve(name, t) ?? resolve(name);
/** Name with its hover card when the reference data knows it. */
export const RefName = ({ name, t }: { name: string; t?: RefType }) => {
  const r = refOf(name, t);
  return r ? <RefChip r={r} /> : <b className="font-semibold">{name}</b>;
};

/** One carried item as a card: type bar, tier gem, name, weight, change; purpose; where to get it only when new. */
/** Where a kit card sits: the route and the stage's window, so alternatives can say who else holds them then. */
export type KitCtx = { route: RouteName; unit: string; from: number; to: number };

/** One alternative: its chip, then "spare" or who carries it during this stage (D-135). */
function AltChip({ name, ctx, tag }: { name: string; ctx?: KitCtx | null; tag: boolean }) {
  const clean = name.replace(/\s*\(.*\)$/, "").trim();
  const r = resolve(clean, "item");
  const note = name.match(/\((.*)\)$/)?.[1];
  // Consumables are bought in bulk: "spare" or "held by" only means something for weapons and worn gear.
  const held = tag && ctx && r
    ? [...new Set(heldBy(ctx.route, clean, ctx.unit, ctx.from, ctx.to).map((h) => h.unit))]
    : [];
  return (
    <span className="inline-flex items-center gap-1">
      {r ? <RefChip r={r} /> : <span className="font-semibold text-ink-soft">{clean}</span>}
      {note && <span className="text-muted">({note})</span>}
      {tag && ctx && r && (held.length
        ? (
          <span
            className="rounded bg-paper-2 px-1 text-[10.5px] font-semibold text-muted"
            title="Another build carries it then"
          >
            {held.slice(0, 2).join(", ")}
            {held.length > 2 ? ` +${held.length - 2}` : ""}
          </span>
        )
        : (
          <span
            className="rounded bg-cai-2 px-1 text-[10.5px] font-semibold text-[#1d5e3e]"
            title="No other build on this route carries it during this stage"
          >
            spare
          </span>
        ))}
    </span>
  );
}

function KitCard({ row, n, part, ctx }: { row: KitRow; n?: number; part?: 1 | 2 | 3; ctx?: KitCtx | null }) {
  const { g, kind, change } = row;
  const wt = itemWeight(g.item);
  const fresh = change !== "kept";
  const from = usePinFrom(g.plan ?? g.where ? { note: g.plan ?? g.where } : undefined);
  return (
    <li
      className={cx(
        "group/kit relative grid grid-cols-[14px_22px_minmax(0,1fr)] items-start gap-x-2 rounded-[4px] py-2 pr-2.5 pl-2 text-[14px] leading-snug",
        change === "kept" ? "bg-paper/60" : "bg-card",
      )}
      style={g.situational ? { backgroundImage: SITUATIONAL_BG, boxShadow: "inset 0 0 0 1px rgba(168,69,42,.4)" } : {
        boxShadow: `inset 3px 0 0 ${KIT[typeOf(kind)].color}, inset 0 0 0 1px rgba(176,144,90,${fresh ? ".5" : ".25"})`,
      }}
    >
      <PinToggle
        kind="item"
        name={g.item}
        from={from}
        variant="icon"
        className="absolute top-1.5 right-1.5 opacity-0 group-hover/kit:opacity-100 focus-visible:opacity-100 aria-pressed:opacity-100"
      />
      <span className="pt-[3px] text-center font-logo text-[11px] font-bold text-faint tabular-nums">{n ?? ""}</span>
      <KitMark g={g} kind={kind} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-semibold">
            <RefName name={g.item} t="item" />
          </span>
          {wt !== undefined && <span className="text-[11.5px] text-muted tabular-nums" title="Weight">Wt {wt}</span>}
          {g.slot && <span className="text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">{g.slot}</span>}
          {g.situational && <SituationalTag />}
          <ChangeTag change={change} />
        </span>
        {g.situational && <span className="block text-[12.5px] font-semibold text-[#8a3a22]">{g.situational}</span>}
        {g.why && (
          <span className="block text-[12.5px] text-ink-soft line-clamp-2" title={stripConf(g.why)}>
            <ConfText text={g.why} k={`gw-${g.item}`} />
          </span>
        )}
        {g.alts?.some((x) => x.trim())
          ? (
            // Shown on every stage, not only when the item is new: a lost or never-found copy needs a fallback any time.
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-soft">
              <b className="font-semibold text-gold-lo">Instead</b>
              {g.alts.filter((x) => x.trim()).map((a) => <AltChip key={a} name={a} ctx={ctx} tag={kind !== "Item"} />)}
            </span>
          )
          : null}
        {fresh && <GetLine item={g.item} plan={g.plan ?? g.where} part={part} max={2} />}
      </span>
    </li>
  );
}

/** The six inventory slots as cards in order (weapons, equipment, consumables), free slots dashed, then swap-ins. */
export function KitSlots({ rows, part, ctx }: { rows: KitRow[]; part?: 1 | 2 | 3; ctx?: KitCtx | null }) {
  // Situational swap-ins sit in the same grid (D-57): their hatched card already says "some maps", and on those maps
  // they take a free slot, so they count against the free ones.
  const core = rows.filter((r) => !r.g.situational);
  const swaps = rows.filter((r) => r.g.situational);
  const free = Math.max(0, INVENTORY_CAP - core.length - swaps.length);
  return (
    <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1.5 p-0 sm:grid-cols-2">
      {core.map((r, i) => <KitCard key={`${r.kind}-${r.g.item}-${i}`} row={r} n={i + 1} part={part} ctx={ctx} />)}
      {swaps.map((r, i) => <KitCard key={`s-${r.g.item}-${i}`} row={r} part={part} ctx={ctx} />)}
      {Array.from({ length: free }, (_, i) => (
        <li
          key={`free-${i}`}
          className="grid grid-cols-[14px_1fr] items-center gap-x-2 rounded-[4px] border border-dashed border-gold/55 py-2 pl-2 text-[12.5px] text-faint"
        >
          <span className="text-center font-logo text-[11px] font-bold tabular-nums">
            {core.length + swaps.length + i + 1}
          </span>
          Free slot
        </li>
      ))}
    </ol>
  );
}

/** Arts or spells as cards with the kit colour on the left: name, change, the reason in two lines. */
export function NoteList({ items, changes, type }: { items: Note[]; changes?: Change[]; type: KitType }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1.5 p-0">
      {items.map((x, i) => (
        <li
          key={x.name}
          style={{ borderLeftColor: KIT[type].color }}
          className={cx(
            "rounded-r-[4px] border-l-[3px] py-1.5 pr-2 pl-2.5 text-[14px] leading-snug",
            changes?.[i] && changes[i] !== "kept"
              ? "bg-card shadow-[inset_0_0_0_1px_rgba(176,144,90,.4)]"
              : "bg-paper/60",
          )}
        >
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-semibold">
              <RefName name={x.name} t={type === "spell" ? undefined : type === "ability" ? "ability" : "art"} />
            </span>
            <ChangeTag change={changes?.[i]} />
          </span>
          {x.why && (
            <span className="block text-[12.5px] text-ink-soft line-clamp-2" title={stripConf(x.why)}>
              <ConfText text={x.why} k={`nw-${x.name}`} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Equipped abilities as slots: filled cards first, empty slots dashed, overflow in red. */
export function AbilitySlots({ items, changes, slots }: { items: Note[]; changes?: Change[]; slots: number }) {
  const free = Math.max(0, slots - items.length);
  if (!items.length) return <p className="m-0 text-[13px] text-faint">0/{slots} · {slots} free</p>;
  return (
    <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1.5 p-0">
      {items.map((x, i) => (
        <li
          key={x.name}
          title={x.why ? stripConf(x.why) : undefined}
          className={cx(
            "rounded-[4px] py-1.5 pr-2 pl-2.5 text-[14px] leading-snug",
            i >= slots ? "bg-warn" : changes?.[i] && changes[i] !== "kept" ? "bg-card" : "bg-paper/60",
          )}
          style={{ boxShadow: `inset 3px 0 0 ${KIT.ability.color}, inset 0 0 0 1px rgba(176,144,90,.4)` }}
        >
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-semibold">
              <RefName name={x.name} t="ability" />
            </span>
            <ChangeTag change={changes?.[i]} />
          </span>
          {x.why && (
            <span className="block text-[12.5px] text-ink-soft line-clamp-2">
              <ConfText text={x.why} k={`aw-${x.name}`} />
            </span>
          )}
        </li>
      ))}
      {Array.from(
        { length: free },
        (_, i) => (
          <li
            key={`f${i}`}
            className="rounded-[4px] border border-dashed border-gold/55 px-2.5 py-1.5 text-[12.5px] text-faint"
          >
            Free slot
          </li>
        ),
      )}
    </ol>
  );
}

export function DropList({ items }: { items: { item: string; why?: string }[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0">
      {items.map((d) => (
        <li
          key={d.item}
          className="text-[12.5px] leading-normal text-ink-soft"
          title={d.why ? stripConf(d.why) : undefined}
        >
          <s className="font-semibold text-muted decoration-blood-2/60">{d.item}</s>
          {d.why && (
            <span className="ml-1">
              <ConfText text={d.why} k={`dw-${d.item}`} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Weapon ranks to train now, one row each: rank badge | what it unlocks | how to train it. */
export function TrainingList({ items }: { items: Training[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] p-0 md:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)]">
      {items.map((t) => (
        <li
          key={`${t.rank}-${t.for}`}
          className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 border-t border-gold/15 py-1.5 text-[14px] leading-snug first:border-t-0 md:col-span-3 md:grid-cols-subgrid"
        >
          <span className="justify-self-start rounded-[3px] bg-(--c) px-1.5 py-[2px] text-[12px] font-extrabold whitespace-nowrap text-white">
            {t.rank}
          </span>
          <b className="font-semibold">{t.for}</b>
          <span className="col-start-2 text-[13px] text-ink-soft md:col-start-3">{t.how}</span>
        </li>
      ))}
    </ul>
  );
}

/** Short notes with a diamond bullet in the route colour. */
export function TipList({ items, k, icon, quiet }: { items: string[]; k: string; icon?: "idea"; quiet?: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1.5 p-0">
      {items.map((t, i) => (
        <li key={t} className="relative pl-4 text-[13.5px] leading-snug">
          {icon === "idea"
            ? <Lightbulb aria-hidden="true" className="absolute top-[2px] left-0 size-3 text-gold-lo" />
            : <span aria-hidden="true" className="absolute top-[7px] left-0.5 size-1.5 rotate-45 bg-(--c)" />}
          <Rich text={t} k={`${k}.${i}`} quiet={quiet} />
        </li>
      ))}
    </ul>
  );
}
