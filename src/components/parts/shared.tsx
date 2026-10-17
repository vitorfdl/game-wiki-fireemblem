import type { ReactNode } from "react";
import { ArrowRight, CheckCheck } from "lucide-react";
import { CLASSES } from "../../lib/data.ts";
import { examsFor, exitText, kitFor } from "../../lib/chapter.ts";
import { type Battle, type Drop, dropName, P3, SQUAD_TONE, squadCap } from "../../lib/parts.ts";
import { activeStage, routeUnits } from "../../lib/walkthrough/builds.ts";
import { isPartDone, type LaterPart, nowIn, setPartDone, useTrack } from "../../lib/track.ts";
import type { Line, RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Panel } from "../ui/panel.tsx";
import { PinScope } from "../ui/pin-toggle.tsx";
import { CheckAll, Lines, SubHead, Tag } from "../chapter/bits.tsx";
import { Fact, UnitCard } from "../chapter/view.tsx";
import { ClassChip, classKey, classLabel, isClass } from "../ui/class-chip.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { ItemMini } from "../ui/item-mini.tsx";
import { RefChip, Rich, UnitPortrait, UnitRef } from "../ref/rich.tsx";
import { resolve } from "../../lib/refs.ts";
import { useWalk } from "../walkthrough/ctx.ts";

/* Pieces shared by the War chapter and Salvation Section views (D-124). Same panel and card language as Part I. */

/** One slot panel: icon, number, title; Check all when it holds two or more boxes. */
export function PSlot(
  { n, id, title, icon, empty, aside, alert, children }: {
    n: number;
    id: string;
    title: string;
    icon: ReactNode;
    empty?: string | false;
    aside?: ReactNode;
    alert?: boolean;
    children?: ReactNode;
  },
) {
  return (
    <PinScope from={{ slot: title }}>
      <Panel
        id={id}
        n={n}
        icon={icon}
        title={title}
        empty={empty || undefined}
        aside={empty ? aside : (
          <span className="flex items-center gap-2">
            {aside}
            <CheckAll sectionId={id} />
          </span>
        )}
        tone={alert ? "alert" : undefined}
        bodyClassName="text-[15px] leading-[1.5]"
      >
        {children}
      </Panel>
    </PinScope>
  );
}

/** A small uppercase label for groups inside a slot. */
export const Kicker = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("text-[10.5px] font-semibold tracking-[0.08em] text-gold-lo uppercase", className)}>
    {children}
  </div>
);

/** A slot's "open the tab" link (Ledger, Squads, War Prep...). */
export function KitLink(
  { tab, children }: { tab: Parameters<ReturnType<typeof useWalk>["openKit"]>[0]; children: ReactNode },
) {
  const { openKit } = useWalk();
  return (
    <button
      type="button"
      onClick={() => openKit(tab)}
      className="flex items-center gap-0.5 text-[12.5px] font-semibold text-gold-lo hover:text-ink"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </button>
  );
}

/* ------------------------------------------------------------ classes */

/** Class changes at a campaign position, as Part I's exam cards (derived from the build stages). */
export function ExamCards({ route, p }: { route: RouteName; p: number }) {
  const t = useTrack();
  const exams = examsFor(route, p).filter((e) => !e.onJoin);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-2">
      {exams.map((e) => (
        <UnitCard
          key={e.id}
          name={e.unit.name}
          route={route}
          tick={isClass(e.to) ? { id: e.id, label: `${e.unit.name} reached ${e.to}` } : undefined}
          done={Boolean(t.done[e.id])}
          title={<TierTag cls={e.to} />}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {e.from && (
              <>
                <ClassChip name={e.from} muted />
                <ArrowRight aria-hidden="true" className="size-3.5 text-faint" />
              </>
            )}
            <ClassChip name={e.to} side={e.kind === "detour"} />
            {e.kind === "detour" && <Tag tone="route">side trip</Tag>}
          </div>
          {e.ranks.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {e.ranks.map((r) => (
                <span key={r} className="rounded-[3px] bg-(--c)/10 px-1.5 text-[12px] font-semibold text-ink">{r}</span>
              ))}
            </div>
          )}
          {e.stage.stage.goal && (
            <p className="m-0 mt-1 text-ink-soft">
              <Rich text={e.stage.stage.goal} k={`g${e.id}`} />
            </p>
          )}
          {exitText(e.stage.stage.exit) && (
            <p className="m-0 mt-0.5 text-muted">
              <span className="mr-1 text-[10.5px] font-semibold tracking-[0.06em] text-gold-lo uppercase">
                Leave when
              </span>
              <ConfText text={exitText(e.stage.stage.exit)} k={`x${e.id}`} />
            </p>
          )}
        </UnitCard>
      ))}
    </div>
  );
}

