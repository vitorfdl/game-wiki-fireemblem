import { GetLine } from "../ref/get-line.tsx";
import { ArrowRight } from "lucide-react";
import { itemTier } from "../../lib/growth.ts";
import type { Gear, StageKind } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { TierGem } from "../ui/tier-gem.tsx";
import { KitIcon, SITUATIONAL_BG, SituationalTag } from "../ui/kit-type.tsx";
import type { KitKind } from "../../lib/inventory.ts";
import { TIER_SCALE, Tip } from "../ui/tooltip.tsx";

const KIND: Record<StageKind, { label: string; cls: string; hint: string }> = {
  core: { label: "Main", cls: "bg-(--c) text-white", hint: "Main class line" },
  detour: {
    label: "Side trip",
    cls: "bg-card text-(--c) shadow-[inset_0_0_0_1.5px_var(--c)]",
    hint: "Side class for a mastery or rank, then back",
  },
  fix: {
    label: "Stat fix",
    cls: "bg-card text-(--c) shadow-[inset_0_0_0_1.5px_var(--c)]",
    hint: "Grows a missing stat",
  },
  bench: { label: "Bench", cls: "bg-muted text-white", hint: "Not deployed in Part I: train ranks in the Arena" },
};

export function KindPill({ kind, className }: { kind?: StageKind; className?: string }) {
  const k = KIND[kind ?? "core"];
  return (
    <span
      title={k.hint}
      className={cx(
        "inline-block rounded-[3px] px-1.5 text-[10.5px] leading-[1.6] font-bold tracking-[0.08em] uppercase",
        k.cls,
        className,
      )}
    >
      {k.label}
    </span>
  );
}

/** Weapon or accessory row: tier gem, name, an upgrade arrow when it replaces an older copy, and where to get it. */
export function GearRow(
  { g, change, kind = "Weapon", showWhere = true }: {
    g: Gear;
    change?: string;
    kind?: KitKind;
    showWhere?: boolean;
  },
) {
  const tier = kind === "Weapon" ? itemTier(g.item) : "";
  return (
    <li
      className={cx("flex items-start gap-2 py-1", g.situational && "-mx-1.5 my-0.5 rounded px-1.5")}
      style={g.situational ? { background: SITUATIONAL_BG } : undefined}
    >
      <span className="mt-[2px] w-[20px] shrink-0">
        {tier
          ? (
            <Tip
              align="start"
              tip={
                <>
                  <b>Weapon tier {tier}</b> from the community weapon tier list. {TIER_SCALE}
                </>
              }
            >
              <TierGem tier={tier} size={20} title="" />
            </Tip>
          )
          : <KitIcon type={kind === "Weapon" ? "weapon" : kind === "Item" ? "item" : "equipment"} size={20} />}
      </span>
      <span className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">{g.item}</span>
        {g.slot && (
          <span className="ml-1.5 text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">{g.slot}</span>
        )}
        {g.situational && (
          <span className="ml-1.5">
            <SituationalTag />
          </span>
        )}
        {change === "upgraded" && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold tracking-[0.06em] text-(--c) uppercase">
            <ArrowRight aria-hidden="true" className="size-3" />upgrade
          </span>
        )}
        {g.situational && <span className="block text-[13px] font-semibold text-[#8a3a22]">{g.situational}</span>}
        {g.why && <span className="block text-[13px] text-ink-soft">{g.why}</span>}
        {g.alts?.length
          ? (
            <span className="block text-[12.5px] text-ink-soft">
              <b className="label mr-1 text-gold-lo">Don't have it?</b>
              {g.alts.join(", then ")}
            </span>
          )
          : null}
        {showWhere && <GetLine item={g.item} plan={g.plan ?? g.where} className="text-[13px]" />}
      </span>
    </li>
  );
}
