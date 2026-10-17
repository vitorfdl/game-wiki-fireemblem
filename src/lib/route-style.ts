import type { CSSProperties } from "react";
import type { RouteName } from "./types.ts";

/** Sets the accent variables every route-colored component reads (`--c`, `--c2`). */
export function routeVars(r: RouteName | undefined | null): CSSProperties {
  if (!r) return { "--c": "var(--color-gold)", "--c2": "#f3e6c6" } as CSSProperties;
  const k = r.toLowerCase();
  return { "--c": `var(--color-${k})`, "--c2": `var(--color-${k}-2)` } as CSSProperties;
}
