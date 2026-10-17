import { Fragment, type ReactNode, useContext } from "react";
import type { Token, Tokens } from "marked";
import { CalendarClock, Leaf, MapPin, PawPrint, Repeat, TriangleAlert } from "lucide-react";
import { CHARACTERS } from "../../lib/data.ts";
import { cx } from "../../lib/cx.ts";
import { WalkCtx } from "./ctx.ts";
import { RefChip, UnitRef } from "../ref/rich.tsx";
import { resolve } from "../../lib/refs.ts";
import { giftNames } from "../../lib/gifts.ts";
import { splitConf } from "../ui/conf-text.tsx";
import { ConfMark } from "../chapter/bits.tsx";
import { foldName, ITEM_BY_NAME, mapNamePattern, NODE_BY_NAME } from "../../lib/map.ts";
import { QUESTS } from "../../lib/refs.ts";
import { BREED_BY_NAME, hasStable, mountNamePattern } from "../../lib/mounts.ts";

/** Names that are also common words never become character links. */
const SKIP = new Set(["Long"]);
const NAMES = Object.keys(CHARACTERS).filter((n) => !SKIP.has(n)).sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Gift names (gifts.json), longest first so "Alecto Garum" wins over "Garum". */
const GIFT_PATTERN = [...giftNames].sort((x, y) => y.length - x.length).map(esc).join("|");

const PATTERN = new RegExp(
  [
    String.raw`(\[(?:MISSABLE|CARRIES|EXTRA|FILLER|PART II|DEADLINE[^\]]*)\])`,
    String.raw`(⚠️?)`,
    String.raw`\b(\d{1,3}(?:,\d{3})+|\d{2,5})G\b`,
    String.raw`\bSupport (\d)\b`,
    String.raw`\bRenown (\d{1,2})\b`,
    String.raw`\bS([1-5])\b(?=[,.;)\s]|$)`,
    String.raw`\b((?:1[0-2]|[1-9])\/(?:3[01]|[12]\d|[1-9]))\b`,
    String.raw`\b(${GIFT_PATTERN})(?![\w-])`,
    String.raw`\b(${mountNamePattern()})\b(?!-\w)`,
    String.raw`\b(${mapNamePattern()})\b(?!-\w)`,
    String.raw`\b(${NAMES.map(esc).join("|")})\b(?!-\w)`,
  ].join("|"),
  "g",
);

const DEADLINE_BEFORE = /(due|ends?|by|expires?|deadline|until|before|last day(?: is)?|closes?)\s*(on\s*)?$/i;

/** Tracks which characters already got a portrait in the current block, so repeats stay plain. */
export type Seen = Set<string>;

