import type { ReactNode } from "react";
import { Award, FlaskConical, Gem, Sparkles, Sword, Zap } from "lucide-react";
import { cx } from "../../lib/cx.ts";

export type KitType = "weapon" | "equipment" | "item" | "art" | "spell" | "ability";

/** One icon and one color per kind of kit entry, used everywhere a build lists gear or skills. */
export const KIT: Record<KitType, { label: string; plural: string; color: string; icon: (cls: string) => ReactNode }> =
  {
    weapon: {
      label: "Weapon",
      plural: "Weapons",
      color: "#3b5b7a",
      icon: (c) => <Sword aria-hidden="true" className={c} />,
    },
    equipment: {
      label: "Equipment",
      plural: "Equipment",
      color: "#8a6420",
      icon: (c) => <Gem aria-hidden="true" className={c} />,
    },
    item: {
      label: "Item",
      plural: "Items",
      color: "#5a7a2a",
      icon: (c) => <FlaskConical aria-hidden="true" className={c} />,
    },
    art: {
      label: "Combat art",
      plural: "Combat arts",
      color: "#a8452a",
      icon: (c) => <Zap aria-hidden="true" className={c} />,
    },
    spell: {
      label: "Spell",
      plural: "Spells",
      color: "#6a3fa0",
      icon: (c) => <Sparkles aria-hidden="true" className={c} />,
    },
    ability: {
      label: "Ability",
      plural: "Abilities",
      color: "#2f6b5a",
      icon: (c) => <Award aria-hidden="true" className={c} />,
    },
  };

/** Striped rust tint for items carried only on some maps, so they never read as part of the core kit. */
export const SITUATIONAL_BG =
  "repeating-linear-gradient(135deg, rgba(168,69,42,.10) 0 7px, rgba(168,69,42,.03) 7px 14px)";

/** "Situational" chip shown on swap-in items. */
export function SituationalTag() {
  return (
    <span className="rounded-sm border border-dashed border-[#a8452a] px-1.5 font-logo text-[10.5px] font-bold tracking-[0.12em] text-[#a8452a] uppercase">
      Situational
    </span>
  );
}

/** Six boxes: filled for core items, red past the cap. Situational swaps are counted beside it. */
export function InventoryMeter({ core, swaps, cap, bare }: { core: number; swaps: number; cap: number; bare?: boolean }) {
  const over = core > cap;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft"
      title="Weapons, consumables and equipped shields, accessories and masks all share the 6 inventory slots"
    >
      {!bare && <b className="label text-gold-lo">Inventory</b>}
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: Math.max(cap, core) }, (_, i) => (
          <span
            key={i}
            className="size-2.5 rounded-[2px] border"
            style={{
              borderColor: i >= cap ? "#a8452a" : "rgba(176,144,90,.8)",
              background: i < core ? (i >= cap ? "#a8452a" : "var(--c, #3b5b7a)") : "transparent",
            }}
          />
        ))}
      </span>
      <span className={cx("tabular-nums font-semibold", over && "text-[#a8452a]")}>{core}/{cap}</span>
      {swaps > 0 && <span className="text-muted">+{swaps} situational</span>}
    </span>
  );
}

/** Round colored icon that says what an entry is without reading a label. */
export function KitIcon({ type, size = 22, className }: { type: KitType; size?: number; className?: string }) {
  const k = KIT[type];
  return (
    <span
      title={k.label}
      className={cx("inline-grid shrink-0 place-items-center rounded-full text-white", className)}
      style={{ width: size, height: size, background: k.color }}
    >
      {k.icon("size-[60%]")}
    </span>
  );
}

/** Section heading with the type's icon and color, plus a count. */
export function KitHeading({ type, count, aside }: { type: KitType; count?: number; aside?: ReactNode }) {
  const k = KIT[type];
  return (
    <h5
      className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-[0.06em] uppercase"
      style={{ color: k.color }}
    >
      <KitIcon type={type} size={20} />
      {k.plural}
      {count !== undefined && <span className="font-semibold text-muted normal-case">{count}</span>}
      {aside && (
        <span className="ml-auto font-sans text-[12px] font-normal tracking-normal text-muted normal-case">
          {aside}
        </span>
      )}
    </h5>
  );
}
