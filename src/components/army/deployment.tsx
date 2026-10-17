import type { CSSProperties, ReactNode } from "react";
import {
  ClipboardCheck,
  Crown,
  Feather,
  Flag,
  Footprints,
  Hammer,
  HandHeart,
  HeartPulse,
  Shield,
  Sparkles,
  Swords,
  Target,
  Lightbulb,
  Link2,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { char, META } from "../../lib/data.ts";
import type { Deployment, RouteName } from "../../lib/types.ts";
import { Hover } from "../ui/hover.tsx";
import { Panel, Sub } from "../ui/panel.tsx";
import { ConfText, stripConf } from "../ui/conf-text.tsx";
import { Medal } from "../ui/medal.tsx";
import { HoverText, Mini, personHref } from "./bits.tsx";

type Pick = { name: string; note?: string; known: boolean };

/** "Ultand (Ch 6 to 9), Sirocco (Ch 9 on)" -> two picks with their notes; commas inside parentheses stay. */
export function picks(text: string | undefined): Pick[] {
  if (!text || /^none/i.test(text.trim())) return [];
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^([^(]+?)\s*(?:\((.*)\))?$/);
    const name = (m?.[1] ?? p).trim();
    return { name, note: m?.[2]?.trim(), known: Boolean(char(name)) };
  });
}

export const ROLE_ICON: [RegExp, ReactNode][] = [
  [/lord/i, <Crown key="i" className="size-3.5" />],
  [/battalion/i, <Flag key="i" className="size-3.5" />],
  [/heal/i, <HeartPulse key="i" className="size-3.5" />],
  [/support/i, <HandHeart key="i" className="size-3.5" />],
  [/nuke|caster|magic/i, <Sparkles key="i" className="size-3.5" />],
  [/armor/i, <Hammer key="i" className="size-3.5" />],
  [/tank|wall/i, <Shield key="i" className="size-3.5" />],
  [/flier/i, <Feather key="i" className="size-3.5" />],
  [/ranged|bow|archer/i, <Target key="i" className="size-3.5" />],
  [/mounted|cavalry/i, <Footprints key="i" className="size-3.5" />],
  [/strik|damage|sword|axe/i, <Swords key="i" className="size-3.5" />],
];

function People({ list, route, faded }: { list: Pick[]; route: RouteName; faded?: boolean }) {
  if (!list.length) return <span className="text-faint">–</span>;
  return (
    <span className={faded ? "flex flex-wrap gap-x-3 gap-y-1 opacity-80" : "flex flex-wrap gap-x-3 gap-y-1"}>
      {list.map((p) =>
        p.known
          ? <Mini key={p.name} name={p.name} route={route} size={faded ? 20 : 24} note={p.note} />
          : <span key={p.name} className="text-[13px] text-ink-soft">{p.name}{p.note ? ` (${p.note})` : ""}</span>
      )}
    </span>
  );
}

