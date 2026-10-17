import type { RouteName } from "../../lib/types.ts";
import { routeVars } from "../../lib/route-style.ts";
import { cx } from "../../lib/cx.ts";
import { Portrait } from "./portrait.tsx";

type Props = {
  name: string;
  route?: RouteName | null;
  size?: number;
  ring?: string;
  className?: string;
  /** Plain circle with a hairline: for rows, tables and text (redesign/10-visual-language.md V-1). */
  flat?: boolean;
};

/** Round portrait medallion used in lists, nav and chips. */
export function Medal({ name, route, size = 88, ring = "var(--color-paper)", className, flat }: Props) {
  return (
    <span
      className={cx("relative inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{
        ...routeVars(route),
        width: size,
        height: size,
        background: flat ? "var(--c2)" : "radial-gradient(circle at 50% 35%, #fffaf0, var(--c2))",
        boxShadow: flat
          ? "inset 0 0 0 1px rgba(16,38,42,.14)"
          : `0 0 0 2px ${ring}, 0 0 0 3.5px var(--color-gold), 0 8px 16px -8px rgba(60,40,10,.5)`,
      }}
    >
      <Portrait
        name={name}
        className="absolute left-1/2 top-[4%] w-[118%] max-w-none -translate-x-1/2"
        opaqueClassName="!top-0 !w-full h-full object-cover object-[50%_18%]"
        fallbackClassName="text-[0.32em]"
      />
    </span>
  );
}

/** Flat avatar for dense UI (V-1). */
export const Avatar = (p: Omit<Props, "flat" | "ring">) => <Medal {...p} flat />;
