import { useEffect } from "react";
import { currentPart, notePart, nowIn } from "./lib/track.ts";
import { PART_HOME } from "./lib/parts.ts";
import { p3BuildHref, p3RosterList } from "./lib/part-army.ts";
import { partHref } from "./components/parts/part-switch.tsx";
import { char, characterBySlug, META, routeFromSlug, routeLineup, routeSlug } from "./lib/data.ts";
import { backLinkFor, href, navigate, useDossierOrigin, useHashLocation } from "./lib/router.ts";
import { HomePage } from "./components/home/home-page.tsx";
import { LaterPage } from "./components/home/later-page.tsx";
import { ArmyPage } from "./components/army/army-page.tsx";
import { DossierPage } from "./components/dossier/dossier-page.tsx";
import { WalkthroughPage } from "./components/walkthrough/walkthrough-page.tsx";
import { PartPage } from "./components/parts/part-page.tsx";
import { HoverLayer } from "./components/ui/hover.tsx";
import { StatLogPage } from "./components/stats/stat-log-page.tsx";

/**
 * Hash routes: #/ · #/later · #/<route>[/ch/<n>] (walkthrough) · #/<route>/army · #/<route>/<unit>[/tab]
 * · #/<route>/stats (stat log, D-133) · #/reserve/<unit>[/recruitment|/profile] (old /copy and /build tabs redirect inside the build page)
 */
export function App() {
  return (
    <>
      <Page />
      <HoverLayer />
    </>
  );
}

/** Scroll position per page (session only). */
const scrollMemory = new Map<string, number>();

function Page() {
  const { parts } = useHashLocation();
  const [a, b, c] = parts;
  const route = routeFromSlug(a);
  const unit = characterBySlug(b);
  const inDossier = Boolean(unit && (route || a === "reserve"));
  const army = Boolean(route && b === "army");
  const origin = useDossierOrigin(inDossier);
  const back = origin ? backLinkFor(origin) : route ? backLinkFor(href(routeSlug(route))) : backLinkFor(href("later"));

  // Army, build and home pages come back where you left them (D-91). The walkthrough restores its own position.
  const key = parts.slice(0, inDossier ? 2 : 2).join("/");
  const later = route && (b === "war" || b === "salvation") ? b : null;
  const stats = Boolean(route && b === "stats");
  const walk = Boolean(route && !army && !inDossier && !stats);
  // The Part is a remembered choice: a bare walkthrough or Army URL opens the Part last viewed (War or Salvation),
  // explicit URLs (`/ch/N`, `/war`, `/salvation`, `/army/war`) open what they name and become the remembered Part.
  const remembered = currentPart();
  const bare = Boolean(route && !inDossier && (!b || (army && !c)) && remembered !== 1);
  const redirect = bare && route
    ? army ? href(routeSlug(route), "army", remembered === 2 ? "war" : "salvation") : partHref(route, remembered)
    : null;
  if (!redirect && route && !inDossier && !stats) {
    notePart(
      later === "war" || (army && c === "war") ? 2 : later === "salvation" || (army && c === "salvation") ? 3 : 1,
    );
  }
  useEffect(() => {
    if (redirect) navigate(redirect, true);
  }, [redirect]);
  useEffect(() => {
    if (walk) return;
    const y = scrollMemory.get(key) ?? 0;
    // Twice: once now, once after the page's lazy parts (fonts, images) settle.
    globalThis.scrollTo({ top: y, behavior: "instant" });
    const id = setTimeout(() => globalThis.scrollTo({ top: y, behavior: "instant" }), 120);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scrollMemory.set(key, globalThis.scrollY);
      });
    };
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(frame);
      globalThis.removeEventListener("scroll", onScroll);
    };
  }, [key, walk]);

  // Tab title: "FE: Fortune's Weave - <page>".
  useEffect(() => {
    const page = inDossier && unit
      ? `${unit.name}${route ? ` (${route})` : ""}`
      : army && route
      ? `${route} Army${c === "war" ? " · War" : c === "salvation" ? " · Salvation" : ""}`
      : route && later
      ? `${route} · ${
        later === "war"
          ? `War${c === "ch" && parts[3] ? ` Ch ${parts[3]}` : ""}`
          : `Salvation${c === "s" && parts[3] ? ` · Section ${parts[3]}` : ""}`
      }`
      : route
      ? `${route} Walkthrough${b === "ch" && c ? ` · Ch ${c}` : ""}`
      : a === "later"
      ? "Later joiners"
      : "All lords";
    document.title = `FE: Fortune's Weave - ${page}`;
  }, [a, b, c, route, unit, inDossier, army, later, parts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The stat log is typed into all the time: no page hotkeys there (D-133).
      if ((e.target as HTMLElement | null)?.closest("input,textarea,select,[data-no-hotkeys]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (inDossier) navigate(back.to);
        else if (army && route) navigate(href(routeSlug(route)));
      } else if (inDossier && unit && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        // Part III: step through the whole Army of Salvation, each unit's picked copy (D-145).
        if (currentPart() === 3) {
          const list = p3RosterList(nowIn(PART_HOME, "salvation"));
          const i = list.indexOf(unit.name);
          if (i < 0) return;
          const next = list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
          navigate(p3BuildHref(next, c && /^(recruit|recruitment|profile)$/.test(c) ? c : undefined), true);
          return;
        }
        const list = route ? routeLineup(route) : META.later;
        const i = list.indexOf(unit.name);
        if (i < 0) return;
        const next = char(list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]);
        // Only the page sections carry over; a build variant (old "/copy") belongs to one unit.
        const section = c && /^(recruit|recruitment|profile)$/.test(c) ? c : undefined;
        navigate(href(route ? routeSlug(route) : "reserve", next?.slug, section), true);
      } else if (!inDossier && /^[1-4]$/.test(e.key)) {
        navigate(href(routeSlug(META.order[Number(e.key) - 1])));
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [inDossier, army, route, unit, c, back.to]);

  if (redirect) return null;
  if (inDossier && unit) {
    return <DossierPage key={`${a}/${unit.slug}`} character={unit} context={route ?? null} tab={c} back={back} />;
  }
  if (route && army) {
    return <ArmyPage key={`${route}/${c ?? ""}`} r={route} part={c === "war" || c === "salvation" ? c : null} />;
  }
  if (route && stats) return <StatLogPage key={route} route={route} />;
  if (route && later) {
    const n = Number(parts[3]);
    return <PartPage key={`${route}/${later}`} route={route} part={later} initial={n >= 1 && n <= 6 ? n : undefined} />;
  }
  if (route) {
    const ch = b === "ch" ? Number(c) : undefined;
    return <WalkthroughPage key={route} route={route} initialChapter={ch && ch >= 1 && ch <= 12 ? ch : undefined} />;
  }
  if (a === "later") return <LaterPage />;
  return <HomePage />;
}
