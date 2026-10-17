import { routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { loadPartPlace, loadPlace, notePart, nowChapter, nowIn, useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { PART_LONG, type PartNo } from "../../lib/parts.ts";

/*
 * Part switch (D-122): the top of every walkthrough rail. Part I · War · Salvation, each with its own URL and reading
 * place; the link lands on the chapter you last read in that Part, else the one you're playing.
 */

const LABEL: Record<PartNo, string> = { 1: "Part I", 2: "War", 3: "Salvation" };
const ROMAN: Record<PartNo, string> = { 1: "I", 2: "II", 3: "III" };

/**
 * Where a Part opens on a route: the chapter or Section you last read there, else the one you're playing. Part I
 * always names its chapter, so the link never falls back to the bare route (which opens the remembered Part).
 */
export function partHref(route: RouteName, p: PartNo): string {
  const slug = routeSlug(route);
  if (p === 1) return href(slug, "ch", String(loadPlace(route)?.ch ?? nowChapter(route)));
  const key = p === 2 ? "war" : "salvation";
  const n = loadPartPlace(route, key)?.ch ?? nowIn(route, key);
  return href(slug, key, p === 2 ? "ch" : "s", String(n));
}

export function PartSwitch({ route, part, compact }: { route: RouteName; part: PartNo; compact?: boolean }) {
  useTrack();
  return (
    <nav
      aria-label="Part"
      className={cx(
        "m-1.5 mb-0 grid gap-0.5 rounded-lg bg-black/25 p-0.5 ring-1 ring-white/10",
        compact ? "grid-cols-1" : "grid-cols-3",
      )}
    >
      {([1, 2, 3] as PartNo[]).map((p) => (
        <a
          key={p}
          href={partHref(route, p)}
          onClick={() => notePart(p)}
          aria-current={p === part ? "page" : undefined}
          title={PART_LONG[p]}
          className={cx(
            "flex flex-col items-center rounded-md py-1 leading-none transition-colors",
            p === part
              ? "bg-gold-hi text-teal shadow-[0_2px_8px_-3px_rgba(0,0,0,.5)]"
              : "text-parchment/70 hover:bg-white/10 hover:text-white",
          )}
        >
          <span className="font-logo text-[13px] font-bold">{ROMAN[p]}</span>
          {!compact && <span className="mt-0.5 text-[10.5px] font-semibold tracking-[0.04em]">{LABEL[p]}</span>}
        </a>
      ))}
    </nav>
  );
}
