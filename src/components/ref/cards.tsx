import type { ReactNode } from "react";
import { PlaceLoot } from "./place-loot.tsx";
import { ArrowRight } from "lucide-react";
import { char, CHARACTERS, deployStatus, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { routeVars } from "../../lib/route-style.ts";
import { abilityRef, artRef, battalionRef, classRef, itemRef, QUESTS, type RefType, statRef } from "../../lib/refs.ts";
import { ids } from "../../lib/chapter.ts";
import { activeStage, routeUnits, unitPlan } from "../../lib/walkthrough/builds.ts";
import { isDone, useTrack } from "../../lib/track.ts";
import { Tick } from "../chapter/bits.tsx";
import { foldName, NODE, NODE_BY_NAME, WORLD } from "../../lib/map.ts";
import { BREED_BY_NAME } from "../../lib/mounts.ts";
import type { RouteName } from "../../lib/types.ts";
import { Medal } from "../ui/medal.tsx";
import { RefName, Rich, UnitPortrait, UnitRef } from "./rich.tsx";
import { cx } from "../../lib/cx.ts";
import { dislikes, gift, giftPicks, giftProfile, giftShop, placeNote, roadShops, stallLabel } from "../../lib/gifts.ts";
import { GiftName } from "./gift.tsx";
import { sourcesLine } from "../../lib/sources.ts";

/* Card contents for every hover type (redesign/02-templates.md §7). Pure render: no hooks, since the card
   renders in the hover layer outside the page's providers. Scope is passed in. */

export type Scope = { route: RouteName | null; chapter: number | null };

const Kicker = ({ children }: { children: ReactNode }) => (
  <div className="label mb-1 text-[11px] text-gold-lo">{children}</div>
);
const Title = ({ children }: { children: ReactNode }) => (
  <div className="pr-6 font-display text-[19px] leading-tight font-bold">{children}</div>
);
const Stat = ({ k, v }: { k: string; v: ReactNode }) =>
  v === undefined || v === null || v === ""
    ? null
    : (
      <span className="inline-flex items-baseline gap-1 rounded bg-paper-2 px-1.5 py-[1px] text-[12.5px]">
        <span className="text-muted">{k}</span>
        <b className="tabular-nums">{v}</b>
      </span>
    );
const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="mt-2 flex gap-2 text-[13.5px]">
    <span className="label w-[70px] shrink-0 pt-[2px] text-[10.5px] text-muted">{k}</span>
    <span className="min-w-0 flex-1">{children}</span>
  </div>
);
const Names = ({ names }: { names: string[] }) => (
  <span className="flex flex-wrap gap-1.5">
    {names.map((n) => (
      <span key={n} className="inline-flex items-center gap-1 font-semibold">
        <UnitPortrait flat name={n} size={18} ring="var(--color-card)" />
        <UnitRef name={n} avatar={false} />
      </span>
    ))}
  </span>
);

/** Units on a route whose plan uses a name in a given kit list, any stage. */
function users(
  route: RouteName | null,
  name: string,
  lists: ("weapons" | "equipment" | "items" | "arts" | "spells" | "abilities")[],
) {
  if (!route) return [];
  const key = name.toLowerCase().replace(/\s*\+\d$/, "");
  return routeUnits(route).filter((u) =>
    u.stages.some((ps) =>
      lists.some((l) =>
        ((ps.stage[l] ?? []) as { item?: string; name?: string }[]).some((x) =>
          (x.item ?? x.name ?? "").toLowerCase().replace(/\s*\+\d$/, "") === key
        )
      )
    )
  ).map((u) => u.name);
}

