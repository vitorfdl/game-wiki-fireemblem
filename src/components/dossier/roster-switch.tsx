import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, X } from "lucide-react";
import { char, fightingCopies, fillers, META, routeLineup, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import { p3BuildHref, p3Roster, p3Stage } from "../../lib/part-army.ts";
import { SQUAD_TONE } from "../../lib/parts.ts";
import { routeVars } from "../../lib/route-style.ts";
import { cx } from "../../lib/cx.ts";
import type { RouteName } from "../../lib/types.ts";
import { Medal } from "../ui/medal.tsx";
import { unitNow } from "./unit-now.ts";

type Props = {
  /** Army whose roster the grid shows; null on the later-joiners pages. */
  route: RouteName | null;
  current: string;
  /** Units the arrows step through (lord and roster, or the later joiners). */
  list: string[];
  /** Page section carried to the next unit ("recruitment", "profile"). */
  tab?: string;
  /** Part III (D-122): the Section whose squads group the whole army; links open each unit's picked copy (D-145). */
  p3?: number;
};

/** Link to a unit's build: this army's page, or in Part III the copy the plan recruits. */
const unitLink = (base: string, name: string, tab: string | undefined, p3: number | undefined) =>
  p3 ? p3BuildHref(name, tab) : href(base, char(name)?.slug, tab);

/** Squad letter as a small colored tag on Part III group headers. */
function SquadTag({ id }: { id?: string }) {
  if (!id) return null;
  const t = SQUAD_TONE[id];
  return (
    <span
      className="mr-1 inline-grid size-[15px] place-items-center rounded-[3px] font-logo text-[10px] leading-none font-bold"
      style={{ background: t?.bg, color: t?.fg }}
    >
      {id}
    </span>
  );
}

/**
 * The top bar's unit switch: ◀ 6 / 13 ▶. The counter (or R) opens the whole army as a portrait grid with each unit's
 * class at the chapter you are playing. Dropdown on wide screens, bottom sheet on phones. Esc closes.
 */
export function RosterSwitch({ route, current, list, tab, p3 }: Props) {
  const [open, setOpen] = useState(false);
  const counter = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Closing the sheet hands focus back to the counter that opened it.
  useEffect(() => {
    if (wasOpen.current && !open) counter.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const idx = list.indexOf(current);
  const base = route ? routeSlug(route) : "reserve";
  const step = (d: number) => list[(idx + d + list.length) % list.length];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea,select")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && open) {
        // Capture phase: keep the page's own Esc (back to the walkthrough) from firing.
        e.stopPropagation();
        setOpen(false);
      } else if (e.key === "r" || e.key === "R") {
        setOpen((o) => !o);
      }
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (idx < 0 && !route && !p3) return null;
  // A filler or extra opened from the army has no place in the arrow order: only the grid button shows.
  const inList = idx >= 0;
  return (
    <div className="flex items-center gap-0.5 font-logo text-sm font-bold text-gold-hi">
      {inList && list.length > 1 && (
        <a
          href={unitLink(base, step(-1), tab, p3)}
          aria-label="Previous unit"
          className="grid h-8 w-7 place-items-center rounded hover:bg-gold-hi/15"
        >
          ◀
        </a>
      )}
      <button
        ref={counter}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Whole army (R)"
        className={cx(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 tabular-nums ring-1 ring-gold-hi/35 hover:bg-gold-hi/15",
          open && "bg-gold-hi/20",
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-3.5" />
        {inList ? `${idx + 1} / ${list.length}` : "Army"}
      </button>
      {inList && list.length > 1 && (
        <a
          href={unitLink(base, step(1), tab, p3)}
          aria-label="Next unit"
          className="grid h-8 w-7 place-items-center rounded hover:bg-gold-hi/15"
        >
          ▶
        </a>
      )}
      {open && createPortal(
        <Sheet
          route={route}
          current={current}
          list={list}
          tab={tab}
          p3={p3}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </div>
  );
}

function Sheet({ route, current, list, tab, p3, onClose }: Props & { onClose: () => void }) {
  const track = useTrack();
  const ch = route && !p3 ? nowChapter(route, track) : undefined;
  const here = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    here.current?.focus({ preventScroll: false });
  }, []);
  const groups: { title: string; names: string[]; filler?: boolean; squad?: string; muted?: boolean }[] = p3
    ? p3Roster(p3)
    : route
    ? [
      { title: `${route}'s army`, names: routeLineup(route) },
      {
        title: "Also recruitable on other routes",
        names: META.routes[route].extras.filter((n) => !fightingCopies(route).has(n)),
      },
      { title: "Fillers", names: fillers(route).map((f) => f.name), filler: true },
    ]
    : [{ title: "Later joiners", names: list }];
  const base = route ? routeSlug(route) : "reserve";
  return (
    <div role="dialog" aria-modal="true" aria-label="Army roster" className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(16,38,42,.45)]" />
      <div
        style={routeVars(route)}
        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-teal px-3 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] text-parchment shadow-[0_-12px_40px_-12px_rgba(0,0,0,.6)] sm:inset-x-auto sm:top-[66px] sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100vh-84px)] sm:w-[min(820px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-xl sm:px-4 sm:shadow-[0_24px_60px_-20px_rgba(0,0,0,.7)] animate-rise"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_0%_0%,color-mix(in_srgb,var(--c)_35%,transparent),transparent_70%)]"
        />
        <span aria-hidden="true" className="relative mx-auto mb-2 block h-1 w-10 rounded-full bg-white/25 sm:hidden" />
        <div className="relative flex items-baseline gap-2">
          <h2 className="m-0 font-display text-[19px] text-white">
            {p3 ? "The Army of Salvation" : route ? `${route}'s army` : "Later joiners"}
          </h2>
          {ch !== undefined && <span className="text-[12.5px] text-gold-hi/80">classes at Ch {ch}</span>}
          {p3 && <span className="text-[12.5px] text-gold-hi/80">squads and classes at Section {p3}</span>}
          <span className="flex-1" />
          <span className="hidden text-[11.5px] text-parchment/50 sm:inline">R or Esc to close</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        {groups.filter((g) => g.names.length).map((g, gi) => (
          <section key={g.title} className={cx("relative", gi > 0 && "mt-3 border-t border-gold-hi/15 pt-2.5")}>
            {(gi > 0 || p3) && (
              <h3 className="m-0 mb-1.5 flex items-center text-[11px] font-bold tracking-[0.12em] text-gold-hi/75 uppercase">
                <SquadTag id={g.squad} />
                {g.title} <span className="ml-1 font-semibold text-parchment/45">{g.names.length}</span>
              </h3>
            )}
            <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0 sm:grid-cols-3 md:grid-cols-4">
              {g.names.map((n) => {
                const c = char(n);
                if (!c) {
                  return null;
                }
                const on = n === current;
                const now = p3
                  ? { cls: p3Stage(n, p3).now?.cls, bench: Boolean(g.muted), later: false, note: undefined }
                  : route && ch !== undefined
                  ? unitNow(route, n, ch)
                  : undefined;
                const sub = now?.cls ?? now?.note ?? (route ? "" : c.joins?.split(/[.;:]/)[0]);
                return (
                  <li key={n}>
                    <a
                      ref={on ? here : undefined}
                      href={unitLink(base, n, tab, p3)}
                      onClick={onClose}
                      aria-current={on ? "page" : undefined}
                      className={cx(
                        "group flex min-w-0 items-center gap-2.5 rounded-lg py-1.5 pr-2 pl-1.5 outline-none focus-visible:ring-2 focus-visible:ring-gold-hi",
                        on ? "bg-white/15 ring-1 ring-gold-hi/70" : "hover:bg-white/10",
                        g.filler && !on && "outline-1 -outline-offset-1 outline-gold-hi/30 outline-dashed",
                      )}
                    >
                      <span
                        className={cx(
                          "shrink-0 transition-transform group-hover:-translate-y-px",
                          (now?.later || (now?.bench && !g.filler)) && !on && "opacity-70",
                        )}
                      >
                        <Medal name={n} route={c.homeRoute} size={40} ring="var(--color-teal)" />
                      </span>
                      <span className="min-w-0 leading-tight">
                        <b className={cx("block truncate text-[14px]", on ? "text-gold-hi" : "text-white")}>{n}</b>
                        {sub && (
                          <span
                            className={cx(
                              "block truncate text-[12px]",
                              now?.cls ? "text-parchment/80" : "text-parchment/50",
                            )}
                          >
                            {sub}
                            {now?.cls && now.bench && !p3 && <span className="text-parchment/45">· bench</span>}
                          </span>
                        )}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Left roster rail (D-55): the whole army one click away on wide screens, below the navbar. Each row: portrait, name
 * and class at the chapter you are playing. Copies that fight sit in the army by join chapter (D-81); waiting copies and fillers fold below.
 */
export function RosterRail({ route, current, tab }: { route: RouteName; current: string; tab?: string }) {
  const track = useTrack();
  const ch = nowChapter(route, track);
  const army = routeLineup(route);
  const waiting = META.routes[route].extras.filter((n) => !army.includes(n));
  const fill = fillers(route).map((f) => f.name);
  const [more, setMore] = useState(() => !army.includes(current));
  const here = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    here.current?.scrollIntoView({ block: "nearest" });
  }, [current]);
  const base = routeSlug(route);
  const row = (n: string, faded = false) => {
    const c = char(n);
    if (!c) return null;
    const on = n === current;
    const now = unitNow(route, n, ch);
    const sub = now.cls ?? now.note ?? "";
    return (
      <li key={n}>
        <a
          ref={on ? here : undefined}
          href={href(base, c.slug, tab)}
          aria-current={on ? "page" : undefined}
          title={sub ? `${n} · ${sub}` : n}
          className={cx(
            "flex min-w-0 items-center gap-2 rounded-md py-1 pr-1.5 pl-1",
            on ? "bg-white/15 ring-1 ring-gold-hi/60" : "hover:bg-white/10",
          )}
        >
          <span className={cx("shrink-0", (faded || now.later) && !on && "opacity-60")}>
            <Medal name={n} route={c.homeRoute} size={28} ring="var(--color-teal)" />
          </span>
          <span className="min-w-0 leading-tight">
            <b className={cx("block truncate text-[13px]", on ? "text-gold-hi" : "text-white")}>{n}</b>
            {sub && <span className="block truncate text-[11px] text-parchment/60">{sub}</span>}
          </span>
        </a>
      </li>
    );
  };
  return (
    <nav
      aria-label={`${route}'s army`}
      style={routeVars(route)}
      className="sticky top-[76px] z-20 mt-5 hidden h-[calc(100vh-92px)] w-[184px] shrink-0 flex-col self-start rounded-xl bg-teal text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] lg:flex"
    >
      <div className="flex items-baseline justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[11px] font-bold tracking-[0.12em] text-gold-hi uppercase">Army</span>
        <span className="text-[11px] text-parchment/50">Ch {ch}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 [scrollbar-color:rgba(231,200,128,.45)_transparent] [scrollbar-width:thin]">
        <ul className="m-0 list-none space-y-0.5 p-0">{army.map((n) => row(n))}</ul>
        {(waiting.length > 0 || fill.length > 0) && (
          <>
            <button
              type="button"
              onClick={() => setMore(!more)}
              aria-expanded={more}
              className="mt-2 flex w-full items-center justify-between rounded-md px-1.5 py-1 text-[11px] font-bold tracking-[0.1em] text-gold-hi/75 uppercase hover:bg-white/10"
            >
              {waiting.length ? "Copies & fillers" : "Fillers"}{" "}
              <span className="text-parchment/50">{more ? "−" : `+${waiting.length + fill.length}`}</span>
            </button>
            {more && (
              <ul className="m-0 mt-0.5 list-none space-y-0.5 p-0">
                {waiting.map((n) => row(n))}
                {fill.map((n) => row(n, true))}
              </ul>
            )}
          </>
        )}
      </div>
    </nav>
  );
}

/**
 * Part III roster rail (D-122): the whole Army of Salvation grouped by the squads of the Section you're playing, each
 * unit once, linking to the copy the plan recruits (D-145), with its class that Section. Units the plan never lists
 * fold below.
 */
export function P3RosterRail({ current, n, tab }: { current: string; n: number; tab?: string }) {
  const groups = p3Roster(n);
  const [more, setMore] = useState(() => groups.some((g) => g.muted && g.names.includes(current)));
  const here = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    here.current?.scrollIntoView({ block: "nearest" });
  }, [current]);
  const row = (name: string, faded = false) => {
    const c = char(name);
    if (!c) return null;
    const on = name === current;
    const sub = p3Stage(name, n).now?.cls ?? "";
    return (
      <li key={name}>
        <a
          ref={on ? here : undefined}
          href={p3BuildHref(name, tab)}
          aria-current={on ? "page" : undefined}
          title={sub ? `${name} · ${sub}` : name}
          className={cx(
            "flex min-w-0 items-center gap-2 rounded-md py-1 pr-1.5 pl-1",
            on ? "bg-white/15 ring-1 ring-gold-hi/60" : "hover:bg-white/10",
          )}
        >
          <span className={cx("shrink-0", faded && !on && "opacity-60")}>
            <Medal name={name} route={c.homeRoute} size={28} ring="var(--color-teal)" />
          </span>
          <span className="min-w-0 leading-tight">
            <b className={cx("block truncate text-[13px]", on ? "text-gold-hi" : "text-white")}>{name}</b>
            {sub && <span className="block truncate text-[11px] text-parchment/60">{sub}</span>}
          </span>
        </a>
      </li>
    );
  };
  const main = groups.filter((g) => !g.muted);
  const folded = groups.filter((g) => g.muted).flatMap((g) => g.names);
  return (
    <nav
      aria-label="Army of Salvation"
      className="sticky top-[76px] z-20 mt-5 hidden h-[calc(100vh-92px)] w-[184px] shrink-0 flex-col self-start rounded-xl bg-teal text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] lg:flex"
    >
      <div className="flex items-baseline justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[11px] font-bold tracking-[0.12em] text-gold-hi uppercase">Salvation</span>
        <span className="text-[11px] text-parchment/50">Section {n}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 [scrollbar-color:rgba(231,200,128,.45)_transparent] [scrollbar-width:thin]">
        {main.map((g, gi) => (
          <section key={g.key} className={cx(gi > 0 && "mt-2")}>
            <h3
              className="m-0 mb-0.5 flex items-center px-1.5 text-[10.5px] font-bold tracking-[0.1em] text-gold-hi/75 uppercase"
              title={g.title}
            >
              <SquadTag id={g.squad} />
              <span className="truncate">{g.squad ? g.title.replace(/^Squad \w · /, "") : g.title}</span>
            </h3>
            <ul className="m-0 list-none space-y-0.5 p-0">{g.names.map((nm) => row(nm, !g.squad))}</ul>
          </section>
        ))}
        {folded.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setMore(!more)}
              aria-expanded={more}
              className="mt-2 flex w-full items-center justify-between rounded-md px-1.5 py-1 text-[11px] font-bold tracking-[0.1em] text-gold-hi/75 uppercase hover:bg-white/10"
            >
              Not in the plan <span className="text-parchment/50">{more ? "−" : `+${folded.length}`}</span>
            </button>
            {more && <ul className="m-0 mt-0.5 list-none space-y-0.5 p-0">{folded.map((nm) => row(nm, true))}</ul>}
          </>
        )}
      </div>
    </nav>
  );
}
