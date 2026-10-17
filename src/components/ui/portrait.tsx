import { useState } from "react";
import { ART, OPAQUE, PORTRAITS } from "virtual:portraits";
import { cx } from "../../lib/cx.ts";

const opaque = new Set(OPAQUE);
const portraitSet = new Set(PORTRAITS);
const hasArt = new Set(ART);
const slugOf = (name: string) => name.toLowerCase().replace(/\s+/g, "-");
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2);

export const hasPortrait = (name: string): boolean => portraitSet.has(slugOf(name));
export const isOpaque = (name: string): boolean => opaque.has(slugOf(name));
export const artFor = (name: string): string | undefined =>
  hasArt.has(slugOf(name)) ? `img/art/${slugOf(name)}.webp` : undefined;

type Props = {
  name: string;
  className?: string;
  opaqueClassName?: string;
  fallbackClassName?: string;
  eager?: boolean;
};

/** Character bust. Painted busts without transparency get `opaqueClassName` so callers can crop or mask them. */
export function Portrait({ name, className, opaqueClassName, fallbackClassName, eager }: Props) {
  const slug = slugOf(name);
  const [broken, setBroken] = useState(!portraitSet.has(slug));
  if (broken) {
    return (
      <span className={cx("grid h-full w-full place-items-center font-logo font-bold text-gold-lo", fallbackClassName)}>
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      src={`img/portrait/${slug}.webp`}
      alt={name}
      loading={eager ? "eager" : "lazy"}
      onError={() => setBroken(true)}
      className={cx(className, opaque.has(slug) && opaqueClassName)}
    />
  );
}
