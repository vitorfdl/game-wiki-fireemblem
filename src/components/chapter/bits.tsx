import { type ReactNode, useEffect, useState } from "react";
import { Check, CheckCheck, CircleHelp, Hourglass, Info, Split, TriangleAlert, Users } from "lucide-react";
import type { Callout, Conf, Line } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { setDone, toggleDone, useTrack } from "../../lib/track.ts";
import { Rich } from "../ref/rich.tsx";
import { Hover } from "../ui/hover.tsx";
import { Sub } from "../ui/panel.tsx";
import { ConfText } from "../ui/conf-text.tsx";

/* Shared row pieces for chapters, the Ledger and the Units tab (redesign/10-visual-language.md). Rows put their
   checkbox in a fixed left gutter (V-5); colour only marks state (V-3). */

/** Checkbox bound to a tracked event id (redesign/09-tracking.md). */
export function Tick({ id, label }: { id: string; label: string }) {
  const done = Boolean(useTrack().done[id]);
  return (
    <button
      type="button"
      role="checkbox"
      data-tick-id={id}
      aria-checked={done}
      aria-label={label}
      title={label}
      onClick={() => toggleDone(id)}
      className={cx(
        "mt-[3px] grid size-[16px] shrink-0 place-items-center rounded-[4px] transition-colors",
        done ? "bg-(--c) text-white" : "shadow-[inset_0_0_0_1.5px_rgba(125,100,53,.55)] hover:bg-paper-2",
      )}
    >
      {done && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

/**
 * "Check all" for a section (D-89): reads the section's Tick ids from the DOM (no id lists to keep in sync), ticks
 * every open one, or clears them all when all are ticked. Hidden when the section has fewer than 2 boxes.
 */
export function CheckAll({ sectionId }: { sectionId: string }) {
  const t = useTrack();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const el = document.getElementById(sectionId);
    const found = [...(el?.querySelectorAll<HTMLElement>("[data-tick-id]") ?? [])].map((b) => b.dataset.tickId!);
    setIds((old) => (old.join() === found.join() ? old : found));
  });
  if (ids.length < 2) return null;
  const all = ids.every((id) => t.done[id]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        ids.forEach((id) => setDone(id, !all));
      }}
      title={all ? "Untick every box in this section" : "Tick every box in this section"}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold text-muted ring-1 ring-gold/40 hover:bg-paper-2 hover:text-ink"
    >
      <CheckCheck className="size-3.5" />
      {all ? "Clear all" : "Check all"}
    </button>
  );
}

export function useIsDone(id: string | undefined): boolean {
  const t = useTrack();
  return Boolean(id && t.done[id]);
}

/** A row with a fixed checkbox gutter: the box when tracked, empty space otherwise, so text always aligns. */
export function Row(
  { tick, children, className, done }: {
    tick?: { id: string; label: string };
    children: ReactNode;
    className?: string;
    done?: boolean;
  },
) {
  return (
    <div className={cx("grid grid-cols-[22px_minmax(0,1fr)] gap-x-1.5 py-[3px]", className)}>
      <span>{tick && <Tick id={tick.id} label={tick.label} />}</span>
      <div className={cx("min-w-0", done && "text-muted")}>{children}</div>
    </div>
  );
}

const CONF: Record<Conf, string> = {
  "?": "Not confirmed in the sources",
  community: "Community-reported",
  disputed: "Sources disagree: see Open questions",
};

export function ConfMark({ conf }: { conf?: Conf }) {
  if (!conf) return null;
  return (
    <span title={CONF[conf]} className="ml-1 inline-flex align-[-0.12em] text-faint">
      <CircleHelp className="size-[0.9em]" aria-label={CONF[conf]} />
    </span>
  );
}

