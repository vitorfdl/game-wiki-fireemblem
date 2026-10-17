import { Gate } from "./inline.tsx";

/** "3S 6R" -> Support 3, Renown 6; "Auto" stays text. */
export function Requirement({ text }: { text?: string }) {
  if (!text) return null;
  const m = text.match(/(?:(\d)S\s+)?(\d+)R/);
  if (!m) return <span className="text-[13px] font-semibold text-ink-soft">{text}</span>;
  return (
    <span className="inline-flex gap-1">
      {m[1] && <Gate kind="S" n={Number(m[1])} />}
      <Gate kind="R" n={Number(m[2])} />
    </span>
  );
}
