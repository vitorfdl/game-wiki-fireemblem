import { createContext, type CSSProperties, type ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "../../lib/cx.ts";
import { WalkCtx } from "../walkthrough/ctx.ts";
import { RouteCtx } from "../ref/ctx.ts";
import { PinFromCtx } from "../../lib/pins.ts";

/**
 * Hover cards (redesign/02-templates.md §7): one open at a time. Desktop: opens after a short hover, a click
 * pins it. Touch: a tap opens it as a bottom sheet. Esc or a click outside closes a pinned card.
 */
type Open = { id: string; anchor: HTMLElement; pinned: boolean; render: () => ReactNode } | null;

let open: Open = null;
const subs = new Set<() => void>();
const set = (v: Open) => {
  open = v;
  subs.forEach((f) => f());
};
// A pinned card belongs to the page it opened on: any navigation (hash route change) closes it.
globalThis.addEventListener?.("hashchange", () => open && set(null));
globalThis.addEventListener?.("popstate", () => open && set(null));

const useOpen = () =>
  useSyncExternalStore((f) => {
    subs.add(f);
    return () => subs.delete(f);
  }, () => open);

/** True inside an open card: chips there act directly (open the map) instead of stacking a second card. */
export const InCard = createContext(false);

let closeTimer: ReturnType<typeof setTimeout> | undefined;
let openTimer: ReturnType<typeof setTimeout> | undefined;
const cancelClose = () => clearTimeout(closeTimer);
const scheduleClose = () => {
  clearTimeout(openTimer);
  cancelClose();
  closeTimer = setTimeout(() => {
    if (open && !open.pinned) set(null);
  }, 160);
};

const coarse = () => globalThis.matchMedia?.("(hover: none)").matches ?? false;

let seq = 0;

/** Wraps a trigger. `card` renders lazily, only when the card opens. */
export function Hover(
  { card, children, className, label, style }: {
    card: () => ReactNode;
    children: ReactNode;
    className?: string;
    label?: string;
    style?: CSSProperties;
  },
) {
  const ref = useRef<HTMLSpanElement>(null);
  const [id] = useState(() => `h${++seq}`);
  // Cards render in the root layer: carry the trigger's page contexts so chips inside (places, items) open its map.
  const walk = useContext(WalkCtx);
  const page = useContext(RouteCtx);
  const pinFrom = useContext(PinFromCtx);
  const render = () => (
    <RouteCtx.Provider value={page}>
      <WalkCtx.Provider value={walk}>
        <PinFromCtx.Provider value={pinFrom}>
          <InCard.Provider value>{card()}</InCard.Provider>
        </PinFromCtx.Provider>
      </WalkCtx.Provider>
    </RouteCtx.Provider>
  );
  const show = (pinned: boolean) => ref.current && set({ id, anchor: ref.current, pinned, render });
  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-expanded={open?.id === id}
      className={cx("cursor-pointer", className)}
      style={style}
      onMouseEnter={() => {
        if (coarse()) return;
        cancelClose();
        clearTimeout(openTimer);
        if (open && !open.pinned) show(false);
        else if (!open) openTimer = setTimeout(() => show(false), 250);
      }}
      onMouseLeave={scheduleClose}
      onClick={(e) => {
        e.stopPropagation();
        clearTimeout(openTimer);
        if (open?.id === id && open.pinned) set(null);
        else show(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          show(true);
        }
      }}
    >
      {children}
    </span>
  );
}

/** Mount once at the app root. */
export function HoverLayer() {
  const o = useOpen();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const sheet = o ? coarse() || globalThis.innerWidth < 640 : false;

  useLayoutEffect(() => {
    if (!o || sheet) return;
    const r = o.anchor.getBoundingClientRect();
    const w = box.current?.offsetWidth ?? 340;
    const h = box.current?.offsetHeight ?? 260;
    let top = r.bottom + 8;
    if (top + h > globalThis.innerHeight - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    const left = Math.min(Math.max(8, r.left - 12), globalThis.innerWidth - w - 8);
    setPos({ top, left });
  }, [o, sheet]);

  useEffect(() => {
    if (!o) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || o.anchor.contains(t)) return;
      set(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && set(null);
    const onScroll = () => !o.pinned && set(null);
    globalThis.addEventListener("pointerdown", onDown);
    globalThis.addEventListener("keydown", onKey);
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      globalThis.removeEventListener("pointerdown", onDown);
      globalThis.removeEventListener("keydown", onKey);
      globalThis.removeEventListener("scroll", onScroll);
    };
  }, [o]);

  if (!o) return null;
  return createPortal(
    <>
      {sheet && <div className="fixed inset-0 z-[69] bg-ink/40" aria-hidden="true" />}
      <div
        ref={box}
        role="dialog"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        style={sheet ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
        className={sheet
          ? "animate-rise fixed inset-x-0 bottom-0 z-[70] max-h-[75vh] overflow-y-auto rounded-t-xl bg-card p-4 text-[14.5px] leading-snug text-ink shadow-[0_-10px_40px_rgba(16,38,42,.35)]"
          : "fixed z-[70] w-[340px] rounded-lg bg-card p-4 text-[14px] leading-snug text-ink shadow-[0_18px_50px_-12px_rgba(16,38,42,.55),inset_0_0_0_1px_var(--color-gold)]"}
      >
        {(o.pinned || sheet) && (
          <button
            type="button"
            onClick={() => set(null)}
            aria-label="Close"
            className="absolute top-2 right-2 rounded p-1 text-muted hover:bg-paper-2"
          >
            <X className="size-4" />
          </button>
        )}
        {o.render()}
      </div>
    </>,
    document.body,
  );
}

export const closeHover = () => set(null);