export function Chip({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 rounded-[3px] px-1 align-[0.06em] text-[0.86em] leading-[1.5] font-semibold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DateChip({ date, deadline }: { date: string; deadline?: boolean }) {
  return deadline
    ? (
      <Chip className="bg-blood/10 text-blood shadow-[inset_0_0_0_1px_rgba(122,14,20,.35)]" title={`Deadline ${date}`}>
        <CalendarClock aria-hidden="true" className="size-[1.05em]" />
        <span className="tabular-nums">{date}</span>
      </Chip>
    )
    : <span className="font-semibold whitespace-nowrap tabular-nums text-ink">{date}</span>;
}

export function Gold({ amount }: { amount: string }) {
  return (
    <Chip className="bg-gold-hi/40 text-[#5d4512]" title={`${amount} gold`}>
      <i
        aria-hidden="true"
        className="block size-[0.72em] rounded-full bg-[radial-gradient(circle_at_35%_35%,#f6e2a8,#b0905a_70%)] shadow-[0_0_0_1px_#7d6435]"
      />
      <span className="tabular-nums">{amount}</span>
    </Chip>
  );
}

/** Support and Renown read as small pips: S3 is three filled hearts out of five ranks. */
export function Gate({ kind, n }: { kind: "S" | "R"; n: number }) {
  // Every pair starts at Support 1, so S1 is never a gate.
  if (kind === "S" && n <= 1) return null;
  return kind === "S"
    ? (
      <Chip className="bg-[#f6dfe3] text-[#8c2a43]" title={`Support ${n}`}>
        <span aria-hidden="true" className="flex gap-[3px] pl-[1px]">
          {Array.from({ length: n }, (_, i) => <i key={i} className="block size-[0.4em] rotate-45 bg-[#c2415f]" />)}
        </span>
        <span className="sr-only">Support</span>S{n}
      </Chip>
    )
    : (
      <Chip className="bg-teal/10 text-teal-3" title={`Renown ${n}`}>
        <span aria-hidden="true" className="font-logo text-[1.05em] leading-none font-bold">✦</span>
        <span className="sr-only">Renown</span>R{n}
      </Chip>
    );
}

const TAGS: Record<string, { label: string; cls: string; icon?: ReactNode }> = {
  MISSABLE: {
    label: "Missable",
    cls: "bg-blood text-white",
    icon: <TriangleAlert aria-hidden="true" className="size-[1em]" />,
  },
  CARRIES: {
    label: "Carries over",
    cls: "bg-teal-3 text-white",
    icon: <Repeat aria-hidden="true" className="size-[1em]" />,
  },
  EXTRA: { label: "Extra copy", cls: "bg-gold text-white" },
  FILLER: { label: "Filler · bench", cls: "border border-dashed border-gold-lo bg-transparent text-gold-lo" },
  "PART II": { label: "Part II", cls: "bg-ink-soft text-white" },
};

export function Tag({ raw }: { raw: string }) {
  const key = raw.slice(1, -1);
  if (key.startsWith("DEADLINE")) return <DateChip date={key.replace("DEADLINE", "").trim()} deadline />;
  const t = TAGS[key];
  return (
    <Chip className={cx("text-[0.72em] tracking-[0.06em] uppercase", t?.cls)}>
      {t?.icon}
      {t?.label ?? key}
    </Chip>
  );
}

export function CharacterChip({ name, avatar = true }: { name: string; avatar?: boolean }) {
  const walk = useContext(WalkCtx);
  if (walk && name === walk.route) return <span className="font-semibold">{name}</span>;
  return <UnitRef name={name} avatar={avatar} />;
}

/** A place or gathering item from the world map: tap to open the map there. */
export function PlaceChip({ text }: { text: string }) {
  const ctx = useContext(WalkCtx);
  const node = NODE_BY_NAME.get(foldName(text));
  const item = node ? undefined : ITEM_BY_NAME.get(foldName(text));
  if (!ctx || (!node && !item)) return <>{text}</>;
  return (
    <button
      type="button"
      onClick={() => ctx.openMap(node ? { place: node.slug } : { item })}
      title={node ? `Show ${node.name} on the map` : `Show where to gather ${text}`}
      className="inline cursor-pointer border-0 bg-transparent p-0 align-baseline whitespace-nowrap text-inherit [font:inherit] decoration-teal-3/60 decoration-dotted decoration-[1.5px] underline underline-offset-[3px] hover:decoration-solid"
    >
      {node
        ? <MapPin aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-teal-3" />
        : <Leaf aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-[#3d7a3a]" />}
      {text}
    </button>
  );
}

/** A mount breed: tap to open the Mounts tab on it. Plain text on routes without a Stable. */
export function MountChip({ text }: { text: string }) {
  const ctx = useContext(WalkCtx);
  const b = BREED_BY_NAME.get(text.toLowerCase());
  if (!ctx || !b || !hasStable(ctx.route)) return <>{text}</>;
  return (
    <button
      type="button"
      onClick={() => ctx.openMount(b.slug)}
      title={`${b.name}: stats, food and where to catch it`}
      className="inline cursor-pointer border-0 bg-transparent p-0 align-baseline whitespace-nowrap text-inherit [font:inherit] decoration-[#8a5a24]/60 decoration-dotted decoration-[1.5px] underline underline-offset-[3px] hover:decoration-solid"
    >
      <PawPrint aria-hidden="true" className="mr-[2px] inline size-[0.85em] align-[-0.08em] text-[#8a5a24]" />
      {text}
    </button>
  );
}

const WEAPON_AFTER = /^ (Swords?|Spears?|Axes?|Bows?|Gauntlets?|Shields?|Lances?|Staff|Staves|Tomes?|Rings?|weapons?)\b/i;

/** Quest names that contain a place name (lowercase, accents folded), for the check below. */
const QUEST_NAMES = Object.values(QUESTS).map((q) => foldName(q.name));

/** True when the match sits inside a quest's name written out in the text ("Defeat Aguino's Thieves"). */
function insideQuestName(text: string, at: number, len: number): boolean {
  const low = foldName(text);
  const word = low.slice(at, at + len);
  for (const q of QUEST_NAMES) {
    if (!q.includes(word)) continue;
    for (let i = low.indexOf(q); i >= 0; i = low.indexOf(q, i + 1)) if (i <= at && at + len <= i + q.length) return true;
  }
  return false;
}

/** Turns plain text into text plus chips for tags, gold, Support, Renown, dates and characters. */
export function enhance(text: string, seen: Seen, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = PATTERN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    const [all, tag, warn, gold, sup, ren, short, date, giftName, mount, place, name] = m;
    if (tag) out.push(<Tag key={k} raw={tag} />);
    else if (warn) {
      out.push(<TriangleAlert key={k} aria-label="Warning" className="inline size-[1em] align-[-0.12em] text-blood" />);
    } else if (gold) out.push(<Gold key={k} amount={`${gold}G`} />);
    else if (sup) out.push(<Gate key={k} kind="S" n={Number(sup)} />);
    else if (ren) out.push(<Gate key={k} kind="R" n={Number(ren)} />);
    else if (short) out.push(<Gate key={k} kind="S" n={Number(short)} />);
    else if (date) {
      const before = text.slice(Math.max(0, m.index - 18), m.index);
      out.push(<DateChip key={k} date={date} deadline={DEADLINE_BEFORE.test(before)} />);
    } else if (giftName) {
      const r = resolve(giftName, "gift");
      out.push(r ? <RefChip key={k} r={r} /> : giftName);
    } else if (mount) {
      out.push(<MountChip key={k} text={mount} />);
    } else if (place) {
      // "Da Mina Sword" is a weapon named after the town, not the town; "Defeat Aguiño's Thieves" is a quest.
      const after = text.slice(m.index + all.length);
      if (WEAPON_AFTER.test(after) || insideQuestName(text, m.index, all.length)) out.push(all);
      else out.push(<PlaceChip key={k} text={place} />);
    } else if (name) {
      out.push(<CharacterChip key={k} name={name} avatar={!seen.has(name)} />);
      seen.add(name);
    } else out.push(all);
    last = m.index + all.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Renders marked inline tokens with the chip enhancements. */
export function Inline({ tokens, seen, k = "i" }: { tokens: Token[] | undefined; seen: Seen; k?: string }) {
  if (!tokens) return null;
  return (
    <>
      {tokens.map((t, i) => {
        const key = `${k}.${i}`;
        switch (t.type) {
          case "text":
          case "escape": {
            const tt = t as Tokens.Text;
            if (tt.tokens?.length) return <Inline key={key} tokens={tt.tokens} seen={seen} k={key} />;
            // D-53: a parenthetical source note becomes the ConfMark icon, also in Markdown chapters.
            return (
              <Fragment key={key}>
                {splitConf(decode(tt.text)).map((p, j) =>
                  typeof p === "string"
                    ? <Fragment key={j}>{enhance(p, seen, `${key}.${j}`)}</Fragment>
                    : (
                      <span key={j} title={`Community-reported: ${p.note}`} className="[&_*]:pointer-events-none">
                        <ConfMark conf="community" />
                      </span>
                    )
                )}
              </Fragment>
            );
          }
          case "strong":
            return (
              <strong key={key} className="font-bold text-ink">
                <Inline tokens={(t as Tokens.Strong).tokens} seen={seen} k={key} />
              </strong>
            );
          case "em":
            return (
              <em key={key}>
                <Inline tokens={(t as Tokens.Em).tokens} seen={seen} k={key} />
              </em>
            );
          case "codespan":
            return (
              <code key={key} className="rounded-[3px] bg-paper-2 px-1 text-[0.85em] text-muted">
                {decode((t as Tokens.Codespan).text)}
              </code>
            );
          case "link": {
            const l = t as Tokens.Link;
            return (
              <a
                key={key}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-teal-3 underline decoration-gold underline-offset-2"
              >
                <Inline tokens={l.tokens} seen={seen} k={key} />
              </a>
            );
          }
          case "br":
            return <br key={key} />;
          case "del":
            return (
              <del key={key}>
                <Inline tokens={(t as Tokens.Del).tokens} seen={seen} k={key} />
              </del>
            );
          case "checkbox":
          case "html":
            return null;
          default:
            return <Fragment key={key}>{(t as { text?: string }).text ?? ""}</Fragment>;
        }
      })}
    </>
  );
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
export const decode = (s: string): string => s.replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e);
