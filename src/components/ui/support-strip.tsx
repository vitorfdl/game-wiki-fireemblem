import { charHref, routeSlug, supportLinks } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import type { Character, RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Medal } from "./medal.tsx";

type Props = {
  character: Character;
  /** Army the page is about; null lists every partner as a tile. */
  army: RouteName | null;
  /** What to show under a partner's name (their class at the chapter you are playing). */
  sub?: (name: string) => string | undefined;
};

/**
 * Support partners for the build page: partners in this army as framed-portrait tiles that open their build, with
 * the rank cap when known; partners outside the army as a muted line of links.
 */
export function SupportList({ character, army, sub }: Props) {
  const links = supportLinks(character, army);
  if (!links.length) return <p className="m-0 text-[13.5px] text-muted">No support partners listed.</p>;
  const tiles = army ? links.filter((l) => l.sameArmy) : links;
  const rest = army ? links.filter((l) => !l.sameArmy) : [];
  return (
    <div className="grid gap-3">
      {tiles.length > 0
        ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5 p-0">
            {tiles.map((l) => {
              const to = l.character ? (army ? href(routeSlug(army), l.character.slug) : charHref(l.character)) : undefined;
              const line = sub?.(l.name);
              const body = (
                <>
                  <Medal name={l.name} route={l.character?.homeRoute} size={34} ring="var(--color-card)" />
                  <span className="min-w-0 leading-tight">
                    <b className="block truncate text-[14px]">{l.name}</b>
                    {line && <span className="block truncate text-[12px] text-muted">{line}</span>}
                  </span>
                  {l.rank && (
                    <span
                      title={`Support rank cap ${l.rank}`}
                      className="ml-auto rounded-[3px] bg-teal px-1.5 py-[2px] font-logo text-[11px] leading-none font-bold text-gold-hi"
                    >
                      {l.rank}
                    </span>
                  )}
                </>
              );
              const cls = "group flex min-w-0 items-center gap-2 rounded-md bg-paper/70 py-1.5 pr-2 pl-1.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]";
              return (
                <li key={l.name} className="min-w-0">
                  {to
                    ? (
                      <a href={to} className={cx(cls, "transition hover:-translate-y-px hover:bg-card hover:shadow-[inset_0_0_0_1.5px_var(--c),0_6px_14px_-10px_rgba(16,38,42,.5)]")}>
                        {body}
                      </a>
                    )
                    : <span className={cls}>{body}</span>}
                </li>
              );
            })}
          </ul>
        )
        : army && <p className="m-0 text-[13.5px] text-ink-soft">No support partner in {army}'s army.</p>}
      {rest.length > 0 && (
        <p className="m-0 text-[12.5px] leading-relaxed text-muted">
          <span className="mr-1 font-semibold tracking-[0.06em] uppercase text-[11px] text-faint">Other armies</span>
          {rest.map((l, i) => (
            <span key={l.name}>
              {i > 0 && ", "}
              {l.character
                ? <a href={charHref(l.character)} className="hover:text-ink hover:underline">{l.name}</a>
                : l.name}
              {l.rank && <span className="text-faint"> ({l.rank})</span>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
