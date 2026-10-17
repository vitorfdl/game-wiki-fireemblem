import { useContext } from "react";
import { MapPin } from "lucide-react";
import { itemRef } from "../../lib/refs.ts";
import { sourcesLine } from "../../lib/sources.ts";
import { RouteCtx } from "./ctx.ts";
import { WalkCtx } from "../walkthrough/ctx.ts";
import { Rich } from "./rich.tsx";
import { cx } from "../../lib/cx.ts";

/**
 * Where to get an item, derived from the item catalog (D-110), plus the build's own plan note (which copy, who hands
 * it over, refine timing). Builds and walkthrough rows never restate shops, barters or chests: this line owns that.
 */
export function GetLine(
  { item, plan, part, className, max = 3 }: {
    item: string;
    /** Plan-only note from the build ("Second barter; Seteth wears the first"). */
    plan?: string;
    /** Stage Part: 1 and 2 hide Part III chests. */
    part?: 1 | 2 | 3;
    className?: string;
    max?: number;
  },
) {
  const walk = useContext(WalkCtx);
  const page = useContext(RouteCtx);
  const route = walk?.route ?? page;
  const known = Boolean(itemRef(item.replace(/\s+\+\d+$/, "")));
  const line = known ? sourcesLine(item, { route, part: part === 3 ? 3 : part ? 1 : undefined, max }) : "";
  if (!known && !plan) return null;
  return (
    <span className={cx("mt-0.5 flex items-start gap-1 text-[12px] text-muted", className)}>
      <MapPin aria-hidden="true" className="mt-[2px] size-3 shrink-0 text-gold-lo" />
      <span className="min-w-0">
        {plan && (
          <span className="text-ink-soft">
            <Rich text={plan} k={`gp-${item}`} />
          </span>
        )}
        {plan && line && <span>·</span>}
        {line ? <Rich text={line} k={`gl-${item}`} /> : known && !plan ? "No known source" : null}
      </span>
    </span>
  );
}
