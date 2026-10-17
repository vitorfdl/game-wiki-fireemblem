import { type ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../../lib/cx.ts";

/** Long prose shows a few lines until opened. Short text renders as is. */
export function Clamp(
  { children, lines = 3, chars = 220, className }: {
    children: ReactNode;
    lines?: 2 | 3 | 4;
    /** Text length above which the clamp applies. */
    chars?: number;
    className?: string;
  },
) {
  const [open, setOpen] = useState(false);
  const len = typeof children === "string" ? children.length : chars + 1;
  if (len <= chars) return <div className={className}>{children}</div>;
  return (
    <div className={className}>
      <div className={cx(!open && (lines === 2 ? "line-clamp-2" : lines === 3 ? "line-clamp-3" : "line-clamp-4"))}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-1 inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-(--c) hover:underline"
      >
        {open ? "less" : "more"}
        <ChevronDown aria-hidden="true" className={cx("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}

/** "3S 6R" -> "Support 3 · Renown 6", keeping each pair on one line. */
export function requirementText(v: string): string {
  const m = v.match(/^(\d)S\s+(\d+)R(.*)$/);
  const out = m ? `Support ${m[1]} · Renown ${m[2]}${m[3]}` : v;
  return out.replace(/(Support|Renown|Part) (\d+|II+)/g, "$1 $2");
}

/** Drops repo file names and script names from source lists; readers only need the outside sources. */
export function publicSources(list: string[] | undefined): string[] {
  return (list ?? []).filter((s) =>
    !/\.(md|py|json)\b|^work\/|PATHS-BRIEF/i.test(s) && !/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s.trim())
  );
}