export function Roles({ r }: { r: RouteName }) {
  const roles = META.routes[r].deployment?.roles;
  if (!roles?.length) return null;
  return (
    <Panel id="roles" icon={<Shield />} title="Roles to fill" sub="Holder first, backup if they're out" bodyClassName="@container">
      <div>
        <div className="hidden grid-cols-[minmax(0,34%)_minmax(0,1fr)_minmax(0,1fr)] border-b border-gold/30 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase @2xl:grid">
          <span className="px-3 py-1.5">Role</span>
          <span className="px-3 py-1.5">Holder</span>
          <span className="px-3 py-1.5">Backup</span>
        </div>
        <ul className="m-0 list-none p-0 text-[13.5px]">
          {roles.map((x) => {
            const icon = ROLE_ICON.find(([re]) => re.test(x.role))?.[1] ?? <Swords className="size-3.5" />;
            return (
              <li
                key={x.role}
                className="grid gap-x-0 gap-y-1 border-b border-gold/15 px-0 py-1.5 last:border-0 @2xl:grid-cols-[minmax(0,34%)_minmax(0,1fr)_minmax(0,1fr)] @2xl:px-0"
              >
                <span className="@2xl:px-3">
                  <Hover
                    label={`${x.role}: why`}
                    card={() => <HoverText title={x.role} rows={[["", x.why]]} />}
                    className="inline-flex items-start gap-1.5 font-semibold decoration-gold decoration-dotted underline-offset-[3px] hover:underline"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-px grid size-6 shrink-0 place-items-center rounded-md bg-(--c)/12 text-(--c)"
                    >
                      {icon}
                    </span>
                    {x.role}
                  </Hover>
                </span>
                <span className="pl-6.5 @2xl:px-3"><People list={picks(x.primary)} route={r} /></span>
                <span className="flex items-baseline gap-2 pl-6.5 @2xl:px-3">
                  <span className="label text-[10px] text-muted @2xl:hidden">Backup</span>
                  <People list={picks(x.backup)} route={r} faded />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ synergies */

type Synergy = NonNullable<Deployment["synergies"]>[number];
type Kind = NonNullable<Synergy["kind"]>;

/** Synergy kinds: icon and colour. Colours stay clear of the four route colours. */
const KIND: Record<Kind, { label: string; color: string; icon: ReactNode }> = {
  defense: { label: "Defense", color: "#4b6a80", icon: <Shield /> },
  offense: { label: "Offense", color: "#a4472c", icon: <Swords /> },
  healing: { label: "Healing", color: "#2f8574", icon: <HeartPulse /> },
  mobility: { label: "Mobility", color: "#a87a1c", icon: <Footprints /> },
  support: { label: "Support", color: "#76569f", icon: <HandHeart /> },
};

/**
 * Headline of a synergy card: `title` when written, else the text before the first colon of `how` when it is short
 * enough to be a headline (the rest becomes the body), else the unit names.
 */
export function synergyHead(s: Synergy): { title: string; body: string; names: boolean } {
  if (s.title) return { title: s.title, body: s.how, names: false };
  const i = s.how.indexOf(":");
  if (i > 0 && i <= 40) {
    const rest = s.how.slice(i + 1).trim();
    return { title: stripConf(s.how.slice(0, i)).trim(), body: rest.charAt(0).toUpperCase() + rest.slice(1), names: false };
  }
  return { title: s.units.join(" + "), body: s.how, names: true };
}

function SynergyCard({ s, r, i }: { s: Synergy; r: RouteName; i: number }) {
  const head = synergyHead(s);
  const kind = s.kind ? KIND[s.kind] : undefined;
  const color = kind?.color ?? "var(--color-gold-lo)";
  return (
    <article
      style={{ "--k": color } as CSSProperties}
      className="flex min-w-0 flex-col overflow-hidden rounded-md bg-paper/60 shadow-[inset_0_0_0_1px_rgba(176,144,90,.32),inset_3px_0_0_var(--k)]"
    >
      <header className="flex items-start gap-2.5 px-3.5 pt-3">
        {kind && (
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-(--k)/12 text-(--k) [&>svg]:size-[17px]"
          >
            {kind.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {kind && (
            <div className="text-[10.5px] font-semibold tracking-[0.12em] text-(--k) uppercase">{kind.label}</div>
          )}
          <h3 className="m-0 font-display text-[17px] leading-tight text-ink">{head.title}</h3>
          {!head.names && (
            <div className="mt-0.5 flex flex-wrap gap-x-1 text-[12.5px] leading-snug text-muted">
              {s.units.map((n, j) => (
                <span key={n}>
                  <a href={personHref(n, r)} className="font-semibold text-ink-soft hover:text-ink hover:underline">{n}</a>
                  {j < s.units.length - 1 && <span aria-hidden="true" className="ml-1 text-faint">·</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="flex shrink-0 -space-x-2.5 pt-0.5">
          {s.units.map((n) => (
            <a
              key={n}
              href={personHref(n, r)}
              title={n}
              className="transition-transform hover:z-10 hover:-translate-y-0.5"
            >
              <Medal name={n} route={char(n)?.homeRoute} size={34} ring="var(--color-card)" />
            </a>
          ))}
        </span>
      </header>
      <p className="mx-3.5 mt-2 mb-3 text-[13.5px] leading-snug text-ink-soft">
        <ConfText text={head.body} k={`syn${i}`} quiet={s.units} />
      </p>
      {s.payoff && (
        <div className="mt-auto flex items-start gap-2 border-t border-(--k)/20 bg-(--k)/[0.08] px-3.5 py-2 text-[13.5px] leading-snug font-medium text-ink">
          <TrendingUp aria-hidden="true" className="mt-[3px] size-3.5 shrink-0 text-(--k)" />
          <span className="min-w-0"><ConfText text={s.payoff} k={`pay${i}`} quiet={s.units} stats /></span>
        </div>
      )}
    </article>
  );
}

export function Synergies({ r }: { r: RouteName }) {
  const list = META.routes[r].deployment?.synergies;
  if (!list?.length) return null;
  return (
    <Panel
      id="synergies"
      icon={<Link2 />}
      title="Synergies to set up"
      sub={`${list.length} pairs and groups that lift each other`}
      bodyClassName="@container"
    >
      <div className="grid gap-2.5 @3xl:grid-cols-2">
        {list.map((s, i) => <SynergyCard key={s.how} s={s} r={r} i={i} />)}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ why this lineup */

function Bullets({ items, tone, k }: { items: string[]; tone: "gap" | "fix"; k: string }) {
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0 text-[13.5px] leading-snug">
      {items.map((g, i) => (
        <li key={g} className="grid grid-cols-[14px_minmax(0,1fr)] gap-2">
          {tone === "gap"
            ? <TriangleAlert aria-hidden="true" className="mt-[2px] size-3.5 text-blood-2/80" />
            : <Wrench aria-hidden="true" className="mt-[2px] size-3.5 text-(--c)" />}
          <span><ConfText text={g} k={`${k}${i}`} /></span>
        </li>
      ))}
    </ul>
  );
}

/** The reasoning behind the lineup and the team check, side by side: reasoning | team check, then gaps | fixes. */
export function WhyLineup({ r }: { r: RouteName }) {
  const d = META.routes[r].deployment;
  const team = META.routes[r].team;
  if (!d && !team) return null;
  return (
    <Panel
      id="why"
      icon={<Lightbulb />}
      title="Why this lineup"
      sub={team ? `The reasoning, ${team.gaps.length} gaps and ${team.fixes.length} fixes` : "The reasoning"}
      fold={{ open: false }}
      bodyClassName="@container"
    >
      <div className="grid gap-x-7 gap-y-1 @3xl:grid-cols-2">
        {d && (
          <section className="min-w-0">
            <Sub icon={<Lightbulb />}>The reasoning</Sub>
            {d.why?.length
              ? (
                <ul className="m-0 list-disc pl-4.5 text-[14px] leading-relaxed">
                  {d.why.map((w, i) => <li key={w}><ConfText text={w} k={`why${i}`} /></li>)}
                </ul>
              )
              : <p className="m-0 text-[14px] leading-relaxed"><ConfText text={d.summary} k="dsum" /></p>}
          </section>
        )}
        {team && (
          <section className="min-w-0">
            <Sub icon={<ClipboardCheck />}>Team check</Sub>
            <p className="m-0 text-[14px] leading-relaxed"><ConfText text={team.summary} k="tsum" /></p>
          </section>
        )}
        {team && (
          <>
            <section className="min-w-0">
              <Sub icon={<TriangleAlert />} aside={<span className="text-[12px] text-muted tabular-nums">{team.gaps.length}</span>}>
                Gaps
              </Sub>
              <Bullets items={team.gaps} tone="gap" k="gap" />
            </section>
            <section className="min-w-0">
              <Sub icon={<Wrench />} aside={<span className="text-[12px] text-muted tabular-nums">{team.fixes.length}</span>}>
                Fixes
              </Sub>
              <Bullets items={team.fixes} tone="fix" k="fix" />
            </section>
          </>
        )}
      </div>
    </Panel>
  );
}
