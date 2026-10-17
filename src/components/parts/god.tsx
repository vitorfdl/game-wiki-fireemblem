import { GOD_LIST } from "../../lib/parts.ts";
import { cx } from "../../lib/cx.ts";
import { Hover } from "../ui/hover.tsx";

/* A god as a pill (Blessings, Group Service, temples): fixed color per god, hover card with the three Blessing levels. */

export const GOD_TONE: Record<string, { bg: string; fg: string; dot: string }> = {
  Aurora: { bg: "#f6ecd0", fg: "#6d5110", dot: "#d6a93a" },
  Mars: { bg: "#f6dcd6", fg: "#8a2a17", dot: "#c4513a" },
  Smyrnos: { bg: "#e9e2f5", fg: "#4f3486", dot: "#8a6cc4" },
  Jurah: { bg: "#dbe9f3", fg: "#1f4f74", dot: "#4f8fbf" },
  Kalla: { bg: "#dcefe3", fg: "#1f6a43", dot: "#3f9c68" },
  Credna: { bg: "#efe2d2", fg: "#6b4423", dot: "#a8743f" },
};

export function GodCard({ god }: { god: string }) {
  const g = GOD_LIST.find((x) => x.name === god);
  if (!g) return <div className="pr-3">{god}</div>;
  return (
    <div className="pr-3">
      <div className="text-[12px] font-semibold tracking-[0.06em] text-gold-lo uppercase">
        {g.name}'s Blessing · serve {g.day}
      </div>
      <ol className="m-0 mt-1 grid list-none gap-1 p-0 text-[14px]">
        {g.levels.map((l) => (
          <li key={l.lv} className="grid grid-cols-[34px_minmax(0,1fr)] gap-1.5">
            <span className="font-semibold text-muted tabular-nums">Lv {l.lv}</span>
            {l.effect}
          </li>
        ))}
      </ol>
      <div className="mt-1.5 text-[12px] text-muted">Community-reported (KeenGamer); lasts 1 turn, army-wide.</div>
    </div>
  );
}

export function GodPill({ god, lv, className }: { god: string; lv?: number; className?: string }) {
  const t = GOD_TONE[god] ?? { bg: "#eee", fg: "#333", dot: "#999" };
  return (
    <Hover label={`${god}'s Blessing`} card={() => <GodCard god={god} />}>
      <span
        className={cx(
          "inline-flex items-center gap-1 rounded-full py-px pr-2 pl-1.5 text-[13px] font-semibold whitespace-nowrap",
          className,
        )}
        style={{ background: t.bg, color: t.fg }}
      >
        <span className="size-2 rounded-full" style={{ background: t.dot }} />
        {god}
        {lv ? <span className="opacity-75">Lv {lv}</span> : null}
      </span>
    </Hover>
  );
}
