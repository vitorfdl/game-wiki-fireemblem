import { cx } from "../../lib/cx.ts";

/** Line-art compass rose used as a faint backdrop. */
export function Compass({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-300 -300 600 600"
      aria-hidden="true"
      className={cx("pointer-events-none absolute text-gold-lo opacity-15", className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle r="290" />
        <circle r="270" strokeDasharray="2 6" />
        <circle r="210" />
        <circle r="120" />
        <circle r="40" />
        <path d="M0-290V290M-290 0H290M-205-205L205 205M-205 205L205-205" />
        <path d="M0-280L26-26L280 0L26 26L0 280L-26 26L-280 0L-26-26Z" />
        <path d="M0-180L14-14L180 0L14 14L0 180L-14 14L-180 0L-14-14Z" transform="rotate(45)" />
      </g>
    </svg>
  );
}