function UnitCard({ name, scope }: { name: string; scope: Scope }) {
  const t = useTrack();
  const c = char(name);
  if (!c) return null;
  const route = scope.route;
  const unit = route ? unitPlan(route, name) : undefined;
  const ch = scope.chapter ?? unit?.join ?? 1;
  const ps = unit ? activeStage(unit, Math.max(ch, unit.join)) : undefined;
  const next = unit && ps ? unit.stages[unit.stages.indexOf(ps) + 1] : undefined;
  const gate = route ? c.recruitOn?.[route] : undefined;
  const dep = route ? deployStatus(name, route) : undefined;
  const recruited = Boolean(route && t.done[ids.recruit(route, name)]);
  const link = route && unit
    ? href(routeSlug(route), c.slug)
    : c.homeRoute
    ? href(routeSlug(c.homeRoute), c.slug)
    : href("reserve", c.slug);
  return (
    <div style={routeVars(c.homeRoute)}>
      <div className="flex items-start gap-3">
        <Medal name={name} route={c.homeRoute} size={52} ring="var(--color-card)" />
        <div className="min-w-0 flex-1">
          <Kicker>
            {unit?.lord ? "Lord" : dep?.status ?? (unit?.extra ? "Second copy" : unit ? "Army" : "Not in this army")}
            {unit && !unit.lord && ` · joins ${unit.estimate ? "~" : ""}Ch ${unit.join}`}
          </Kicker>
          <Title>{name}</Title>
          {(c.guide?.role ?? c.build?.role) && (
            <div className="text-[13px] text-muted">{c.guide?.role ?? c.build?.role}</div>
          )}
        </div>
      </div>
      {ps && (
        <Row k={`Ch ${ch}`}>
          <b>
            <RefName name={ps.cls} types={["class"]} />
          </b>
          {ps.stage.exit && <span className="block text-[12.5px] text-muted">Leave when: {ps.stage.exit}</span>}
        </Row>
      )}
      {next && (
        <Row k="Next">
          <b>
            <RefName name={next.cls} types={["class"]} />
          </b>{" "}
          {next.start
            ? <span className="text-muted">· Ch {next.start}</span>
            : <span className="text-muted">· {next.stage.when}</span>}
        </Row>
      )}
      <GiftTaste name={name} ch={ch} route={route} />
      {gate && gate.how === "recruit" && unit && !unit.lord && (
        <Row k="Recruit">
          <span className="flex flex-wrap items-center gap-1.5">
            {gate.support !== undefined && gate.support > 1 && <Stat k="Support" v={gate.support} />}
            {gate.renown !== undefined && <Stat k="Renown" v={gate.renown} />}
            {gate.gold !== undefined && <Stat k="Gold" v={gate.gold.toLocaleString("en-US")} />}
            {gate.item && <Stat k="Item" v={<RefName name={gate.item} types={["item", "gift"]} />} />}
          </span>
          {gate.task && <span className="mt-1 block text-[12.5px] text-muted">{gate.task}</span>}
          <span className="mt-1.5 flex items-center gap-1.5 text-[13px]">
            <Tick id={ids.recruit(route!, name)} label={`${name} recruited`} />
            <span className={recruited ? "font-semibold" : "text-muted"}>Recruited</span>
          </span>
        </Row>
      )}
      <a href={link} className="mt-3 inline-flex items-center gap-1 font-semibold text-(--c) hover:underline">
        Full build <ArrowRight className="size-4" />
      </a>
    </div>
  );
}

/** A unit's taste: liked categories and the best gifts to buy now (linked). */
function GiftTaste({ name, ch, route }: { name: string; ch: number; route: RouteName | null }) {
  const p = giftProfile(name);
  const picks = giftPicks(name, Math.max(ch, 4), route);
  const buy = [...picks.dagsion, ...picks.road].slice(0, 3);
  if (!p && !buy.length) return null;
  return (
    <Row k="Gifts">
      {buy.length > 0 && (
        <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          {buy.map((b) => <GiftName key={b.name} name={b.name} tier={b.tier} />)}
        </span>
      )}
      {p?.categories?.length
        ? <span className="block text-[12.5px] text-muted">Likes {p.categories.join(", ")}</span>
        : null}
    </Row>
  );
}

function ItemCard({ name, scope }: { name: string; scope: Scope }) {
  const it = itemRef(name);
  if (!it) return <Title>{name}</Title>;
  const who = users(scope.route, name, ["weapons", "equipment", "items"]);
  return (
    <div>
      <Kicker>{[it.kind, it.type, it.rank && `Rank ${it.rank}`].filter(Boolean).join(" · ")}</Kicker>
      <Title>{name}</Title>
      <div className="mt-2 flex flex-wrap gap-1">
        <Stat k="Mt" v={it.mt} />
        <Stat k="Hit" v={it.hit} />
        <Stat k="Crit" v={it.crit} />
        <Stat k="Wt" v={it.wt} />
        <Stat k="Rng" v={it.rng} />
        <Stat k="Uses" v={it.uses} />
        <Stat k="Price" v={it.price ? `${it.price.toLocaleString("en-US")}G` : undefined} />
      </div>
      {it.fx && <p className="mt-2 mb-0 text-[13.5px]">{it.fx}</p>}
      {it.eff && <Row k="Effective">{it.eff.join(", ")}</Row>}
      {it.src?.length
        ? (
          <Row k="Where">
            <Rich text={sourcesLine(name, { route: scope.route, max: 4 })} k="iw" />
          </Row>
        )
        : null}
      {who.length > 0 && (
        <Row k="Used by">
          <Names names={who} />
        </Row>
      )}
    </div>
  );
}

