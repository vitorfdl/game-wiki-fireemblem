import type { ReactNode } from "react";
import type { Character, Guide, RouteName, Stage } from "../../lib/types.ts";
import { growthRow, mountAt, primaryClass, stripParens } from "../../lib/growth.ts";
import { kitChanges, leftBehind } from "../../lib/snapshot.ts";
import { inventory } from "../../lib/inventory.ts";
import { itemWeight } from "../../lib/items.ts";
import { ids } from "../../lib/chapter.ts";
import { battalionRef, keyItemsOf, resolve } from "../../lib/refs.ts";
import { stageWindow } from "../../lib/holders.ts";
import { cx } from "../../lib/cx.ts";
import { KindPill } from "../walkthrough/stage-bits.tsx";
import { InventoryMeter } from "../ui/kit-type.tsx";
import {
  Backpack,
  Dumbbell,
  Flag,
  Gauge,
  Gem,
  Lightbulb,
  ListChecks,
  PawPrint,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Tick } from "../chapter/bits.tsx";
import { Sub, Tile } from "../ui/panel.tsx";
import { Hover } from "../ui/hover.tsx";
import { renderCard } from "../ref/cards.tsx";
import { useScope } from "../ref/ctx.ts";
import { Rich } from "../ref/rich.tsx";
import { AbilitySlots, DropList, type KitRow, KitSlots, NoteList, RefName, TipList, TrainingList } from "./lists.tsx";
import { MoreFold } from "./fold.tsx";
import { GrowthChecks } from "./growth-checks.tsx";
import { TierBadge } from "./journey.tsx";
import { firstSentence, levelLabel, rangeLabel } from "./variants.ts";

type Props = {
  stages: Stage[];
  index: number;
  cls: string;
  character: Character;
  guide: Guide;
  /** Route whose tracked "class reached" event this stage ticks. */
  route: RouteName | null;
};

function prevCls(stages: Stage[], index: number): string {
  const p = stages[index - 1];
  return p ? primaryClass(p.class) || p.class || "" : "";
}

/** Weight of the weapon in hand plus the core equipment, when every weight is known. */
function stageLoad(stage: Stage): number | undefined {
  const worn = [stage.weapons?.[0], ...(stage.equipment ?? []).filter((g) => !g.situational)].filter(Boolean)
    .map((g) => itemWeight(g!.item));
  if (!worn.length || worn.some((w) => w === undefined)) return undefined;
  return worn.reduce((a, b) => a! + b!, 0);
}

function useStage({ stages, index, cls, character, route }: Props) {
  const stage = stages[index];
  const prev = stages[index - 1];
  const changes = kitChanges(stage, prev);
  const rows: KitRow[] = [
    ...(stage.weapons ?? []).map((g, i) => ({ g, kind: "Weapon" as const, change: changes.weapons?.[i] })),
    ...(stage.equipment ?? []).map((g, i) => ({ g, kind: "Equipment" as const, change: changes.equipment?.[i] })),
    ...(stage.items ?? []).map((g, i) => ({ g, kind: "Item" as const, change: changes.items?.[i] })),
  ];
  // Every class has 5 ability slots (player-confirmed, D-102). The personal skill never takes one.
  const slots = 5;
  // Same id as the walkthrough's exam row; a stage that keeps the previous class has no exam to tick.
  const sameClass = index > 0 && prevCls(stages, index) === cls;
  const examId = route && cls && !sameClass ? ids.exam(route, character.name, cls, index) : undefined;
  return { stage, prev, changes, rows, slots, examId };
}

