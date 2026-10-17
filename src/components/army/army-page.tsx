import { PART_HOME } from "../../lib/parts.ts";
import { char, classCarry, META, ordinal, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { routeVars } from "../../lib/route-style.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { RouteCtx } from "../ref/ctx.ts";
import { Portrait } from "../ui/portrait.tsx";
import { type KitTab, useWalk } from "../walkthrough/ctx.ts";
import { KitHost } from "../walkthrough/kit-host.tsx";
import { TopBar } from "./top-bar.tsx";
import { Roles, Synergies, WhyLineup } from "./deployment.tsx";
import { Muster } from "./roster.tsx";
import { Lineup } from "./lineup.tsx";
import { Cast } from "./cast.tsx";
import { openRulesNext } from "../walkthrough/route-rules.tsx";
import { type ArmyPart, ArmyPartSwitch, SalvationArmy, WarArmy } from "./part-army.tsx";

/*
 * Army page (redesign/04-page-plans.md, 10-visual-language.md): identity line, the cast, the lineup by slot,
 * roles, synergies, the muster table and the reasoning. Route rules live in the walkthrough (route-rules.tsx).
 * The Ledger and Units open in the same side panel as the walkthrough.
 */

function Facts({ r }: { r: RouteName }) {
  const info = META.routes[r];
  const lord = char(r);
  const carry = classCarry(r);
  const tiles: { k: string; v: React.ReactNode; warn?: boolean; wide?: boolean }[] = [
    { k: "Plays as", v: info.plays },
    { k: "Watch out", v: info.watch, warn: true },
  ];
  if (lord?.personalSkill) tiles.push({ k: `Personal · ${lord.personalSkill.name}`, v: lord.personalSkill.effect });
  tiles.push({
    k: "Class carryover",
    v: (
      <>
        {carry.gives.join(", ")}
        {carry.got.length > 0 && <span className="text-parchment/60">· arrives with {carry.got.join(", ")}</span>}
      </>
    ),
  });
  // The systems tile lists what the walkthrough's rules panel shows (mechanics), falling back to the short list.
  const systems = info.mechanics?.length ? info.mechanics.map((m) => m.system) : info.systems;
  tiles.push({
    k: `${info.paralogues} Paralogues · systems`,
    v: (
      <>
        {systems.join(" · ")} {info.mechanics?.length
          ? (
            <a
              href={href(routeSlug(r))}
              onClick={() => openRulesNext(r)}
              className="font-semibold whitespace-nowrap text-gold-hi hover:text-white hover:underline"
            >
              Rules in the walkthrough →
            </a>
          )
          : null}
      </>
    ),
  });
  // Wide: short tiles (Plays as, Class carryover) stack in the first column beside the long ones, systems span the
  // bottom row. Narrow: two columns, the last tile fills its row. No holes either way.
  const n = tiles.length;
  const lastSpan = cx(n % 2 === 1 && "@lg:col-span-2", "@5xl:col-span-3");
  const tall = new Set(["Watch out"]);
  if (lord?.personalSkill) tall.add(`Personal · ${lord.personalSkill.name}`);
  return (
    <div className="mt-4 grid gap-2 @lg:grid-cols-2 @5xl:grid-flow-dense @5xl:grid-cols-3">
      {tiles.map((t, i) => (
        <div
          key={t.k}
          className={cx(
            "rounded-md bg-white/[0.06] px-3 py-2 text-[13.5px] leading-snug text-parchment/90 ring-1 ring-white/10",
            i === n - 1 && lastSpan,
            tall.has(t.k) && "@5xl:row-span-2",
          )}
        >
          <div
            className={cx(
              "mb-0.5 text-[10.5px] font-semibold tracking-[0.1em] uppercase",
              t.warn ? "text-[#f3b09f]" : "text-gold-hi",
            )}
          >
            {t.k}
          </div>
          {t.v}
        </div>
      ))}
    </div>
  );
}

/** Army header (D-32): a dark band with the lord, the route's facts and the cast. No texture behind data. */
function Header({ r, openKit }: { r: RouteName; openKit: (t: KitTab) => void }) {
  const info = META.routes[r];
  const lord = char(r);
  const now = nowChapter(r, useTrack());
  return (
    <header className="@container relative mt-5 overflow-hidden rounded-xl bg-teal px-5 pt-5 pb-5 text-parchment shadow-[0_14px_36px_-18px_rgba(16,38,42,.8)] sm:px-7">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_95%_0%,color-mix(in_srgb,var(--c)_55%,transparent),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 hidden h-[300px] w-[300px] @4xl:block"
      >
        <Portrait
          name={r}
          eager
          className="absolute right-4 bottom-0 h-full w-auto max-w-none [mask-image:linear-gradient(to_bottom,#000_65%,transparent)]"
          opaqueClassName="!h-[85%] rounded-lg"
        />
      </div>
      <div className="relative @4xl:pr-[280px]">
        <div className="flex flex-wrap items-center gap-3">
          <ArmyPartSwitch r={r} part={null} />
          <span className="text-[11.5px] font-semibold tracking-[0.12em] text-gold-hi uppercase">
            Play {ordinal(r)} · you are in Ch {now}
          </span>
        </div>
        <h1 className="m-0 mt-0.5 font-display text-[clamp(28px,4.2cqi,40px)] leading-tight text-white">
          The Army of {r}
        </h1>
        <p className="mt-1 mb-0 max-w-[60ch] text-[15.5px] leading-snug text-parchment/85">{info.hook}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
          <a
            href={href(routeSlug(r), "ch", String(now))}
            className="rounded-full bg-gold-hi px-3 py-1 text-teal hover:bg-white"
          >
            Walkthrough Ch {now} →
          </a>
          <button
            type="button"
            onClick={() => openKit("ledger")}
            className="rounded-full bg-white/10 px-3 py-1 text-parchment ring-1 ring-white/15 hover:bg-white/20"
          >
            Ledger · L
          </button>
          {lord && (
            <a
              href={href(routeSlug(r), lord.slug)}
              className="rounded-full bg-white/10 px-3 py-1 text-parchment ring-1 ring-white/15 hover:bg-white/20"
            >
              {r}'s build
            </a>
          )}
        </div>
        <Facts r={r} />
      </div>
      <div className="relative">
        <Cast r={r} />
      </div>
    </header>
  );
}

export function ArmyPage({ r, part = null }: { r: RouteName; part?: ArmyPart | null }) {
  return (
    <RouteCtx.Provider value={r}>
      <div style={routeVars(r)} className="min-h-screen bg-paper">
        <TopBar back={{ to: href(), label: "All lords" }} current={r} view="army" part={part ?? undefined} />
        {/* Part III is one campaign played on Theodora's page: its tabs (squads, Section plans) read her files. */}
        <KitHost route={part === "salvation" ? PART_HOME : r} part={part === "war" ? 2 : part === "salvation" ? 3 : 1}>
          {part === "war"
            ? (
              <div className="mx-auto max-w-[1180px] px-4 pb-32 sm:px-6">
                <WarArmy r={r} />
              </div>
            )
            : part === "salvation"
            ? (
              <div className="mx-auto max-w-[1180px] px-4 pb-32 sm:px-6">
                <SalvationArmy r={r} />
              </div>
            )
            : <ArmyBody r={r} />}
        </KitHost>
      </div>
    </RouteCtx.Provider>
  );
}

function ArmyBody({ r }: { r: RouteName }) {
  const { openKit } = useWalk();
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-32 sm:px-6">
      <Header r={r} openKit={openKit} />
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
        <Lineup r={r} />
        <Roles r={r} />
        <Synergies r={r} />
        <Muster r={r} />
        <WhyLineup r={r} />
      </div>
    </div>
  );
}
