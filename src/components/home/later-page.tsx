import { char, META } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { TopBar } from "../army/top-bar.tsx";
import { Medal } from "../ui/medal.tsx";

/** Units who join outside Part I, with the first clause of how they join. */
export function LaterPage() {
  return (
    <div className="min-h-screen bg-paper">
      <TopBar back={{ to: href(), label: "All lords" }} />
      <main className="mx-auto max-w-[1000px] px-4 pt-10 pb-24 md:px-8">
        <div className="label text-gold-lo">Beyond Part I · {META.later.length} warriors</div>
        <h1 className="m-0 mt-1 font-display text-[clamp(30px,4vw,44px)] leading-tight">Those who come later</h1>
        <p className="mt-2 max-w-[60ch] text-ink-soft">
          Guests and late joiners for Part II and Part III. Some are missable: read their conditions before Part II.
        </p>
        <ul className="mt-6 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-6 p-0">
          {META.later.map((n) => {
            const c = char(n);
            const join = (c?.joins ?? "").split(/[.:]/)[0];
            return (
              <li key={n}>
                <a
                  href={href("reserve", c?.slug)}
                  className="flex flex-col items-center gap-1.5 text-center transition-transform hover:-translate-y-1"
                >
                  <Medal name={n} size={84} />
                  <b className="text-[16px]">{n}</b>
                  <small className="text-[13px] leading-snug text-ink-soft">{join}</small>
                </a>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
