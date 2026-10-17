import { useState } from "react";
import * as REFS from "virtual:refs";
import { resolve } from "../../lib/refs.ts";
import { RefChip } from "./rich.tsx";
import { PinScope } from "../ui/pin-toggle.tsx";

/* What a World Map place sells, barters and holds in chests (D-101, D-109). Built in vite.config.ts from
   structured owners only: `shops` (shops and Vandahl counters) and `dungeon_chests` (RPG Site, per Part).
   Quest and story rewards live on their quests, not here. */

type Loot = {
  buy: { item: string; price?: number }[];
  barter: { item: string; cost?: string }[];
  chests?: { p1: string[]; p3: string[]; note?: string };
};
const LOOT = REFS.PLACE_LOOT as Record<string, Loot>;
export const placeLoot = (name: string): Loot | undefined => LOOT[name];

/** "Longbow +3" resolves as Longbow; duplicates ("Bullion, Bullion") fold into "Bullion ×2". */
function fold(list: string[]): { item: string; tag?: string }[] {
  const out: { item: string; n: number }[] = [];
  for (const x of list) {
    const hit = out.find((o) => o.item === x);
    if (hit) hit.n++;
    else out.push({ item: x, n: 1 });
  }
  return out.map((o) => ({ item: o.item, tag: o.n > 1 ? `×${o.n}` : undefined }));
}

function Chips({ list, cap }: { list: { item: string; tag?: string; title?: string }[]; cap: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, cap);
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[12.5px] leading-snug">
      {shown.map((x) => {
        const base = x.item.replace(/ \+\d+$/, "");
        const r = resolve(x.item, "gift") ?? resolve(x.item, "item") ?? resolve(base, "item");
        const plus = r && base !== x.item ? x.item.slice(base.length) : "";
        return (
          <span key={x.item + (x.tag ?? "")} title={x.title} className="whitespace-nowrap">
            {r ? <RefChip r={r} /> : x.item}
            {plus}
            {x.tag && <span className="ml-0.5 text-[11px] text-muted">{x.tag}</span>}
          </span>
        );
      })}
      {!all && list.length > cap && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="font-semibold text-(--c) hover:underline"
        >
          +{list.length - cap} more
        </button>
      )}
    </span>
  );
}

function Block({ label, children, hint }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5">
      <div className="label mb-0.5 text-[10px] text-gold-lo">
        {label}
        {hint && <span className="ml-1 normal-case tracking-normal text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function PlaceLoot({ name, cap = 10 }: { name: string; cap?: number }) {
  const l = LOOT[name];
  if (!l) return null;
  const c = l.chests;
  // Pins made from these chips remember the place (D-108).
  return (
    <PinScope from={{ place: name }}>
      {c && (c.p1.length > 0 || c.p3.length > 0) && (
        <>
          <Block label={`Chests · Part I (${c.p1.length})`}>
            {c.p1.length ? <Chips cap={cap} list={fold(c.p1)} /> : <span className="text-[12px] text-muted">None</span>}
          </Block>
          <Block label={`Chests · Part III (${c.p3.length})`} hint="new set, not there in Part I">
            {c.p3.length ? <Chips cap={cap} list={fold(c.p3)} /> : <span className="text-[12px] text-muted">None</span>}
          </Block>
          {c.note && <div className="mt-0.5 text-[11.5px] text-muted">{c.note}</div>}
        </>
      )}
      {l.barter.length > 0 && (
        <Block label={`Vandahl barter (${l.barter.length})`}>
          <Chips cap={cap} list={l.barter.map((b) => ({ item: b.item, tag: b.cost ?? "cost ?", title: b.cost }))} />
        </Block>
      )}
      {l.buy.length > 0 && (
        <Block label={`Sells (${l.buy.length})`}>
          <Chips cap={cap} list={l.buy.map((b) => ({ item: b.item, tag: b.price ? `${b.price}G` : undefined }))} />
        </Block>
      )}
    </PinScope>
  );
}
