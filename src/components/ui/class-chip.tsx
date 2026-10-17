import { classKey, isClass, resolve } from "../../lib/refs.ts";
import { cx } from "../../lib/cx.ts";
import { RefChip } from "../ref/rich.tsx";
import { TierBadge } from "../dossier/journey.tsx";

export { classKey, isClass };

/** Label for a stage class: the class, or "Class on join" when the stage only describes it. */
export const classLabel = (name: string | undefined): string => (isClass(name) ? name : "Class on join");

/**
 * A class as a pill with its tier badge (B, S, A, M) and the class hover card. `muted`: the class a unit leaves
 * (smaller, outlined). `side`: a side trip (dashed badge). Text that isn't a class becomes a neutral "class on join"
 * pill with the text as a muted note beside it: prose never goes inside a chip.
 */
export function ClassChip({ name, muted, side, note = true }: { name: string; muted?: boolean; side?: boolean; note?: boolean }) {
  const key = classKey(name);
  if (!key) {
    return (
      <span className="inline-flex max-w-full min-w-0 items-baseline gap-1.5 align-middle">
        <span
          title={name}
          className="shrink-0 rounded-full px-2 py-[1px] text-[12.5px] whitespace-nowrap text-muted italic shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]"
        >
          class on join
        </span>
        {note && !/^(starting|specialty|beginner) class$/i.test(name) && (
          <span className="min-w-0 truncate text-[12.5px] text-muted" title={name}>{name}</span>
        )}
      </span>
    );
  }
  const r = resolve(name, "class") ?? resolve(key, "class");
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full py-[2px] pr-2.5 pl-[3px] align-middle leading-tight whitespace-nowrap",
        muted
          ? "text-[13px] text-ink-soft shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]"
          : "bg-paper-2/80 text-[14.5px] font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(176,144,90,.55)]",
      )}
    >
      <TierBadge cls={key} size={muted ? 17 : 20} side={side} />
      <span className="min-w-0 truncate">{r ? <RefChip r={{ ...r, label: name }} bare /> : name}</span>
    </span>
  );
}
