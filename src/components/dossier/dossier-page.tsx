import { type ReactNode, useEffect, useState } from "react";
import { CLASSES, deployStatus, META, routeLineup, routeSlug, supportLinks } from "../../lib/data.ts";
import { type BackLink, href, navigate } from "../../lib/router.ts";
import { routeVars } from "../../lib/route-style.ts";
import { cx } from "../../lib/cx.ts";
import { growthRow, primaryClass, rowLabel, stripParens } from "../../lib/growth.ts";
import { ids } from "../../lib/chapter.ts";
import { activeStage, unitPlan } from "../../lib/walkthrough/builds.ts";
import { currentPart, nowChapter, nowIn, pushRecent, saveUnitView, unitKey, useTrack } from "../../lib/track.ts";
import { PART_HOME, pos, posLabel } from "../../lib/parts.ts";
import { p3RosterList } from "../../lib/part-army.ts";
import type { Character, RouteName, Stage } from "../../lib/types.ts";
import { TopBar } from "../army/top-bar.tsx";
import { KitHost } from "../walkthrough/kit-host.tsx";
import { Portrait } from "../ui/portrait.tsx";
import { Medal } from "../ui/medal.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { Rich } from "../ref/rich.tsx";
import { Journey, type JourneyStage } from "./journey.tsx";
import { LegacyLists, StageCore } from "./stage-card.tsx";
import { mountAt } from "../../lib/growth.ts";
import { PinScope } from "../ui/pin-toggle.tsx";
import { rangeLabel } from "./variants.ts";
import { HowToPlay, RouteNotes } from "./why-path.tsx";
import { FillerCard, Fold, Profile, Recruitment, WatchOut, WatchPeek } from "./sections.tsx";
import { ClampText } from "./fold.tsx";
import { Panel, Tile } from "../ui/panel.tsx";
import { SupportList } from "../ui/support-strip.tsx";
import { GrowthPanel } from "./growth-panel.tsx";
import { P3RosterRail, RosterRail, RosterSwitch } from "./roster-switch.tsx";
import { unitNow } from "./unit-now.ts";
import { ChartNoAxesColumn, HeartHandshake, Route } from "lucide-react";
import { gateChips, partOf, placementOn, type Variant, variantsOf } from "./variants.ts";

const DEPLOY_LABEL = {
  core: "Deploys all route",
  early: "Deploys early, then bench",
  late: "Deploys once joined",
  bench: "Bench in Part I",
};

/** Old tab segments that now point at a section of the same page. */
const SECTION_OF: Record<string, "recruitment" | "profile"> = {
  recruit: "recruitment",
  recruitment: "recruitment",
  profile: "profile",
};

function Fact({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white/[0.06] px-2.5 py-1.5 ring-1 ring-white/10" title={title}>
      <div className="text-[10.5px] font-semibold tracking-[0.1em] text-gold-hi/80 uppercase">{label}</div>
      <div className="text-[14px] leading-snug font-semibold text-white">{children}</div>
    </div>
  );
}

/**
 * Short class for a long goal ("Guardian (Great Counter and Piety mastered, ...)" -> "Guardian"). A goal written as a
 * sentence with no class up front falls back to the last class the plan reaches in that part.
 */
function shortGoal(goal: string | undefined, fallback: string | undefined): string | undefined {
  if (!goal) return fallback;
  if (goal.includes("→")) return goal;
  if (goal.length <= 24) return goal;
  const p = primaryClass(goal);
  if (p && CLASSES[p]) return p;
  // Not a class name: keep the sentence without its asides ("Bench (his joining class); ..." -> "Bench; ...").
  return fallback ?? stripParens(goal).replace(/\s+([;,.:])/g, "$1");
}

