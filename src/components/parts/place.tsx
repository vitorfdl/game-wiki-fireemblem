import { resolve } from "../../lib/refs.ts";
import { RefChip } from "../ref/rich.tsx";

/** A place name as a map chip when the world map knows it. */
export function PlaceName({ name }: { name: string }) {
  const r = resolve(name, "place");
  return r ? <RefChip r={r} /> : <>{name}</>;
}
