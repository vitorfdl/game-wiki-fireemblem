import { type ReactNode, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cx } from "../../lib/cx.ts";

/* Shared Field Kit pieces: a collapsible note and the sticky search box. */

export function Fold({ title, children, open: start = false }: { title: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(start);
  return (
    <div className="mt-4 rounded-md bg-paper/70 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-semibold"
      >
        {title}
        <ChevronDown
          aria-hidden="true"
          className={cx("ml-auto size-4 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-3 pb-3 text-[14px] [&>*:first-child]:mt-0">{children}</div>}
    </div>
  );
}

/** Sticky search. `prominent`: a framed, larger field for tabs where search is the main way in (Gifts). */
export function SearchBox(
  { value, onChange, placeholder, prominent }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    prominent?: boolean;
  },
) {
  return (
    <label
      className={cx(
        "sticky top-0 z-[2] -mx-4 mb-3 flex items-center gap-2 bg-card px-4 py-2 shadow-[0_1px_0_rgba(176,144,90,.4)]",
        prominent && "py-3",
      )}
    >
      <span
        className={cx(
          "flex w-full items-center gap-2",
          prominent &&
            "rounded-lg border-2 border-gold/70 bg-paper px-3 py-2 shadow-[0_2px_6px_rgba(90,60,20,.12)] focus-within:border-(--c)",
        )}
      >
        <Search aria-hidden="true" className={cx("text-muted", prominent ? "size-5 text-gold-lo" : "size-4")} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cx(
            "w-full bg-transparent outline-none placeholder:text-muted",
            prominent ? "text-[16.5px] font-medium" : "text-[15px]",
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear"
            className="text-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </span>
    </label>
  );
}
