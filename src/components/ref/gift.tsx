import { Heart } from "lucide-react";
import { resolve } from "../../lib/refs.ts";
import { gift, type Tier } from "../../lib/gifts.ts";
import { cx } from "../../lib/cx.ts";
import { RefChip } from "./rich.tsx";

/** Loved = two filled hearts (about double Support), really liked = one. */
export function TierMark({ tier }: { tier: Tier }) {
  if (!tier) return null;
  return (
    <span
      title={tier === 2 ? "Loved: about double Support" : "Really liked"}
      className={cx("mr-1 inline-flex gap-px align-[-0.1em]", tier === 2 ? "text-[#c2415f]" : "text-[#c2415f]/55")}
    >
      {Array.from(
        { length: tier },
        (_, i) => <Heart key={i} aria-hidden="true" className="size-[0.8em] fill-current" />,
      )}
    </span>
  );
}

/**
 * A gift as a hover chip with its price: the card says where it is sold and who wants it.
 * `unsure`: the shop line is unconfirmed (shown as "?").
 */
export function GiftName(
  { name, tier = 0, price = true, unsure, className }: {
    name: string;
    tier?: Tier;
    price?: boolean;
    unsure?: boolean;
    className?: string;
  },
) {
  const r = resolve(name, "gift");
  const g = gift(name);
  return (
    <span className={cx("whitespace-nowrap", className)}>
      <TierMark tier={tier} />
      {r ? <RefChip r={r} bare /> : name}
      {unsure && <span className="text-muted" title="Not confirmed in this shop">?</span>}
      {price && g?.price && <span className="ml-1 text-[12.5px] text-muted tabular-nums">{g.price}G</span>}
    </span>
  );
}
