import { type ReactNode, useEffect, useState } from "react";
import {
  Bird,
  Carrot,
  ChevronDown,
  Dices,
  Drumstick,
  ExternalLink,
  Feather,
  Fish,
  Flame,
  PawPrint,
  Star,
} from "lucide-react";
import { CHARACTERS } from "../../lib/data.ts";
import { cx } from "../../lib/cx.ts";
import type { RouteName } from "../../lib/types.ts";
import {
  type Breed,
  BREED_BY_NAME,
  BREEDS,
  breedUrl,
  FAMILIES,
  type Family,
  FOOD_SOURCE,
  FOODS,
  foodUrl,
  MOUNT_SOURCE,
  type MountRec,
  mountRecs,
  ridersOf,
  TAMING_TIPS,
} from "../../lib/mounts.ts";
import { Medal } from "../ui/medal.tsx";
import { PlaceChip } from "./inline.tsx";
import { foldName, ITEM_BY_NAME } from "../../lib/map.ts";

const FAMILY_STYLE: Record<Family, { icon: ReactNode; cls: string }> = {
  Ornius: { icon: <Bird aria-hidden="true" className="size-[1em]" />, cls: "bg-[#dcebe8] text-[#1f5b57]" },
  Horse: { icon: <PawPrint aria-hidden="true" className="size-[1em]" />, cls: "bg-[#f1e3cf] text-[#6f4a1c]" },
  Pegasus: { icon: <Feather aria-hidden="true" className="size-[1em]" />, cls: "bg-[#e1e8f4] text-[#34507d]" },
  Bau: { icon: <Flame aria-hidden="true" className="size-[1em]" />, cls: "bg-[#f4dede] text-[#7c2323]" },
  Elephant: { icon: <PawPrint aria-hidden="true" className="size-[1em]" />, cls: "bg-[#e6e3dd] text-[#4f4a40]" },
};

const FOOD_ICON: Record<string, ReactNode> = {
  Fish: <Fish aria-hidden="true" className="size-[1em]" />,
  Vegetable: <Carrot aria-hidden="true" className="size-[1em]" />,
  Meat: <Drumstick aria-hidden="true" className="size-[1em]" />,
};

const TASTE_CLS: Record<string, string> = {
  Sweet: "text-[#a2416b]",
  Spicy: "text-[#b4441c]",
  Bitter: "text-[#4c5a2a]",
  Rare: "text-[#6b4aa0]",
};

const rowId = (b: Breed) => `mount-${b.slug}`;

