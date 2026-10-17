import { Fragment, type MouseEvent as ReactMouseEvent, type ReactNode, useContext } from "react";
import {
  BookOpen,
  Gauge,
  Gem,
  Gift,
  GraduationCap,
  Leaf,
  MapPin,
  PawPrint,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { char, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import type { RouteName } from "../../lib/types.ts";
import { routeUnits } from "../../lib/walkthrough/builds.ts";
import { p3Route } from "../../lib/part-army.ts";
import { currentPart } from "../../lib/track.ts";
import { routeVars } from "../../lib/route-style.ts";
import { itemRef, type Ref, type RefType, resolve, splitRefs, splitStats, type StatDelta } from "../../lib/refs.ts";
import { cx } from "../../lib/cx.ts";
import { foldName, ITEM_BY_NAME, NODE_BY_NAME } from "../../lib/map.ts";
import { BREED_BY_NAME, hasStable } from "../../lib/mounts.ts";
import { closeHover, Hover, InCard } from "../ui/hover.tsx";
import { Medal } from "../ui/medal.tsx";
import { hasPortrait } from "../ui/portrait.tsx";
import { enhance } from "../walkthrough/inline.tsx";
import { WalkCtx } from "../walkthrough/ctx.ts";
import { renderCard, renderStatCard } from "./cards.tsx";
import { RouteCtx, useScope } from "./ctx.ts";
import { PinFromCtx, pinKindOf, resolveFrom } from "../../lib/pins.ts";
import { PinToggle } from "../ui/pin-toggle.tsx";

const DOTTED =
  "decoration-dotted decoration-1 underline underline-offset-[3px] hover:decoration-solid hover:decoration-ink";

function itemIcon(name: string) {
  const it = itemRef(name);
  if (it?.kind === "Equipment") {
    return <Shield aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
  }
  if (it?.kind === "Item") {
    return <Gem aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
  }
  if (/manual|archive/i.test(name)) {
    return <BookOpen aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
  }
  return <Swords aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
}

/**
 * Build page for a unit as seen from a route: its home build, the copy plan when it is a second copy in this army,
 * else its home army's build (or the later-joiners page). In Part III (the page's Part, else the remembered one) it
 * opens the copy the plan recruits (D-145).
 */
export function unitHref(name: string, route: RouteName | null, part?: 1 | 2 | 3): string {
  const c = char(name);
  if (!c) return "#/";
  if ((part ?? currentPart()) === 3) {
    const pick = p3Route(name);
    if (pick) return href(routeSlug(pick), c.slug);
    if (!c.homeRoute) return href("reserve", c.slug);
  }
  const inArmy = route ? routeUnits(route).find((u) => u.name === name) : undefined;
  if (route && inArmy) return href(routeSlug(route), c.slug, inArmy.extra ? "copy" : undefined);
  return c.homeRoute ? href(routeSlug(c.homeRoute), c.slug) : href("reserve", c.slug);
}

/** A plain left click, not one that asks for a new tab (Ctrl, Cmd, Shift, middle button). */
export const plainClick = (e: MouseEvent | ReactMouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * A unit name: portrait plus name, as a real link to the build page (no hover card). In the walkthrough a plain
 * click opens the Units side panel on the unit instead; Ctrl or middle click still opens the build.
 */
export function UnitRef({ name, avatar = true, label }: { name: string; avatar?: boolean; label?: string }) {
  const walk = useContext(WalkCtx);
  const page = useContext(RouteCtx);
  const c = char(name);
  if (!c) return <>{label ?? name}</>;
  const route = walk?.route ?? page ?? null;
  return (
    <a
      href={unitHref(name, route, walk?.part)}
      onClick={(e) => {
        if (!walk || walk.unitsOpenPage || !plainClick(e)) return;
        e.preventDefault();
        closeHover();
        walk.focusUnit(name);
      }}
      title={walk && !walk.unitsOpenPage
        ? `${name}: open in the Units panel (Ctrl-click for the full build)`
        : `${name}'s build`}
      style={routeVars(c.homeRoute)}
      className="font-semibold whitespace-nowrap text-inherit no-underline underline-offset-[3px] hover:text-(--c) hover:underline"
    >
      {avatar && hasPortrait(name) && (
        <span className="mr-[4px] ml-[2px] inline-block align-[-0.28em]">
          <Medal flat name={name} route={c.homeRoute} size={18} />
        </span>
      )}
      {label ?? name}
    </a>
  );
}

/** A unit's portrait as the same link as UnitRef: Units panel in the walkthrough, the build page elsewhere. */
export function UnitPortrait(
  { name, size = 28, flat, ring, className, title }: {
    name: string;
    size?: number;
    flat?: boolean;
    ring?: string;
    className?: string;
    /** Tooltip; defaults to the name. */
    title?: string;
  },
) {
  const walk = useContext(WalkCtx);
  const page = useContext(RouteCtx);
  const c = char(name);
  if (!c) return <Medal name={name} size={size} flat={flat} ring={ring} />;
  return (
    <a
      href={unitHref(name, walk?.route ?? page ?? null, walk?.part)}
      onClick={(e) => {
        if (!walk || walk.unitsOpenPage || !plainClick(e)) return;
        e.preventDefault();
        closeHover();
        walk.focusUnit(name);
      }}
      aria-label={name}
      title={title ?? name}
      className={cx("inline-block shrink-0 rounded-full transition-transform hover:-translate-y-0.5", className)}
    >
      <Medal name={name} route={c.homeRoute} size={size} flat={flat} ring={ring} />
    </a>
  );
}

/** Any resolved ref as an inline chip. `bare`: no type icon (when a badge beside it already says the type). */
export function RefChip({ r, bare }: { r: Ref; bare?: boolean }) {
  const scope = useScope();
  const walk = useContext(WalkCtx);
  const inCard = useContext(InCard);
  const pinFrom = useContext(PinFromCtx);
  if (r.type === "unit") return <UnitRef name={r.name} label={r.label} />;
  const pinKind = pinKindOf(r.type);
  let icon: ReactNode = null;
  let tone = "decoration-gold/60";
  let onOpen: (() => void) | undefined;
  switch (r.type) {
    case "item":
      icon = itemIcon(r.name);
      tone = "decoration-gold/60";
      break;
    case "class":
      icon = <GraduationCap aria-hidden="true" className="mr-[2px] inline size-[0.9em] align-[-0.1em] text-faint" />;
      tone = "decoration-gold/60";
      break;
    case "art":
    case "ability":
      icon = <Sparkles aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      break;
    case "quest":
      icon = <ScrollText aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      break;
    case "place": {
      icon = <MapPin aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      const n = NODE_BY_NAME.get(foldName(r.name));
      if (walk && n) onOpen = () => walk.openMap({ place: n.slug });
      break;
    }
    case "gather": {
      icon = <Leaf aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      const item = ITEM_BY_NAME.get(foldName(r.name));
      if (walk && item) onOpen = () => walk.openMap({ item });
      break;
    }
    case "stat":
      icon = <Gauge aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      break;
    case "gift":
      icon = <Gift aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      break;
    case "battalion":
      icon = <Users aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      break;
    case "mount": {
      icon = <PawPrint aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-faint" />;
      tone = "decoration-gold/60";
      const b = BREED_BY_NAME.get(r.name.toLowerCase());
      if (walk && b && hasStable(walk.route)) onOpen = () => walk.openMount(b.slug);
      break;
    }
  }
  const card = () => (
    <>
      {renderCard(r.type, r.name, scope)}
      {onOpen && (
        <button
          type="button"
          onClick={() => {
            closeHover();
            onOpen!();
          }}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-teal px-3 py-1 text-[13px] font-semibold text-parchment hover:bg-teal-2"
        >
          <MapPin aria-hidden="true" className="size-3.5" />
          {r.type === "mount" ? "Open in the Mounts tab" : "Open on the map"}
        </button>
      )}
      {pinKind && <PinToggle kind={pinKind} name={r.name} from={resolveFrom(pinFrom, scope)} variant="corner" />}
    </>
  );
  if (inCard && onOpen) {
    return (
      <button
        type="button"
        title={r.type === "mount" ? "Open in the Mounts tab" : "Open on the map"}
        onClick={() => {
          closeHover();
          onOpen!();
        }}
        className={cx(DOTTED, tone, "cursor-pointer whitespace-nowrap text-inherit hover:text-(--c)")}
      >
        {!bare && icon}
        {r.label}
      </button>
    );
  }
  return (
    <Hover card={card} label={r.label} className="whitespace-nowrap">
      <span className={cx(DOTTED, tone)}>
        {!bare && icon}
        {r.label}
      </span>
    </Hover>
  );
}

/**
 * A name from data (not authored text) as its chip when it resolves to one of `types`, tried in order; plain text
 * otherwise. Explicit types only, so a town named like a person or weapon never links by accident (D-73, D-82).
 * `label` keeps the shown text when it differs from the lookup name ("Lowtown Tavern" opening Dagsion).
 */
export function RefName(
  { name, types, label, bare }: { name: string; types: RefType[]; label?: string; bare?: boolean },
) {
  for (const t of types) {
    const r = resolve(name, t);
    if (r) return <RefChip r={label ? { ...r, label } : r} bare={bare} />;
  }
  return <>{label ?? name}</>;
}

/**
 * A stat delta ("Prt +10", "Str/Mag +7") as a small badge with the number in bold: gains in teal, losses in blood.
 * Hover or tap opens the glossary card for each stat in it.
 */
export function StatBadge({ d }: { d: StatDelta }) {
  const down = d.delta.startsWith("\u2212");
  return (
    <Hover
      card={() => renderStatCard(d.stats.join("/"), d.delta)}
      label={`${d.raw}: what it means`}
      className="whitespace-nowrap"
    >
      <span
        className={cx(
          "inline-flex items-baseline gap-[3px] rounded-[4px] border px-[5px] py-px align-[0.04em] text-[0.86em] leading-[1.25]",
          "decoration-dotted underline-offset-[3px] hover:underline",
          down ? "border-blood/25 bg-warn text-blood" : "border-teal-3/20 bg-paper-2 text-teal-3",
        )}
      >
        <span className="font-semibold">{d.stats.join("/")}</span>
        <b className="tabular-nums">{d.delta}</b>
      </span>
    </Hover>
  );
}

/** Plain text with stat deltas as badges; the rest goes through the usual chip enhancements. */
function withStats(text: string, seen: Set<string>, key: string): ReactNode[] {
  return splitStats(text).map((part, j) =>
    typeof part === "string"
      ? <Fragment key={`${key}s${j}`}>{enhance(part, seen, `${key}s${j}`)}</Fragment>
      : <StatBadge key={`${key}s${j}`} d={part} />
  );
}

/**
 * Authored text: `[[type:Name|label]]` refs become chips; the rest gets the usual gate, gold, date and name chips.
 * `stats`: style stat deltas ("Prt +10", "Hit +3") as small badges with a glossary hover card. Opt-in, for the few
 * places where numbers are the point (synergy payoffs). The stat glossary owner is `combat-stats.json` (repo root);
 * `[[stat:Prt]]` refs work everywhere.
 */
export function Rich(
  { text, k = "r", quiet, stats }: { text: string; k?: string; quiet?: string[]; stats?: boolean },
) {
  // Names already shown beside the text (the row's unit) render without a second portrait.
  const seen = new Set<string>(quiet);
  return (
    <>
      {splitRefs(text).map((seg, i) => {
        const key = `${k}.${i}`;
        if (typeof seg === "string") {
          return <Fragment key={key}>{stats ? withStats(seg, seen, key) : enhance(seg, seen, key)}</Fragment>;
        }
        if ("unresolved" in seg) {
          return (
            <span
              key={key}
              title="Not found in the reference data"
              className="underline decoration-blood decoration-wavy"
            >
              {seg.unresolved}
            </span>
          );
        }
        if (seg.type === "unit") seen.add(seg.name);
        return <RefChip key={key} r={seg} />;
      })}
    </>
  );
}