/** A titled block inside the stage detail: the panel's Sub heading over its content. */
/** The battalion this stage carries: name chip (hover card), tier, carrier bonuses, gambit, why and where. */
function BattalionStrip({ b }: { b: NonNullable<Stage["battalion"]> }) {
  const ref = battalionRef(b.name);
  return (
    <div className={cx("rounded-md border border-paper-3 bg-paper-2/60 px-3 py-2", b.situational && "border-dashed")}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold">
          <RefName name={b.name} t="battalion" />
        </span>
        {ref && <span className="rounded bg-teal px-1.5 text-[11px] font-bold text-parchment">Tier {ref.tier}</span>}
        {ref &&
          Object.entries(ref.stats).map(([k, v]) => (
            <span key={k} className="rounded bg-card px-1.5 text-[12px] tabular-nums">
              <span className="text-muted">{k}</span> <b>+{v}</b>
            </span>
          ))}
        {ref?.gambit?.name && (
          <span className="text-[12.5px] text-muted">
            Gambit: <b className="text-ink-soft">{ref.gambit.name}</b>
          </span>
        )}
      </div>
      {b.why && (
        <p className="mt-1 mb-0 text-[13px]">
          <Rich text={b.why} />
        </p>
      )}
      {(b.where || b.alts?.length || b.situational) && (
        <p className="mt-0.5 mb-0 text-[12px] text-muted">
          {b.where && <Rich text={b.where} />}
          {b.alts?.length ? <>{b.where ? " · " : ""}Else: {b.alts.join(", ")}</> : null}
          {b.situational ? <>{(b.where || b.alts?.length) ? " · " : ""}{b.situational}</> : null}
        </p>
      )}
    </div>
  );
}

function Block({ icon, title, aside, children, className }: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <Sub icon={icon} aside={aside && <span className="text-[12px] text-muted tabular-nums">{aside}</span>}>
        {title}
      </Sub>
      {children}
    </div>
  );
}

/** Class name in display type with the class hover card. */
function ClassTitle({ cls }: { cls: string }) {
  const scope = useScope();
  const r = cls ? resolve(cls, "class") : undefined;
  const text = (
    <span className="font-display text-[clamp(24px,2.6vw,30px)] leading-[1.05]">
      {cls || "Before the class tutorial"}
    </span>
  );
  if (!r) return <h2 className="m-0">{text}</h2>;
  return (
    <h2 className="m-0">
      <Hover
        card={() => renderCard("class", r.name, scope)}
        label={`${cls} class card`}
        className="decoration-gold/50 decoration-dotted underline-offset-[5px] hover:underline"
      >
        {text}
      </Hover>
    </h2>
  );
}

/**
 * The selected stage (detail side of the Journey panel): class header, goal, leave condition, masteries; the six
 * inventory slots as cards; arts, abilities and training side by side; then why this stage and its tips.
 */
