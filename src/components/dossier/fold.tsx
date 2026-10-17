import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../../lib/cx.ts";
import { Rich } from "../ref/rich.tsx";

const CLAMP = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" } as const;

/** Authored text clamped to one to four lines, with a "more" toggle only when the text is long enough to need it. */
export function ClampText(
  { text, lines = 2, chars = 150, k, className, quiet }: {
    text: string;
    /** Names shown without a portrait (the page's own unit). */
    quiet?: string[];
    lines?: 1 | 2 | 3 | 4;
    chars?: number;
    k: string;
    className?: string;
  },
) {
  const [open, setOpen] = useState(false);
  const long = text.length > chars;
  return (
    <span className={cx("block", className)}>
      <span className={cx(long && !open ? CLAMP[lines] : "block")}>
        <Rich text={text} k={k} quiet={quiet} />
      </span>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-gold-lo hover:text-ink"
        >
          {open ? "less" : "more"}
          <ChevronDown aria-hidden="true" className={cx("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </span>
  );
}

/** A small "N more" toggle that reveals the rest of a list or a block. */
export function MoreFold(
  { label, children, className, defaultOpen = false }: {
    label: string;
    children: ReactNode;
    className?: string;
    defaultOpen?: boolean;
  },
) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-gold-lo hover:text-ink"
      >
        <ChevronDown aria-hidden="true" className={cx("size-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Show less" : label}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

/** Small uppercase label above a block inside a card. */
export function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <h3 className="mb-1.5 flex items-baseline justify-between gap-2 font-sans text-[11px] font-bold tracking-[0.1em] text-gold-lo uppercase">
      <span>{children}</span>
      {aside && <span className="text-[11.5px] font-semibold tracking-normal text-muted normal-case">{aside}</span>}
    </h3>
  );
}

/** Plain chip for a number, gate or class. */
export function Chip({ children, tone = "plain", title }: {
  children: ReactNode;
  tone?: "plain" | "route" | "warn" | "dark";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center rounded-[3px] px-1.5 py-px text-[12.5px] leading-snug font-semibold whitespace-nowrap",
        tone === "plain" && "bg-card text-ink shadow-[inset_0_0_0_1px_rgba(176,144,90,.7)]",
        tone === "route" && "bg-[color-mix(in_srgb,var(--c)_14%,#fff)] text-ink shadow-[inset_0_0_0_1px_var(--c)]",
        tone === "warn" && "bg-warn text-warn-ink shadow-[inset_0_0_0_1px_#d2a595]",
        tone === "dark" && "bg-teal text-gold-hi",
      )}
    >
      {children}
    </span>
  );
}

/**
 * A block of mixed content (several paragraphs, icons) clamped to a number of lines, with one "more" toggle that
 * shows only when the content overflows.
 */
export function ClampBox({ lines = 3, children, className }: { lines?: number; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && !open) setOver(el.scrollHeight > el.clientHeight + 2);
  }, [open, children]);
  return (
    <div className={className}>
      <div ref={box} className="overflow-hidden" style={open ? undefined : { maxHeight: `${lines * 1.375}em` }}>
        {children}
      </div>
      {(over || open) && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-gold-lo hover:text-ink"
        >
          {open ? "less" : "more"}
          <ChevronDown aria-hidden="true" className={cx("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
