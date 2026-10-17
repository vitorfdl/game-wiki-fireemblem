import { Hammer, ScrollText, Swords } from "lucide-react";
import { P3 } from "../../lib/parts.ts";
import { assignOf, licenseHolders } from "../../lib/part-army.ts";
import { pids } from "../../lib/part-plan.ts";
import { resolve } from "../../lib/refs.ts";
import { useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Tick } from "../chapter/bits.tsx";
import { RefChip, UnitPortrait } from "../ref/rich.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { ClassChip } from "../ui/class-chip.tsx";
import { GOD_TONE, GodPill } from "./god.tsx";
import { ItemChip, Kicker } from "./shared.tsx";

/*
 * Field Kit › Temples (D-125): the six gods of Part III in one sheet. Each god runs three steps in order: repair the
 * temple (material + a squad on site, several turns), the god's request (opens a Master class), the Lv 60 Trial
 * (rewards). Facts from part3-salvation.json; who takes each Master class from the build stages.
 */

const Ref = ({ name }: { name: string }) => {
  const r = resolve(name.replace(/\s*×\d+$/, ""));
  return r ? <RefChip r={r} /> : <b>{name}</b>;
};

function Step(
  { id, label, icon, done, children }: {
    id: string;
    label: string;
    icon: React.ReactNode;
    done: boolean;
    children: React.ReactNode;
  },
) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-md bg-card px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]",
        done && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Tick id={id} label={label} />
        <span className="text-faint [&>svg]:size-3.5">{icon}</span>
        <Kicker>{label.split(":")[0]}</Kicker>
      </div>
      <div className="mt-1 text-[13.5px] leading-snug">{children}</div>
    </div>
  );
}

export function TemplesTab({ route }: { route: RouteName }) {
  const t = useTrack();
  const gods = P3.quests.filter((q) => q.kind === "god-request");
  const done = gods.filter((q) => t.done[pids.temple(q.giver!, "trial")]).length;
  return (
    <RouteCtx.Provider value={route}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="m-0 font-display text-[17px]">Six temples, three steps each</h3>
          <p className="m-0 text-[13px] text-muted">
            Repair the temple → the god's request opens a Master class → the Lv 60 Trial pays out. All end 6/6.
          </p>
        </div>
        <span className="text-[13px] font-semibold text-ink-soft tabular-nums">{done}/6 Trials</span>
      </div>
      <div className="mt-3 grid gap-2.5">
        {gods.map((q) => {
          const god = q.giver!;
          const tone = GOD_TONE[god];
          // Who takes the class: the Master License queue (D-149), plus joiners who arrive in it.
          const holders = q.master_class ? licenseHolders(q.master_class) : [];
          return (
            <article
              key={god}
              className="overflow-hidden rounded-lg bg-paper/60"
              style={{ boxShadow: `inset 4px 0 0 ${tone?.dot}, inset 0 0 0 1px rgba(176,144,90,.4)` }}
            >
              <header className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1.5">
                <GodPill god={god} />
                <span className="text-[13px] text-muted">{q.where}</span>
                <span className="flex-1" />
                {q.master_class && <ClassChip name={q.master_class} />}
                {holders.length > 0
                  ? (
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      for
                      {holders.map((h) => (
                        <span
                          key={h.unit}
                          className="inline-flex items-center gap-0.5"
                          title={`${h.unit}: ${h.join ? "joins in this class" : "License"}, Section ${h.n}`}
                        >
                          <UnitPortrait name={h.unit} size={24} ring="var(--color-paper)" />
                          <span className="font-semibold tabular-nums">{h.join ? "joins" : `S${h.n}`}</span>
                        </span>
                      ))}
                    </span>
                  )
                  : q.master_class && <span className="text-[12px] text-muted">no holder planned</span>}
              </header>
              <div className="grid gap-1.5 px-3 pb-3 sm:grid-cols-3">
                <Step
                  id={pids.temple(god, "repair")}
                  label={`Repair: ${god}'s Temple`}
                  icon={<Hammer />}
                  done={Boolean(t.done[pids.temple(god, "repair")])}
                >
                  {q.repair?.material
                    ? <Ref name={q.repair.material} />
                    : <span className="text-muted">material ?</span>}
                  {q.repair?.note && <div className="text-[12.5px] text-muted">{q.repair.note}</div>}
                </Step>
                <Step
                  id={pids.temple(god, "request")}
                  label={`Request: ${q.name}`}
                  icon={<ScrollText />}
                  done={Boolean(t.done[pids.temple(god, "request")])}
                >
                  <b className="font-semibold">{q.task}</b>
                  {q.how && <div className="mt-0.5 text-[12.5px] text-muted">{q.how}</div>}
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {[
                      q.reward.gold ? `${q.reward.gold.toLocaleString("en-US")}G` : "",
                      q.reward.relief ? `${q.reward.relief} Relief` : "",
                      q.from_section > 2 ? `opens in Section ${q.from_section}` : "",
                    ].filter(Boolean).join(" · ")}
                  </div>
                </Step>
                <Step
                  id={pids.temple(god, "trial")}
                  label="Trial: Lv 60 clash"
                  icon={<Swords />}
                  done={Boolean(t.done[pids.temple(god, "trial")])}
                >
                  <span className="grid gap-1">
                    {q.reward.trial_items?.map((it) => {
                      const to = assignOf(it)[0];
                      return (
                        <span key={it} className="flex flex-wrap items-center gap-1.5">
                          <ItemChip name={it} />
                          {to
                            ? (
                              <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                                → <UnitPortrait name={to.to} size={20} flat />
                                <span className="font-semibold text-ink-soft">{to.to}</span> S{to.n}
                              </span>
                            )
                            : <span className="text-[12px] text-muted">no holder yet</span>}
                        </span>
                      );
                    })}
                  </span>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {god === "Kalla"
                      ? "Hardest Trial (Game8)"
                      : god === "Credna"
                      ? "Easiest Trial (Game8)"
                      : "Two back-to-back clashes; retry freely"}
                  </div>
                </Step>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-3 mb-0 text-[13px] text-muted">
        After Credna's request, talk to Credna again: The Nameless becomes the Shining Spear. Nothing marks the scene. A
        repaired temple teleports only after its request is done.
      </p>
    </RouteCtx.Provider>
  );
}
