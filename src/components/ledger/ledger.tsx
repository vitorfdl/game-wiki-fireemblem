import { barterText } from "../../lib/sources.ts";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { CalendarDays, Check, Crown, Gem, GraduationCap, TrendingUp, UserPlus } from "lucide-react";
import { char, fillers, META } from "../../lib/data.ts";
import { chapterFile, dayOf, examsFor, fillerChapter, ids, recruitGate } from "../../lib/chapter.ts";
import { P3, PART_HOME, pos, posLabel, section } from "../../lib/parts.ts";
import { assignRows, divineHolders, licenseRows, notPlanned, p3Plan, salvationArmy } from "../../lib/part-army.ts";
import { pids } from "../../lib/part-plan.ts";
import { examRanks } from "../../lib/refs.ts";
import { ArrowRight } from "lucide-react";
import { QUESTS, resolve } from "../../lib/refs.ts";
import { routeUnits } from "../../lib/walkthrough/builds.ts";
import { useTrack } from "../../lib/track.ts";
import type { LicenseRow, RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { RefChip, Rich, UnitRef } from "../ref/rich.tsx";
import { RouteCtx } from "../ref/ctx.ts";
import { Gate, Gold } from "../walkthrough/inline.tsx";
import { Tag, Tick } from "../chapter/bits.tsx";
import { DataTable, PanelHead, TD, TGroup, TR } from "../ui/data-table.tsx";

/* The route Ledger (redesign/02-templates.md §3): cross-chapter queues, reachable from every chapter. */

export type LedgerTab = "classes" | "gear" | "recruits" | "calendar" | "renown";

const TABS: { id: LedgerTab; label: string; icon: ReactNode }[] = [
  { id: "classes", label: "Classes", icon: <GraduationCap className="size-4" /> },
  { id: "gear", label: "Gear", icon: <Gem className="size-4" /> },
  { id: "recruits", label: "Recruits", icon: <UserPlus className="size-4" /> },
  { id: "calendar", label: "Calendar", icon: <CalendarDays className="size-4" /> },
  { id: "renown", label: "Renown", icon: <TrendingUp className="size-4" /> },
];

const ClassChip = ({ name }: { name: string }) => {
  const r = resolve(name, "class");
  return r ? <RefChip r={r} /> : <b>{name}</b>;
};
const ItemChip = ({ name }: { name: string }) => {
  const r = resolve(name, "item") ?? resolve(name);
  return r ? <RefChip r={r} /> : <b>{name}</b>;
};
const BattalionChip = ({ name }: { name: string }) => {
  const r = resolve(name, "battalion");
  return r ? <RefChip r={r} /> : <b>{name}</b>;
};
const Ch = ({ ch, est }: { ch?: number | string; est?: boolean }) =>
  ch === undefined
    ? <span className="text-faint">·</span>
    : (
      <span className="font-semibold whitespace-nowrap text-gold-lo tabular-nums">
        {est ? "~" : ""}
        {typeof ch === "number" ? `Ch ${ch}` : ch}
      </span>
    );
const REFINE_GROUP = {
  rare: "Rare ore · specials: +1 at Renown 7, +2 at Renown 10",
  common: "Smithing Stone · Iron: +1 at Renown 7, +2 at Renown 10",
  "?": "Ores unknown · Da Mina: +1 at Renown 7, +2 at Renown 10",
  soulstone: "Warrior's Soulstone · Part III maxima",
} as const;
const Why = ({ text, k }: { text?: string; k: string }) =>
  text
    ? (
      <span className="text-[13px] text-muted">
        <Rich text={text} k={k} />
      </span>
    )
    : null;

/** The exam event id of a ledger row, if the unit's plan has that class. */
function examId(route: RouteName, row: LicenseRow): string | undefined {
  const u = routeUnits(route).find((x) => x.name === row.unit);
  if (!u) return undefined;
  const i = u.stages.findIndex((s) => s.cls === row.class);
  return i >= 0 ? ids.exam(route, row.unit, row.class, i) : undefined;
}

const LIC_COLS = [
  { className: "w-[22px]" },
  { label: "#", className: "w-[26px]" },
  { label: "Unit", className: "w-[120px]" },
  "Class",
  { label: "When", className: "w-[96px]" },
  "Ranks · why",
];

function LicenseTable({ route, rows, cap }: { route: RouteName; rows: LicenseRow[]; cap?: number }) {
  const t = useTrack();
  let partOne = 0;
  return (
    <DataTable card cols={LIC_COLS} minW={560}>
      {rows.map((r, i) => {
        const id = examId(route, r);
        const done = Boolean(id && t.done[id]);
        const isPartOne = typeof r.ch === "number" || !/^part/i.test(String(r.ch ?? ""));
        if (isPartOne) partOne++;
        const capLine = cap !== undefined && isPartOne && partOne === cap && rows.slice(i + 1).length > 0;
        return (
          <Fragment key={`${r.unit}-${r.class}-${i}`}>
            <TR done={done}>
              <TD>{id && <Tick id={id} label={`${r.unit} reached ${r.class}`} />}</TD>
              <TD className="text-[12px] font-semibold text-faint tabular-nums">{i + 1}</TD>
              <TD>
                <UnitRef name={r.unit} />
              </TD>
              <TD>
                <ClassChip name={r.class} />
                {r.side && (
                  <span className="ml-1.5">
                    <Tag tone="route">side trip</Tag>
                  </span>
                )}
              </TD>
              <TD>
                <Ch ch={r.ch} />
              </TD>
              <TD>
                {r.ranks?.length ? <span className="mr-2 text-[13px] font-semibold">{r.ranks.join(" · ")}</span> : null}
                <Why text={r.why} k={`lw${i}`} />
              </TD>
            </TR>
            {capLine && (
              <TGroup cols={6} tone="red">Part I cap: {cap} Advanced classes · below: Part II Licenses</TGroup>
            )}
          </Fragment>
        );
      })}
    </DataTable>
  );
}

function Classes({ route }: { route: RouteName }) {
  const l = META.routes[route].ledger;
  const lic = l?.licenses;
  if (!lic) return <p className="text-muted">No license plan for this route yet.</p>;
  return (
    <>
      {l?.rules?.length
        ? (
          <ul className="m-0 mb-1 list-none space-y-1 p-0 text-[14px]">
            {l.rules.map((r, i) => (
              <li key={i} className="grid grid-cols-[18px_minmax(0,1fr)] gap-1.5">
                <Crown className="mt-[3px] size-3.5 text-faint" />
                <span>
                  <Rich text={r} k={`lr${i}`} />
                </span>
              </li>
            ))}
          </ul>
        )
        : null}
      <PanelHead aside={<span className="text-[12px] text-muted">{lic.advancedCap ?? 8} in Part I</span>}>
        Advanced, in priority order
      </PanelHead>
      <LicenseTable route={route} rows={lic.advanced} cap={lic.advancedCap} />
      {lic.buy && (
        <p className="mt-1 mb-0 text-[13px] text-muted">
          <Rich text={lic.buy} k="buy" />
        </p>
      )}
      <PanelHead>Specialty</PanelHead>
      <LicenseTable route={route} rows={lic.specialty} />
      <PanelHead>Beginner</PanelHead>
      <LicenseTable route={route} rows={lic.beginner} />
      {l?.licenseBudget?.length
        ? (
          <>
            <PanelHead>Licenses you get per chapter</PanelHead>
            <DataTable
              card
              cols={["", ...l.licenseBudget.map((b) => ({ label: `Ch ${b.ch}`, className: "text-center" }))]}
            >
              {(["beginner", "specialty", "advanced"] as const).map((k) => (
                <TR key={k}>
                  <TD className="text-[13px] font-semibold capitalize">{k}</TD>
                  {l.licenseBudget!.map((b) => (
                    <TD key={b.ch} className="text-center tabular-nums">
                      {b[k] || <span className="text-faint">·</span>}
                    </TD>
                  ))}
                </TR>
              ))}
            </DataTable>
          </>
        )
        : null}
    </>
  );
}

/** Who carries which battalion, derived from build stages (one owner: each stage's `battalion`). */
function BattalionTable({ route, p3 }: { route: RouteName; p3?: boolean }) {
  const rows: { unit: string; name: string; from: string; to: string; why?: string }[] = [];
  // Part III: every army's picked copy (D-145), Part III stages only.
  const units = p3
    ? salvationArmy().filter((u) => !notPlanned(u)).flatMap((u) => p3Plan(u.name)?.plan ?? [])
    : routeUnits(route);
  for (const u of units) {
    for (const ps of u.stages) {
      if (p3 && ps.pos <= 18) continue;
      const b = ps.stage.battalion;
      if (!b) continue;
      const last = rows.at(-1);
      if (last && last.unit === u.name && last.name === b.name) last.to = ps.stage.when;
      else rows.push({ unit: u.name, name: b.name, from: ps.stage.when, to: ps.stage.when, why: b.why });
    }
  }
  if (!rows.length) return null;
  return (
    <>
      <PanelHead aside={<span className="text-[12px] text-muted">infantry only · tier at or below Authority</span>}>
        Battalions: who carries what
      </PanelHead>
      <DataTable card cols={[{ label: "Unit", className: "w-[120px]" }, "Battalion", "Stages", "Why"]} minW={560}>
        {rows.map((r) => (
          <TR key={r.unit + r.name + r.from}>
            <TD>
              <UnitRef name={r.unit} />
            </TD>
            <TD>
              <BattalionChip name={r.name} />
            </TD>
            <TD className="text-[13px] text-muted">{r.from === r.to ? r.from : `${r.from} → ${r.to}`}</TD>
            <TD>
              <Why text={r.why} k={`bt${r.unit}${r.name}${r.from}`} />
            </TD>
          </TR>
        ))}
      </DataTable>
    </>
  );
}

function GearTab({ route }: { route: RouteName }) {
  const l = META.routes[route].ledger;
  if (!l) return <p className="text-muted">No gear plan for this route yet.</p>;
  return (
    <>
      {l.weaponPriority?.length
        ? (
          <>
            <PanelHead>Weapon priority: who gets new weapons and training first</PanelHead>
            <DataTable card cols={[{ label: "Type", className: "w-[100px]" }, "Order", "Why"]} minW={520}>
              {l.weaponPriority.map((w) => (
                <TR key={w.type}>
                  <TD className="font-semibold">{w.type}</TD>
                  <TD>
                    {w.units.map((u, i) => (
                      <span key={u} className="whitespace-nowrap">
                        {i > 0 && <span className="mx-1 text-faint">›</span>}
                        <UnitRef name={u} />
                      </span>
                    ))}
                  </TD>
                  <TD>
                    <Why text={w.why} k={`wp${w.type}`} />
                  </TD>
                </TR>
              ))}
            </DataTable>
          </>
        )
        : null}
      {l.uniques?.length
        ? (
          <>
            <PanelHead>One copy: who holds it</PanelHead>
            <DataTable
              card
              cols={[{ className: "w-[22px]" }, "Item", { label: "Holder", className: "w-[120px]" }, {
                label: "When",
                className: "w-[56px]",
              }, "Source · fallback"]}
              minW={560}
            >
              {l.uniques.map((u) => {
                const id = ids.unique(route, u.item, u.to);
                return <UniqueRow key={u.item + u.to} id={id} u={u} />;
              })}
            </DataTable>
          </>
        )
        : null}
      {l.barters?.length
        ? (
          <>
            <PanelHead>Barters (Vandahl)</PanelHead>
            <DataTable
              card
              cols={[
                "Item",
                { label: "For", className: "w-[120px]" },
                { label: "When", className: "w-[56px]" },
                "Materials",
              ]}
              minW={520}
            >
              {l.barters.map((b) => (
                <TR key={b.item + b.for}>
                  <TD>
                    <ItemChip name={b.item} />
                  </TD>
                  <TD>
                    <UnitRef name={b.for} />
                  </TD>
                  <TD>
                    <Ch ch={b.ch} />
                  </TD>
                  <TD className="text-[13px] text-ink-soft">
                    <Rich text={barterText(b, route)} k={`bm${b.item}`} />
                  </TD>
                </TR>
              ))}
            </DataTable>
          </>
        )
        : null}
      <BattalionTable route={route} />
      {l.refines?.length
        ? (
          <>
            <PanelHead>Refine projects</PanelHead>
            <DataTable
              card
              cols={[
                { label: "Unit", className: "w-[120px]" },
                "Item",
                { label: "When", className: "w-[72px]" },
                "Why",
              ]}
              minW={560}
            >
              {l.refines.map((r, i) => (
                <Fragment key={r.unit + r.item}>
                  {r.ore && r.ore !== l.refines![i - 1]?.ore && <TGroup cols={4}>{REFINE_GROUP[r.ore]}</TGroup>}
                  <TR>
                    <TD>
                      <UnitRef name={r.unit} />
                    </TD>
                    <TD>
                      <ItemChip name={r.item} />
                    </TD>
                    <TD>
                      <Ch ch={r.ch} />
                    </TD>
                    <TD>
                      <Why text={r.why} k={`rf${r.unit}${r.item}`} />
                    </TD>
                  </TR>
                </Fragment>
              ))}
            </DataTable>
          </>
        )
        : null}
      {l.carried?.length
        ? (
          <>
            <PanelHead>Items recruits bring</PanelHead>
            <DataTable card cols={[{ label: "Unit", className: "w-[120px]" }, "Item", "When"]} minW={480}>
              {l.carried.map((c) => (
                <TR key={c.unit + c.item}>
                  <TD>
                    <UnitRef name={c.unit} />
                  </TD>
                  <TD>
                    <ItemChip name={c.item} />
                  </TD>
                  <TD className="text-[13px] text-muted">{c.when}</TD>
                </TR>
              ))}
            </DataTable>
          </>
        )
        : null}
    </>
  );
}

type Unique = NonNullable<NonNullable<(typeof META.routes)[RouteName]["ledger"]>["uniques"]>[number];

function UniqueRow({ id, u }: { id: string; u: Unique }) {
  const done = Boolean(useTrack().done[id]);
  return (
    <TR done={done}>
      <TD>
        <Tick id={id} label={`${u.item} given to ${u.to}`} />
      </TD>
      <TD>
        <ItemChip name={u.item} />
      </TD>
      <TD>
        <UnitRef name={u.to} />
      </TD>
      <TD>
        <Ch ch={u.ch} />
      </TD>
      <TD className="text-[13px] text-muted">
        {u.from && <Rich text={u.from} k={`uf${u.item}${u.to}`} />}
        {u.fallback && (
          <>
            · fallback: <Rich text={u.fallback} k={`ub${u.item}${u.to}`} />
          </>
        )}
      </TD>
    </TR>
  );
}

function Recruits({ route }: { route: RouteName }) {
  const t = useTrack();
  const info = META.routes[route];
  const rows = [
    ...info.roster.map((r) => ({ name: r.name, ch: r.chapter, est: r.estimate, role: "Army" })),
    ...info.extras.map((n) => {
      const cp = char(n)?.copies?.find((x) => x.route === route);
      return { name: n, ch: cp?.chapter ?? 12, est: true, role: "Part II extra" };
    }),
    ...fillers(route).map((f) => ({
      name: f.name,
      ch: fillerChapter(route, f),
      est: true,
      role: f.kind === "items" ? `Filler: ${f.item}` : "Filler: supports",
    })),
  ].sort((a, b) => a.ch - b.ch);
  return (
    <DataTable
      card
      cols={[
        { className: "w-[22px]" },
        { label: "Unit", className: "w-[120px]" },
        { label: "Joins", className: "w-[56px]" },
        "Gates",
        "What it takes",
        { label: "Kind", className: "w-[90px]" },
      ]}
      minW={620}
    >
      {rows.map((r) => {
        const g = recruitGate(route, r.name) ?? char(r.name)?.recruitOn?.[route];
        const id = ids.recruit(route, r.name);
        const auto = g?.how === "auto" || g?.how === "lord";
        const done = auto || Boolean(t.done[id]);
        return (
          <TR key={r.name + r.role} done={done && !auto}>
            <TD>
              {auto
                ? <Check className="mt-[2px] size-4 text-faint" aria-label="Joins on its own" />
                : <Tick id={id} label={`${r.name} recruited`} />}
            </TD>
            <TD>
              <UnitRef name={r.name} />
            </TD>
            <TD>
              <Ch ch={r.ch} est={r.est} />
            </TD>
            <TD className="whitespace-nowrap">
              {g?.support !== undefined && <Gate kind="S" n={g.support} />}
              {g?.renown !== undefined && <Gate kind="R" n={g.renown} />}
              {g?.gold !== undefined && <Gold amount={`${g.gold.toLocaleString("en-US")}G`} />}
              {auto && <span className="text-[13px] text-muted">joins</span>}
            </TD>
            <TD className="text-[13px] text-ink-soft">
              {g?.item && <ItemChip name={g.item} />}
              {g?.item && g?.task && " · "}
              {g?.task && <Rich text={g.task} k={`rt${r.name}`} />}
            </TD>
            <TD className="text-[12.5px] text-muted">{r.role}</TD>
          </TR>
        );
      })}
    </DataTable>
  );
}

function Calendar({ route }: { route: RouteName }) {
  const t = useTrack();
  const rows: { date: string; ch: number; label: string; id: string; kind: string }[] = [];
  for (const q of Object.values(QUESTS)) {
    const r = q.routes[route];
    if (r?.due) {
      rows.push({ date: r.due, ch: r.ch, label: `[[quest:${q.id}]]`, id: ids.quest(route, q.id), kind: q.kind });
    }
  }
  for (let ch = 1; ch <= 12; ch++) {
    for (const m of chapterFile(route, ch)?.missables ?? []) {
      if (m.when && /\d+\/\d+/.test(m.when)) {
        rows.push({ date: m.when.match(/\d+\/\d+/)![0], ch, label: m.text, id: m.id, kind: "missable" });
      }
    }
  }
  rows.sort((a, b) => dayOf(a.date) - dayOf(b.date));
  if (!rows.length) return <p className="text-muted">No dated items yet.</p>;
  return (
    <>
      <p className="mt-0 mb-2 text-[13px] text-muted">
        Every dated quest and missable on this route, from the migrated chapters.
      </p>
      <DataTable
        card
        cols={[{ className: "w-[22px]" }, { label: "Due", className: "w-[52px]" }, "What", {
          label: "Kind",
          className: "w-[80px]",
        }, { label: "Ch", className: "w-[48px]" }]}
        minW={480}
      >
        {rows.map((r) => (
          <TR key={r.id} done={Boolean(t.done[r.id])}>
            <TD>
              <Tick id={r.id} label={r.label} />
            </TD>
            <TD className="font-semibold text-blood tabular-nums">{r.date}</TD>
            <TD>
              <Rich text={r.label} k={r.id} />
            </TD>
            <TD className="text-[12.5px] text-muted capitalize">{r.kind}</TD>
            <TD>
              <Ch ch={r.ch} />
            </TD>
          </TR>
        ))}
      </DataTable>
    </>
  );
}

function Renown({ route }: { route: RouteName }) {
  const pace = META.routes[route].ledger?.renownPace;
  if (!pace?.length) return <p className="text-muted">No Renown pace for this route yet.</p>;
  return (
    <DataTable
      card
      cols={[{ label: "Ch", className: "w-[56px]" }, { label: "Renown", className: "w-[100px]" }, "Opens"]}
      minW={440}
    >
      {pace.map((p) => (
        <TR key={p.ch}>
          <TD>
            <Ch ch={p.ch} />
          </TD>
          <TD className="whitespace-nowrap">
            <Gate kind="R" n={p.from} /> → <Gate kind="R" n={p.to} />
          </TD>
          <TD className="text-ink-soft">
            <Rich text={p.opens} k={`rp${p.ch}`} />
          </TD>
        </TR>
      ))}
    </DataTable>
  );
}

/** Ledger with its five tabs. Listens for "fw-ledger-tab" events so chapter slots can open a given tab. */
/**
 * Class changes of Part II or III, derived from the build stages (D-125): one group per War chapter or Section. Part
 * II and III have no Recruits, Calendar or Renown queue; Gear keeps the uniques and the Soulstone refines.
 */
function PartClasses({ route, part }: { route: RouteName; part: 2 | 3 }) {
  const t = useTrack();
  const groups = [1, 2, 3, 4, 5, 6].map((n) => ({ n, exams: examsFor(route, pos(part, n)).filter((e) => !e.onJoin) }))
    .filter((g) => g.exams.length);
  if (!groups.length) return <p className="text-muted">No class changes planned in this Part.</p>;
  return (
    <>
      <p className="mt-0 mb-1 text-[13.5px] text-muted">
        {part === 2
          ? "Free Licenses every chapter (5 Beginner, 5 Specialty, 5 Advanced): spend them, they don't stack."
          : "Master exams need a Master License and Lv 45; Divine classes need their Temple of the Diadem item and a 100% pass."}
      </p>
      <DataTable
        card
        cols={[{ className: "w-[22px]" }, { label: "Unit", className: "w-[130px]" }, "Class change", "Ranks"]}
        minW={520}
      >
        {groups.map((g) => (
          <Fragment key={g.n}>
            <TGroup cols={4}>{posLabel(pos(part, g.n))}</TGroup>
            {g.exams.map((e) => (
              <TR key={e.id} done={Boolean(t.done[e.id])}>
                <TD>
                  <Tick id={e.id} label={`${e.unit.name} reached ${e.to}`} />
                </TD>
                <TD>
                  <UnitRef name={e.unit.name} />
                </TD>
                <TD>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {e.from && (
                      <span className="opacity-60">
                        <ClassChip name={e.from} />
                      </span>
                    )}
                    {e.from && <ArrowRight className="size-3.5 text-faint" />}
                    <ClassChip name={e.to} />
                    {e.kind === "detour" && <Tag tone="route">side trip</Tag>}
                  </span>
                </TD>
                <TD className="text-[13px] font-semibold">{e.ranks.join(" · ")}</TD>
              </TR>
            ))}
          </Fragment>
        ))}
      </DataTable>
    </>
  );
}

/* ------------------------------------------------------------ Part III */

const DIVINE = [
  "The Trident",
  "The Godhand",
  "The Eternal",
  "The Avatar",
  "The Calamity",
  "The Blade",
  "The Cavalier",
  "The Apsara",
];

/**
 * Part III Classes (D-149): each Section's Master License queue from the plan files, then the Divine claims (Diadem
 * holders) the picked builds take that Section. Ticks are the same as the Section page's queue and exam cards.
 */
function P3Classes() {
  const t = useTrack();
  const lic = licenseRows();
  const divine = DIVINE.flatMap((cls) => divineHolders(cls).map((h) => ({ ...h, cls })));
  const ns = [1, 2, 3, 4, 5, 6].filter((n) => lic.some((l) => l.n === n) || divine.some((d) => d.n === n));
  return (
    <>
      <p className="mt-0 mb-1 text-[13.5px] text-muted">
        Master exams need a Master License (Dagsion vendor: 3 a Section, 8,000G), Lv 45 and the ranks; EL rows need an
        Elephant License, Lv 35 and Riding C. Divine classes need their Temple of the Diadem item and a 100% pass.
      </p>
      <DataTable
        card
        cols={[
          { className: "w-[22px]" },
          { label: "#", className: "w-[26px]" },
          {
            label: "Unit",
            className: "w-[130px]",
          },
          "Class",
          "Ranks · why",
        ]}
        minW={560}
      >
        {ns.map((n) => {
          const rows = lic.filter((l) => l.n === n);
          const masters = rows.filter((l) => !l.license);
          const div = divine.filter((d) => d.n === n);
          return (
            <Fragment key={n}>
              <TGroup cols={5}>
                Section {n} · {section(n)?.name}
                {masters.length ? ` · ${masters.length} Master Licenses` : ""}
                {rows.length > masters.length ? ` · ${rows.length - masters.length} Elephant` : ""}
              </TGroup>
              {rows.map((l, i) => {
                const id = pids.license(PART_HOME, l.unit, l.to);
                return (
                  <TR key={id} done={Boolean(t.done[id])}>
                    <TD>
                      <Tick id={id} label={`${l.unit}: ${l.to} exam passed`} />
                    </TD>
                    <TD className="text-[12px] font-semibold text-faint tabular-nums">
                      {l.license ? <Tag tone="route">EL</Tag> : masters.indexOf(l) + 1}
                    </TD>
                    <TD>
                      <UnitRef name={l.unit} />
                    </TD>
                    <TD>
                      <ClassChip name={l.to} />
                    </TD>
                    <TD>
                      {examRanks(l.to).length
                        ? <span className="mr-2 text-[13px] font-semibold">{examRanks(l.to).join(" · ")}</span>
                        : null}
                      <Why text={l.why} k={`pl${n}${i}`} />
                    </TD>
                  </TR>
                );
              })}
              {div.map((d) => {
                const x = p3Plan(d.unit);
                const i = x ? x.plan.stages.findIndex((s) => s.cls === d.cls) : -1;
                const id = x && i >= 0 ? ids.exam(x.route ?? PART_HOME, d.unit, d.cls, i) : undefined;
                const from = x && i > 0 ? x.plan.stages[i - 1].cls : undefined;
                return (
                  <TR key={d.cls + d.unit} done={Boolean(id && t.done[id])}>
                    <TD>{id && <Tick id={id} label={`${d.unit} reached ${d.cls}`} />}</TD>
                    <TD>
                      <Tag tone="route">Divine</Tag>
                    </TD>
                    <TD>
                      <UnitRef name={d.unit} />
                    </TD>
                    <TD>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {from && (
                          <span className="opacity-60">
                            <ClassChip name={from} />
                          </span>
                        )}
                        {from && <ArrowRight className="size-3.5 text-faint" />}
                        <ClassChip name={d.cls} />
                      </span>
                    </TD>
                    <TD className="text-[13px] font-semibold">{examRanks(d.cls).join(" · ")}</TD>
                  </TR>
                );
              })}
            </Fragment>
          );
        })}
      </DataTable>
    </>
  );
}

/** Trial items: the god whose Lv 60 Trial gives them. */
const TRIAL_OF = new Map(
  P3.quests.flatMap((q) => (q.reward.trial_items ?? []).map((it) => [it, q.giver ?? q.name] as const)),
);

/**
 * Part III Gear: each Section's hand-overs from the plan files (`gear.assign`: Trial items, Anna's boosters, weapons),
 * then the Trial items nobody is handed yet, then battalions. The Part I tables (barters, weapon priority, uniques,
 * refines) stay in Part I.
 */
function P3Gear({ route }: { route: RouteName }) {
  const t = useTrack();
  const rows = assignRows();
  const ns = [...new Set(rows.map((r) => r.n))];
  const loose = [...TRIAL_OF.keys()].filter((it) => !rows.some((r) => r.item === it));
  return (
    <>
      <PanelHead aside={<span className="text-[12px] text-muted">one copy each · tick when handed over</span>}>
        Hand over, by Section
      </PanelHead>
      {rows.length
        ? (
          <DataTable
            card
            cols={[{ className: "w-[22px]" }, "Item", { label: "To", className: "w-[130px]" }, "Why"]}
            minW={560}
          >
            {ns.map((n) => (
              <Fragment key={n}>
                <TGroup cols={4}>Section {n} · {section(n)?.name}</TGroup>
                {rows.filter((r) => r.n === n).map((r) => {
                  const id = ids.unique(PART_HOME, r.item, r.to);
                  return (
                    <TR key={r.item + r.to} done={Boolean(t.done[id])}>
                      <TD>
                        <Tick id={id} label={`${r.item} given to ${r.to}`} />
                      </TD>
                      <TD>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <ItemChip name={r.item} />
                          {TRIAL_OF.has(r.item) && <Tag tone="route">{TRIAL_OF.get(r.item)}'s Trial</Tag>}
                        </span>
                      </TD>
                      <TD>
                        <UnitRef name={r.to} />
                      </TD>
                      <TD>
                        <Why text={r.why} k={`pa${n}${r.item}`} />
                      </TD>
                    </TR>
                  );
                })}
              </Fragment>
            ))}
          </DataTable>
        )
        : <p className="text-muted">No hand-overs planned yet.</p>}
      {loose.length > 0 && (
        <p className="mt-2 mb-0 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
          Trial items with no holder yet: {loose.map((it) => <ItemChip key={it} name={it} />)}
        </p>
      )}
      <BattalionTable route={route} p3 />
    </>
  );
}

export function Ledger(
  { route, initial = "classes", part = 1 }: { route: RouteName; initial?: LedgerTab; part?: 1 | 2 | 3 },
) {
  const [tab, setTab] = useState<LedgerTab>(initial);
  useEffect(() => {
    const on = (e: Event) => setTab((e as CustomEvent<LedgerTab>).detail);
    globalThis.addEventListener("fw-ledger-tab", on);
    return () => globalThis.removeEventListener("fw-ledger-tab", on);
  }, []);
  return (
    <RouteCtx.Provider value={route}>
      <div
        role="tablist"
        className="sticky top-0 z-[2] -mx-4 mb-2 flex gap-1 bg-card px-4 py-2 shadow-[0_1px_0_rgba(176,144,90,.4)]"
      >
        {TABS.filter((t) => part === 1 || t.id === "classes" || t.id === "gear").map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "flex items-center gap-1 border-b-2 px-2 py-1 text-[13px] font-semibold",
              tab === t.id ? "border-(--c) text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {tab === "classes" &&
        (part === 1
          ? <Classes route={route} />
          : part === 3
          ? <P3Classes />
          : <PartClasses route={route} part={part} />)}
      {tab === "gear" && (part === 3 ? <P3Gear route={route} /> : <GearTab route={route} />)}
      {tab === "recruits" && <Recruits route={route} />}
      {tab === "calendar" && <Calendar route={route} />}
      {tab === "renown" && <Renown route={route} />}
    </RouteCtx.Provider>
  );
}