/** The tier of a class as a tiny pill: Advanced, Master, Divine. */
export function TierTag({ cls }: { cls: string }) {
  const tier = CLASSES[classKey(cls) ?? ""]?.tier;
  if (!tier) return null;
  const tone = tier === "Divine"
    ? "bg-[#f3e2a8] text-[#6a4b07] ring-[#c9a23a]/60"
    : tier === "Master"
    ? "bg-[#e9e2f5] text-[#4f3486] ring-[#8f6ec2]/50"
    : "bg-paper-2 text-ink-soft ring-gold/40";
  return (
    <span className={cx("rounded-full px-1.5 py-px text-[10.5px] font-bold tracking-[0.06em] uppercase ring-1", tone)}>
      {tier}
    </span>
  );
}

export const examCount = (route: RouteName, p: number) => examsFor(route, p).filter((e) => !e.onJoin);

/* ------------------------------------------------------------ gear */

/** New kit in each build at a position, plus the plan's give-outs. */
export function KitCards(
  { route, p, assign }: { route: RouteName; p: number; assign?: { item: string; to: string; why?: string }[] },
) {
  const kit = kitFor(route, p);
  return (
    <>
      {kit.length > 0 && (
        <>
          <SubHead>New in each build</SubHead>
          <div className="@container grid gap-1.5">
            {kit.map(({ unit, gear }) => (
              <PinScope key={unit.name} from={{ unit: unit.name }}>
                <div className="grid items-start gap-x-3 gap-y-1 @lg:grid-cols-[150px_minmax(0,1fr)]">
                  <span className="flex min-w-0 items-center gap-1.5 pt-1 text-[14px]">
                    <UnitPortrait name={unit.name} size={24} flat />
                    <UnitRef name={unit.name} avatar={false} />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-start gap-1.5">
                    {gear.map((x) => <ItemMini key={x.g.item} item={x.g.item} kind={x.kind} change={x.change} />)}
                  </span>
                </div>
              </PinScope>
            ))}
          </div>
        </>
      )}
      {assign?.length
        ? (
          <>
            <SubHead>Hand over</SubHead>
            <div className="grid gap-1">
              {assign.map((a) => (
                <div
                  key={a.item + a.to}
                  className="grid grid-cols-[minmax(0,auto)_auto_minmax(0,auto)_minmax(0,1fr)] items-center gap-x-2 text-[14.5px]"
                >
                  <ItemChip name={a.item} />
                  <span className="text-faint">→</span>
                  <UnitRef name={a.to} />
                  {a.why && (
                    <span className="truncate text-[13px] text-muted">
                      · <ConfText text={a.why} k={`a${a.item}`} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )
        : null}
    </>
  );
}

export function ItemChip({ name }: { name: string }) {
  const r = resolve(name.replace(/\s+\+\d+$/, ""), "item") ?? resolve(name);
  return r ? <RefChip r={r} /> : <b>{name}</b>;
}

/** Map drops as item cards with who carries them; "flees" lines get a red tag. */
export function DropGrid({ drops }: { drops: Drop[] }) {
  if (!drops.length) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-1.5">
      {drops.map((d, i) => {
        const at = d.src.at.replace(/^Part II(I)? (Ch \d+|S\d+),?\s*/i, "");
        const flees = /flee|moves from|turn \d/i.test(at);
        return (
          <ItemMini
            key={i}
            item={dropName(d)}
            kind={/Box|Treatise|Crate|Robe|Dew|Speedwing|Talisman|Drop/.test(d.item) ? "Item" : "Weapon"}
            className="w-full"
            sub={
              <>
                {flees && <span className="mr-1 font-semibold text-blood-2">Flees ·</span>}
                {at}
              </>
            }
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ battle facts */

/** Part II defeat: the lord whose War Path it is, Theodora or Bertrand (one name less on Theodora's own). */
export const loseLine = (route: RouteName) =>
  route === "Theodora" ? "Theodora or Bertrand falls" : `${route}, Theodora or Bertrand falls`;

/** The fact tiles and lists of a battle from part2-war.json / part3-salvation.json, plus the plan's tips. */
export function BattleFacts({ b, lose, tips, extra }: { b: Battle; lose: string; tips?: Line[]; extra?: ReactNode }) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        {b.victory && (
          <Fact label="Win">
            <ConfText text={b.victory} k="v" />
          </Fact>
        )}
        <Fact label="Lose if" tone="red">{lose}</Fact>
        <Fact label="Map">
          {b.location}
          {b.max_units
            ? (
              <span className="text-muted">
                {" · max "}
                <b className="text-ink tabular-nums">{b.max_units}</b>
              </span>
            )
            : null}
        </Fact>
        {b.ideal_tier && <Fact label="Ideal tier (Game8)">{b.ideal_tier}</Fact>}
        {extra}
      </div>
      {(b.suggested?.classes?.length || b.suggested?.items?.length)
        ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13.5px]">
            <Kicker className="mr-1">Bring</Kicker>
            {b.suggested?.classes?.map((c) => (
              <span key={c} className="rounded-full bg-paper-2 px-2 py-px font-semibold">{c}</span>
            ))}
            {b.suggested?.items?.map((it) => <ItemChip key={it} name={it} />)}
          </div>
        )
        : null}
      {tips?.length
        ? (
          <>
            <SubHead>Plan</SubHead>
            <Lines lines={tips} k="tips" stats />
          </>
        )
        : null}
      <div className="mt-2 grid gap-3 @container lg:grid-cols-2">
        {b.mechanics?.length
          ? (
            <div>
              <Kicker>Map rules</Kicker>
              <ul className="m-0 mt-1 grid list-none gap-1 p-0 text-[14px] leading-snug">
                {b.mechanics.map((m, i) => (
                  <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2">
                    <span className="mt-[7px] size-1.5 rounded-full bg-(--c)" />
                    <span>
                      <ConfText text={m} k={`m${i}`} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
          : null}
        {(b.enemies?.length || b.reinforcements)
          ? (
            <div>
              <Kicker>Enemies</Kicker>
              <ul className="m-0 mt-1 grid list-none gap-1 p-0 text-[14px] leading-snug">
                {b.enemies?.map((m, i) => (
                  <li key={i} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2">
                    <span className="mt-[7px] size-1.5 rounded-full bg-blood-2/70" />
                    <span>
                      <ConfText text={m} k={`e${i}`} />
                    </span>
                  </li>
                ))}
                {b.reinforcements && (
                  <li className="grid grid-cols-[10px_minmax(0,1fr)] gap-2 text-ink-soft">
                    <span className="mt-[7px] size-1.5 rounded-full bg-faint" />
                    <span>
                      <b className="font-semibold">Reinforcements:</b> <ConfText text={b.reinforcements} k="r" />
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )
          : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------ deploy grid */

/** A seat: portrait, name, class at this point of the campaign. Dashed when empty. */
export function Seat(
  { name, route, p, n, tone }: { name?: string; route: RouteName; p: number; n?: number; tone?: string },
) {
  if (!name) {
    return (
      <div className="grid h-[60px] place-items-center rounded-md border border-dashed border-gold/50 text-[12px] text-faint">
        {n ? `slot ${n}` : "open"}
      </div>
    );
  }
  const u = routeUnits(route).find((x) => x.name === name);
  const ps = u ? activeStage(u, p) : undefined;
  return (
    <div
      className="relative flex h-[60px] min-w-0 items-center gap-2 rounded-md bg-paper/70 px-2 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]"
      style={tone ? { boxShadow: `inset 3px 0 0 ${tone}, inset 0 0 0 1px rgba(176,144,90,.35)` } : undefined}
    >
      {n !== undefined && (
        <span className="absolute top-1 right-1.5 text-[10px] font-semibold text-faint tabular-nums">{n}</span>
      )}
      <UnitPortrait name={name} size={36} ring="var(--color-card)" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[14px] font-semibold">
          <UnitRef name={name} avatar={false} />
        </span>
        <span className="block truncate text-[12px] text-muted">
          {ps ? classLabel(ps.cls) : u ? "" : "from another army"}
        </span>
      </span>
    </div>
  );
}

/** A count against a cap: filled pips, then the number. */
export function CapMeter({ used, cap, label }: { used: number; cap: number; label?: string }) {
  const over = used > cap;
  return (
    <span className="inline-flex items-center gap-1.5" title={`${used} of ${cap}`}>
      <span className="flex gap-[2px]">
        {Array.from(
          { length: cap },
          (_, i) => (
            <span
              key={i}
              className={cx("h-3 w-[5px] rounded-[1px]", i < used ? (over ? "bg-blood-2" : "bg-(--c)") : "bg-gold/30")}
            />
          ),
        )}
      </span>
      <span className={cx("text-[12.5px] font-semibold tabular-nums", over ? "text-blood-2" : "text-ink-soft")}>
        {used}/{cap}
        {label ? ` ${label}` : ""}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ squads */

/** A squad's letter badge in its fixed color (D-127). */
export function SquadBadge(
  { id, size = 22, className, title }: { id: string; size?: number; className?: string; title?: string },
) {
  const t = SQUAD_TONE[id] ?? SQUAD_TONE.A;
  return (
    <span
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-[5px] font-logo font-bold leading-none",
        className,
      )}
      style={{ width: size, height: size, background: t.bg, color: t.fg, fontSize: size * 0.58 }}
      title={title ?? `Squad ${id}`}
    >
      {id}
    </span>
  );
}

/** Squads allowed in a Section, as a label. */
export const squadLine = (n: number) => `${squadCap(n)} squad${squadCap(n) === 1 ? "" : "s"} · up to 8 each`;

export const p3Battle = (name: string) => P3.sections.flatMap((s) => s.battles).find((b) => b.name === name);

/* ------------------------------------------------------------ finish */

export function PartFinish({ route, part, n, label }: { route: RouteName; part: LaterPart; n: number; label: string }) {
  const t = useTrack();
  const done = isPartDone(route, part, n, t);
  const playing = nowIn(route, part, t) === n;
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5 text-[14px]",
        done
          ? "bg-(--c)/10 text-ink-soft shadow-[inset_0_0_0_1px_var(--c)]"
          : "bg-paper-2/70 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]",
      )}
    >
      {done
        ? (
          <>
            <CheckCheck className="size-4 text-(--c)" />
            <b>{label} finished</b>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setPartDone(route, part, n, false)}
              className="text-[13px] font-semibold text-muted underline hover:text-ink"
            >
              Undo
            </button>
          </>
        )
        : (
          <>
            <button
              type="button"
              onClick={() => setPartDone(route, part, n, true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--c) px-3.5 py-1 font-semibold text-white hover:opacity-90"
            >
              <CheckCheck className="size-4" /> Finish {label}
            </button>
            <span className="text-[13px] text-muted">
              {playing ? "You're playing this one." : "Marks it done; open ticks stay as they are."}
            </span>
          </>
        )}
    </div>
  );
}
