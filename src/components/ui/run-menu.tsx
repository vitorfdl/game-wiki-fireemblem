import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, History, MapPinned, Upload } from "lucide-react";
import { exportState, importState, lastFinished, nowChapter, useTrack } from "../../lib/track.ts";
import type { RouteName } from "../../lib/types.ts";

/**
 * Top-bar menu for the run (redesign/09-tracking.md): where you are on this route, recent pages, and a backup
 * file so the run survives cleared browser storage.
 */
export function RunMenu({ route }: { route?: RouteName | null }) {
  const t = useTrack();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const ch = route ? nowChapter(route, t) : null;
  const finished = route ? lastFinished(route, t) : 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    globalThis.addEventListener("pointerdown", onDown);
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("pointerdown", onDown);
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const download = () => {
    const blob = new Blob([exportState()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `muster-roll-run-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="Where you are in your run, recent pages and backup"
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13.5px] font-semibold text-[#f1e5c8] hover:bg-white/15"
      >
        <MapPinned aria-hidden="true" className="size-4 text-gold-hi" />
        <span className="hidden sm:inline">My run</span>
        {route && ch ? <span className="text-[12px] text-[#f1e5c8]/60 tabular-nums">Ch {ch}</span> : null}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </button>
      {open && (
        <div className="animate-rise absolute right-0 z-50 mt-2 w-[300px] rounded-lg bg-card p-3 text-ink shadow-[0_18px_50px_-12px_rgba(16,38,42,.55),inset_0_0_0_1px_var(--color-gold)]">
          {route && (
            <>
              <div className="label mb-1 text-[11px] text-gold-lo">{route} run</div>
              <p className="m-0 text-[13px] leading-snug">
                {finished ? <>Finished up to <b>Ch {finished}</b>, playing <b>Ch {ch}</b>.</> : <>Playing <b>Ch 1</b>.</>}
              </p>
              <p className="mt-1 mb-0 text-[12px] leading-snug text-muted">
                Finish a chapter with the button at its end; the Units tab, hover cards and build pages follow.
              </p>
            </>
          )}
          {t.recent.length > 0 && (
            <>
              <div className="label mt-3 mb-1 flex items-center gap-1 text-[11px] text-gold-lo">
                <History className="size-3.5" />Recent
              </div>
              <ul className="m-0 list-none space-y-0.5 p-0 text-[14px]">
                {t.recent.map((r) => (
                  <li key={r.href}>
                    <a href={r.href} onClick={() => setOpen(false)} className="block truncate rounded px-1.5 py-0.5 hover:bg-paper-2">
                      {r.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="label mt-3 mb-1 text-[11px] text-gold-lo">Backup</div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={download}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-paper-2 py-1.5 text-[13px] font-semibold hover:bg-paper-3"
            >
              <Download className="size-4" />Export
            </button>
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-paper-2 py-1.5 text-[13px] font-semibold hover:bg-paper-3"
            >
              <Upload className="size-4" />Import
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const err = importState(await f.text());
                setMsg(err ?? "Run restored.");
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-1.5 mb-0 text-[12px] leading-snug text-muted">
            {msg ?? "Your ticks live in this browser. Export a copy now and then."}
          </p>
        </div>
      )}
    </div>
  );
}
