import { Crown, MapPin, Minus, Plus } from "lucide-react";
import { type Battle, pos, section, shortBattle, SQUAD_SIZE, SQUAD_TONE, squadCap } from "../../lib/parts.ts";
import { salvationFile, squadsAt, squadsFile } from "../../lib/part-plan.ts";
import { classAt as p3ClassAt, deploysIn, hasDeployPlan } from "../../lib/part-army.ts";
import type { RouteName, SquadsFile } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { ROUTE_NAMES } from "../../lib/types.ts";
import { UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { classLabel } from "../ui/class-chip.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { CapMeter, Kicker, SquadBadge } from "./shared.tsx";

/*
 * Field Kit › Squads (D-126, D-127). Part III's squad board: a Section strip like the Arena's chapter strip, one card
 * per squad (fixed letter and color, role and map job, 8 seats), what changed since the last Section, the units outside
 * any squad, and a gate matrix: which squads deploy where against each cap. Data: walkthrough/<route>/squads.json.
 */

type Squad = SquadsFile["sections"][number]["squads"][number];

/** Class of a unit at a Section: the build of the copy the plan recruits (D-145), every army and Part III joiners. */
function classAt(unit: string, n: number): string | undefined {
  const cls = p3ClassAt(unit, pos(3, n));
  return cls ? classLabel(cls) : undefined;
}

/** Battles of a Section that the squads plan for: gates, plus skirmishes with a plan entry (Rescue Centurio). */
export function planBattles(route: RouteName, n: number): Battle[] {
  const f = salvationFile(route, n);
  return (section(n)?.battles ?? []).filter((b) =>
    !b.kind || (b.kind === "skirmish" && f?.gates.some((g) => g.battle === b.name))
  );
}

const isLord = (u: string) => (ROUTE_NAMES as readonly string[]).includes(u);

function SeatLine(
  { unit, n, tone, atGate }: { unit?: string; n: number; tone: string; atGate: boolean },
) {
  if (!unit) {
    return <li className="h-[34px] rounded-[5px] border border-dashed border-gold/40" aria-label="Open seat" />;
  }
  const cls = classAt(unit, n);
  // With a deploy plan, a squad at a gate can hold units that stay on the map tile: ⚔ marks who fights.
  const fights = hasDeployPlan(n) ? deploysIn(n, unit) : [];
  const present = atGate && hasDeployPlan(n) && !fights.length;
  return (
    <li
      className={cx(
        "flex h-[34px] min-w-0 items-center gap-1.5 rounded-[5px] bg-card/90 pr-1.5 pl-1 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3)]",
        present && "opacity-70",
      )}
      title={fights.length
        ? `${unit} deploys: ${fights.map(shortBattle).join(", ")}`
        : present
        ? `${unit} rides to the gate but doesn't deploy`
        : undefined}
    >
      <UnitPortrait name={unit} size={26} flat />
      <span className="min-w-0 flex-1 leading-[1.1]">
        <span className="block truncate text-[13px] font-semibold">
          <UnitRef name={unit} avatar={false} />
        </span>
        <span className="block truncate text-[11px] text-muted">
          {cls ?? "no Part III plan"}
          {present && " · stays"}
        </span>
      </span>
      {fights.length > 0 && (
        <span className="text-[11px] font-bold" style={{ color: tone }} aria-label="Deploys">⚔</span>
      )}
      {isLord(unit) && (
        <span title={`${unit}'s map ability works while ${unit} rides in this squad`} style={{ color: tone }}>
          <Crown className="size-3.5" />
        </span>
      )}
    </li>
  );
}

/** One squad: banner (letter, role, job), 8 seats, gates, changes since last Section. */
export function SquadCard({ sq, route, n, compact }: { sq: Squad; route: RouteName; n: number; compact?: boolean }) {
  const t = SQUAD_TONE[sq.id] ?? SQUAD_TONE.A;
  const prev = squadsAt(route, n - 1)?.squads.find((x) => x.id === sq.id);
  const joined = prev ? sq.units.filter((u) => !prev.units.includes(u)) : [];
  const left = prev ? prev.units.filter((u) => !sq.units.includes(u)) : [];
  const seats = Array.from({ length: SQUAD_SIZE }, (_, i) => sq.units[i]);
  return (
    <article
      className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-paper/60"
      style={{ boxShadow: `inset 0 0 0 1.5px ${t.ring}` }}
    >
      <header className="px-2.5 pt-2 pb-1.5" style={{ background: t.bg, color: t.fg }}>
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-white/15 font-logo text-[17px] font-bold">
            {sq.id}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <b className="block truncate text-[14px]">{sq.role}</b>
            <span className="flex items-center gap-1 truncate text-[11.5px] opacity-85">
              <MapPin className="size-3 shrink-0" />
              {sq.job}
            </span>
          </span>
          <span className="text-[11.5px] font-semibold tabular-nums opacity-85">{sq.units.length}/{SQUAD_SIZE}</span>
        </div>
      </header>
      {compact
        ? (
          <div className="flex flex-wrap gap-1 px-2 py-2">
            {sq.units.map((u) => (
              <UnitPortrait
                key={u}
                name={u}
                size={28}
                flat
                title={`${u}${classAt(u, n) ? ` · ${classAt(u, n)}` : ""}${
                  hasDeployPlan(n) && deploysIn(n, u).length ? " · deploys" : ""
                }`}
              />
            ))}
            {Array.from(
              { length: SQUAD_SIZE - sq.units.length },
              (_, i) => <span key={i} className="size-7 rounded-full border border-dashed border-gold/50" />,
            )}
          </div>
        )
        : (
          <ul className="m-0 grid list-none gap-1 p-2">
            {seats.map((u, i) => <SeatLine key={i} unit={u} n={n} tone={t.bg} atGate={sq.gates.length > 0} />)}
          </ul>
        )}
      <footer className="mt-auto flex flex-wrap items-center gap-1 px-2 pb-2 text-[12px]">
        {sq.gates.length
          ? sq.gates.map((g) => (
            <span key={g} className="rounded-full px-2 py-px font-semibold" style={{ background: t.soft, color: t.bg }}>
              ⚔ {shortBattle(g)}
            </span>
          ))
          : <span className="text-muted">No gate: map work</span>}
      </footer>
      {!compact && (joined.length || left.length)
        ? (
          <div className="flex flex-wrap gap-1 border-t border-gold/25 px-2 py-1.5 text-[12px]">
            {joined.map((u) => (
              <span
                key={u}
                className="inline-flex items-center gap-0.5 rounded-full bg-[#dcefe3] px-1.5 font-semibold text-[#1f6a43]"
              >
                <Plus className="size-3" />
                {u}
              </span>
            ))}
            {left.map((u) => (
              <span
                key={u}
                className="inline-flex items-center gap-0.5 rounded-full bg-paper-3 px-1.5 font-semibold text-muted"
              >
                <Minus className="size-3" />
                {u}
              </span>
            ))}
          </div>
        )
        : null}
      {!compact && sq.note && (
        <p className="m-0 border-t border-gold/25 px-2 py-1.5 text-[12.5px] leading-snug text-muted">
          <ConfText text={sq.note} k={`sn${sq.id}`} />
        </p>
      )}
    </article>
  );
}

/** Rows: each gate this Section; cells: squads sending units; the cap meter counts Eshmel. */
function GateMatrix({ route, n }: { route: RouteName; n: number }) {
  const at = squadsAt(route, n);
  const gates = planBattles(route, n);
  if (!at || !gates.length) return null;
  return (
    <div className="overflow-hidden rounded-md border border-gold/55 bg-card">
      <table className="w-full border-collapse text-left text-[14px] leading-snug">
        <thead>
          <tr className="border-b border-gold/60 bg-paper-2/70 text-[11.5px] font-semibold tracking-[0.06em] text-ink-soft uppercase">
            <th className="px-3 py-2">Gate</th>
            {at.squads.map((q) => (
              <th key={q.id} className="w-[44px] px-1 py-2 text-center">
                <SquadBadge id={q.id} size={20} />
              </th>
            ))}
            <th className="px-3 py-2">Cap · with Eshmel</th>
          </tr>
        </thead>
        <tbody>
          {gates.map((b) => {
            const sending = at.squads.filter((q) => q.gates.includes(b.name));
            const plan = salvationFile(route, n)?.gates.find((g) => g.battle === b.name);
            // Eshmel joins every gate battle; skirmishes don't count him.
            const used = (plan?.deploy?.length ?? sending.reduce((a, q) => a + q.units.length, 0)) + (b.kind ? 0 : 1);
            const miasma = b.mechanics?.find((m) => /miasma/i.test(m));
            return (
              <tr key={b.name} className="border-b border-gold/25 align-top last:border-0 even:bg-paper/40">
                <td className="px-3 py-2">
                  <b className="font-semibold">{shortBattle(b.name)}</b>
                  {b.kind === "skirmish" && <span className="ml-1 text-[12px] text-muted">(skirmish)</span>}
                  <span className="text-muted">· {b.location}</span>
                  {miasma && <div className="text-[12.5px] text-muted">{miasma}</div>}
                </td>
                {at.squads.map((q) => {
                  const on = q.gates.includes(b.name);
                  const tone = SQUAD_TONE[q.id];
                  return (
                    <td key={q.id} className="px-1 py-2 text-center">
                      {on
                        ? (
                          <span
                            className={cx(
                              "inline-block size-4 rounded-full",
                              plan?.launch === q.id && "ring-2 ring-offset-1 ring-offset-card",
                            )}
                            style={{ background: tone.bg, ["--tw-ring-color" as string]: tone.ring }}
                            title={plan?.launch === q.id
                              ? `Squad ${q.id} launches (spends its turn)`
                              : `Squad ${q.id} at the gate`}
                          />
                        )
                        : <span className="inline-block size-4 rounded-full border border-gold/40" />}
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <CapMeter used={used} cap={b.max_units ?? used} label={plan?.deploy ? "deploy" : undefined} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SquadsTab({ route, n, setN }: { route: RouteName; n: number; setN: (n: number) => void }) {
  const file = squadsFile(route);
  const shown = squadsAt(route, n) ? n : file?.sections.find((s) => s.n >= n)?.n ?? file?.sections[0]?.n ?? 2;
  const at = squadsAt(route, shown);
  const s = section(shown);
  if (!file) return <p className="text-muted">No squad plan for this route yet.</p>;
  return (
    <RouteCtx.Provider value={route}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <Kicker className="mb-1">Section</Kicker>
          <div className="flex gap-1">
            {file.sections.map((x) => (
              <button
                key={x.n}
                type="button"
                onClick={() => setN(x.n)}
                className={cx(
                  "grid h-8 min-w-8 place-items-center rounded-md px-2 text-[14px] font-semibold tabular-nums",
                  x.n === shown ? "bg-(--c) text-white" : "bg-paper-2 text-ink-soft hover:bg-paper-3",
                )}
              >
                {x.n}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-right text-[13px] leading-snug text-muted">
          <b className="text-ink">{s?.name}</b>
          <div>{squadCap(shown)} squads · up to {SQUAD_SIZE} each · Eshmel stays in Dagsion and joins any gate</div>
        </div>
      </div>
      {file.draft && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-warn px-3 py-2 text-[13.5px] text-warn-ink">
          <b className="shrink-0 tracking-[0.06em] uppercase">Draft</b>
          <span>{file.note ?? "First pass: squads are being reworked."}</span>
        </div>
      )}
      {at && (
        <>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2">
            {at.squads.map((q) => <SquadCard key={q.id} sq={q} route={route} n={shown} />)}
            {Array.from(
              { length: Math.max(0, squadCap(shown) - at.squads.length) },
              (_, i) => (
                <div
                  key={i}
                  className="grid min-h-[120px] place-items-center rounded-lg border border-dashed border-gold/50 text-[13px] text-faint"
                >
                  Squad slot open
                </div>
              ),
            )}
          </div>
          <div className="mt-4 mb-1.5 flex items-baseline gap-2">
            <h3 className="m-0 font-display text-[16px]">Gates this Section</h3>
            <span className="text-[12.5px] text-muted">only squads on or next to the gate deploy</span>
          </div>
          <GateMatrix route={route} n={shown} />
          <div className="mt-4 rounded-md bg-paper-2/60 px-3 py-2">
            <div className="flex items-baseline gap-2">
              <Kicker>Outside the squads</Kicker>
              <span className="text-[12.5px] text-muted">gain EXP and class EXP every map turn</span>
            </div>
            {at.bench.length
              ? (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
                  {at.bench.map((u) => (
                    <span key={u} className="inline-flex items-center gap-1.5 text-[14px]">
                      <UnitPortrait name={u} size={24} flat />
                      <UnitRef name={u} avatar={false} />
                    </span>
                  ))}
                </div>
              )
              : <p className="m-0 mt-1 text-[13.5px] text-muted">Everyone rides in a squad this Section.</p>}
          </div>
          <ul className="mt-3 mb-0 grid list-none gap-1 p-0 text-[13px] text-muted">
            <li>Swapping members costs a map turn; disbanding and rebuilding a squad is free.</li>
            <li>
              <Crown className="mr-1 inline size-3.5 align-[-2px]" />A Flame Lord's map ability works only while the
              lord rides in the squad.
            </li>
            {at.note && <li>{at.note}</li>}
          </ul>
        </>
      )}
    </RouteCtx.Provider>
  );
}
