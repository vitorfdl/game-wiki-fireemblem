import { Fragment } from "react";
import { ConfMark } from "../chapter/bits.tsx";
import { Rich } from "../ref/rich.tsx";

/*
 * D-20: source notes leave the text. A parenthetical that is only a source note ("(community-reported)",
 * "(community sheet)", "(fortunesweave.co.uk, community-reported)") becomes the ConfMark icon, with the note
 * in its tooltip. Everything else renders as Rich text.
 */

const NOTE = /\s*\(([^()]*\b(?:community|reported|unverified|sheet)\b[^()]*)\)/gi;

/** Text pieces and the source notes taken out of it, in order. */
export function splitConf(text: string): (string | { note: string })[] {
  const out: (string | { note: string })[] = [];
  let last = 0;
  NOTE.lastIndex = 0;
  for (let m = NOTE.exec(text); m; m = NOTE.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ note: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Text without its source notes (for a plain string, such as a title attribute). */
export const stripConf = (text: string) =>
  splitConf(text).filter((p): p is string => typeof p === "string").join("");

/** Rich text with source notes shown as a community ConfMark. */
export function ConfText({ text, k, quiet, stats }: { text: string; k: string; quiet?: string[]; stats?: boolean }) {
  return (
    <>
      {splitConf(text).map((p, i) =>
        typeof p === "string"
          ? <Fragment key={i}><Rich text={p} k={`${k}.${i}`} quiet={quiet} stats={stats} /></Fragment>
          : (
            // The outer title carries the specific note; ConfMark's own fixed title is muted so this one shows.
            <span key={i} title={`Community-reported: ${p.note}`} className="[&_*]:pointer-events-none">
              <ConfMark conf="community" />
            </span>
          )
      )}
    </>
  );
}
