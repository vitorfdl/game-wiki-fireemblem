import { KeyRound, MapPin } from "lucide-react";
import { CLASS_REF } from "virtual:refs";
import { P3 } from "../../lib/parts.ts";
import { divineFallbacks, divineHolders } from "../../lib/part-army.ts";
import { pids } from "../../lib/part-plan.ts";
import { useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Tick } from "../chapter/bits.tsx";
import { PlaceName } from "./place.tsx";
import { UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { ClassChip } from "../ui/class-chip.tsx";
import { ItemChip, Kicker } from "./shared.tsx";

/*
 * Field Kit › Diadem (D-125): the five Keys of the Diadem (Part III chests) and the eight Divine classes, each with its
 * item and the unit planned for it (D-119, from the build stages). One copy of each item: one holder per class.
 */

const DIVINE = [
  "The Trident",
  "The Godhand",
  "The Eternal",
  "The Avatar",
  "The Calamity",
  "The Blade",
  "The Cavalier",
  "The Apsara",
];

export function DiademTab({ route }: { route: RouteName }) {
  const t = useTrack();
  const keys = P3.diadem.keys;
  const found = keys.filter((k) => t.done[pids.key(k.dungeon)]).length;
  return (
    <RouteCtx.Provider value={route}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 flex items-center gap-2 font-display text-[17px]">
          <KeyRound className="size-4 text-(--c)" />Keys of the Diadem
        </h3>
        <span
          className={cx(
            "rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums",
            found === 5 ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft",
          )}
        >
          {found}/5 found
        </span>
      </div>
      <p className="m-0 mt-0.5 text-[13px] text-muted">{P3.diadem.opens}</p>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-1.5">
        {keys.map((k) => {
          const id = pids.key(k.dungeon);
          return (
            <div
              key={k.dungeon}
              className={cx(
                "flex gap-2 rounded-md bg-paper/60 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]",
                Boolean(t.done[id]) && "opacity-60",
              )}
            >
              <Tick id={id} label={`Key of the Diadem: ${k.dungeon}`} />
              <div className="min-w-0 text-[13.5px] leading-snug">
                <div className="font-semibold">
                  <PlaceName name={k.dungeon} />{" "}
                  <span className="text-[12px] font-normal text-muted">· {k.region}</span>
                </div>
                <div className="flex gap-1 text-muted">
                  <MapPin className="mt-[3px] size-3 shrink-0" />
                  {k.spot}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mt-5 mb-0 font-display text-[17px]">Divine classes</h3>
      <p className="m-0 mt-0.5 text-[13px] text-muted">{P3.diadem.rules.slice(1).join(" ")}</p>
      <div className="mt-2 overflow-hidden rounded-md border border-gold/55 bg-card">
        <table className="w-full border-collapse text-left text-[14px] leading-snug">
          <thead>
            <tr className="border-b border-gold/60 bg-paper-2/70 text-[11.5px] font-semibold tracking-[0.06em] text-ink-soft uppercase">
              <th className="px-2.5 py-2">Class</th>
              <th className="px-2.5 py-2">Item · chamber</th>
              <th className="px-2.5 py-2">Ranks</th>
              <th className="px-2.5 py-2">Planned for</th>
            </tr>
          </thead>
          <tbody>
            {DIVINE.map((name) => {
              const fallback = divineFallbacks()[name];
              const c = CLASS_REF[name];
              const item = c?.license?.replace(/\s*\(.*\)$/, "");
              const chamber = c?.unlock?.match(/\(([^,]+),/)?.[1];
              // The picked copy's build (D-145), one holder per item; the fallback if the exam isn't 100% in time.
              const who = divineHolders(name);
              return (
                <tr key={name} className="border-b border-gold/25 align-top last:border-0 even:bg-paper/40">
                  <td className="px-2.5 py-2">
                    <ClassChip name={name} />
                  </td>
                  <td className="px-2.5 py-2">
                    {item ? <ItemChip name={item} /> : "?"}
                    {chamber && <div className="text-[12px] text-muted">{chamber}</div>}
                  </td>
                  <td className="px-2.5 py-2 text-[13px] font-semibold">{c?.ranks?.join(" · ")}</td>
                  <td className="px-2.5 py-2">
                    {who.length
                      ? (
                        <span className="flex flex-col gap-0.5">
                          {who.map((w) => (
                            <span key={w.unit} className="inline-flex items-center gap-1.5">
                              <UnitPortrait name={w.unit} size={22} flat />
                              <UnitRef name={w.unit} avatar={false} />
                              <span className="text-[12px] text-muted tabular-nums">S{w.n}</span>
                            </span>
                          ))}
                        </span>
                      )
                      : <span className="text-muted">open</span>}
                    {fallback && (
                      <span
                        className="mt-0.5 flex items-center gap-1 text-[12px] text-muted"
                        title="If the exam isn't 100% by Mission Time"
                      >
                        else <UnitPortrait name={fallback} size={18} flat />
                        <UnitRef name={fallback} avatar={false} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <Kicker>Rules</Kicker>
      </div>
      <ul className="m-0 mt-1 grid list-none gap-0.5 p-0 text-[13px] text-muted">
        {P3.diadem.rules.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </RouteCtx.Provider>
  );
}