/** Fans of a gift: this army's units with portraits, everyone else as a count. */
function Fans({ names, route }: { names: string[]; route: RouteName | null }) {
  const army = route ? new Set(routeUnits(route).map((u) => u.name)) : null;
  const mine = army ? names.filter((n) => army.has(n)) : names;
  const rest = names.length - mine.length;
  return (
    <span>
      {mine.length > 0 && <Names names={mine} />}
      {rest > 0 && <span className="text-[12.5px] text-muted">{mine.length ? " + " : ""}{rest} outside this army</span>}
    </span>
  );
}

function GiftCard({ name, scope }: { name: string; scope: Scope }) {
  const g = gift(name);
  if (!g) return <Title>{name}</Title>;
  const stalls = (g.sold ?? []).filter((s) => giftShop(s.shop)?.dagsion);
  const road = roadShops(name);
  const ok = (n: string) => !dislikes(n, name);
  const loved = (g.loved ?? []).filter(ok);
  const really = [...(g.really ?? []), ...(g.lovedQ ?? [])].filter(ok);
  const skip = Object.keys(CHARACTERS).filter((n) => dislikes(n, name));
  return (
    <div>
      <Kicker>{["Gift", g.rarity, g.likes && `for ${g.likes}`].filter(Boolean).join(" · ")}</Kicker>
      <Title>{name}</Title>
      <div className="mt-2 flex flex-wrap gap-1">
        <Stat k="Price" v={g.price ? `${g.price.toLocaleString("en-US")}G` : undefined} />
      </div>
      {stalls.length > 0 && (
        <Row k="Dagsion">
          {stalls.map((s) => (
            <span key={s.shop} className="mr-2 inline-block">
              <b>
                <RefName name="Dagsion" types={["place"]} label={stallLabel(s.shop)} />
              </b>
              {s.from && <span className="text-muted">from Ch {s.from}</span>}
              {s.conf === "unconfirmed" && <span className="text-muted" title={s.note}>?</span>}
            </span>
          ))}
        </Row>
      )}
      {road.length > 0 && (
        <Row k="Elsewhere">
          {road.map((r, i) => (
            <span key={r}>
              {i > 0 && ", "}
              <RefName name={r} types={["place"]} />
              {placeNote(r) && <span className="text-[12.5px] text-muted">({placeNote(r).note})</span>}
            </span>
          ))}
        </Row>
      )}
      {g.other && <Row k="Also">{g.other}</Row>}
      {loved.length
        ? (
          <Row k="Loved by">
            <Fans names={loved} route={scope.route} />
          </Row>
        )
        : null}
      {really.length
        ? (
          <Row k="Really liked">
            <Fans names={really} route={scope.route} />
          </Row>
        )
        : null}
      {skip.length > 0 && (
        <Row k="Disliked by">
          <Names names={skip} />
        </Row>
      )}
    </div>
  );
}

function ClassCard({ name, scope }: { name: string; scope: Scope }) {
  const c = classRef(name);
  if (!c) return <Title>{name}</Title>;
  const takers = scope.route
    ? routeUnits(scope.route).filter((u) => u.stages.some((s) => s.cls === name)).map((u) => {
      const s = u.stages.find((x) => x.cls === name)!;
      return { n: u.name, when: s.start ? `Ch ${s.start}` : s.stage.when };
    })
    : [];
  const growth = Object.entries(c.growth ?? {});
  return (
    <div>
      <Kicker>{[c.tier, c.part && `Part ${c.part}`, c.move].filter(Boolean).join(" · ")}</Kicker>
      <Title>{name}</Title>
      <div className="mt-2 flex flex-wrap gap-1">
        <Stat k="Renown" v={c.renown} />
        <Stat k="Lv" v={c.level} />
        <Stat k="Mov" v={c.mov} />
      </div>
      {c.ranks?.length ? <Row k="Exam">{c.ranks.join(", ")}</Row> : null}
      {c.weapons?.length ? <Row k="Weapons">{c.weapons.join(", ")}</Row> : null}
      {growth.length > 0 && (
        <Row k="Growth">
          <span className="flex flex-wrap gap-1">
            {growth.map(([s, v]) => (
              <span key={s} className={cx("text-[12.5px] tabular-nums", v > 0 ? "text-teal-3" : "text-blood")}>
                {s} {v > 0 ? "+" : ""}
                {v}
              </span>
            ))}
          </span>
        </Row>
      )}
      {c.mastery && (
        <Row k="Mastery">
          <Rich text={c.mastery} k="cm" />
        </Row>
      )}
      {c.unlock && (
        <Row k="Unlock">
          <Rich text={c.unlock} k="cu" />
        </Row>
      )}
      {takers.length > 0 && (
        <Row k="This army">
          {takers.map((t) => (
            <span key={t.n} className="mr-2 inline-block font-semibold">
              <UnitRef name={t.n} /> <span className="font-normal text-muted">{t.when}</span>
            </span>
          ))}
        </Row>
      )}
    </div>
  );
}

