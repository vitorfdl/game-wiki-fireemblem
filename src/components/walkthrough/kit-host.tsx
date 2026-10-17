import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { routeSlug } from "../../lib/data.ts";
import { href, navigate } from "../../lib/router.ts";
import { nowChapter, nowIn } from "../../lib/track.ts";
import { PART_HOME, pos } from "../../lib/parts.ts";
import type { RouteName } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { type KitTab, type WalkContext, WalkCtx } from "./ctx.ts";
import { Dock, FieldKit, kitTabs, PANEL_MR, PANEL_W, partTabs } from "./kit.tsx";
import type { MapFocus } from "./world-map.tsx";
import type { UnitFocus } from "../units/units-tab.tsx";

/**
 * The Field Kit outside the walkthrough (Army and build pages, D-85): dock, keys, side panel, and a WalkCtx so place
 * and item chips open the map. Unit links still go to the build page (`unitsOpenPage`).
 */
export function KitHost(
  { route, part = 1, children }: { route: RouteName | null; part?: 1 | 2 | 3; children: ReactNode },
) {
  return route ? <Host route={route} part={part}>{children}</Host> : <>{children}</>;
}

function Host({ route, part, children }: { route: RouteName; part: 1 | 2 | 3; children: ReactNode }) {
  // Part II and III army pages get that Part's tabs (D-125); the Part tabs follow the War chapter or Section you're
  // playing (Part III is played on Theodora's page, so her marker counts on every route).
  const only = part === 1 ? undefined : partTabs(part);
  const [partN, setPartN] = useState(() =>
    part === 1 ? 1 : part === 2 ? nowIn(route, "war") : nowIn(PART_HOME, "salvation")
  );
  const [kit, setKit] = useState<KitTab | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [mountFocus, setMountFocus] = useState<{ slug: string; nonce: number } | null>(null);
  const [unitFocus, setUnitFocus] = useState<UnitFocus | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.key === "Escape" && kit) {
        e.stopPropagation();
        setKit(null);
        return;
      }
      const tab = kitTabs(route, only).find((t) => t.key.toLowerCase() === e.key.toLowerCase());
      if (tab) setKit((k) => (k === tab.id ? null : tab.id));
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [route, kit, only]);

  const openMap = useCallback((f: { place?: string; item?: string }) => {
    setMapFocus({ ...f, nonce: Date.now() });
    setKit("map");
  }, []);
  const openMount = useCallback((slug: string) => {
    setMountFocus({ slug, nonce: Date.now() });
    setKit("mounts");
  }, []);
  const focusUnit = useCallback((name: string) => {
    setUnitFocus({ name, nonce: Date.now() });
    setKit("units");
  }, []);
  const ctx: WalkContext = useMemo(
    () => ({ route, part, focusUnit, openKit: setKit, openMap, openMount, unitsOpenPage: true }),
    [route, part, focusUnit, openMap, openMount],
  );

  return (
    <WalkCtx.Provider value={ctx}>
      {/* Closed, the dock sits on the right edge: the page always keeps room for it (wide build pages reach the edge). */}
      <div className={cx("transition-[margin] duration-300", kit ? PANEL_MR : "lg:pr-[76px]")}>{children}</div>
      <Dock route={route} open={kit} onOpen={setKit} only={only} />
      {kit && (
        <div
          className={cx(
            "animate-rise fixed inset-x-0 bottom-0 z-50 h-[85vh] overflow-hidden rounded-t-xl lg:inset-x-auto lg:top-[60px] lg:right-0 lg:h-auto lg:rounded-none",
            PANEL_W,
          )}
        >
          <FieldKit
            route={route}
            tab={kit}
            chapter={part === 1 ? nowChapter(route) : pos(part, partN)}
            part={part}
            partN={partN}
            only={only}
            mapFocus={mapFocus}
            mountFocus={mountFocus}
            unitFocus={unitFocus}
            onChapter={(ch) => navigate(href(routeSlug(route), "ch", String(ch)))}
            setTab={setKit}
            setChapter={setPartN}
            onClose={() => setKit(null)}
          />
        </div>
      )}
    </WalkCtx.Provider>
  );
}