/** The variant a page shows: the URL's route decides; the later-joiners URL opens the last one viewed, else home. */
function pickVariant(c: Character, context: RouteName | null, units: Record<string, { at: number }>) {
  const all = variantsOf(c);
  if (context) {
    const p = placementOn(c, context);
    return { all, placement: p, variant: p.kind === "build" ? p.variant : undefined };
  }
  const seen = [...all].sort((a, b) =>
    (units[unitKey(b.route, c.name)]?.at ?? 0) - (units[unitKey(a.route, c.name)]?.at ?? 0)
  );
  const v = seen.find((x) => units[unitKey(x.route, c.name)]) ?? all[0];
  return { all, placement: v ? { kind: "build" as const, variant: v } : { kind: "none" as const }, variant: v };
}

type Props = { character: Character; context: RouteName | null; tab?: string; back: BackLink };

/** Build page (02-templates §5): header with the variant switch, the journey, the selected stage, reasons, warnings. */
export function DossierPage({ character: c, context, tab, back }: Props) {
  const track = useTrack();
  const { all, placement, variant } = pickVariant(c, context, track.units);
  const vr: RouteName | null = variant?.route ?? null;
  const color = context ?? c.homeRoute ?? null;
  const store: RouteName | "reserve" = context ?? "reserve";
  // In Part III (the Part last viewed, D-122) the roster is the whole Army of Salvation, grouped by the squads of the
  // Section you're playing, and the page opens on the stage the plan reaches there.
  const p3n = currentPart(track) === 3 ? nowIn(PART_HOME, "salvation", track) : undefined;
  const lineup = p3n ? p3RosterList(p3n) : context ? routeLineup(context) : META.later;
  const idx = lineup.indexOf(c.name);
  const base = context ? routeSlug(context) : "reserve";
  const section = tab ? SECTION_OF[tab] : undefined;

  // Old tab URLs: /copy opens that copy's route; /build is the page itself.
  useEffect(() => {
    if (tab === "copy") {
      const copies = variantsOf(c).filter((v) => !v.home);
      const copy = copies.find((v) => v.route === context) ?? copies[0];
      navigate(href(copy ? routeSlug(copy.route) : base, c.slug), true);
    } else if (tab === "build") navigate(href(base, c.slug), true);
  }, [tab, base, c, context]);

  useEffect(() => {
    pushRecent(href(base, c.slug), `${c.name} · ${context ?? "Later joiners"}`);
    if (vr) saveUnitView(store, c.name, { variant: vr });
  }, [base, c.slug, c.name, context, store, vr]);

  /* ---------------------------------------------- journey state */
  const guide = variant?.guide;
  const stages: Stage[] = guide?.stages ?? [];
  const plan = vr ? unitPlan(vr, c.name) : undefined;
  const planned = plan && plan.stages.length === stages.length ? plan.stages : undefined;
  const jStages: JourneyStage[] = stages.map((s, i) => ({
    stage: s,
    cls: planned?.[i].cls ?? (primaryClass(s.class) || s.class || ""),
    start: planned?.[i].start ?? null,
  }));
  const now = vr ? (p3n ? pos(3, p3n) : nowChapter(vr, track)) : undefined;
  const planHit = plan && planned && now !== undefined ? activeStage(plan, now) : undefined;
  const planIdx = planHit ? planned!.indexOf(planHit) : undefined;
  let youIdx: number | undefined;
  if (vr) {
    jStages.forEach((s, i) => {
      if (s.cls && track.done[ids.exam(vr, c.name, s.cls, i)]) youIdx = i;
    });
  }
  const saved = track.units[unitKey(store, c.name)];
  const [picked, setPicked] = useState<number | undefined>(() =>
    saved?.variant === vr && typeof saved?.stage === "number" && saved.stage < stages.length &&
      // In Part III a stage picked during Parts I and II no longer wins over the Part III stage.
      !(p3n && planned && planned[saved.stage].pos <= 18)
      ? saved.stage
      : undefined
  );
  const selected = Math.min(picked ?? planIdx ?? 0, Math.max(0, stages.length - 1));
  const select = (i: number) => {
    setPicked(i);
    // Phones and tablets stack the stepper above the stage: bring the stage into view.
    if (globalThis.innerWidth < 1024) {
      requestAnimationFrame(() =>
        document.getElementById("stage")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
    saveUnitView(store, c.name, { stage: i, variant: vr ?? undefined });
  };

  /* ---------------------------------------------- folds */
  const noBuild = !guide?.stages?.length;
  const [openRec, setOpenRec] = useState(section === "recruitment");
  const [openProf, setOpenProf] = useState(section === "profile" || (noBuild && placement.kind !== "filler"));
  useEffect(() => {
    if (!section) return;
    if (section === "recruitment") setOpenRec(true);
    else setOpenProf(true);
    // After the app's scroll-to-top on navigation.
    const t = setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [section]);
  const carry = section;

  /* ---------------------------------------------- header facts */
  // A filler has no build on this route: its home role would mislead.
  const role = variant
    ? variant.copy?.role ?? guide?.role ?? (variant.home ? c.build?.role : undefined)
    : context
    ? undefined
    : c.build?.role;
  const gate = color ? c.recruitOn?.[color] : undefined;
  const chips = gateChips(gate);
  // The header tile keeps the numbers; tasks, items and windows stay in Recruitment.
  const factChips = gateChips(gate && { ...gate, task: undefined, item: undefined, window: undefined })
    .filter((x) => x !== "Lord")
    .map((x) => x.replace(/^Support (\d)$/, "S$1").replace(/^Renown (\d+)$/, "R$1"));
  const deploy = color ? deployStatus(c.name, color) : undefined;
  const filler = placement.kind === "filler" ? placement.filler : undefined;
  const joinText = filler
    ? filler.when
    : variant?.route === color && variant.join
    ? `${variant.joinEstimate ? "~" : ""}Ch ${variant.join}`
    : undefined;
  const lastIn = (part: 1 | 3) => jStages.filter((s) => partOf(s.stage) === part && CLASSES[s.cls]).at(-1)?.cls;
  const part1 = shortGoal(variant?.part1, lastIn(1));
  const part3 = shortGoal(variant?.part3, lastIn(3));
  const lord = c.isLord && c.homeRoute === color;

  const supportCount = color ? supportLinks(c, color).filter((l) => l.sameArmy).length : 0;
  const stage = stages[selected];
  const growth = guide && stage && c.growths ? growthRow(stage, mountAt(stages, selected)) : null;
  const growthTile = growth && c.growths
    ? (
      <Tile
        icon={<ChartNoAxesColumn />}
        title="Growth"
        aside={<span className="truncate" title={rowLabel(growth.key)}>{rowLabel(growth.key)}</span>}
      >
        <GrowthPanel bare personal={c.growths} row={growth} focus={guide?.focus} />
      </Tile>
    )
    : null;
  const sub = (n: string) => {
    if (!color) return undefined;
    const u = unitNow(color, n, nowChapter(color, track));
    return u.cls ?? u.note;
  };
  const howLeft = filler && context
    ? <FillerCard c={c} filler={filler} route={context} />
    : <HowToPlay guide={guide} summary={guide?.summary} self={c.name} growths={c.growths} />;
  const hasHow = Boolean(filler && context) ||
    Boolean(guide?.summary || guide?.keys?.length || guide?.callouts?.length || guide?.finalists);

  return (
    <RouteCtx.Provider value={color}>
      <div style={routeVars(color)} className="min-h-screen bg-paper">
        <TopBar back={back} current={context} unit={c.name}>
          {(idx >= 0 || context || p3n) && (
            <RosterSwitch route={context} current={c.name} list={lineup} tab={carry} p3={p3n} />
          )}
        </TopBar>
        <KitHost route={p3n ? PART_HOME : context ?? color} part={p3n ? 3 : 1}>
          <div className={cx((context || p3n !== undefined) && "mx-auto flex max-w-[1400px] gap-1 lg:pl-4")}>
            {p3n
              ? <P3RosterRail current={c.name} n={p3n} tab={carry} />
              : context && <RosterRail route={context} current={c.name} tab={carry} />}
            <div className="min-w-0 flex-1">
              <div className="mx-auto max-w-[1180px] px-4 pt-5 md:px-8">
                <header className="relative grid overflow-hidden rounded-xl bg-teal text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] sm:grid-cols-[200px_minmax(0,1fr)] md:grid-cols-[240px_minmax(0,1fr)]">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_100%,color-mix(in_srgb,var(--c)_60%,transparent),transparent_70%)]"
                  />
                  <div className="relative hidden h-full min-h-[220px] overflow-hidden sm:block">
                    <Portrait
                      name={c.name}
                      eager
                      className="absolute bottom-0 left-1/2 h-[108%] w-auto max-w-none -translate-x-1/2 drop-shadow-[0_14px_24px_rgba(0,0,0,.45)]"
                      opaqueClassName="!bottom-4 !h-[85%] rounded-lg"
                      fallbackClassName="text-[64px] text-gold-hi"
                    />
                  </div>
                  <div className="relative min-w-0 px-4 py-4 sm:px-5 sm:py-5 sm:pl-2">
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 sm:hidden">
                        <Medal name={c.name} route={color} size={64} ring="var(--color-teal)" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-semibold tracking-[0.12em] text-gold-hi uppercase">
                          {[
                            c.faction,
                            filler && context
                              ? `Filler in ${context}'s army · home ${c.homeRoute ?? "later"}`
                              : variant && !variant.home && context
                              ? `${
                                holdsSlot(c.name, context) ? "In" : "Second copy in"
                              } ${context}'s army · home ${c.homeRoute}`
                              : c.homeRoute
                              ? lord
                                ? `Flame Lord · play ${["1st", "2nd", "3rd", "4th"][META.order.indexOf(c.homeRoute)]}`
                                : `${c.homeRoute}'s army`
                              : "Joins later",
                          ].filter(Boolean).join(" · ")}
                        </div>
                        <h1 className="m-0 mt-0.5 flex flex-wrap items-baseline gap-x-3 font-display text-[clamp(30px,4vw,46px)] leading-[1.05] text-white">
                          {c.name}
                          {c.epithet && (
                            <span className="font-logo text-[16px] font-semibold text-parchment/70 italic">
                              {c.epithet}
                            </span>
                          )}
                        </h1>
                      </div>
                    </div>
                    {role && <p className="m-0 mt-1.5 text-[16px] leading-snug font-semibold text-parchment">{role}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {(joinText || chips.length > 0) && (
                        <Fact label={color ? `Joins ${color}` : "Joins"} title={chips.join(" · ")}>
                          {[joinText, ...factChips].filter(Boolean).join(" · ") || (lord ? "Lord" : "")}
                        </Fact>
                      )}
                      {deploy && <Fact label="Part I" title={deploy.why}>{DEPLOY_LABEL[deploy.status]}</Fact>}
                      {part1 && <Fact label="Part I goal" title={variant?.part1}>{part1}</Fact>}
                      {part3 && <Fact label="Part III goal" title={variant?.part3}>{part3}</Fact>}
                    </div>
                    {c.personalSkill && (
                      <p className="mt-2.5 mb-0 rounded-md bg-white/8 px-3 py-2 text-[13.5px] leading-snug text-parchment/90 ring-1 ring-gold-hi/25">
                        <span className="mr-2 text-[10.5px] font-bold tracking-[0.1em] text-gold-hi/75 uppercase">
                          Personal skill
                        </span>
                        <b className="mr-1.5 text-gold-hi">{c.personalSkill.name}</b>
                        {c.personalSkill.effect}
                      </p>
                    )}
                    {!c.homeRoute && c.joins && (
                      <ClampText
                        text={c.joins}
                        k="joins"
                        chars={140}
                        className="mt-2 text-[13.5px] text-parchment/85"
                      />
                    )}
                    <VariantSwitch c={c} all={all} current={variant} fillerRoute={filler ? context : null} />
                    {variant?.copy && (
                      <ClampText
                        text={`This copy: ${variant.copy.why}`}
                        k="cw"
                        lines={1}
                        chars={110}
                        className="mt-1.5 text-[13px] text-parchment/70"
                      />
                    )}
                  </div>
                </header>
              </div>

              <main className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-4 pb-24 md:px-8">
                {placement.kind === "none" && context && (
                  <p className="m-0 text-[14px] text-muted">
                    {c.name} isn't part of {context}'s army plan.{" "}
                    {all.length > 0
                      ? "Pick a route above to see a build."
                      : "See Recruitment below for the requirement."}
                  </p>
                )}

                {hasHow || c.supports?.length
                  ? (
                    <div
                      className={cx(
                        "grid grid-cols-[minmax(0,1fr)] items-start gap-4",
                        hasHow && Boolean(c.supports?.length) && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
                      )}
                    >
                      {hasHow && howLeft}
                      {c.supports?.length
                        ? (
                          <div className="grid min-w-0 content-start gap-4">
                            <Panel
                              id="supports"
                              icon={<HeartHandshake />}
                              title="Supports"
                              sub={color && supportCount ? `in ${color}'s army first` : undefined}
                            >
                              <SupportList character={c} army={color} sub={sub} />
                            </Panel>
                            {/* Few partners leave the column short beside How to play: the top warnings fill it. */}
                            {hasHow && supportCount <= 6 && guide?.watch?.length
                              ? <WatchPeek watch={guide.watch} max={supportCount <= 4 ? 3 : 2} />
                              : null}
                          </div>
                        )
                        : null}
                    </div>
                  )
                  : null}

                {variant && jStages.length > 0 && (
                  <Panel
                    id="journey"
                    icon={<Route />}
                    title="Journey"
                    sub={<JourneyNote plan={planIdx} you={youIdx} stages={jStages} now={now} join={plan?.join} />}
                    className="overflow-clip!"
                    bodyClassName="grid grid-cols-[minmax(0,1fr)] gap-x-7 gap-y-4 lg:grid-cols-[250px_minmax(0,1fr)]"
                  >
                    <div className="min-w-0 lg:sticky lg:top-[76px] lg:self-start">
                      <Journey
                        route={vr}
                        stages={jStages}
                        selected={selected}
                        onSelect={select}
                        plan={planIdx}
                        you={youIdx}
                        now={now}
                        copy={!variant.home}
                      />
                      {guide?.gates?.filter((g) => !g.route || g.route === vr).length
                        ? (
                          <p className="mt-2 mb-0 text-[12.5px] leading-snug text-muted">
                            <b className="font-semibold text-ink-soft">Gates:</b>{" "}
                            {guide.gates.filter((g) => !g.route || g.route === vr).map((g, i) => (
                              <span key={i}>
                                {i > 0 && " · "}
                                <Rich text={g.text} k={`g${i}`} />
                              </span>
                            ))}
                          </p>
                        )
                        : null}
                      {growthTile && <div className="mt-4 hidden lg:block">{growthTile}</div>}
                    </div>
                    {guide && stage && (
                      <div id="stage" className="min-w-0 scroll-mt-20 lg:border-l lg:border-gold/25 lg:pl-7">
                        <PinScope
                          from={{
                            unit: c.name,
                            route: vr ?? undefined,
                            stage: [jStages[selected].cls, rangeLabel(stage)].filter(Boolean).join(" · "),
                          }}
                        >
                          <StageCore
                            key={`${vr}-${selected}`}
                            stages={stages}
                            index={selected}
                            cls={jStages[selected].cls}
                            character={c}
                            guide={guide}
                            route={vr}
                          />
                        </PinScope>
                        <div className="mt-3">
                          <LegacyLists guide={guide} />
                        </div>
                      </div>
                    )}
                    {growthTile && <div className="lg:hidden">{growthTile}</div>}
                  </Panel>
                )}

                {variant && !jStages.length && c.build?.path?.length
                  ? <PathOnly path={c.build.path} notes={c.build.notes} />
                  : null}
                {!variant && !filler && !context && c.build?.path?.length
                  ? <PathOnly path={c.build.path} notes={c.build.notes} />
                  : null}

                {guide?.watch?.length ? <WatchOut watch={guide.watch} self={c.name} /> : null}

                {guide?.routeNotes?.length ? <RouteNotes guide={guide} route={vr} self={c.name} /> : null}

                <div>
                  <Fold
                    id="recruitment"
                    title={lord ? "The route" : "Recruitment"}
                    aside={lord
                      ? "What the route plays like and when to pick it"
                      : chips.length && color
                      ? `${color}: ${chips.join(" · ")}`
                      : undefined}
                    open={openRec}
                    onToggle={setOpenRec}
                  >
                    <Recruitment c={c} route={color} />
                  </Fold>
                  <Fold
                    id="profile"
                    title="Profile"
                    aside="Story, personal growths, weapons, tier lists"
                    open={openProf}
                    onToggle={setOpenProf}
                  >
                    <Profile c={c} />
                  </Fold>
                </div>
              </main>
            </div>
          </div>
        </KitHost>
      </div>
    </RouteCtx.Provider>
  );
}

/** "Plan: Pugilist · You: Myrmidon", or where the pin is against the join chapter. */
function JourneyNote(
  { plan, you, stages, now, join }: {
    plan?: number;
    you?: number;
    stages: JourneyStage[];
    now?: number;
    join?: number;
  },
) {
  if (now === undefined) return null;
  if (join !== undefined && now < join) return <>Joins {posLabel(join)} · you are at {posLabel(now)}</>;
  if (plan !== undefined && you !== undefined && you !== plan) {
    return (
      <span className="font-semibold text-warn-ink">
        Plan at {posLabel(now)}: {stages[plan].cls} · You: {stages[you].cls}
      </span>
    );
  }
  if (plan !== undefined) return <>{posLabel(now)} · tick "Reached" on a stage to track where you really are</>;
  return null;
}

/** Units with only a suggested class list (Part II and III joiners). */
function PathOnly({ path, notes }: { path: string[]; notes?: string }) {
  return (
    <Panel id="journey" icon={<Route />} title="Journey" sub="Suggested class path; no chapter plan yet">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {path.map((p, i) => (
          <li key={`${i}-${p}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="text-xs text-gold">→</span>}
            <span className="text-[14.5px] font-semibold">{p}</span>
          </li>
        ))}
      </ol>
      {notes && <ClampText text={notes} k="pn" chars={200} className="mt-2 text-[13.5px] text-ink-soft" />}
    </Panel>
  );
}

/** One pill per route with a build; the filler route shows as a plain pill. */
function VariantSwitch(
  { c, all, current, fillerRoute }: {
    c: Character;
    all: Variant[];
    current?: Variant;
    fillerRoute: RouteName | null;
  },
) {
  if (all.length < 2 && !(fillerRoute && all.length)) return null;
  return (
    <nav aria-label="Builds by route" className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] font-semibold tracking-[0.08em] text-parchment/60 uppercase">Builds</span>
      {fillerRoute && (
        <span
          style={routeVars(fillerRoute)}
          aria-current="page"
          className="rounded-full border border-dashed border-gold-hi/70 px-3 py-1 text-[13px] font-semibold text-gold-hi"
        >
          {fillerRoute} (filler)
        </span>
      )}
      {all.map((v) => {
        const on = current?.route === v.route;
        return (
          <a
            key={v.route}
            href={href(routeSlug(v.route), c.slug)}
            aria-current={on ? "page" : undefined}
            style={routeVars(v.route)}
            className={cx(
              "rounded-full px-3 py-1 text-[13px] font-semibold transition-colors",
              on ? "bg-gold-hi text-teal" : "bg-white/10 text-parchment ring-1 ring-white/15 hover:bg-white/20",
            )}
          >
            {v.route}{" "}
            ({v.home
              ? (c.homeRoute ? "home" : "Part III")
              : holdsSlot(c.name, v.route)
              ? "in this army"
              : "second copy"})
          </a>
        );
      })}
    </nav>
  );
}

/** True when the unit holds a slot in the route's Part I lineup: it fights in that army, not just a Part II copy. */
function holdsSlot(name: string, route: RouteName): boolean {
  return (META.routes[route].deployment?.lineup ?? []).some((s) => s.holders.some((h) => h.unit === name));
}