function ArtCard({ name, scope }: { name: string; scope: Scope }) {
  const a = artRef(name);
  const ab = a ? undefined : abilityRef(name);
  const who = users(scope.route, name, ["arts", "abilities", "spells"]);
  if (ab) {
    return (
      <div>
        <Kicker>Ability{ab.source ? ` · ${ab.source}` : ""}{ab.from ? ` · ${ab.from}` : ""}</Kicker>
        <Title>{name}</Title>
        {ab.fx && <p className="mt-2 mb-0">{ab.fx}</p>}
        {who.length > 0 && (
          <Row k="Used by">
            <Names names={who} />
          </Row>
        )}
      </div>
    );
  }
  return (
    <div>
      <Kicker>Combat art{a?.weapon ? ` · ${a.weapon}` : ""}</Kicker>
      <Title>{name}</Title>
      {a && (
        <div className="mt-2 flex flex-wrap gap-1">
          <Stat k="Mt" v={a.mt ? `+${a.mt}` : undefined} />
          <Stat k="Hit" v={a.hit ? `+${a.hit}` : undefined} />
          <Stat k="Crit" v={a.crit ? `+${a.crit}` : undefined} />
          <Stat k="Avo" v={a.avo ? `+${a.avo}` : undefined} />
          <Stat k="Rng" v={a.rng} />
          <Stat k="Dur" v={a.dur} />
        </div>
      )}
      {a?.fx && <p className="mt-2 mb-0">{a.fx}</p>}
      {who.length > 0 && (
        <Row k="Used by">
          <Names names={who} />
        </Row>
      )}
    </div>
  );
}

/** A reward line ("Sunstone ×2"): the name links, the count stays text. */
function RewardName({ text }: { text: string }) {
  const m = /^(.*?)(\s*[×x]\s*\d+)?$/.exec(text)!;
  return (
    <>
      <RefName name={m[1]} types={["item", "gift", "gather"]} />
      {m[2] ?? ""}
    </>
  );
}

function QuestCard({ id, scope }: { id: string; scope: Scope }) {
  const q = QUESTS[id];
  if (!q) return null;
  const r = scope.route ? q.routes[scope.route] : undefined;
  const rw = q.reward;
  const done = scope.route && isDone(ids.quest(scope.route, id));
  return (
    <div>
      <Kicker>{q.kind.replace("-", " ")}{r ? ` · Ch ${r.ch}` : ""}{done ? " · done" : ""}</Kicker>
      <Title>{q.name}</Title>
      <p className="mt-1 mb-0">{q.task}</p>
      {q.giver && (
        <Row k="Giver">
          <Rich text={q.giver} k="qg" />
        </Row>
      )}
      {q.where && (
        <Row k="Where">
          <Rich text={q.where} k="qw" />
        </Row>
      )}
      {r?.window && <Row k="Window">{r.window.from} to {r.window.to}</Row>}
      {r?.due && (
        <Row k="Due">
          <b className="text-blood">{r.due}</b>
        </Row>
      )}
      {r?.fight && <Row k="Fight">{r.fight}</Row>}
      {rw && (
        <Row k="Reward">
          {[
            rw.gold ? `${rw.gold.toLocaleString("en-US")}G` : null,
            rw.renown ? `${rw.renown} Renown` : null,
            ...(rw.items ?? []).map((x) => <RewardName key={x} text={x} />),
            ...(rw.unlocks ?? []).map((u) => (
              <span key={u}>
                unlocks <RefName name={u} types={["class", "place", "quest"]} />
              </span>
            )),
          ].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " · "}{x}</span>)}
        </Row>
      )}
    </div>
  );
}