export function StageCore(props: Props) {
  const { index, cls, character, stages } = props;
  const { stage, prev, changes, rows, slots, examId } = useStage(props);
  const gone = leftBehind(stage, prev);
  const inv = inventory(stage);
  const load = stageLoad(stage);
  const [lead, rest] = firstSentence(stage.goal ?? "");
  const why = [...(rest ? [rest] : []), ...(stage.why ?? [])];
  const tips = stage.tips ?? [];
  const classNote = stage.class && stripParens(stage.class) !== cls ? stage.class : "";
  const fresh = rows.filter((r) => r.change && r.change !== "kept").length;
  const arts = [...(stage.arts ?? []), ...(stage.spells ?? [])];
  const side = stage.kind === "detour" || stage.kind === "fix";
  const mount = stage.mount ? mountAt(stages, index) ?? stage.mount : undefined;
  const lvl = levelLabel(stage);
  const swaps = rows.filter((r) => r.g.situational).length;
  const win = props.route ? stageWindow(props.route, character.name, index) : null;
  const kitCtx = props.route && win ? { route: props.route, unit: character.name, ...win } : null;
  const quiet = [character.name];
  return (
    <section aria-label={`Stage ${index + 1}: ${cls}`} className="min-w-0 animate-rise">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <TierBadge cls={cls} side={side} size={34} />
        <ClassTitle cls={cls} />
        <KindPill kind={stage.kind} />
        <span className="flex-1" />
        {examId && (index > 0 || !character.isLord) && (
          <label
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[13px] shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]"
            title='Moves "you" on the journey'
          >
            <Tick id={examId} label={`${character.name} reached ${cls}`} />
            <span className="font-semibold">{index === 0 ? "Joined" : "Reached"}</span>
          </label>
        )}
      </div>
      <div
        className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-ink-soft tabular-nums"
        title={[stage.when, stage.level].filter(Boolean).join(" · ")}
      >
        <b className="font-semibold text-ink">{rangeLabel(stage)}</b>
        {lvl && <span>· {lvl}</span>}
        {mount && (
          <span className="inline-flex items-center gap-1">
            · <PawPrint aria-hidden="true" className="size-3.5 text-gold-lo" />
            <RefName name={mount} t="mount" />
          </span>
        )}
        {classNote && <span className="text-muted">· {classNote}</span>}
      </div>

      {stage.goal && (
        <p className="mt-2 mb-0 text-[15.5px] leading-snug font-medium">
          <Rich text={lead} k="goal" quiet={quiet} />
        </p>
      )}
      {(stage.exit || stage.masteries?.length) && (
        <div className="mt-2 grid gap-x-4 gap-y-1.5 rounded-md bg-[color-mix(in_srgb,var(--c)_7%,var(--color-card))] px-3 py-2 shadow-[inset_3px_0_0_var(--c),inset_0_0_0_1px_color-mix(in_srgb,var(--c)_25%,transparent)] sm:grid-cols-[minmax(0,1fr)_auto]">
          {stage.exit && (
            <p className="m-0 flex items-start gap-2 text-[14px] leading-snug">
              <Flag aria-hidden="true" className="mt-[2px] size-4 shrink-0 text-(--c)" />
              <span>
                <b className="mr-1 font-bold text-(--c)">Leave when</b>
                <Rich text={stage.exit.replace(/^Leave\b\s*(when\s*)?/i, "")} k="exit" quiet={quiet} />
              </span>
            </p>
          )}
          {stage.masteries?.length
            ? (
              <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                <span className="text-[11px] font-bold tracking-[0.08em] text-gold-lo uppercase">Master</span>
                {stage.masteries.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-[2px] text-[12.5px] font-semibold shadow-[inset_0_0_0_1px_rgba(176,144,90,.6)]"
                  >
                    <Star aria-hidden="true" className="size-3 fill-gold-hi text-gold" />
                    <RefName name={m} t="ability" />
                  </span>
                ))}
              </div>
            )
            : null}
        </div>
      )}

      <Block
        className="mt-4"
        icon={<Backpack />}
        title="Inventory"
        aside={
          <span className="flex flex-wrap items-center justify-end gap-x-3">
            {prev && rows.length > 0 && fresh > 0 && <span className="font-semibold text-(--c)">{fresh} new</span>}
            {load !== undefined && <span title="Weapon in hand plus worn equipment">Wt {load}</span>}
            <InventoryMeter bare core={inv.core} swaps={swaps} cap={inv.cap} />
          </span>
        }
      >
        {rows.length > 0
          ? <KitSlots rows={rows} part={stage.from?.part} ctx={kitCtx} />
          : <p className="m-0 text-[13px] text-faint">No kit listed for this stage.</p>}
        {keyItemsOf(character.name).map((k) => (
          <p key={k.name} className="mt-1.5 mb-0 text-[12px] text-muted">
            <Rich text={`[[item:${k.name}]]`} />{" "}
            {k.fx ? `${k.fx.replace(/\.$/, "")}: ` : ""}key item, always on, no slot, no weight.
          </p>
        ))}
        {gone.length > 0 && (
          <MoreFold
            label={`Drops ${gone.length} item${gone.length > 1 ? "s" : ""} from the last stage`}
            className="mt-1.5"
          >
            <DropList items={gone} />
          </MoreFold>
        )}
      </Block>

      <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
        <Block
          icon={<Sparkles />}
          title={stage.spells?.length && !stage.arts?.length ? "Spells" : "Combat arts"}
          aside={arts.length || undefined}
        >
          {arts.length
            ? (
              <NoteList
                items={arts}
                changes={[...(changes.arts ?? []), ...(changes.spells ?? [])]}
                type={stage.arts?.length ? "art" : "spell"}
              />
            )
            : <p className="m-0 text-[13px] text-faint">None this stage.</p>}
        </Block>
        <Block icon={<Gem />} title="Abilities" aside={`${stage.abilities?.length ?? 0}/${slots}`}>
          <AbilitySlots items={stage.abilities ?? []} changes={changes.abilities} slots={slots} />
          {character.personalSkill && (
            <p className="mt-1.5 mb-0 text-[12px] text-muted">
              <b className="font-semibold text-ink-soft">{character.personalSkill.name}</b>: personal, no slot.
            </p>
          )}
          {stage.openSlots && <p className="mt-1 mb-0 text-[12px] text-muted">Open slot: {stage.openSlots}</p>}
        </Block>
      </div>

      {stage.battalion && (
        <Block className="mt-4" icon={<Users />} title="Battalion" aside="infantry only · not an item">
          <BattalionStrip b={stage.battalion} />
        </Block>
      )}

      {stage.training?.length
        ? (
          <Block className="mt-4" icon={<Dumbbell />} title="Train now">
            <TrainingList items={stage.training} />
          </Block>
        )
        : null}

      {stage.checks?.length
        ? (
          <Block className="mt-4" icon={<Gauge />} title="Growth checks" aside="level-ups are random">
            <GrowthChecks
              checks={stage.checks}
              personal={character.growths}
              row={growthRow(stage, mountAt(stages, index))}
              quiet={quiet}
            />
          </Block>
        )
        : null}

      {(why.length > 0 || tips.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {why.length > 0 && (
            <Tile
              icon={<Lightbulb />}
              title={`Why ${cls || "this stage"}`}
              className={cx(!tips.length && "md:col-span-2")}
            >
              <TipList items={why} k="why" quiet={quiet} />
            </Tile>
          )}
          {tips.length > 0 && (
            <Tile icon={<ListChecks />} title="Tips" className={cx(!why.length && "md:col-span-2")}>
              <TipList items={tips.slice(0, 4)} k="tip" quiet={quiet} />
              {tips.length > 4 && (
                <MoreFold label={`${tips.length - 4} more`} className="mt-1">
                  <TipList items={tips.slice(4)} k="tip4" quiet={quiet} />
                </MoreFold>
              )}
            </Tile>
          )}
        </div>
      )}
    </section>
  );
}

/** Build-wide lists from older guides (arts, abilities, specials not tied to a stage). */
export function LegacyLists({ guide }: { guide: Guide }) {
  const legacy = [guide.arts, guide.spells, guide.abilities, guide.specials].some((x) => x?.length);
  if (!legacy) return null;
  return (
    <MoreFold label="All arts, abilities and specials for this build">
      <div className="grid gap-3 md:grid-cols-3">
        {guide.arts?.length
          ? (
            <Block icon={<Sparkles />} title="Combat arts to learn">
              <NoteList items={guide.arts} type="art" />
            </Block>
          )
          : null}
        {guide.spells?.length
          ? (
            <Block icon={<Sparkles />} title="Spells to know">
              <NoteList items={guide.spells} type="spell" />
            </Block>
          )
          : null}
        {guide.abilities?.length
          ? (
            <Block icon={<Gem />} title="Abilities worth equipping">
              <NoteList items={guide.abilities} type="ability" />
            </Block>
          )
          : null}
        {guide.specials?.length
          ? (
            <Block icon={<Star />} title="Specials">
              <TipList items={guide.specials} k="sp" />
            </Block>
          )
          : null}
      </div>
    </MoreFold>
  );
}
