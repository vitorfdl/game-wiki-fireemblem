import { posLabel } from "../../lib/parts.ts";
import { type KeyboardEvent, useRef } from "react";
import { Check, GitMerge } from "lucide-react";
import type { RouteName, Stage } from "../../lib/types.ts";
import { stripParens } from "../../lib/growth.ts";
import { CLASSES } from "../../lib/data.ts";
import { cx } from "../../lib/cx.ts";
import { levelLabel, partOf, rangeLabel } from "./variants.ts";

export type JourneyStage = { stage: Stage; cls: string; start: number | null };

type Props = {
  route: RouteName | null;
  stages: JourneyStage[];
  selected: number;
  onSelect: (i: number) => void;
  /** Stage the plan puts the unit in at the current chapter. */
  plan?: number;
  /** Last stage whose "class reached" event is ticked. */
  you?: number;
  now?: number;
  copy: boolean;
};

const PART = ["", "I", "II", "III"];

/** Class tier as a letter and a fill. Unknown classes ("starting class") get a question mark. */
const TIER: Record<string, { l: string; cls: string }> = {
  Base: { l: "0", cls: "bg-[#a99c7e] text-white" },
  Beginner: { l: "B", cls: "bg-[#8a7a55] text-white" },
  Specialty: { l: "S", cls: "bg-teal-3 text-gold-hi" },
  Advanced: { l: "A", cls: "bg-[#3b5b7a] text-white" },
  Master: { l: "M", cls: "bg-[linear-gradient(135deg,#8e7442,#e0c689)] text-[#2a1d07]" },
  Divine: { l: "D", cls: "bg-[linear-gradient(135deg,#5a3a8a,#b08ad8)] text-white" },
};

export function TierBadge({ cls, side, size = 26 }: { cls: string; side?: boolean; size?: number }) {
  const tier = CLASSES[cls]?.tier;
  const t = tier ? TIER[tier] : undefined;
  return (
    <span
      title={tier ? `${tier} class` : "Class tier unknown"}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      className={cx(
        "relative z-[1] inline-grid shrink-0 place-items-center rounded-full font-logo leading-none font-bold",
        side
          ? "bg-card text-(--c) outline-[1.5px] -outline-offset-[1.5px] outline-(--c) outline-dashed"
          : t
          ? cx(t.cls, "shadow-[0_0_0_2px_var(--color-card)]")
          : "bg-paper-2 text-muted shadow-[0_0_0_2px_var(--color-card)]",
      )}
    >
      {t?.l ?? "?"}
    </span>
  );
}

/** Part I range for the part header: first chapter of the part's stages to Ch 12. */
function partRange(stages: JourneyStage[], part: number): string {
  if (part !== 1) return "";
  const first = stages.find((s) => partOf(s.stage) === 1)?.stage.from?.ch;
  return first ? ` · Ch ${first}–12` : "";
}

/**
 * The build as a vertical stepper (master list of the Journey panel): part labels, one node per stage on a line
 * (solid up to where the plan is now, dotted ahead), tier badge, class, chapter and level span, Now / reached / side
 * trip tags. The selected node is a raised card that points at the stage detail. ↑/↓ move the selection.
 */
