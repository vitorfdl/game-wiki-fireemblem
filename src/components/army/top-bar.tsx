import type { ReactNode } from "react";
import { BookOpen, ChartNoAxesColumn, ChevronLeft, Users } from "lucide-react";
import { char, fillers, META, routeLineup, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { Medal } from "../ui/medal.tsx";
import { RunMenu } from "../ui/run-menu.tsx";

type Props = {
  back: { to: string; label: string };
  current?: RouteName | null;
  /** On a route page, which of its two views is showing. */
  view?: "walk" | "army" | "stats";
  /** On a build page: the unit shown, so switching lord keeps you on that unit's build when it exists there. */
  unit?: string;
  /** Part II or III (D-122): Walkthrough and Army links and the lord switch stay in that Part. */
  part?: "war" | "salvation";
  children?: ReactNode;
};

/** Where a lord switch lands (D-56): same view on the other route; a build stays a build when the unit is in that army. */
function switchTo(r: RouteName, view: Props["view"], unit?: string, part?: Props["part"]): string {
  if (part && !unit) return view === "army" ? href(routeSlug(r), "army", part) : href(routeSlug(r), part);
  if (unit) {
    const c = char(unit);
    const there = c && (routeLineup(r).includes(unit) || META.routes[r].extras.includes(unit) ||
      fillers(r).some((f) => f.name === unit));
    return there ? href(routeSlug(r), c!.slug) : href(routeSlug(r), "army");
  }
  if (view === "stats") return href(routeSlug(r), "stats");
  return view === "army" ? href(routeSlug(r), "army") : href(routeSlug(r));
}

/** Sticky dark bar: back link, the route's Walkthrough/Army switch, and the lord switcher. */
export function TopBar({ back, current, view, unit, part, children }: Props) {
  const tab = (to: "walk" | "army" | "stats", label: string, icon: ReactNode) =>
    current && (
      <a
        href={to === "walk"
          ? href(routeSlug(current), part)
          : to === "stats"
          ? href(routeSlug(current), "stats")
          : href(routeSlug(current), "army", part)}
        aria-current={view === to ? "page" : undefined}
        className={cx(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold",
          view === to ? "bg-gold-hi text-ink" : unit && to === "army"
            // On a build page the unit belongs to the Army view: a soft outline, not the active fill (D-90).
            ? "text-[#f1e5c8] ring-1 ring-gold-hi/40 hover:bg-white/10 hover:text-white"
            : "text-[#f1e5c8]/80 hover:bg-white/10 hover:text-white",
        )}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </a>
    );
  return (
    <div className="sticky top-0 z-30 flex min-h-[52px] items-center gap-x-3 gap-y-2 bg-[rgba(16,38,42,.97)] px-3 py-1.5 text-[#f1e5c8] shadow-[0_1px_0_rgba(234,211,156,.4)] backdrop-blur md:px-[3vw] lg:min-h-[60px]">
      <a
        href={back.to}
        title={back.label}
        className="flex items-center gap-1 text-[14px] font-semibold text-gold-hi hover:text-white"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Back</span>
      </a>
      {(view || unit) && current && (
        <nav aria-label="View" className="flex gap-1 rounded-full bg-white/5 p-0.5">
          {tab("walk", "Walkthrough", <BookOpen aria-hidden="true" className="size-4" />)}
          {tab("army", "Army", <Users aria-hidden="true" className="size-4" />)}
          {tab("stats", "Stat log", <ChartNoAxesColumn aria-hidden="true" className="size-4" />)}
        </nav>
      )}
      {children}
      <div className="ml-auto">
        <RunMenu route={current} />
      </div>
      <nav aria-label="Switch lord" className={cx("sm:gap-1", children ? "hidden sm:flex" : "flex")}>
        {META.order.map((r) => (
          <a
            key={r}
            href={switchTo(r, view, unit, part)}
            aria-current={r === current ? "page" : undefined}
            title={r}
            className="relative -ml-2.5 flex items-center gap-2 rounded-full border border-transparent py-0.5 pl-0.5 text-sm opacity-70 first:ml-0 aria-[current=page]:z-[1] sm:ml-0 sm:pr-1 hover:opacity-100 aria-[current=page]:border-gold-hi/60 aria-[current=page]:bg-gold-hi/10 aria-[current=page]:opacity-100 xl:pr-3"
          >
            <Medal flat name={r} route={r} size={30} ring="transparent" />
            <span className="hidden xl:inline">{r}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
