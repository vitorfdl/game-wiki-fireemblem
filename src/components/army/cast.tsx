import { char, deployStatus, fillers, META, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { routeUnits, type UnitPlan } from "../../lib/walkthrough/builds.ts";
import type { RouteName } from "../../lib/types.ts";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";
import { routeVars } from "../../lib/route-style.ts";
import { Portrait } from "../ui/portrait.tsx";

/*
 * Cast intro (redesign/10-visual-language.md, D-31): the whole army at once, like a film's cast card.
 * Always open (D-86, D-88): the army (second copies that fight here marked by a dashed outline), then a Fillers row.
 */

/** Everyone who fights in Part I: the army, plus second copies that hold a lineup slot or deploy in a phase; by join. */
const castOf = (r: RouteName) => {
  const dep = META.routes[r].deployment;
  const fights = new Set([
    ...(dep?.lineup ?? []).flatMap((s) => s.holders.map((h) => h.unit)),
    ...(dep?.phases ?? []).flatMap((p) => p.deploy),
  ]);
  return routeUnits(r).filter((u) => !u.extra || fights.has(u.name))
    .sort((a, b) => Number(b.lord) - Number(a.lord) || a.join - b.join);
};

function role(u: UnitPlan, r: RouteName) {
  return deployStatus(u.name, r)?.role ?? u.character.guide?.role ?? u.character.build?.role;
}

type Kind = "army" | "extra" | "filler";

export function Tile({ name, sub, title, r, i, kind }: { name: string; sub: string; title: string; r: RouteName; i: number; kind: Kind }) {
  const c = char(name);
  if (!c) return null;
  return (
    // A click opens the build page (no unit hover cards); the poster keeps its hover lift.
    <a
      href={href(routeSlug(r), c.slug)}
      title={title}
      className={cx("group animate-rise block text-center", kind === "filler" && "opacity-80 hover:opacity-100")}
      style={{ animationDelay: `${Math.min(i, 24) * 30}ms` }}
    >
      <span
        style={routeVars(c.homeRoute)}
        className={cx(
          "relative block aspect-[3/4] overflow-hidden rounded-md bg-[linear-gradient(180deg,var(--c2),color-mix(in_srgb,var(--c)_55%,#0d1f22))] shadow-[0_8px_18px_-10px_rgba(0,0,0,.8)] transition duration-200 group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-gold-hi",
          kind === "army" ? "ring-1 ring-white/10" : "outline-[1.5px] -outline-offset-[1.5px] outline-gold-hi/55",
          kind === "filler" ? "outline-dotted" : kind === "extra" && "outline-dashed",
        )}
      >
        <Portrait
          name={name}
          className="absolute bottom-0 left-1/2 h-[118%] w-auto max-w-none -translate-x-1/2 object-cover object-top saturate-[.85] transition-[filter] duration-200 group-hover:saturate-100"
          opaqueClassName="!h-full !w-full !left-0 !translate-x-0"
          fallbackClassName="text-[20px]"
        />
      </span>
      <span className="mt-1.5 block truncate text-[13px] font-semibold text-parchment group-hover:text-white">{name}</span>
      <span className="block text-[11.5px] text-gold-hi/70 tabular-nums">{sub}</span>
    </a>
  );
}

export function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={cx(label && "mt-4 border-t border-dashed border-white/15 pt-3")}>
      {label && <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-gold-hi/80 uppercase">{label}</div>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-3 gap-y-4">{children}</div>
    </div>
  );
}

export function Cast({ r }: { r: RouteName }) {
  const list = castOf(r);
  const shown = new Set(list.map((u) => u.name));
  const fill = fillers(r).filter((f) => !shown.has(f.name));
  return (
    <section aria-label="Cast" className="mt-5 border-t border-white/10 pt-4">
      <Group>
        {list.map((u, i) => (
          <Tile key={u.name} name={u.name} r={r} i={i} kind={u.extra ? "extra" : "army"}
            sub={u.lord ? "Lord" : `Ch ${u.join}${u.extra ? " · 2nd copy" : ""}`}
            title={[u.name, u.extra ? "second copy (merges in Part III)" : "", role(u, r)].filter(Boolean).join(" · ")} />
        ))}
      </Group>
      {fill.length > 0 && (
        <Group label={`Fillers · ${fill.length}`}>
          {fill.map((f, i) => (
            <Tile key={f.name} name={f.name} r={r} i={list.length + i} kind="filler"
              sub={`${f.when.match(/Ch \d+/)?.[0] ?? f.when} · filler`} title={`${f.name} · ${f.why}`} />
          ))}
        </Group>
      )}
    </section>
  );
}
