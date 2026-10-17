import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { char, META } from "../../lib/data.ts";
import type { RouteName } from "../../lib/types.ts";
import { Panel } from "../ui/panel.tsx";
import { Medal } from "../ui/medal.tsx";
import { ConfText } from "../ui/conf-text.tsx";
import { MoreFold } from "../dossier/fold.tsx";
import { firstSentence } from "../dossier/variants.ts";
import { personHref } from "../army/bits.tsx";

/** sessionStorage flag set by "Rules in the walkthrough" on the Army page: open and scroll to this panel. */
const OPEN_FLAG = "fw-open-rules";

/** Opens the route's rules panel on the next walkthrough load. */
export function openRulesNext(route: RouteName) {
  try {
    sessionStorage.setItem(OPEN_FLAG, route);
  } catch { /* storage blocked: the link still lands on the walkthrough */ }
}

function takeFlag(route: RouteName): boolean {
  try {
    if (sessionStorage.getItem(OPEN_FLAG) !== route) return false;
    sessionStorage.removeItem(OPEN_FLAG);
    return true;
  } catch {
    return false;
  }
}

/** Sentences of a paragraph, for the impact bullets. */
const sentences = (text: string) =>
  text.split(/(?<=[.!?])\s+(?=[A-Z0-9'"(])/).map((s) => s.trim()).filter(Boolean);

/**
 * The route's own systems (META.routes[r].mechanics): one line on what each is, up to three changes to your builds,
 * linked units. Folded under the Key decisions; the folded header still names every system.
 */
export function RouteRules({ route }: { route: RouteName }) {
  const list = META.routes[route].mechanics;
  const [jump] = useState(() => takeFlag(route));
  useEffect(() => {
    if (!jump) return;
    // After the page's own scroll-to-top on load.
    const id = setTimeout(() => document.getElementById("rules")?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(id);
  }, [jump]);
  if (!list?.length) return null;
  return (
    <Panel
      id="rules"
      icon={<BookOpen />}
      title="Rules of this route"
      sub={list.map((m) => m.system).join(" · ")}
      fold={{ open: jump }}
      className="my-4"
    >
      <div className="grid gap-2.5 md:grid-cols-2">
        {list.map((m) => {
          const all = sentences(m.impact);
          const [lead, rest] = firstSentence(m.what);
          return (
            <article
              key={m.system}
              className="flex flex-col rounded-md bg-paper/60 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(176,144,90,.3),inset_3px_0_0_var(--c)]"
            >
              <b className="text-[15.5px] leading-snug">{m.system}</b>
              <p className="mt-0.5 mb-0 text-[13.5px] leading-snug text-ink-soft">
                <ConfText text={lead} k={`rw${m.system}`} />
              </p>
              <ul className="mt-2 mb-0 list-disc space-y-0.5 pl-4.5 text-[13.5px] leading-snug">
                {all.slice(0, 3).map((b, i) => <li key={b}><ConfText text={b} k={`ri${m.system}${i}`} /></li>)}
              </ul>
              {m.units?.length
                ? (
                  <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
                    {m.units.map((n) => (
                      <a key={n} href={personHref(n, route)} title={n}>
                        <Medal flat name={n} route={char(n)?.homeRoute} size={24} />
                      </a>
                    ))}
                  </div>
                )
                : null}
              {(all.length > 3 || rest) && (
                <MoreFold label="Full text" className="mt-2">
                  <div className="text-[13.5px] leading-relaxed text-ink-soft">
                    {rest && <p className="m-0"><ConfText text={rest} k={`rr${m.system}`} /></p>}
                    {all.length > 3 && (
                      <ul className="mt-1.5 mb-0 list-disc space-y-0.5 pl-4.5">
                        {all.slice(3).map((b, i) => <li key={b}><ConfText text={b} k={`rx${m.system}${i}`} /></li>)}
                      </ul>
                    )}
                  </div>
                </MoreFold>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
