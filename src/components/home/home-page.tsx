import { ArrowRight, Check, Users } from "lucide-react";
import { char, META, ordinal, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { cx } from "../../lib/cx.ts";
import { routeVars } from "../../lib/route-style.ts";
import type { RouteName } from "../../lib/types.ts";
import { walkthrough } from "../../lib/walkthrough/model.ts";
import { useProgress } from "../../lib/walkthrough/store.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import { Portrait } from "../ui/portrait.tsx";
import { Medal } from "../ui/medal.tsx";

/** Where the reader left off: the chapter after the latest finished, plus overall tick progress. */
function useResume(r: RouteName): { chapter: number; done: number; total: number } {
  const p = useProgress();
  const t = useTrack();
  const wt = walkthrough(r);
  let chapter = 0;
  let done = 0;
  let total = 0;
  for (const s of wt.sections) {
    const d = s.tasks.filter((t) => p[t]).length;
    done += d;
    total += s.tasks.length;
  }
  // The chapter you're playing: after the latest one marked finished (D-92).
  chapter = nowChapter(r, t);
  return { chapter, done, total };
}

function Recent() {
  const t = useTrack();
  if (!t.recent.length) return null;
  return (
    <div className="mt-6">
      <div className="label mb-2 text-[12px] text-gold-lo">Recently opened</div>
      <div className="flex flex-wrap gap-2">
        {t.recent.map((r) => (
          <a
            key={r.href}
            href={r.href}
            className="rounded-full bg-card px-3 py-1 text-[14px] font-semibold shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)] hover:bg-paper-2"
          >
            {r.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function LordCard({ r }: { r: RouteName }) {
  const info = META.routes[r];
  const lord = char(r);
  const { chapter, done, total } = useResume(r);
  const to = chapter ? href(routeSlug(r), "ch", String(chapter)) : href(routeSlug(r));
  const pct = total ? Math.round((done / total) * 100) : 0;
  const finished = META.finished?.includes(r) ?? false;
  return (
    <li style={routeVars(r)} className="group relative flex flex-col">
      <a
        href={to}
        aria-label={`${r}'s walkthrough${chapter ? `, continue at Chapter ${chapter}` : ""}`}
        className="relative flex flex-1 flex-col overflow-hidden rounded-xl bg-teal text-parchment shadow-[0_20px_40px_-24px_rgba(16,38,42,.8)] transition-transform duration-300 hover:-translate-y-1"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-[radial-gradient(90%_80%_at_50%_30%,color-mix(in_srgb,var(--c)_70%,#1a1210),#132b2e_75%)]">
          <Portrait
            name={r}
            eager
            className="absolute bottom-0 left-1/2 h-[104%] w-auto max-w-none -translate-x-1/2 transition-transform duration-500 group-hover:scale-[1.03]"
            opaqueClassName="ink-edge !h-full w-full object-cover"
          />
          <span
            className={cx(
              "absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold tracking-[0.08em] uppercase",
              finished ? "bg-teal/85 text-parchment/85" : "bg-gold-hi text-ink",
            )}
          >
            {finished && <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />}
            {finished ? `Played ${ordinal(r)}` : `Play ${ordinal(r)}`}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-4">
          <div className="text-[12px] font-semibold tracking-[0.08em] text-gold-hi uppercase">
            {info.plays.split(" (")[0]}
          </div>
          <h2 className="m-0 font-display text-[24px] leading-none text-[#fbf0d6] sm:text-[28px]">{r}</h2>
          <p className="m-0 hidden text-[14px] leading-snug text-parchment/80 sm:block">{info.hook}</p>
          <div className="mt-auto pt-3">
            <div className="h-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="h-full rounded-full bg-(--c)" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[13.5px] font-semibold">
              <span className="text-parchment/75">
                {chapter
                  ? `Continue at Ch ${chapter}`
                  : `${info.roster.length + 1} units · ${info.paralogues} Paralogues`}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-4 text-gold-hi transition-transform group-hover:translate-x-1"
              />
            </div>
          </div>
        </div>
      </a>
      <a
        href={href(routeSlug(r), "army")}
        className="mt-2 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink"
      >
        <Users aria-hidden="true" className="size-4" />
        <span>
          {lord?.name ?? r}'s army<span className="hidden sm:inline">&nbsp;and builds</span>
        </span>
      </a>
    </li>
  );
}

/** Landing page: the four routes, nothing else. */
export function HomePage() {
  return (
    <main className="paper-grain flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-12 pb-10 md:px-8 md:pt-16">
        <header className="mb-8 md:mb-10">
          <div className="label text-gold-lo">Fire Emblem: Fortune's Weave · Part I</div>
          <h1 className="m-0 mt-1 font-logo text-[clamp(44px,6vw,80px)] leading-[0.95] font-bold italic">
            The Muster Roll
          </h1>
          <p className="mt-3 mb-0 max-w-[52ch] text-[17px] text-ink-soft">
            Pick a lord to open their walkthrough. Your progress is saved in this browser; export a backup from the top bar of any route.
          </p>
        </header>
        <ol className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-6 p-0 lg:grid-cols-4">
          {META.order.map((r) => <LordCard key={r} r={r} />)}
        </ol>
        <Recent />
        <a
          href={href("later")}
          className="mt-10 flex items-center gap-3 rounded-lg bg-card px-4 py-3 shadow-[inset_0_0_0_1px_rgba(176,144,90,.5)] hover:bg-white sm:inline-flex"
        >
          <span className="flex">
            {META.later.slice(0, 4).map((n) => (
              <span key={n} className="-mr-2">
                <Medal name={n} size={32} ring="var(--color-card)" />
              </span>
            ))}
          </span>
          <span className="ml-2 text-[15px] font-semibold">Those who join after Part I</span>
          <ArrowRight aria-hidden="true" className="size-4 text-gold-lo" />
        </a>
      </div>
      <footer className="px-4 py-6 text-center text-[13px] text-muted">
        Unofficial companion. Art from fortunesweave.co.uk · Keys: <b>1–4</b> open a lord
      </footer>
    </main>
  );
}
