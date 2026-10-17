import { createContext, useContext } from "react";
import type { RouteName } from "../../lib/types.ts";
import { ChapterCtx, WalkCtx } from "../walkthrough/ctx.ts";
import { nowChapter } from "../../lib/track.ts";

/** Route a page is about, for hover cards rendered outside the walkthrough (army, build pages). */
export const RouteCtx = createContext<RouteName | null>(null);

/** The route and chapter a hover card should describe: the chapter in view, else the run's current chapter. */
export function useScope(): { route: RouteName | null; chapter: number | null } {
  const walk = useContext(WalkCtx);
  const page = useContext(RouteCtx);
  const inChapter = useContext(ChapterCtx);
  const route = walk?.route ?? page ?? null;
  // No store subscription here: every chip calls this, and a tick must not re-render hundreds of them.
  const chapter = inChapter ?? (route ? nowChapter(route) : null);
  return { route, chapter };
}
