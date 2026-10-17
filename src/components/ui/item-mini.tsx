import type { ReactNode } from "react";
import { itemTier } from "../../lib/growth.ts";
import { Tick } from "../chapter/bits.tsx";
import { itemWeight } from "../../lib/items.ts";
import type { KitKind } from "../../lib/inventory.ts";
import { cx } from "../../lib/cx.ts";
import { resolve } from "../../lib/refs.ts";
import { RefChip } from "../ref/rich.tsx";
import { ChangeTag } from "../dossier/lists.tsx";
import { KIT, KitIcon, type KitType } from "./kit-type.tsx";
import { TierGem } from "./tier-gem.tsx";

const typeOf = (kind: KitKind): KitType => kind === "Weapon" ? "weapon" : kind === "Item" ? "item" : "equipment";

/**
 * A small item card (the build page's first-version look, compact): kit-type bar on the left, tier gem or type icon,
 * the name with its hover card, weight, and an UPGRADE tag (everything listed is new, so NEW would repeat itself).
 */
export function ItemMini(
  { item, kind, change, className, sub, tick, draft }: {
    item: string;
    kind: KitKind;
    change?: string;
    className?: string;
    /** A second line: where it comes from (give-out reason, barter cost). */
    sub?: ReactNode;
    /** A tracked unique: its checkbox sits in the card's corner. */
    tick?: { id: string; label: string };
    /** A chained step still waiting (D-139): dashed frame, no checkbox. */
    draft?: boolean;
  },
) {
  const tier = kind === "Weapon" ? itemTier(item) : "";
  const wt = itemWeight(item);
  const r = resolve(item, "item") ?? resolve(item);
  const head = (
    <>
      {tier ? <TierGem tier={tier} size={17} /> : <KitIcon type={typeOf(kind)} size={17} />}
      <span className="min-w-0 truncate font-semibold">{r ? <RefChip r={r} bare /> : item}</span>
      {wt !== undefined && <span className="text-[11px] text-muted tabular-nums" title="Weight">Wt {wt}</span>}
      {change === "upgraded" && <ChangeTag change={change} />}
    </>
  );
  const style = draft
    ? { boxShadow: `inset 3px 0 0 ${KIT[typeOf(kind)].color}`, outline: "1px dashed rgba(176,144,90,.7)", outlineOffset: "-1px", background: "transparent" }
    : { boxShadow: `inset 3px 0 0 ${KIT[typeOf(kind)].color}, inset 0 0 0 1px rgba(176,144,90,.45)` };
  if (sub || tick) {
    return (
      <span className={cx("inline-flex min-w-0 max-w-full flex-col gap-0.5 rounded-[4px] bg-card py-1 pr-2 pl-1.5 text-[13.5px] leading-tight", className)} style={style}>
        <span className="flex min-w-0 items-center gap-1.5">
          {head}
          {tick && <span className="ml-auto pl-1"><Tick id={tick.id} label={tick.label} /></span>}
        </span>
        {sub && <span className="pl-[23px] text-[12px] leading-snug text-muted">{sub}</span>}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex min-w-0 items-center gap-1.5 rounded-[4px] bg-card py-1 pr-2 pl-1.5 text-[13.5px] leading-tight",
        className,
      )}
      style={style}
    >
      {head}
    </span>
  );
}
