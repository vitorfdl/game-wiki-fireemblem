import { type ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../../lib/cx.ts";

/*
 * Sections are visible (redesign/10-visual-language.md V-13): every section of a page is a Panel, a card with a
 * titled header. Quiet styling applies inside a panel; the boundary between sections stays obvious.
 */

type PanelProps = {
  id?: string;
  /** Slot number, shown before the title (chapters). */
  n?: number;
  icon?: ReactNode;
  title: ReactNode;
  /** One muted line next to the title. */
  sub?: ReactNode;
  aside?: ReactNode;
  /** "alert" colours the icon and title red (missables with something in them). */
  tone?: "alert";
  /** A section with nothing in it: header only, muted, with this line in place of the body. */
  empty?: ReactNode;
  /** Collapsible body. `open` is the starting state. */
  fold?: { open: boolean };
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

export function Panel(
  { id, n, icon, title, sub, aside, tone, empty, fold, className, bodyClassName, children }: PanelProps,
) {
  const [open, setOpen] = useState(fold?.open ?? true);
  const shown = !empty && (!fold || open);
  const alert = tone === "alert" && !empty;
  return (
    <section
      id={id}
      data-empty={empty ? "" : undefined}
      className={cx(
        "scroll-mt-28 overflow-hidden rounded-lg lg:scroll-mt-20",
        empty
          ? "bg-paper-2/60 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]"
          : "bg-card shadow-[inset_0_0_0_1px_rgba(176,144,90,.45),0_1px_3px_-1px_rgba(60,40,10,.12)]",
        className,
      )}
    >
      <header
        className={cx(
          "flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4",
          empty ? "py-2" : "py-2.5",
          shown && "border-b border-gold/25",
        )}
      >
        {icon && (
          <span
            aria-hidden="true"
            className={cx(
              "grid size-7 shrink-0 place-items-center rounded-md [&>svg]:size-4",
              empty ? "bg-paper-3/60 text-faint" : alert ? "bg-blood-2/10 text-blood-2" : "bg-(--c)/12 text-(--c)",
            )}
          >
            {icon}
          </span>
        )}
        <h2
          className={cx(
            "m-0 flex items-baseline gap-1.5 font-display text-[17.5px] leading-tight",
            empty ? "text-muted" : alert ? "text-blood-2" : "text-ink",
          )}
        >
          {n !== undefined && <span className="font-sans text-[12px] font-semibold text-faint tabular-nums">{n}</span>}
          {title}
        </h2>
        {empty
          ? <span className="min-w-0 flex-1 text-[13.5px] text-muted">{empty}</span>
          : (
            <>
              {sub && <span className="min-w-0 text-[13px] text-muted">{sub}</span>}
              <span className="flex-1" />
              {aside}
              {fold && (
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  aria-expanded={open}
                  className="flex items-center gap-0.5 text-[12.5px] font-semibold text-gold-lo hover:text-ink"
                >
                  {open ? "Hide" : "Show"}
                  <ChevronDown className={cx("size-3.5 transition-transform", open && "rotate-180")} />
                </button>
              )}
            </>
          )}
      </header>
      {shown && <div className={cx("px-4 py-3", bodyClassName)}>{children}</div>}
    </section>
  );
}

/** A labelled block inside a panel: small icon, title, a hairline to the right. */
export function Sub({ icon, children, aside, className }: {
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mt-4 mb-1.5 flex items-center gap-2 first:mt-0", className)}>
      {icon && <span aria-hidden="true" className="text-gold-lo [&>svg]:size-3.5">{icon}</span>}
      <h3 className="m-0 text-[12px] font-semibold tracking-[0.08em] whitespace-nowrap text-gold-lo uppercase">{children}</h3>
      <span className="h-px flex-1 bg-gold/25" />
      {aside}
    </div>
  );
}

/** A tinted inner card for side-by-side blocks inside a panel (build page stage columns). */
export function Tile({ title, aside, icon, children, className }: {
  title: ReactNode;
  aside?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0 rounded-md bg-paper/70 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]", className)}>
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon && <span aria-hidden="true" className="text-(--c) [&>svg]:size-3.5">{icon}</span>}
        <h3 className="m-0 shrink-0 text-[12px] font-semibold tracking-[0.08em] text-ink-soft uppercase">{title}</h3>
        <span className="flex-1" />
        {aside && <span className="min-w-0 truncate text-[12px] text-muted tabular-nums">{aside}</span>}
      </div>
      {children}
    </div>
  );
}