/** Names from data, each as its chip when it resolves to one of `types`. */
const List = ({ names, types, sep = ", " }: { names: string[]; types: RefType[]; sep?: string }) => (
  <>
    {names.map((n, i) => (
      <span key={n}>
        {i > 0 && sep}
        <RefName name={n} types={types} />
      </span>
    ))}
  </>
);

function PlaceCard({ name }: { name: string }) {
  const n = NODE_BY_NAME.get(foldName(name));
  if (!n) return <Title>{name}</Title>;
  return (
    <div>
      <Kicker>{[n.kind, n.region].filter(Boolean).join(" · ")}</Kicker>
      <Title>{n.name}</Title>
      {n.unlock && (
        <Row k="Opens">
          <Rich text={n.unlock} k="pu" />
        </Row>
      )}
      {n.items?.length
        ? (
          <Row k="Gather">
            <List names={n.items.map((k) => WORLD.items[k]?.name ?? k)} types={["gather"]} />
          </Row>
        )
        : null}
      <PlaceLoot name={n.name} cap={8} />
    </div>
  );
}

function GatherCard({ name }: { name: string }) {
  const it = Object.values(WORLD.items).find((x) => foldName(x.name) === foldName(name));
  if (!it) return <Title>{name}</Title>;
  return (
    <div>
      <Kicker>Gathering · {it.kind}</Kicker>
      <Title>{it.name}</Title>
      {it.places.length > 0 && (
        <Row k="Found at">
          <List names={it.places.slice(0, 6).map((p) => NODE[p]?.name ?? p)} types={["place"]} />
        </Row>
      )}
      {it.neededBy.length > 0 && (
        <Row k="For">
          <List names={it.neededBy.slice(0, 4)} types={["unit"]} sep=" · " />
        </Row>
      )}
    </div>
  );
}

function MountCard({ name }: { name: string }) {
  const b = BREED_BY_NAME.get(name.toLowerCase());
  if (!b) return <Title>{name}</Title>;
  return (
    <div>
      <Kicker>{b.family}{b.rare ? " · rare" : ""} · {b.part}</Kicker>
      <Title>{b.name}</Title>
      <Row k="Bait">{b.taste} {b.food}</Row>
      {b.bonus.length > 0 && (
        <Row k="Bond 5">{b.bonus.map((x) => `${x.stat} +${x.flat} (+${x.growth}%)`).join(", ")}</Row>
      )}
      {b.abilities.length > 0 && (
        <Row k="Abilities">
          <List names={b.abilities} types={["ability", "art"]} />
        </Row>
      )}
      {b.spawns.length > 0 && (
        <Row k="Where">
          <List names={[...new Set(b.spawns.map((s) => s.place))]} types={["place"]} />
        </Row>
      )}
    </div>
  );
}

const STAT_GROUP: Record<string, string> = {
  base: "Unit stat",
  derived: "Combat value",
  weapon: "Weapon value",
  skill: "Skill rank",
};

