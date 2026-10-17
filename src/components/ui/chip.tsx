import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";

type Tone = "plain" | "good" | "bad" | "got" | "accent";
const TONE: Record<Tone, string> = {
  plain: "border-gold/60",
  good: "border-gold-hi text-gold-hi",
  bad: "border-[rgba(230,130,120,.6)] text-[#f0b1a6]",
  got: "border-gold/45 bg-gold-hi/15",
  accent: "border-(--c) bg-[color-mix(in_srgb,var(--c)_14%,#fff)]",
};

export function Chip(
  { children, tone = "plain", className }: { children: ReactNode; tone?: Tone; className?: string },
) {
  return (
    <span
      className={cx(
        "inline-block whitespace-nowrap border px-2.5 py-0.5 text-[12.5px] leading-normal",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
