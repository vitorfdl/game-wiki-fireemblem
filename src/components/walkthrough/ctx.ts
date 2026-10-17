import { createContext, useContext } from "react";
import type { RouteName } from "../../lib/types.ts";

/** Field Kit tabs. "supports" opens Gifts; "builds" opens Units. */
export type KitTab =
  | "warprep"
  | "squads"
  | "temples"
  | "diadem"
  | "supports"
  | "units"
  | "ledger"
  | "map"
  | "mounts"
  | "arena"
  | "gifts"
  | "meals"
  | "raven"
  | "pins"
  | "items"
  | "builds";

export type WalkContext = {
  route: RouteName;
  /** Part on screen (D-122); Part I when absent. */
  part?: 1 | 2 | 3;
  /** Opens the Units side panel on this unit, expanded and scrolled to (lesson: no unit hover cards). */
  focusUnit: (name: string) => void;
  openKit: (tab: KitTab) => void;
  /** Opens the map tab centered on a place, or with a gathering item's spots highlighted. */
  openMap: (focus: { place?: string; item?: string }) => void;
  /** Opens the Mounts tab with a breed highlighted (Cai's route only). */
  openMount: (slug: string) => void;
  /** Outside the walkthrough: unit links go to the build page instead of the Units panel. */
  unitsOpenPage?: boolean;
};

export const WalkCtx = createContext<WalkContext | null>(null);

export function useWalk(): WalkContext {
  const v = useContext(WalkCtx);
  if (!v) throw new Error("WalkCtx missing");
  return v;
}

/** Chapter scope for a section; nested providers override the page default. */
export const ChapterCtx = createContext<number | null>(null);
export const useChapter = () => useContext(ChapterCtx);