/** One glossary entry: what the stat is, why it matters, the formula when known. `?` marks unconfirmed parts. */
function StatEntry({ abbr, delta, compact }: { abbr: string; delta?: string; compact?: boolean }) {
  const s = statRef(abbr);
  if (!s) return <Title>{abbr}</Title>;
  const down = delta?.startsWith("\u2212");
  return (
    <div>
      {!compact && <Kicker>{[STAT_GROUP[s.group ?? ""] ?? "Stat", "glossary"].join(" · ")}</Kicker>}
      <div className="flex items-baseline gap-2 pr-6">
        <span className="font-display text-[19px] leading-tight font-bold">{s.name}</span>
        <span className="text-[13px] font-semibold text-muted">{abbr}</span>
        {delta && (
          <span
            className={cx(
              "ml-auto rounded px-1.5 text-[13px] font-bold tabular-nums",
              down ? "bg-warn text-blood" : "bg-paper-2 text-teal-3",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {s.what && <p className="mt-1 mb-0 text-[13.5px]">{s.what}</p>}
      {s.matters && (
        <div className="mt-2 rounded-md border-l-[3px] border-gold bg-paper-2 px-2.5 py-1.5 text-[13.5px]">
          <span className="label mr-1.5 text-[10.5px] text-gold-lo">Why it matters</span>
          {s.matters}
        </div>
      )}
      {s.formula && (
        <Row k="Formula">
          <span className="tabular-nums">{s.formula}</span>
        </Row>
      )}
      {!compact && s.src?.length
        ? (
          <Row k="Source">
            <span className="text-muted">{s.src.join(" · ")}</span>
          </Row>
        )
        : null}
    </div>
  );
}

/** Stat card. `name` may be a compound from a delta ("Str/Mag"): each stat gets its own entry. */
function StatCard({ name, delta }: { name: string; delta?: string }) {
  const parts = name.split("/");
  if (parts.length === 1) return <StatEntry abbr={name} delta={delta} />;
  const src = [...new Set(parts.flatMap((p) => statRef(p)?.src ?? []))];
  return (
    <div>
      <Kicker>Stat glossary</Kicker>
      <div className="flex flex-col gap-3 divide-y divide-paper-3">
        {parts.map((p, i) => (
          <div key={p} className={i ? "pt-3" : undefined}>
            <StatEntry abbr={p} delta={delta} compact />
          </div>
        ))}
      </div>
      {src.length > 0 && (
        <Row k="Source">
          <span className="text-muted">{src.join(" · ")}</span>
        </Row>
      )}
    </div>
  );
}

/** Battalion: tier and Authority gate, carrier stat bonuses, gambit, recruit towns, carriers on this route. */
function BattalionCard({ name, scope }: { name: string; scope: Scope }) {
  const b = battalionRef(name);
  if (!b) return <Title>{name}</Title>;
  const g = b.gambit;
  const key = name.toLowerCase();
  const carriers = scope.route
    ? routeUnits(scope.route).filter((u) => u.stages.some((ps) => ps.stage.battalion?.name.toLowerCase() === key)).map((
      u,
    ) => u.name)
    : [];
  return (
    <div>
      <Kicker>Battalion · tier {b.tier}{b.auth ? ` · Authority ${b.auth}` : ""}{b.kind ? ` · ${b.kind}` : ""}</Kicker>
      <Title>{name}</Title>
      {Object.keys(b.stats).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {Object.entries(b.stats).map(([k, v]) => <Stat key={k} k={k} v={`+${v}`} />)}
        </div>
      )}
      {g?.name && (
        <Row k="Gambit">
          <b>{g.name}</b>
          {g.kind && <span className="text-muted">· {g.kind}</span>}
          {(g.mt != null || g.hit != null || g.rng || g.uses != null) && (
            <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
              <Stat k="Mt" v={g.mt} />
              <Stat k="Hit" v={g.hit} />
              <Stat k="Rng" v={g.rng} />
              <Stat k="Uses" v={g.uses} />
            </span>
          )}
          {g.fx && <div className="text-[13px]">{g.fx}</div>}
          {g.area && <div className="text-[12.5px] text-muted">Area: {g.area}</div>}
        </Row>
      )}
      {b.towns.length > 0 && (
        <Row k="Recruit">
          <List names={b.towns.slice(0, 6)} types={["place"]} />
          {b.towns.length > 6 && <span className="text-muted">+{b.towns.length - 6}</span>}
        </Row>
      )}
      {carriers.length > 0 && (
        <Row k="Carried by">
          <Names names={carriers} />
        </Row>
      )}
      <div className="mt-2 text-[12px] text-muted">
        Infantry only; the carrier's Authority must reach the tier. Cha raises gambit power.
      </div>
    </div>
  );
}

/** Card for a stat delta badge ("Prt +10"); a stat ref without a delta goes through `renderCard`. */
export function renderStatCard(name: string, delta?: string): ReactNode {
  return <StatCard name={name} delta={delta} />;
}

export function renderCard(type: RefType, name: string, scope: Scope): ReactNode {
  switch (type) {
    case "unit":
      return <UnitCard name={name} scope={scope} />;
    case "item":
      return <ItemCard name={name} scope={scope} />;
    case "class":
      return <ClassCard name={name} scope={scope} />;
    case "art":
    case "ability":
      return <ArtCard name={name} scope={scope} />;
    case "quest":
      return <QuestCard id={name} scope={scope} />;
    case "place":
      return <PlaceCard name={name} />;
    case "gather":
      return <GatherCard name={name} />;
    case "mount":
      return <MountCard name={name} />;
    case "stat":
      return <StatCard name={name} />;
    case "gift":
      return <GiftCard name={name} scope={scope} />;
    case "battalion":
      return <BattalionCard name={name} scope={scope} />;
  }
}