/** Bond 5 bonus as one line per stat: flat points, then growth. */
function Bonus({ b }: { b: Breed }) {
  return (
    <ul className="m-0 grid list-none gap-0.5 p-0 tabular-nums">
      {b.bonus.map((x) => (
        <li key={x.stat} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="w-8 font-semibold">{x.stat}</span>
          <span className={cx("w-6", !x.flat && "text-muted")}>{x.flat ? `+${x.flat}` : "—"}</span>
          <span className={cx(!x.growth && "text-muted")}>{x.growth ? `${x.growth}%` : "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/** A breed name with its family colour; rare breeds get a star. */
function BreedBadge({ b, onClick }: { b: Breed; onClick?: () => void }) {
  const f = FAMILY_STYLE[b.family];
  const body = (
    <>
      {f.icon}
      <span>{b.name}</span>
      {b.rare && <Star aria-label="Rare" className="size-[0.85em] fill-current text-gold-lo" />}
    </>
  );
  const cls = cx(
    "inline-flex items-center gap-1 rounded-[3px] px-1.5 py-[1px] text-[13.5px] font-semibold whitespace-nowrap",
    f.cls,
  );
  return onClick
    ? (
      <button
        type="button"
        onClick={onClick}
        title={`Show ${b.name} in the breed table`}
        className={cx(cls, "cursor-pointer hover:brightness-95")}
      >
        {body}
      </button>
    )
    : <span className={cls}>{body}</span>;
}

function Food({ b, stack = false }: { b: Breed; stack?: boolean }) {
  return (
    <button
      type="button"
      title={`Which items are ${b.taste.toLowerCase()} ${b.food.toLowerCase()}?`}
      onClick={() => document.getElementById("mount-foods")?.scrollIntoView({ block: "start", behavior: "smooth" })}
      className={cx(
        "inline-flex cursor-pointer gap-x-1 text-left hover:underline decoration-gold underline-offset-2",
        stack ? "flex-col" : "items-center whitespace-nowrap",
      )}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {FOOD_ICON[b.food]}
        {b.food}
      </span>
      {!stack && <span className="text-muted">·</span>}
      <span className={cx("font-semibold", TASTE_CLS[b.taste])}>{b.taste}</span>
    </button>
  );
}

function Where({ b }: { b: Breed }) {
  if (b.unique) return <span className="text-muted">Comes with {b.unique}</span>;
  if (!b.spawns.length) {
    return <span className="text-muted">{b.part === "III" ? "Part III only" : "Not on a tile"}</span>;
  }
  return (
    <span className="flex flex-col gap-0.5">
      {b.spawns.map((s) => (
        <span key={s.place} className="whitespace-nowrap">
          <PlaceChip text={s.place} />
          {s.rare && <span className="ml-0.5 text-[11px] font-semibold text-gold-lo uppercase">rare</span>}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------ Your riders */

function RiderCard({ unit, recs, jump }: { unit: string; recs: MountRec[]; jump: (b: Breed) => void }) {
  const c = CHARACTERS[unit];
  return (
    <li className="rounded-md bg-paper/60 p-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.4)]">
      <div className="flex items-center gap-2.5">
        <Medal name={unit} route={c?.homeRoute} size={36} ring="var(--color-card)" />
        <span className="text-[16px] font-bold">{unit}</span>
      </div>
      <ol className="m-0 mt-2 list-none space-y-2 p-0">
        {recs.map((r, i) => {
          const b = BREED_BY_NAME.get(r.mount.toLowerCase());
          return (
            <li key={i} className="grid gap-1 border-l-2 border-gold/50 pl-3 text-[14px] leading-snug">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="label text-[11.5px] text-muted">{r.cls}</span>
                <span aria-hidden="true" className="text-muted">→</span>
                {b ? <BreedBadge b={b} onClick={() => jump(b)} /> : <b>{r.mount}</b>}
                {r.roll && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2 py-[1px] text-[12px] font-semibold text-teal-3"
                    title="Reroll the catch until it has this paired ability"
                  >
                    <Dices aria-hidden="true" className="size-3.5" />
                    {r.roll}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13.5px]">
                <PlaceChip text={r.where} />
                <span className="text-muted">{r.when}</span>
                {b && <Food b={b} />}
              </div>
              <p className="m-0 text-[13.5px] text-ink-soft">{r.why}</p>
              {r.alt && <p className="m-0 text-[13px] text-muted">Alternative: {r.alt}</p>}
            </li>
          );
        })}
      </ol>
    </li>
  );
}

/* ------------------------------------------------------------ All breeds */

const FAMILY_ORDER: Family[] = ["Ornius", "Horse", "Pegasus", "Bau", "Elephant"];

function BreedTable({ route, hot }: { route: RouteName; hot: string | null }) {
  const [fam, setFam] = useState<Family | "all">("all");
  const [partOne, setPartOne] = useState(false);
  const shown = BREEDS.filter((b) =>
    (fam === "all" || b.family === fam) && (!partOne || (b.part === "I" && b.spawns.length > 0))
  );
  useEffect(() => {
    if (hot) setFam("all");
  }, [hot]);
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(["all", ...FAMILY_ORDER] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={fam === f}
            onClick={() => setFam(f)}
            className={cx(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold",
              fam === f
                ? "bg-teal text-parchment"
                : "bg-paper text-ink-soft shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)]",
            )}
          >
            {f !== "all" && FAMILY_STYLE[f].icon}
            {f === "all" ? "All" : f}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={partOne} onChange={(e) => setPartOne(e.target.checked)} />
          Catchable in Part I
        </label>
      </div>
      <div className="overflow-x-auto rounded-md shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]">
        <table className="w-full min-w-[640px] border-collapse text-[13.5px] leading-snug">
          <thead>
            <tr className="bg-paper-2/70 text-left">
              {["Breed", "Bond 5 · growth", "Rolls one of", "Feed", "Where"].map((h) => (
                <th key={h} className="label px-2.5 py-2 text-[11.5px] font-semibold text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => {
              const riders = ridersOf(route, b);
              return (
                <tr
                  key={b.slug}
                  id={rowId(b)}
                  data-here={hot === b.slug || undefined}
                  className={cx(
                    "border-t border-gold/25 align-top",
                    hot === b.slug && "bg-gold-hi/35",
                    b.part === "III" && "opacity-70",
                  )}
                >
                  <td className="px-2.5 py-2">
                    <a
                      href={breedUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      title={`${b.name} on fortunesweave.co.uk`}
                      className="group inline-flex items-center gap-1"
                    >
                      <BreedBadge b={b} />
                      <ExternalLink aria-hidden="true" className="size-3 text-muted group-hover:text-teal-3" />
                    </a>
                    {b.part === "III" && (
                      <div className="mt-1 text-[11px] font-semibold text-muted uppercase">Part III</div>
                    )}
                    {riders.length > 0 && (
                      <span className="mt-1.5 flex -space-x-1.5" aria-label={`Ridden by ${riders.join(", ")}`}>
                        {riders.map((u) => (
                          <span key={u} title={u}>
                            <Medal name={u} route={CHARACTERS[u]?.homeRoute} size={26} ring="var(--color-card)" />
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <Bonus b={b} />
                  </td>
                  <td className="px-2.5 py-2">
                    <ul className="m-0 grid list-none gap-0.5 p-0">
                      {b.abilities.map((a) => <li key={a} className="whitespace-nowrap">{a}</li>)}
                    </ul>
                  </td>
                  <td className="px-2.5 py-2">
                    <Food b={b} stack />
                  </td>
                  <td className="px-2.5 py-2">
                    <Where b={b} />
                    {b.note && <div className="mt-1 text-[12.5px] text-muted">{b.note}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        Breed names open{" "}
        <a
          href={MOUNT_SOURCE}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-teal-3 underline decoration-gold"
        >
          fortunesweave.co.uk
        </a>
        ; places open the map. Paired abilities upgrade at bond 3 and bond 5.
      </p>
    </>
  );
}

/* ------------------------------------------------------------ Foods */

const TASTES = ["Sweet", "Spicy", "Bitter", "Rare"];
const FOOD_KINDS = ["Fish", "Vegetable", "Meat"];

/** What each mount food and taste actually is: every ingredient, with gather spots on the map. */
function FoodGrid({ route }: { route: RouteName }) {
  const wanted = new Map<string, string[]>();
  for (const r of mountRecs(route)) {
    const b = BREED_BY_NAME.get(r.mount.toLowerCase());
    if (!b) continue;
    const k = `${b.food}|${b.taste}`;
    wanted.set(k, [...new Set([...(wanted.get(k) ?? []), b.name])]);
  }
  return (
    <>
      <p className="mt-0 mb-2 text-[13.5px] leading-snug text-ink-soft">
        Lure with any item of the right type; feed the breed's taste for faster bond. "Vegetable" means any plant
        ingredient: grains, fruit, flowers, herbs. Highlighted cells feed one of your riders' mounts. Items with a leaf
        open the map on their gather spots.
      </p>
      <div className="overflow-x-auto rounded-md shadow-[inset_0_0_0_1px_rgba(176,144,90,.45)]">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-[13.5px] leading-snug">
          <thead>
            <tr className="bg-paper-2/70 text-left">
              <th className="label w-[96px] px-2.5 py-2 text-[11.5px] font-semibold text-muted">Food</th>
              {TASTES.map((t) => (
                <th key={t} className={cx("px-2.5 py-2 text-[12.5px] font-bold", TASTE_CLS[t])}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FOOD_KINDS.map((k) => (
              <tr key={k} className="border-t border-gold/25 align-top">
                <th className="px-2.5 py-2 text-left font-semibold">
                  <span className="inline-flex items-center gap-1">{FOOD_ICON[k]}{k}</span>
                </th>
                {TASTES.map((t) => {
                  const fans = wanted.get(`${k}|${t}`);
                  return (
                    <td key={t} className={cx("px-2.5 py-2", fans && "bg-gold-hi/30")}>
                      {fans && (
                        <div className="mb-1 text-[11.5px] font-semibold text-gold-lo">Feeds {fans.join(", ")}</div>
                      )}
                      <ul className="m-0 grid list-none gap-0.5 p-0">
                        {FOODS.filter((f) => f.food === k && f.taste === t).map((f) => (
                          <li key={f.slug}>
                            {ITEM_BY_NAME.has(foldName(f.name)) ? <PlaceChip text={f.name} /> : (
                              <a
                                href={foodUrl(f)}
                                target="_blank"
                                rel="noreferrer"
                                className="decoration-gold underline-offset-2 hover:underline"
                              >
                                {f.name}
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        Tastes from{" "}
        <a
          href={FOOD_SOURCE}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-teal-3 underline decoration-gold"
        >
          fortunesweave.co.uk cooking
        </a>
        . Items without a leaf have no mapped gather spot; they link to their item page.
      </p>
    </>
  );
}

/* ------------------------------------------------------------ Tab */

function Tips() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 rounded-md bg-paper/70 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-semibold"
      >
        How to catch the exact mount you want
        <ChevronDown
          aria-hidden="true"
          className={cx("ml-auto size-4 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="m-0 list-disc space-y-1 px-3 pb-3 pl-8 text-[14px] leading-snug">
          {TAMING_TIPS.map((t) => <li key={t}>{t}</li>)}
          {FAMILY_ORDER.map((f) => (
            <li key={f}>
              <b>{f}</b>: eats {FAMILIES[f].food.toLowerCase()}. Pairs with {FAMILIES[f].classes}.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MountsTab({ route, focus }: { route: RouteName; focus: { slug: string; nonce: number } | null }) {
  const [hot, setHot] = useState<string | null>(focus?.slug ?? null);
  const recs = mountRecs(route);
  const units = [...new Set(recs.map((r) => r.unit))];
  const jump = (b: Breed) => {
    setHot(b.slug);
    requestAnimationFrame(() => {
      document.getElementById(rowId(b))?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };
  useEffect(() => {
    if (!focus) return;
    const b = BREEDS.find((x) => x.slug === focus.slug);
    if (b) jump(b);
  }, [focus?.nonce]);
  return (
    <>
      <Tips />
      <h3 className="mt-0 mb-2 text-[18px]">Your riders</h3>
      <ul className="m-0 grid list-none gap-2.5 p-0 md:grid-cols-2">
        {units.map((u) => <RiderCard key={u} unit={u} recs={recs.filter((r) => r.unit === u)} jump={jump} />)}
      </ul>
      <h3 className="mt-6 mb-2 text-[18px]">Every breed</h3>
      <BreedTable route={route} hot={hot} />
      <h3 id="mount-foods" className="mt-6 mb-2 text-[18px]">What counts as each food</h3>
      <FoodGrid route={route} />
    </>
  );
}
