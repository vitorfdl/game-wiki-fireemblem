import { char, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import type { DeployStatus, RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Hover } from "../ui/hover.tsx";
import { Medal } from "../ui/medal.tsx";
import { ConfText } from "../ui/conf-text.tsx";

export const STATUS_LABEL: Record<DeployStatus, string> = {
  core: "Core",
  early: "Early",
  late: "Late",
  bench: "Bench",
};

export const STATUS_HINT: Record<DeployStatus, string> = {
  core: "Deploys every Part I map once joined",
  early: "Deploys early, then gives up the slot",
  late: "Takes a slot once recruited, late in Part I",
  bench: "Waits on the bench for Part II",
};

export const STATUS_STYLE: Record<DeployStatus, string> = {
  core: "bg-(--c)/14 text-(--c)",
  early: "bg-teal-3/12 text-teal-3",
  late: "bg-gold/20 text-gold-lo",
  bench: "bg-paper-3/80 text-muted",
};

export type Badge = DeployStatus | "filler" | "extra";

const BADGE_LABEL: Record<Badge, string> = { ...STATUS_LABEL, filler: "Filler", extra: "2nd copy" };
const BADGE_HINT: Record<Badge, string> = {
  ...STATUS_HINT,
  filler: "Bench only: recruited for an item or supports",
  extra: "Second copy of a unit from another route; the copies merge in Part III",
};
const BADGE_STYLE: Record<Badge, string> = {
  ...STATUS_STYLE,
  filler: "shadow-[inset_0_0_0_1px_var(--color-gold)] text-gold-lo",
  extra: "bg-ink-soft/10 text-ink-soft",
};

/** Deployment status as a small badge next to a name; hover gives the hint and, when written, the reason. */
export function StatusPill({ status, why, className }: { status?: Badge; why?: string; className?: string }) {
  if (!status) return null;
  const pill = (
    <span
      title={why ? undefined : BADGE_HINT[status]}
      className={cx(
        "inline-block rounded px-1.5 text-[10.5px] leading-[1.6] font-bold tracking-[0.08em] whitespace-nowrap uppercase",
        BADGE_STYLE[status],
        className,
      )}
    >
      {BADGE_LABEL[status]}
    </span>
  );
  if (!why) return pill;
  return (
    <Hover
      label={`${BADGE_LABEL[status]}: why`}
      card={() => <HoverText title={`${BADGE_LABEL[status]} · ${BADGE_HINT[status]}`} rows={[["", why]]} />}
      className="inline-flex"
    >
      {pill}
    </Hover>
  );
}

/** Build page for a unit in this army: its home dossier, or the copy plan for a second copy. */
export function personHref(name: string, route: RouteName): string | undefined {
  const c = char(name);
  if (!c) return undefined;
  return c.homeRoute === route || name === route
    ? href(routeSlug(route), c.slug)
    : href(routeSlug(route), c.slug, "copy");
}

/** Small portrait plus name, linking to the unit's build. */
export function Mini({ name, route, size = 24, note }: { name: string; route: RouteName; size?: number; note?: string }) {
  const c = char(name);
  return (
    <a
      href={personHref(name, route)}
      className="inline-flex min-w-0 items-center gap-1.5 font-semibold hover:underline"
      title={note ? `${name}: ${note}` : name}
    >
      {c && <Medal flat name={name} route={c.homeRoute} size={size} />}
      <span className="shrink-0 text-[13.5px] whitespace-nowrap">{name}</span>
      {note && <span className="truncate text-[12px] font-normal text-muted">{note}</span>}
    </a>
  );
}

/** Body of a text hover card: a kicker and a few labelled paragraphs. */
export function HoverText({ title, rows }: { title: string; rows: [string, string | undefined][] }) {
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]));
  return (
    <div className="pr-5">
      <b className="block text-[15px]">{title}</b>
      {shown.map(([k, v]) => (
        <p key={k} className="mt-2 mb-0 text-[13.5px] leading-snug">
          {k && <span className="label mr-1.5 text-[10.5px] text-gold-lo">{k}</span>}
          <ConfText text={v} k={`ht${k}`} />
        </p>
      ))}
    </div>
  );
}
