import { ArrowRight, Backpack, BookOpen, ScrollText, Users } from "lucide-react";
import { char, META, ordinal, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Rich } from "../ref/rich.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { Portrait } from "../ui/portrait.tsx";
import { useWalk } from "./ctx.ts";

type Decision = NonNullable<NonNullable<(typeof META.routes)[RouteName]["ledger"]>["keyDecisions"]>[number];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Where a key decision is acted on, as a short label. */
const target = (d: Decision) =>
  d.ch ? `Ch ${d.ch}` : d.panel === "mounts" ? "Mounts" : d.panel === "army" ? "Army" : "Ledger";

const PILL = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ring-white/15 bg-white/10 text-parchment hover:bg-white/20";

/**
 * Route feature band (D-39, V-14; replaces the Route plan, 02-templates.md §2): lord art, title, hook, the actions
 * (resume, Army, Ledger, Units, Rules) and the Key decisions as numbered tiles, each linked to where you act on it.
 * Routes without key decisions show the "Plays as" and "Watch out" facts instead.
 */
export function RouteBand({ route }: { route: RouteName }) {
  const { openKit } = useWalk();
  const info = META.routes[route];
  const now = nowChapter(route, useTrack());
  const lord = char(route);
  const decisions = info.ledger?.keyDecisions ?? [];
  const go = (d: Decision) => {
    if (d.ch) scrollTo(`ch-${d.ch}`);
    else if (d.panel === "mounts") openKit("mounts");
    else if (d.panel === "army") location.hash = href(routeSlug(route), "army");
    else openKit("ledger");
  };
  return (
    <header
      id="plan"
      className="@container relative scroll-mt-20 overflow-hidden rounded-xl bg-teal px-5 pt-5 pb-5 text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] sm:px-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_95%_0%,color-mix(in_srgb,var(--c)_55%,transparent),transparent_65%)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 hidden h-[230px] w-[260px] @3xl:block">
        <Portrait
          name={route}
          eager
          className="absolute right-6 bottom-0 h-full w-auto max-w-none [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]"
          opaqueClassName="!h-[85%] rounded-lg"
        />
      </div>
      <div className="relative min-h-[150px] @3xl:pr-[250px]">
        <div className="text-[11.5px] font-semibold tracking-[0.12em] text-gold-hi uppercase">
          Part I walkthrough · play {ordinal(route)} · {info.paralogues} Paralogues
        </div>
        <h1 className="m-0 mt-0.5 font-display text-[clamp(28px,4cqi,40px)] leading-tight text-white">{route}'s route</h1>
        <p className="mt-1 mb-0 max-w-[68ch] text-[15.5px] leading-snug text-parchment/85">{info.hook}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => scrollTo(`ch-${now}`)}
            className="inline-flex items-center gap-1 rounded-full bg-gold-hi px-3 py-1 text-teal hover:bg-white"
          >
            {now > 1 ? "Resume" : "Start"} Ch {now} <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
          <a href={href(routeSlug(route), "army")} className={PILL}>
            <Users aria-hidden="true" className="size-3.5 text-gold-hi" />Army
          </a>
          <button type="button" onClick={() => openKit("ledger")} className={PILL}>
            <ScrollText aria-hidden="true" className="size-3.5 text-gold-hi" />Ledger · L
          </button>
          <button type="button" onClick={() => openKit("units")} className={PILL}>
            <Backpack aria-hidden="true" className="size-3.5 text-gold-hi" />Units · U
          </button>
          {info.mechanics?.length
            ? (
              <button type="button" onClick={() => scrollTo("rules")} className={PILL}>
                <BookOpen aria-hidden="true" className="size-3.5 text-gold-hi" />Rules of this route
              </button>
            )
            : null}
          {lord && <a href={href(routeSlug(route), lord.slug)} className={PILL}>{route}'s build</a>}
        </div>
      </div>
      {decisions.length
        ? (
          <div className="relative mt-4">
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="m-0 font-sans text-[11.5px] font-bold tracking-[0.12em] text-gold-hi uppercase">Key decisions</h2>
              <span className="text-[12.5px] text-parchment/60">what shapes the whole route</span>
            </div>
            <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
              {decisions.map((d, i) => (
                <li key={i} className="flex min-w-[260px] flex-[1_1_280px]">
                  <div className="flex w-full gap-2.5 rounded-lg bg-card px-3 py-2.5 text-ink shadow-[0_6px_18px_-10px_rgba(0,0,0,.6)]">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-(--c) font-logo text-[15px] leading-none font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="m-0 text-[14px] leading-snug"><Rich text={d.text} k={`kd${i}`} /></p>
                      <button
                        type="button"
                        onClick={() => go(d)}
                        className="mt-auto self-end pt-1 text-[12.5px] font-semibold text-gold-lo hover:text-ink"
                      >
                        {target(d)} →
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )
        : (
          <div className="relative mt-4 grid gap-2 @2xl:grid-cols-2">
            {[["Plays as", info.plays, false], ["Watch out", info.watch, true]].map(([k, v, warn]) => (
              <div
                key={String(k)}
                className="rounded-md bg-white/[0.06] px-3 py-2 text-[13.5px] leading-snug text-parchment/90 ring-1 ring-white/10 [&_.text-ink]:!text-gold-hi"
              >
                <div className={cx("mb-0.5 text-[10.5px] font-semibold tracking-[0.1em] uppercase", warn ? "text-[#f3b09f]" : "text-gold-hi")}>
                  {k}
                </div>
                <ConfText text={String(v)} k={`f${k}`} />
              </div>
            ))}
          </div>
        )}
    </header>
  );
}