export function Journey({ stages, selected, onSelect, plan, you, now, copy }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const passed = Math.max(plan ?? -1, you ?? -1);
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = Math.min(stages.length - 1, Math.max(0, selected + d));
    onSelect(n);
    refs.current[n]?.focus();
  };
  return (
    <nav aria-label="Class journey">
      <ol role="tablist" aria-orientation="vertical" onKeyDown={onKey} className="m-0 list-none p-0">
        {stages.map(({ stage: st, cls }, i) => {
          const on = i === selected;
          const part = partOf(st);
          const newPart = i === 0 || partOf(stages[i - 1].stage) !== part;
          const side = st.kind === "detour" || st.kind === "fix";
          const reached = you !== undefined && i <= you;
          const isNow = i === plan;
          const isYou = i === you && you !== plan;
          const lvl = levelLabel(st);
          const name = cls || stripParens(st.class) || (i === 0 ? "Before the class tutorial" : "No class yet");
          const inLine = i > 0 ? (i <= passed ? "solid" : "dotted") : null;
          const outLine = i < stages.length - 1 ? (i + 1 <= passed ? "solid" : "dotted") : null;
          return (
            <li key={i} className="relative">
              {newPart && (
                <div className="relative flex items-center gap-2 py-1 pl-[11px]">
                  {i > 0 && <Rail kind={inLine} className="top-0 bottom-0" />}
                  <span
                    className={cx(
                      "relative z-[1] -ml-[3px] rounded-full bg-teal px-2 py-[3px] font-logo text-[10px] font-bold tracking-[0.12em] text-gold-hi uppercase",
                      i > 0 && "mt-1",
                    )}
                  >
                    {PART[part] ? `Part ${PART[part]}` : "Plan"}
                    <span className="font-semibold text-gold-hi/70 normal-case tracking-normal">
                      {partRange(stages, part)}
                    </span>
                  </span>
                </div>
              )}
              <button
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="stage"
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect(i)}
                title={[st.when, st.level].filter(Boolean).join(" · ")}
                className={cx(
                  "group relative grid w-full grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 rounded-lg py-1.5 pr-2 pl-[11px] text-left transition",
                  on
                    ? "bg-card shadow-[inset_0_0_0_1.5px_var(--c),0_8px_18px_-10px_rgba(16,38,42,.45)]"
                    : "hover:bg-card/70",
                )}
              >
                {inLine && <Rail kind={inLine} className="top-0 h-1/2" />}
                {outLine && <Rail kind={outLine} className="top-1/2 bottom-0" />}
                <TierBadge cls={cls} side={side} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <b
                      className={cx(
                        "min-w-0 text-[15px] leading-tight",
                        on ? "text-ink" : "text-ink-soft group-hover:text-ink",
                      )}
                    >
                      {name}
                    </b>
                    {reached && <Check aria-label="Reached" className="size-3.5 shrink-0 text-(--c)" strokeWidth={3} />}
                    {copy && part === 3 && <GitMerge aria-label="Merge" className="size-3.5 shrink-0 text-muted" />}
                    <span className="flex-1" />
                    {isYou && (
                      <span
                        title="Furthest stage you ticked as reached"
                        className="shrink-0 rounded-full bg-ink px-1.5 py-[2px] text-[9.5px] leading-none font-bold tracking-[0.1em] text-gold-hi uppercase"
                      >
                        You
                      </span>
                    )}
                    {isNow && (
                      <span
                        title={now ? `The plan puts the unit here at ${posLabel(now)}` : undefined}
                        className="shrink-0 rounded-full bg-(--c) px-1.5 py-[2px] text-[9.5px] leading-none font-bold tracking-[0.1em] text-white uppercase"
                      >
                        Now
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-tight text-muted tabular-nums">
                    <span className={cx(on && "font-semibold text-ink-soft")}>{rangeLabel(st)}</span>
                    {lvl && <span>· {lvl}</span>}
                    {side && (
                      <span className="rounded-[3px] px-1 text-[9.5px] leading-[1.5] font-bold tracking-[0.08em] text-(--c) uppercase shadow-[inset_0_0_0_1px_var(--c)]">
                        {st.kind === "fix" ? "Stat fix" : "Side trip"}
                      </span>
                    )}
                    {st.kind === "bench" && (
                      <span className="rounded-[3px] bg-muted px-1 text-[9.5px] leading-[1.5] font-bold tracking-[0.08em] text-white uppercase">
                        Bench
                      </span>
                    )}
                  </span>
                </span>
                {on && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -right-[7px] hidden size-3 -translate-y-1/2 rotate-45 bg-card shadow-[1.5px_-1.5px_0_0_var(--c)] lg:block"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Connector segment in the badge column: solid route colour where the plan has passed, dotted gold ahead. */
function Rail({ kind, className }: { kind: "solid" | "dotted" | null; className?: string }) {
  if (!kind) return null;
  return (
    <span
      aria-hidden="true"
      className={cx(
        "absolute left-[23px] w-0 border-l-2",
        kind === "solid" ? "border-(--c)" : "border-dotted border-gold/60",
        className,
      )}
    />
  );
}
