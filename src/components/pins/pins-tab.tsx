import { type ReactNode, useContext, useState } from "react";
import { Check, Gift, Leaf, MapPin, Pin as PinIcon, RotateCcw, X } from "lucide-react";
import { cx } from "../../lib/cx.ts";
import { routeVars } from "../../lib/route-style.ts";
import { itemRef, resolve } from "../../lib/refs.ts";
import { itemTier } from "../../lib/growth.ts";
import { foldName, ITEM_BY_NAME, NODE_BY_NAME } from "../../lib/map.ts";
import {
  clearDonePins,
  fromKey,
  type Pin,
  type PinFrom,
  pinKicker,
  type PinKind,
  pinKindOf,
  pinSources,
  type PinWhy,
  removePin,
  removeWhy,
  setPinDone,
  type Source,
  type SourceTag,
} from "../../lib/pins.ts";
import { getPins, useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { KIT, KitIcon } from "../ui/kit-type.tsx";
import { TierGem } from "../ui/tier-gem.tsx";
import { PinToggle } from "../ui/pin-toggle.tsx";
import { RefChip, Rich, UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { WalkCtx } from "../walkthrough/ctx.ts";

/*
 * Field Kit > Pins (D-108): items, gifts and gathering materials you want to get. Each card says who or what it is
 * for (the build, chapter or map place it was pinned from) and every known way to get it, derived from the item
 * data. Tick "Got it" to finish a pin; finished pins fold at the bottom.
 */

const TAG: Record<SourceTag, { label: string; cls: string }> = {
  shop: { label: "Shop", cls: "bg-[#dbe9e6] text-teal-3" },
  stall: { label: "Stall", cls: "bg-[#dbe9e6] text-teal-3" },
  barter: { label: "Barter", cls: "bg-[#f3e7cf] text-[#7d5a17]" },
  chest: { label: "Chest", cls: "bg-[#efe1d3] text-[#7a4a22]" },
  quest: { label: "Quest", cls: "bg-[#e9e2f5] text-[#4f3486]" },
  drop: { label: "Drop", cls: "bg-[#f6dcd6] text-[#8a2a17]" },
  story: { label: "Story", cls: "bg-paper-2 text-ink-soft" },
  crate: { label: "Crate", cls: "bg-[#efe1d3] text-[#7a4a22]" },
  gather: { label: "Gather", cls: "bg-[#e3f0df] text-[#3d7a3a]" },
  other: { label: "Other", cls: "bg-paper-2 text-ink-soft" },
};

const EDGE: Record<PinKind, string> = { item: KIT.weapon.color, gift: "#b0457a", gather: "#3d7a3a" };

function KindMark({ kind, name }: { kind: PinKind; name: string }) {
  if (kind === "gift") return <Gift aria-hidden="true" className="size-[18px] text-[#b0457a]" />;
  if (kind === "gather") return <Leaf aria-hidden="true" className="size-[18px] text-[#3d7a3a]" />;
  const it = itemRef(name);
  const tier = it?.kind === "Weapon" ? itemTier(name) : "";
  if (tier) return <TierGem tier={tier} size={18} />;
  return <KitIcon type={it?.kind === "Equipment" ? "equipment" : it?.kind === "Item" ? "item" : "weapon"} size={18} />;
}

/** Authored text with `[[ref]]`s reduced to their labels, for comparing a note with the derived sources. */
const plainText = (t: string) => t.replace(/\[\[(?:\w+:)?([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a);

/**
 * The Get column owns "where to get it" (one owner). A pin's note (the build's own "where" line, captured when it
 * was pinned) shows only for items the data has no source for; otherwise it shrinks to its chapter hint ("Ch 7"),
 * with the full line on hover.
 */
function noteFor(note: string | undefined, sources: Source[]): { text?: string; hint?: string } {
  if (!note) return {};
  if (!sources.length) return { text: note };
  return { hint: /\b(Part I{1,3} Ch \d+|Ch \d+(?:[–-]\d+)?)/.exec(plainText(note))?.[1] };
}

/** One origin, on one line: the unit with its build stage, the chapter slot, or the map place. Click jumps there. */
function Why(
  { w, pin, here, sources, onChapter }: {
    w: PinWhy;
    pin: Pin;
    here: RouteName;
    sources: Source[];
    onChapter: (ch: number) => void;
  },
) {
  const walk = useContext(WalkCtx);
  const node = w.place ? NODE_BY_NAME.get(foldName(w.place)) : undefined;
  const note = noteFor(w.note, sources);
  const sub = [w.unit ? w.stage ?? (w.ch ? `Ch ${w.ch}${w.slot ? ` · ${w.slot}` : ""}` : "") : "", note.hint]
    .filter(Boolean).join(" · ");
  let head: ReactNode;
  if (w.unit) {
    head = (
      <>
        <UnitPortrait name={w.unit} size={20} flat />
        <UnitRef name={w.unit} avatar={false} />
      </>
    );
  } else if (w.ch) {
    const same = !w.route || w.route === here;
    head = (
      <button
        type="button"
        disabled={!same}
        onClick={() => onChapter(w.ch!)}
        title={same ? `Go to Chapter ${w.ch}` : `${w.route}'s walkthrough`}
        className="inline-flex items-center gap-1.5 text-left font-semibold hover:text-(--c) disabled:cursor-default"
      >
        <span className="rounded bg-(--c) px-1.5 text-[11.5px] font-bold text-white tabular-nums">Ch {w.ch}</span>
        {w.slot && <span>{w.slot}</span>}
      </button>
    );
  } else if (w.place) {
    head = (
      <button
        type="button"
        onClick={() => node && walk?.openMap({ place: node.slug })}
        className="inline-flex items-center gap-1 font-semibold hover:text-(--c)"
        title="Open on the map"
      >
        <MapPin aria-hidden="true" className="size-3.5 text-gold-lo" />
        {w.place}
      </button>
    );
  } else head = <span className="font-semibold">{w.route ?? "Pinned"}</span>;
  return (
    <li
      className="group/why flex min-w-0 items-start gap-1.5 text-[13.5px] leading-snug"
      style={routeVars(w.route ?? here)}
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          {head}
          {sub && <span className="text-[12px] text-muted" title={w.note ? plainText(w.note) : undefined}>{sub}</span>}
          {w.route && w.route !== here && (
            <span className="rounded-full bg-(--c2) px-1.5 text-[10.5px] font-semibold text-(--c)">{w.route}</span>
          )}
        </span>
        {note.text && (
          <span className="block text-[12px] leading-snug text-muted">
            <Rich text={note.text} k={`pn-${fromKey(w)}`} />
          </span>
        )}
      </span>
      {pin.why.length > 1 && (
        <button
          type="button"
          onClick={() => removeWhy(pin.kind, pin.name, w)}
          title="Drop this reason"
          aria-label={`Drop ${pin.name} for this reason`}
          className="rounded p-0.5 text-faint opacity-0 group-hover/why:opacity-100 hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </li>
  );
}

/**
 * One way to get it, on one line: kind pill, location (places link to the map), when, barter cost you can pin.
 * Shared by Pins and Items. `forWho`: the origin a pinned barter material records.
 */
export function SourceRow(
  { s, kind, name, forWho }: { s: Source; kind: PinKind; name: string; forWho?: PinFrom },
) {
  const t = TAG[s.tag];
  return (
    <li className={cx("grid grid-cols-[50px_minmax(0,1fr)] items-start gap-2", s.offRoute && "opacity-55")}>
      <span
        className={cx(
          "mt-[2px] rounded px-1 py-[1px] text-center text-[10px] font-bold tracking-[0.04em] uppercase",
          t.cls,
        )}
      >
        {t.label}
      </span>
      <span className="min-w-0 text-[13.5px] leading-snug">
        {s.places?.length
          ? s.places.map((p, i) => {
            const r = resolve(p, "place");
            return <span key={p}>{i > 0 && ", "}{r ? <RefChip r={r} /> : p}</span>;
          })
          : <Rich text={s.text} k={`ps-${name}-${s.text}`} />}
        {s.mats?.map((m, i) => {
          const matKind = m.ref ? pinKindOf(m.ref.type) : null;
          return (
            <span
              key={m.name}
              className="ml-2 inline-flex items-center gap-1 align-middle font-semibold whitespace-nowrap"
            >
              <span className="text-faint">{i ? "+" : "→"}</span>
              {m.ref ? <RefChip r={m.ref} /> : m.name}
              {m.qty ? <span className="text-[12px] text-muted tabular-nums">×{m.qty}</span> : null}
              {matKind && (
                <PinToggle
                  kind={matKind}
                  name={m.ref!.name}
                  variant="icon"
                  className="size-5"
                  from={{
                    route: forWho?.route,
                    unit: forWho?.unit,
                    stage: forWho?.stage,
                    note: `Barter for [[${kind}:${name}]]${m.qty ? ` (×${m.qty})` : ""}`,
                  }}
                />
              )}
            </span>
          );
        })}
        {s.when && <span className="text-[12px] text-muted">{` · ${s.when}`}</span>}
        {s.offRoute && <span className="text-[12px] text-muted">&nbsp;· other routes</span>}
      </span>
    </li>
  );
}

const SHOW = 4;

/** Round icon button for the card's actions column. */
const Act = (
  { onClick, title, children, tone }: { onClick: () => void; title: string; children: ReactNode; tone: string },
) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={cx("grid size-7 shrink-0 place-items-center rounded-full", tone)}
  >
    {children}
  </button>
);

/**
 * One pin as a three-column row (panel width): what it is and who it's for | every way to get it | actions. Narrow
 * panels stack the columns. A finished pin is a single line.
 */
function PinCard({ pin, route, onChapter }: { pin: Pin; route: RouteName; onChapter: (ch: number) => void }) {
  const walk = useContext(WalkCtx);
  const [all, setAll] = useState(false);
  const sources = pinSources(pin.kind, pin.name, route);
  const shown = all ? sources : sources.slice(0, SHOW);
  const r = resolve(pin.name, pin.kind);
  const gatherKey = pin.kind === "gather" ? ITEM_BY_NAME.get(foldName(pin.name)) : undefined;
  const done = Boolean(pin.done);
  const actions = (
    <div className="flex items-start gap-1">
      <Act
        onClick={() => setPinDone(pin.kind, pin.name, !done)}
        title={done ? "Reopen this pin" : "Got it: finish this pin"}
        tone={done ? "bg-paper-2 text-ink-soft hover:bg-paper-3" : "bg-teal text-parchment hover:bg-teal-2"}
      >
        {done ? <RotateCcw aria-hidden="true" className="size-3.5" /> : <Check aria-hidden="true" className="size-4" />}
      </Act>
      <Act
        onClick={() => removePin(pin.kind, pin.name)}
        title={`Remove ${pin.name}`}
        tone="text-faint hover:bg-paper-2 hover:text-blood"
      >
        <X aria-hidden="true" className="size-4" />
      </Act>
    </div>
  );
  const title = (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-[2px]">
        <KindMark kind={pin.kind} name={pin.name} />
      </span>
      <span className="min-w-0">
        <span className={cx("block text-[15px] leading-tight font-bold", done && "line-through decoration-1")}>
          {r ? <RefChip r={r} bare /> : pin.name}
        </span>
        <span className="block text-[11.5px] leading-tight text-muted">{pinKicker(pin.kind, pin.name)}</span>
      </span>
    </div>
  );
  if (done) {
    return (
      <li
        className="flex items-center gap-3 rounded-md bg-card px-3 py-1.5 opacity-75"
        style={{ boxShadow: `inset 3px 0 0 ${EDGE[pin.kind]}, inset 0 0 0 1px rgba(176,144,90,.35)` }}
      >
        <div className="min-w-0 flex-1">{title}</div>
        {actions}
      </li>
    );
  }
  return (
    <li
      className="@container overflow-hidden rounded-lg bg-card"
      style={{
        boxShadow: `inset 5px 0 0 ${
          EDGE[pin.kind]
        }, inset 0 0 0 1.5px rgba(176,144,90,.75), 0 3px 10px -4px rgba(60,40,10,.35)`,
      }}
    >
      {/* The tinted left block marks where each pin starts; the right side stays white for the sources. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] @2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_auto]">
        <div className="min-w-0 bg-paper-2/80 py-2 pr-3 pl-[17px] shadow-[inset_0_-1px_0_rgba(176,144,90,.35)] @2xl:shadow-[inset_-1px_0_0_rgba(176,144,90,.45)]">
          {title}
          <ul className="m-0 mt-1.5 grid min-w-0 list-none gap-0.5 p-0 pl-[26px]">
            {pin.why.map((w) => (
              <Why key={fromKey(w)} w={w} pin={pin} here={route} sources={sources} onChapter={onChapter} />
            ))}
          </ul>
        </div>
        <div className="col-span-2 min-w-0 py-2 pr-3 pl-[17px] @2xl:col-span-1 @2xl:pl-4">
          {sources.length
            ? (
              <ul className="m-0 grid list-none gap-1 p-0">
                {shown.map((s, i) => (
                  <SourceRow
                    key={i}
                    s={s}
                    kind={pin.kind}
                    name={pin.name}
                    forWho={pin.why.find((w) => w.unit) ?? pin.why[0]}
                  />
                ))}
              </ul>
            )
            : <p className="m-0 text-[13px] text-muted">No source in the item data yet.</p>}
          {(sources.length > SHOW || (gatherKey && walk)) && (
            <span className="mt-1 flex flex-wrap items-center gap-x-3 pl-[58px]">
              {sources.length > SHOW && (
                <button
                  type="button"
                  onClick={() => setAll(!all)}
                  className="text-[12px] font-semibold text-(--c) hover:underline"
                >
                  {all ? "Fewer" : `+${sources.length - SHOW} more`}
                </button>
              )}
              {gatherKey && walk && (
                <button
                  type="button"
                  onClick={() => walk.openMap({ item: gatherKey })}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-(--c) hover:underline"
                >
                  <MapPin aria-hidden="true" className="size-3.5" /> Show spots on the map
                </button>
              )}
            </span>
          )}
        </div>
        <div className="col-start-2 row-start-1 bg-paper-2/80 py-2 pr-2.5 @2xl:col-start-3 @2xl:bg-transparent @2xl:pl-1">
          {actions}
        </div>
      </div>
    </li>
  );
}

/** Pins with a reason on this route first, then the rest; newest first inside each. */
const order = (pins: Pin[], route: RouteName) =>
  [...pins].sort((a, b) => {
    const ha = a.why.some((w) => !w.route || w.route === route) ? 0 : 1;
    const hb = b.why.some((w) => !w.route || w.route === route) ? 0 : 1;
    return ha - hb || (b.why.at(-1)?.at ?? b.at) - (a.why.at(-1)?.at ?? a.at);
  });

export function PinsTab({ route, onChapter }: { route: RouteName; onChapter: (ch: number) => void }) {
  useTrack();
  const pins = getPins();
  const open = order(pins.filter((p) => !p.done), route);
  const done = pins.filter((p) => p.done).sort((a, b) => (b.done ?? 0) - (a.done ?? 0));
  const [showDone, setShowDone] = useState(false);
  return (
    <div style={routeVars(route)}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 font-display text-[17px] font-bold">Pinned items</h2>
        <span className="text-[13px] text-muted tabular-nums">{open.length} open · {done.length} got</span>
      </div>
      {open.length === 0 && (
        <div className="flex items-start gap-3 rounded-md bg-paper-2/70 px-3 py-3 text-[13.5px] text-ink-soft">
          <PinIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gold-lo" />
          <p className="m-0">
            Nothing pinned. Hover an item, gift or gathering material anywhere (a build's inventory, a chapter tip, a
            map place) and press <b>Pin</b>. The pin keeps who or where it was for and lists every way to get it.
          </p>
        </div>
      )}
      {open.length > 0 && (
        <ul className="m-0 grid list-none gap-3 p-0">
          {open.map((p) => <PinCard key={`${p.kind}:${p.name}`} pin={p} route={route} onChapter={onChapter} />)}
        </ul>
      )}
      {done.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-3 border-t border-gold/30 pt-2">
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              className="text-[13.5px] font-semibold text-ink-soft hover:text-ink"
            >
              {showDone ? "▾" : "▸"} Got ({done.length})
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={clearDonePins}
              className="text-[12.5px] font-semibold text-muted hover:text-blood"
            >
              Clear got
            </button>
          </div>
          {showDone && (
            <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
              {done.map((p) => <PinCard key={`${p.kind}:${p.name}`} pin={p} route={route} onChapter={onChapter} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Open pins as a small badge for the dock and the tab strip. */
export function PinCount({ className }: { className?: string }) {
  useTrack();
  const n = getPins().filter((p) => !p.done).length;
  if (!n) return null;
  return (
    <span
      className={cx(
        "absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-blood-2 px-1 text-[10px] leading-none font-bold text-white tabular-nums",
        className,
      )}
    >
      {n}
    </span>
  );
}
