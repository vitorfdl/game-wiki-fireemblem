import { cx } from "../../lib/cx.ts";

const FILL: Record<string, string> = {
  S: "bg-[linear-gradient(135deg,#8e7442,#e0c689)] text-[#2a1d07]",
  A: "bg-teal-3 text-[#fff8e4]",
  B: "bg-[#6f7c78] text-[#fff8e4]",
  C: "bg-[#a99c7e] text-[#fff8e4]",
  D: "bg-blood-2 text-[#fff8e4]",
};

/** Diamond badge for a letter tier (weapons and published unit ratings). */
export function TierGem({ tier, size = 22, title }: { tier: string; size?: number; title?: string }) {
  return (
    <i
      title={title ?? `Tier ${tier}`}
      className={cx("inline-grid shrink-0 place-items-center font-logo font-bold not-italic", FILL[tier] ?? FILL.C)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.62,
        clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)",
      }}
    >
      {tier}
    </i>
  );
}
