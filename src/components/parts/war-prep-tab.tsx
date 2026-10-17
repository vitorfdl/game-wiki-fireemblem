import { CLASSES } from "../../lib/data.ts";
import { examsFor } from "../../lib/chapter.ts";
import { GOD_LIST, GOD_RULES, P2, pos, warChapter } from "../../lib/parts.ts";
import { warFile } from "../../lib/part-plan.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { classKey } from "../ui/class-chip.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { UnitPortrait } from "../ref/rich.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { GOD_TONE, GodPill } from "./god.tsx";
import { Kicker } from "./shared.tsx";

/*
 * Field Kit › War Prep (D-125): what the base offers between War chapters. A chapter strip; the six chapters at a
 * glance (Army Action, level floor, Blessings, Licenses spent, deploy cap); the Blessing table; the base facilities.
 */

const TH = "px-2.5 py-2 text-[11.5px] font-semibold tracking-[0.06em] text-ink-soft uppercase";

function licenses(route: RouteName, ch: number) {
  const ex = examsFor(route, pos(2, ch)).filter((e) => !e.onJoin);
  const tier = (c: string) => CLASSES[classKey(c) ?? ""]?.tier;
  return {
    B: ex.filter((e) => tier(e.to) === "Beginner"),
    S: ex.filter((e) => tier(e.to) === "Specialty"),
    A: ex.filter((e) => tier(e.to) === "Advanced"),
  };
}

