import type { ReactNode } from "react";

/** Diamond-marked heading with a fading gold rule, used for every dossier section. */
export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-3 text-[15px] tracking-[0.12em]">
      <span className="text-[11px] text-(--c)">◆</span>
      <span>{children}</span>
      <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--color-gold),transparent)]" />
      {aside}
    </h3>
  );
}
