import { setDone, toggleDone, useTrack } from "../track.ts";

/** Checkbox state now lives in the run tracker (lib/track.ts); these wrappers keep the Markdown chapters working. */
export function useProgress(): Record<string, number> {
  return useTrack().done;
}

export function toggleTask(id: string): void {
  toggleDone(id);
}

export function clearTasks(ids: string[]): void {
  for (const id of ids) setDone(id, false);
}