export function WarPrepTab({ route, ch, setCh }: { route: RouteName; ch: number; setCh: (n: number) => void }) {
  const floors = P2.prep.army_actions.find((a) => a.levels)?.levels ?? {};
  const cur = Math.min(6, Math.max(1, ch));
  const f = warFile(route, cur);
  const lic = licenses(route, cur);
  return (
    <RouteCtx.Provider value={route}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <Kicker className="mb-1">War chapter</Kicker>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCh(n)}
                className={cx(
                  "grid h-8 min-w-8 place-items-center rounded-md px-2 text-[14px] font-semibold tabular-nums",
                  n === cur ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-right text-[13px] leading-snug text-muted">
          <b className="text-ink">{warChapter(cur)?.name}</b>
          <div>{cur >= 5 ? "No facilities this chapter" : "Licenses and Divine Sand refilled"}</div>
        </div>
      </div>

      {f && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
            <Kicker>Army Action</Kicker>
            <div className="mt-1 text-[16px] font-semibold">{f.action?.pick ?? "None"}</div>
            {f.action?.pick === "Training Drills" && floors[String(cur)] && (
              <div className="text-[12.5px] text-(--c)">floor Lv {floors[String(cur)]}</div>
            )}
            <p className="m-0 mt-1 text-[13px] leading-snug text-muted">
              {f.action ? <ConfText text={f.action.why} k="a" /> : "No Dispatch Officer after Ch 4."}
            </p>
          </div>
          <div className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
            <Kicker>Blessings</Kicker>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {f.blessings.map((b, i) => <GodPill key={i} god={b.god} lv={b.lv} />)}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-snug text-muted">
              {f.blessings[0] && <ConfText text={f.blessings[0].why} k="b" />}
            </p>
          </div>
          <div className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
            <Kicker>Free Licenses</Kicker>
            <div className="mt-1 grid gap-1">
              {(["B", "S", "A"] as const).map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="w-4 text-[12px] font-bold text-muted">{k}</span>
                  {Array.from(
                    { length: 5 },
                    (_, i) => (
                      <span
                        key={i}
                        className={cx(
                          "grid size-[24px] place-items-center rounded",
                          lic[k][i]
                            ? "bg-(--c)/12 shadow-[inset_0_0_0_1.5px_var(--c)]"
                            : "shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]",
                        )}
                      >
                        {lic[k][i] && (
                          <UnitPortrait
                            name={lic[k][i].unit.name}
                            size={20}
                            flat
                            title={`${lic[k][i].unit.name} → ${lic[k][i].to}`}
                          />
                        )}
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <h3 className="mt-5 mb-1.5 font-display text-[16px]">All six chapters</h3>
      <div className="overflow-hidden rounded-md border border-gold/55 bg-card">
        <table className="w-full border-collapse text-left text-[14px] leading-snug">
          <thead>
            <tr className="border-b border-gold/60 bg-paper-2/70">
              <th className={TH}>Ch</th>
              <th className={TH}>Army Action</th>
              <th className={TH}>Blessings</th>
              <th className={cx(TH, "text-center")}>Lic B·S·A</th>
              <th className={cx(TH, "text-center")}>Deploy</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const w = warFile(route, n);
              const l = licenses(route, n);
              return (
                <tr
                  key={n}
                  onClick={() => setCh(n)}
                  className={cx(
                    "cursor-pointer border-b border-gold/25 align-top last:border-0 hover:bg-paper/60",
                    n === cur ? "bg-(--c)/[0.07]" : "even:bg-paper/40",
                  )}
                >
                  <td className="px-2.5 py-2 font-logo font-bold tabular-nums">{n}</td>
                  <td className="px-2.5 py-2">
                    <b className="font-semibold">{w?.action?.pick ?? "—"}</b>
                    {w?.action?.pick === "Training Drills" && floors[String(n)] && (
                      <span className="text-[12.5px] text-muted">· Lv {floors[String(n)]}</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="flex flex-wrap gap-1">
                      {w?.blessings.map((b, i) => <GodPill key={i} god={b.god} lv={b.lv} />)}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-center font-semibold tabular-nums">
                    {l.B.length}·{l.S.length}·{l.A.length}
                  </td>
                  <td className="px-2.5 py-2 text-center tabular-nums">
                    {warChapter(n)?.battles[0]?.max_units ?? "?"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="mt-5 mb-1.5 font-display text-[16px]">Blessings</h3>
      <div className="overflow-hidden rounded-md border border-gold/55 bg-card">
        <table className="w-full border-collapse text-left text-[14px] leading-snug">
          <thead>
            <tr className="border-b border-gold/60 bg-paper-2/70">
              <th className={TH}>God</th>
              <th className={TH}>Lv 1</th>
              <th className={TH}>Lv 2</th>
              <th className={TH}>Lv 3</th>
            </tr>
          </thead>
          <tbody>
            {GOD_LIST.map((g) => (
              <tr
                key={g.name}
                className="border-b border-gold/25 last:border-0"
                style={{ boxShadow: `inset 3px 0 0 ${GOD_TONE[g.name]?.dot}` }}
              >
                <td className="px-2.5 py-2">
                  <b className="font-semibold">{g.name}</b>
                  <div className="text-[12px] text-muted">{g.day}</div>
                </td>
                {g.levels.map((l) => <td key={l.lv} className="px-2.5 py-2">{l.effect}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 mb-0 grid list-none gap-0.5 p-0 text-[13px] text-muted">
        {GOD_RULES.map((r) => <li key={r}>{r}</li>)}
        <li>Effects are community-reported (KeenGamer): check the in-game text.</li>
      </ul>

      <h3 className="mt-5 mb-1.5 font-display text-[16px]">The base</h3>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {[
          ...P2.prep.facilities.map((x) => [x.name, x.does]),
          ...P2.prep.lord_facilities.map((x) => [`${x.lord}'s War Path`, x.does]),
          ...P2.prep.army_actions.map((x) => [x.name, x.does]),
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-md bg-paper/60 px-3 py-2 text-[13.5px] leading-snug shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]"
          >
            <b className="font-semibold">{k}</b> <span className="text-ink-soft">· {v}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 mb-0 text-[13px] text-muted">{P2.prep.facilities_until}</p>
    </RouteCtx.Provider>
  );
}
