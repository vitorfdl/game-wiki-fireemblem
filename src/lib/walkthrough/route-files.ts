import { META } from "../data.ts";
import type { Line, RouteName } from "../types.ts";

/*
 * Route-level walkthrough files (redesign/03-data-model.md §5b): `walkthrough/<route>/exit.json` holds the authored
 * part of "Before Part II", `notes.json` the open questions. When a file exists it replaces the Markdown section.
 */

export type OpenQuestion = { text: string; ch?: number; units?: string[]; sources?: string[] };
export type RouteNotes = { openQuestions: OpenQuestion[] };
export type RouteExit = { partII: Line[]; extra?: Line[] };

const EXITS = import.meta.glob<RouteExit>("../../data/walkthrough/*/exit.json", { eager: true, import: "default" });
const NOTES = import.meta.glob<RouteNotes>("../../data/walkthrough/*/notes.json", { eager: true, import: "default" });

/** The route a file belongs to, from its folder name. */
function byRoute<T>(files: Record<string, T>): Map<RouteName, T> {
  const out = new Map<RouteName, T>();
  for (const [path, v] of Object.entries(files)) {
    const dir = path.split("/").at(-2)?.toLowerCase();
    const route = META.order.find((r) => r.toLowerCase() === dir);
    if (route && v) out.set(route, v);
  }
  return out;
}

const EXIT = byRoute(EXITS);
const NOTE = byRoute(NOTES);

export const routeExit = (route: RouteName): RouteExit | undefined => EXIT.get(route);
export const routeNotes = (route: RouteName): RouteNotes | undefined => NOTE.get(route);