/** Folded notes: closed until "more" is clicked. A quiet link, never a block. */
export function Detail({ items, k }: { items?: string[]; k: string }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  const shown = open;
  return (
    <>
      {!shown && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-1.5 inline-flex items-center text-[12.5px] font-semibold text-gold-lo hover:text-ink"
        >
          more
        </button>
      )}
      {shown && (
        <ul className="m-0 mt-0.5 list-none space-y-0.5 p-0 text-[13.5px] leading-snug text-ink-soft">
          {items.map((t, i) => (
            <li key={i}>
              <ConfText text={t} k={`${k}.${i}`} />
            </li>
          ))}
          {open && (
            <li>
              <button type="button" onClick={() => setOpen(false)} className="text-[12.5px] font-semibold text-gold-lo">
                less
              </button>
            </li>
          )}
        </ul>
      )}
    </>
  );
}

/** A small info mark whose hover card holds a note: for notes that would otherwise add a line. */
export function NoteMark({ text, k }: { text?: string; k: string }) {
  if (!text) return null;
  return (
    <Hover card={() => <p className="m-0 pr-5 text-[13.5px] leading-snug"><Rich text={text} k={k} /></p>} label="Note">
      <Info aria-hidden="true" className="ml-1 inline size-[0.95em] align-[-0.12em] text-faint hover:text-ink" />
    </Hover>
  );
}

/** One authored line in the gutter layout. */
export function LineRow({ line, k, stats }: { line: Line; k: string; stats?: boolean }) {
  const done = useIsDone(line.id);
  const tracked = Boolean(line.task && line.id);
  return (
    <Row tick={tracked ? { id: line.id!, label: line.text } : undefined} done={done}>
      <ConfText text={line.text} k={k} stats={stats} />
      <ConfMark conf={line.conf} />
      <Detail items={line.detail} k={`${k}.d`} />
    </Row>
  );
}

export function Lines({ lines, k, stats }: { lines?: Line[]; k: string; stats?: boolean }) {
  if (!lines?.length) return null;
  return <div>{lines.map((l, i) => <LineRow key={i} line={l} k={`${k}.${i}`} stats={stats} />)}</div>;
}

const CALLOUT: Record<Callout["type"], { label: string; icon: ReactNode; tone: string }> = {
  "timing-trap": { label: "Timing", icon: <Hourglass className="size-3.5" />, tone: "text-[#8a5a14]" },
  fork: { label: "Choose one", icon: <Split className="size-3.5" />, tone: "text-blood-2" },
  "multi-copy": { label: "Copies", icon: <Users className="size-3.5" />, tone: "text-(--c)" },
  "route-system": { label: "Route system", icon: <Users className="size-3.5" />, tone: "text-(--c)" },
  "special-map": { label: "Map trick", icon: <TriangleAlert className="size-3.5" />, tone: "text-blood-2" },
  "bench-plan": { label: "Bench plan", icon: <Users className="size-3.5" />, tone: "text-(--c)" },
};

/** A typed callout as one quiet line: icon and label in the type's colour, the text in ink. */
export function CalloutBox({ c, k }: { c: Callout; k: string }) {
  const t = CALLOUT[c.type];
  return (
    <div className="mt-1 text-[13.5px] leading-snug">
      <span className={cx("mr-1.5 inline-flex items-center gap-1 align-[-0.1em] font-semibold", t.tone)}>
        {t.icon}
        {t.label}
      </span>
      <ConfText text={c.text} k={k} />
      {c.bullets?.length ? <Detail items={c.bullets} k={`${k}.b`} /> : null}
    </div>
  );
}

/** A labelled block inside a slot: same look as the panel's Sub (V-13). */
export function SubHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <Sub aside={aside}>{children}</Sub>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 py-0.5 text-[13.5px] text-faint">{children}</p>;
}

/** Quiet outlined tag (V-3): for kinds like "if offered" or "side trip". */
export function Tag({ children, tone }: { children: ReactNode; tone?: "red" | "route" }) {
  return (
    <span
      className={cx(
        "inline-block rounded-[3px] px-1 align-[0.1em] text-[10.5px] leading-[1.5] font-semibold tracking-[0.04em] uppercase",
        tone === "red"
          ? "text-blood-2 shadow-[inset_0_0_0_1px_rgba(168,29,34,.45)]"
          : tone === "route"
          ? "text-(--c) shadow-[inset_0_0_0_1px_var(--c)]"
          : "text-muted shadow-[inset_0_0_0_1px_rgba(125,100,53,.35)]",
      )}
    >
      {children}
    </span>
  );
}
