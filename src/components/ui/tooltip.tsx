import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";

/** Hover or keyboard-focus tip. The trigger is focusable so touch and keyboard users can open it too. */
export function Tip(
  { tip, children, className, align = "center" }: {
    tip: ReactNode;
    children: ReactNode;
    className?: string;
    /** "start" pins the tip to the trigger's left edge, for triggers that sit against a container edge. */
    align?: "center" | "start";
  },
) {
  return (
    <span tabIndex={0} className={cx("group/tip relative inline-flex cursor-help outline-none", className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none invisible absolute top-full z-50 mt-2 w-max max-w-[260px] rounded-md bg-ink px-3 py-2 text-left text-[12.5px] leading-snug font-normal tracking-normal text-parchment normal-case opacity-0 shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] transition-opacity group-hover/tip:visible group-hover/tip:opacity-100 group-focus/tip:visible group-focus/tip:opacity-100",
          align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
        )}
      >
        {tip}
      </span>
    </span>
  );
}

export const TIER_SCALE = "S is the best, then A, B and C; D is the weakest.";
