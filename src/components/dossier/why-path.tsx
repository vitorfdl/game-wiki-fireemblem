import { ConfText } from "../ui/conf-text.tsx";
import type { ReactNode } from "react";
import type { Decision, Finalists, Guide, RouteName, StatLine } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { finalistTable } from "../../lib/growth.ts";
import { CalloutBox, Tag } from "../chapter/bits.tsx";
import { Rich } from "../ref/rich.tsx";
import { Chip, ClampBox, ClampText, Label, MoreFold } from "./fold.tsx";
import { Panel, Tile } from "../ui/panel.tsx";
import { DataTable, TD, TR } from "../ui/data-table.tsx";
import { ClassChip } from "../ui/class-chip.tsx";
import {
  Anchor,
  BookOpen,
  ChevronRight,
  Compass,
  GitBranch,
  GraduationCap,
  Map as MapIcon,
  Music,
  Package,
  PawPrint,
  ScrollText,
  Shield,
  Sprout,
  Wine,
} from "lucide-react";

function ChoiceRow({ r, i, quiet }: { r: Decision; i: number; quiet?: string[] }) {
  return (
    <li className="grid gap-x-4 gap-y-0.5 border-t border-gold/15 py-2 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="min-w-0 text-[14.5px] leading-snug">
        <b className="font-semibold">{r.topic}</b>
        {r.pick && <span className="mt-0.5 block text-[13px] font-semibold text-(--c)"><Rich text={r.pick} k={`wp${i}`} /></span>}
      </div>
      <div className="min-w-0 text-[14px] leading-snug text-ink-soft">
        <ClampText text={r.why} k={`wy${i}`} chars={190} quiet={quiet} />
        {r.else && (
          <span className="mt-0.5 block text-[12.5px] text-muted">
            Else: <Rich text={r.else} k={`we${i}`} />
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Class finalists (D-121): candidate classes compared on the role's stats. Growth % is derived (personal + class row,
 * mounted row when a mount is named); the best value per stat is gold. Picked rows say where they are used.
 */
function FinalistsTable({ f, growths, quiet }: { f: Finalists; growths: StatLine; quiet?: string[] }) {
  const { rows, best } = finalistTable(growths, f);
  return (
    <div className="mt-3">
      <Label aside="Growth % = personal + class (base mount off Cai's route)">Class finalists</Label>
      <DataTable
        card
        cols={[
          "Class",
          ...f.stats.map((s) => ({ label: s, className: "w-[2.75rem] px-2! text-right" })),
          "Use",
          { label: "Why", className: "min-w-[8.5rem]" },
        ]}
      >
        {rows.map((r, i) => {
          const picked = Boolean(r.use);
          return (
            <TR key={i} className={cx("align-middle!", !picked && "text-muted")}>
              <TD>
                <ClassChip name={r.class} muted={!picked} />
                {r.mount && (
                  <span className="mt-0.5 block pl-1 text-[11.5px] leading-tight text-muted">on {r.mount}</span>
                )}
              </TD>
              {f.stats.map((s) => {
                const v = r.growth[s];
                const top = v !== undefined && v === best[s];
                return (
                  <TD
                    key={s}
                    className={cx(
                      "px-2! text-right text-[13.5px] tabular-nums",
                      top ? "bg-gold/15 font-bold text-gold-lo" : picked ? "font-medium text-ink" : "text-faint",
                    )}
                  >
                    {r.key ? v : "?"}
                  </TD>
                );
              })}
              <TD className="whitespace-nowrap">{picked ? <Chip tone="route">{r.use}</Chip> : <Tag>Rejected</Tag>}</TD>
              <TD className={cx("text-[13px] leading-snug", picked ? "text-ink-soft" : "text-muted")}>
                <Rich text={r.note} k={`fn${i}`} quiet={quiet} />
              </TD>
            </TR>
          );
        })}
      </DataTable>
    </div>
  );
}

/** A key move. Text up to the first ":" or ";" is its bold label; a move without one reads as plain text. */
function KeyMove({ text, i, quiet }: { text: string; i: number; quiet?: string[] }) {
  // Paren-aware: a ";" inside "( ... )" is not the label's end. A label past 60 characters isn't a label: no bold.
  const m = text.match(/^((?:[^:;()]|\([^()]*\)){2,60}?)([:;])\s+(.*)$/s);
  return (
    <li className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-x-1.5 py-[3px] text-[14px] leading-snug">
      <ChevronRight aria-hidden="true" className="mt-[2px] size-4 text-(--c)" strokeWidth={2.5} />
      <span className="min-w-0 text-ink-soft">
        {m
          ? (
            <>
              <b className="font-semibold text-ink"><Rich text={m[1]} k={`kh${i}`} quiet={quiet} /></b>
              {m[2]} <Rich text={m[3]} k={`kr${i}`} quiet={quiet} />
            </>
          )
          : <Rich text={text} k={`k${i}`} quiet={quiet} />}
      </span>
    </li>
  );
}

/**
 * How to play: what the unit is for and how to play it (summary), callouts, authored decisions, the first key moves,
 * and the other route on one line. Side trips are not repeated here: the Journey stepper marks them and each stage owns
 * its goal.
 */
export function HowToPlay(
  { guide, summary, keysShown = 3, self, growths }: {
    guide?: Guide;
    summary?: string;
    keysShown?: number;
    self?: string;
    growths?: StatLine;
  },
) {
  const quiet = self ? [self] : undefined;
  const rows = guide?.decisions ?? [];
  const keys = guide?.keys ?? [];
  const callouts = guide?.callouts ?? [];
  const finalists = growths && guide?.finalists?.options.length ? guide.finalists : undefined;
  if (!rows.length && !callouts.length && !summary && !keys.length && !finalists) return null;
  return (
    <Panel id="how" icon={<Compass />} title="How to play" sub="Purpose, playstyle and the moves that make the build" className="h-full">
      {summary && <p className="mt-0 mb-2 text-[15px] leading-relaxed"><Rich text={summary} k="sum" quiet={quiet} /></p>}
      {callouts.map((c, i) => <CalloutBox key={i} c={c} k={`co${i}`} />)}
      {rows.length > 0 && (
        <div className="mt-3">
          <Label>Choices</Label>
          <ul className="m-0 list-none p-0">{rows.map((r, i) => <ChoiceRow key={i} r={r} i={i} quiet={quiet} />)}</ul>
        </div>
      )}
      {finalists && growths && <FinalistsTable f={finalists} growths={growths} quiet={quiet} />}
      {keys.length > 0 && (
        <div className="mt-3">
          <Label>Key moves</Label>
          <ul className="m-0 list-none p-0">{keys.slice(0, keysShown).map((k, i) => <KeyMove key={i} text={k} i={i} quiet={quiet} />)}</ul>
          {keys.length > keysShown && (
            <MoreFold label={`${keys.length - keysShown} more`} className="pl-[19px]">
              <ul className="m-0 list-none p-0">
                {keys.slice(keysShown).map((k, i) => <KeyMove key={i} text={k} i={i + keysShown} quiet={quiet} />)}
              </ul>
            </MoreFold>
          )}
        </div>
      )}
      {guide?.alt && (
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 border-t border-gold/20 pt-2.5 text-[13.5px] leading-snug">
          <b className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
            <GitBranch aria-hidden="true" className="size-3.5 text-gold-lo" />Other route
          </b>
          <ClampText text={guide.alt} k="alt" lines={1} chars={90} className="text-ink-soft" quiet={quiet} />
        </div>
      )}
    </Panel>
  );
}

const SYSTEM_ICON: [RegExp, ReactNode][] = [
  [/battalion|gambit|authority/i, <Shield key="s" />],
  [/stable|lur|mount|ornius/i, <PawPrint key="p" />],
  [/danc|song|perform/i, <Music key="m" />],
  [/drink|tavern|recipe|meal/i, <Wine key="w" />],
  [/farm|crop|plant/i, <Sprout key="f" />],
  [/quest|request|kindness/i, <ScrollText key="q" />],
  [/ship|island|sea/i, <Anchor key="a" />],
  [/mentor|training|exam/i, <GraduationCap key="g" />],
  [/suppl|send|barter|shop/i, <Package key="k" />],
  [/map|area|region/i, <MapIcon key="mp" />],
];
const iconFor = (system: string) => SYSTEM_ICON.find(([re]) => re.test(system))?.[1] ?? <BookOpen />;

/** How the route's own systems change this build: one card per system, its notes clamped to three lines. */
export function RouteNotes({ guide, route, self }: { guide?: Guide; route: RouteName | null; self?: string }) {
  const notes = guide?.routeNotes ?? [];
  if (!notes.length) return null;
  const groups = new Map<string, string[]>();
  for (const n of notes) groups.set(n.system, [...(groups.get(n.system) ?? []), n.note]);
  const quiet = self ? [self] : undefined;
  return (
    <Panel
      icon={<Compass />}
      title={`On ${route ? `${route}'s route` : "this route"}`}
      sub="What the route's own systems change for this build"
    >
      <ul
        className={cx(
          "m-0 grid list-none items-start gap-2.5 p-0",
          groups.size > 1 && "md:grid-cols-2",
          groups.size > 2 && "xl:grid-cols-3",
        )}
      >
        {[...groups].map(([system, list], gi) => (
          <li key={system} className="min-w-0">
            <Tile icon={iconFor(system)} title={system}>
              <ClampBox lines={3} className="text-[13.5px] leading-snug text-ink-soft">
                {list.map((n, i) => (
                  <p key={i} className="m-0 mb-1 last:mb-0">
                    <ConfText text={n} k={`rn${gi}.${i}`} quiet={quiet} />
                  </p>
                ))}
              </ClampBox>
            </Tile>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
