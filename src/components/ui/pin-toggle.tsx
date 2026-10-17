import { type ReactNode, useContext, useMemo } from "react";
import { Pin as PinIcon, PinOff } from "lucide-react";
import { cx } from "../../lib/cx.ts";
import {
  addPin,
  findPin,
  fromKey,
  fromLabel,
  type PinFrom,
  PinFromCtx,
  type PinKind,
  removeWhy,
  resolveFrom,
} from "../../lib/pins.ts";
import { getPins, useTrack } from "../../lib/track.ts";
import { useScope } from "../ref/ctx.ts";

/**
 * Marks where pins made inside it come from (D-108): a build stage, a chapter slot, a unit's row, a map place.
 * Nested scopes add to the outer one.
 */
export function PinScope({ from, children }: { from: PinFrom; children: ReactNode }) {
  const parent = useContext(PinFromCtx);
  const sig = JSON.stringify(from);
  const value = useMemo(() => ({ ...parent, ...from }), [parent, sig]);
  return <PinFromCtx.Provider value={value}>{children}</PinFromCtx.Provider>;
}

/** The origin a pin made here would record: nearest scope, plus the page's route and chapter. */
export function usePinFrom(extra?: PinFrom): PinFrom {
  const ctx = useContext(PinFromCtx);
  const scope = useScope();
  return resolveFrom({ ...ctx, ...extra }, scope);
}

/**
 * Pin button. `corner`: a pill in a hover card's top-right corner (cards can be taller than the screen); `card`: a
 * full row ("Pin for Theodora"); `icon`: a small round button for item cards. `from` must already be resolved (hover cards render outside the page's providers).
 */
export function PinToggle(
  { kind, name, from, variant = "card", className }: {
    kind: PinKind;
    name: string;
    from: PinFrom;
    variant?: "card" | "icon" | "corner";
    className?: string;
  },
) {
  useTrack();
  const pin = findPin(getPins(), kind, name);
  const k = fromKey(from);
  const mine = Boolean(pin && !pin.done && pin.why.some((w) => fromKey(w) === k));
  const others = pin && !pin.done ? pin.why.filter((w) => fromKey(w) !== k) : [];
  const label = fromLabel(from);
  const toggle = () => (mine ? removeWhy(kind, name, from) : addPin(kind, name, from));
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-pressed={mine}
        title={mine ? `Pinned for ${label}: click to unpin` : `Pin ${name} for ${label} (Pins tab, P)`}
        className={cx(
          "grid size-6 shrink-0 place-items-center rounded-full transition-colors",
          mine
            ? "bg-(--c) text-white shadow-[0_2px_6px_-2px_rgba(0,0,0,.5)]"
            : pin && !pin.done
            ? "bg-paper-2 text-(--c) hover:bg-paper-3"
            : "text-faint hover:bg-paper-2 hover:text-ink",
          className,
        )}
      >
        <PinIcon aria-hidden="true" className={cx("size-3.5", mine && "fill-current")} />
      </button>
    );
  }
  if (variant === "corner") {
    const more = others.length ? ` · also pinned for ${others.map(fromLabel).join(", ")}` : "";
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={mine}
        title={(mine ? `Pinned for ${label}: click to unpin` : `Pin to the sidebar for ${label}`) + more}
        className={cx(
          "absolute top-[10px] right-9 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[12px] font-semibold",
          mine
            ? "bg-(--c) text-white hover:opacity-90"
            : "bg-paper-2 text-ink-soft shadow-[inset_0_0_0_1px_rgba(176,144,90,.55)] hover:bg-paper-3 hover:text-ink",
          className,
        )}
      >
        <PinIcon aria-hidden="true" className={cx("size-3", mine && "fill-current")} />
        {mine ? "Pinned" : others.length ? "Also pin" : "Pin"}
      </button>
    );
  }
  return (
    <div className={cx("mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gold/25 pt-2.5", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={mine}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
          mine
            ? "bg-paper-2 text-ink shadow-[inset_0_0_0_1px_var(--c)] hover:bg-paper-3"
            : "bg-(--c) text-white hover:opacity-90",
        )}
      >
        {mine
          ? <PinOff aria-hidden="true" className="size-3.5" />
          : <PinIcon aria-hidden="true" className="size-3.5" />}
        {mine ? "Unpin" : "Pin"} <span className="font-normal opacity-85">for {label}</span>
      </button>
      {others.length > 0 && (
        <span className="text-[12px] text-muted">
          Pinned for {others.map(fromLabel).join(", ")}
        </span>
      )}
    </div>
  );
}
