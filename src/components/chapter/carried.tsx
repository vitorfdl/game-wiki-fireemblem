import type { ReactNode } from "react";
import { ArrowRight, Hourglass } from "lucide-react";
import { routeSlug } from "../../lib/data.ts";
import { cx } from "../../lib/cx.ts";
import { href } from "../../lib/router.ts";
import { resolve } from "../../lib/refs.ts";
import { quest, recruitGate } from "../../lib/chapter.ts";
import { type Carried, carriedInto, type Task, type TaskKind, waitingOn } from "../../lib/open-tasks.ts";
import { useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { RefChip, UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { ClassChip } from "../ui/class-chip.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { ItemMini } from "../ui/item-mini.tsx";
import { Gate } from "../walkthrough/inline.tsx";
import { Row, SubHead, Tag } from "./bits.tsx";

/*
 * Carry-forward rows (D-139): tasks planned in an earlier chapter and still open show at the top of their slot in
 * every later chapter, compact, with a Ch N tag that links back to the full card. A task waiting on another one is a
 * draft: dashed, no checkbox, and a "waits for" line.
 */

/** Carried tasks of the given kinds for a chapter; re-reads on every tick. */
export function useCarried(route: RouteName, ch: number, kinds: TaskKind[]): Carried[] {
  const t = useTrack();
  return carriedInto(route, ch, t.done, t.forks).filter((x) => kinds.includes(x.task.kind));
}

/** Open tasks a task waits for, live. */
export function useWaits(route: RouteName, task: Task | undefined): Task[] {
  const t = useTrack();
  return task ? waitingOn(route, task, t.done) : [];
}

/** What a task is, as a short phrase with chips: "Lysander → Dragoon", "recruiting Loretta". */
function Target({ t }: { t: Task }) {
  if (t.kind === "exam") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <UnitRef name={t.unit} avatar={false} /> <ClassChip name={t.to} />
      </span>
    );
  }
  if (t.kind === "recruit") {
    return (
      <>
        recruiting <UnitRef name={t.unit} avatar={false} />
      </>
    );
  }
  return <span>{t.id}</span>;
}

/** "Waits for: Lysander → Dragoon". One line under a draft. */
export function WaitsFor({ waits }: { waits: Task[] }) {
  if (!waits.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[12.5px] text-muted">
      <Hourglass aria-hidden="true" className="size-3.5 text-faint" />
      <span className="font-semibold tracking-[0.04em] text-gold-lo uppercase text-[10.5px]">Waits for</span>
      {waits.map((w, i) => (
        <span key={w.id} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-faint">·</span>}
          <Target t={w} />
        </span>
      ))}
    </span>
  );
}

/** The amber "Ch 5" tag on a carried row: links to that chapter's full card. */
function From({ route, ch, missed }: { route: RouteName; ch: number; missed?: boolean }) {
  return (
    <a
      href={href(routeSlug(route), "ch", String(ch))}
      title={`Planned in Chapter ${ch}: open the full card`}
      className={cx(
        "inline-flex shrink-0 items-center gap-0.5 rounded-[3px] px-1.5 text-[11px] leading-[1.6] font-semibold whitespace-nowrap tabular-nums",
        missed ? "bg-blood/12 text-blood-2" : "bg-[#c98a1b]/15 text-[#8a5a14] hover:bg-[#c98a1b]/25",
      )}
    >
      Ch {ch}
      <ArrowRight aria-hidden="true" className="size-3" />
    </a>
  );
}

const GATED = (route: RouteName, unit: string) => {
  const g = recruitGate(route, unit);
  if (!g || g.how !== "recruit") return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {g.support !== undefined && g.support > 1 && <Gate kind="S" n={g.support} />}
      {g.renown !== undefined && <Gate kind="R" n={g.renown} />}
    </span>
  );
};

function Body({ route, t }: { route: RouteName; t: Task }): ReactNode {
  switch (t.kind) {
    case "exam":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <UnitPortrait name={t.unit} size={22} flat />
          <UnitRef name={t.unit} avatar={false} />
          {t.from && (
            <>
              <ClassChip name={t.from} muted />
              <ArrowRight aria-hidden="true" className="size-3.5 text-faint" />
            </>
          )}
          <ClassChip name={t.to} />
        </span>
      );
    case "recruit":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <UnitPortrait name={t.unit} size={22} flat />
          <UnitRef name={t.unit} avatar={false} />
          {GATED(route, t.unit)}
          {t.when && <span className="text-[13px] text-muted">· {t.when}</span>}
        </span>
      );
    case "kit":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <UnitPortrait name={t.unit} size={22} flat />
          <UnitRef name={t.unit} avatar={false} />
          <ItemMini item={t.item} kind={t.gear} />
        </span>
      );
    case "unique": {
      const r = resolve(t.item, "item");
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {r ? <RefChip r={r} /> : t.item} <span className="text-faint">→</span> <UnitRef name={t.unit} />
        </span>
      );
    }
    case "quest": {
      const r = resolve(t.quest, "quest");
      return (
        <span>
          {r ? <RefChip r={r} /> : quest(t.quest)?.name ?? t.quest}
          {t.due && <span className="ml-1.5 text-[13px] text-muted tabular-nums">due {t.due}</span>}
        </span>
      );
    }
    case "missable":
      return (
        <span>
          {t.m.kind === "choice" && <span className="font-semibold">Choose:</span>}
          <ConfText text={t.m.text} k={`cm${t.id}`} />
          {t.due && <span className="ml-1.5 text-[13px] text-muted tabular-nums">by {t.due}</span>}
        </span>
      );
    case "dungeon":
      return <ConfText text={t.text} k={`cd${t.id}`} />;
  }
}

const LABEL: Record<TaskKind, string> = {
  exam: "exam",
  recruit: "recruit",
  kit: "gear",
  unique: "give-out",
  quest: "quest",
  missable: "missable",
  dungeon: "dungeon",
};

/** One carried task: checkbox (none for drafts and choices), the task, the Ch tag, "missed?" or "waits for". */
export function CarriedRow({ route, c }: { route: RouteName; c: Carried }) {
  const t = c.task;
  const choice = t.kind === "missable" && t.m.kind === "choice";
  const tick = c.draft || choice ? undefined : { id: t.id, label: `${LABEL[t.kind]} from Chapter ${t.start} done` };
  return (
    <Row
      tick={tick}
      className={cx(c.draft && "rounded-[4px] border border-dashed border-gold/50 pr-2", c.missed && "text-blood-2")}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <From route={route} ch={t.start} missed={c.missed} />
        {c.missed && <Tag tone="red">missed?</Tag>}
        <Body route={route} t={t} />
      </div>
      {c.draft && <WaitsFor waits={c.waits} />}
    </Row>
  );
}

/**
 * "From earlier" block at the top of a slot. Renders nothing when no carried task matches, so a slot only grows when
 * something is still open.
 */
export function CarriedGroup({ route, items }: { route: RouteName; items: Carried[] }) {
  if (!items.length) return null;
  const missed = items.filter((x) => x.missed).length;
  return (
    <div className="mb-2 rounded-md bg-[#c98a1b]/[.06] px-2 pb-1 shadow-[inset_3px_0_0_#c98a1b]">
      <SubHead
        aside={missed ? <span className="text-[12px] font-semibold text-blood-2">{missed} missed?</span> : undefined}
      >
        From earlier · {items.length}
      </SubHead>
      {[...items].sort((a, b) => Number(b.missed) - Number(a.missed) || a.task.start - b.task.start).map((x) => (
        <CarriedRow key={x.task.id} route={route} c={x} />
      ))}
    </div>
  );
}
