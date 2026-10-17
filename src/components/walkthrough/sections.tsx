import { memo, type ReactNode, useState } from "react";
import type { Token, Tokens } from "marked";
import {
  BookOpen,
  ChevronDown,
  Diamond,
  DoorOpen,
  GraduationCap,
  Heart,
  Hourglass,
  ListChecks,
  ScrollText,
  ShoppingBag,
  Star,
  Swords,
  UserPlus,
} from "lucide-react";
import { cx } from "../../lib/cx.ts";
import type { Group, GroupKind, Section } from "../../lib/walkthrough/model.ts";
import { useProgress } from "../../lib/walkthrough/store.ts";
import { Blocks } from "./blocks.tsx";
import { ChapterBuilds } from "./checkpoints.tsx";
import { ChapterCtx, useWalk } from "./ctx.ts";
import { ChapterBand } from "../chapter/view.tsx";
import { Panel } from "../ui/panel.tsx";
import { joinsIn } from "../../lib/chapter.ts";
import { Inline } from "./inline.tsx";
import { lexInline } from "../../lib/walkthrough/sources.ts";

const ICON: Record<GroupKind, { icon: ReactNode; tone: string }> = {
  battle: { icon: <Swords className="size-4" />, tone: "bg-teal text-gold-hi" },
  moveon: { icon: <Hourglass className="size-4" />, tone: "bg-blood text-white" },
  recruit: { icon: <UserPlus className="size-4" />, tone: "bg-(--c) text-white" },
  class: { icon: <GraduationCap className="size-4" />, tone: "bg-[#4f3486] text-white" },
  paralogue: { icon: <Star className="size-4" />, tone: "bg-gold text-white" },
  quest: { icon: <ScrollText className="size-4" />, tone: "bg-[#7d5a17] text-white" },
  shop: { icon: <ShoppingBag className="size-4" />, tone: "bg-[#2f6b5a] text-white" },
  explore: { icon: <DoorOpen className="size-4" />, tone: "bg-[#5a5246] text-white" },
  support: { icon: <Heart className="size-4" />, tone: "bg-[#c2415f] text-white" },
  checklist: { icon: <ListChecks className="size-4" />, tone: "bg-ink-soft text-white" },
  plan: { icon: <Diamond className="size-4" />, tone: "bg-gold-lo text-white" },
};

export function GroupIcon({ kind, className }: { kind: GroupKind; className?: string }) {
  const i = ICON[kind];
  return (
    <span aria-hidden="true" className={cx("grid size-7 shrink-0 place-items-center rounded-full", i.tone, className)}>
      {i.icon}
    </span>
  );
}

const Title = ({ text }: { text: string }) => <Inline tokens={lexInline(text)} seen={new Set()} />;

/** Task ids stamped on a group's checklist items, for the folded header's count. */
function groupTasks(tokens: Token[], out: string[] = []): string[] {
  for (const t of tokens) {
    if (t.type === "list") {
      for (const item of (t as Tokens.List).items) {
        const id = (item as Tokens.ListItem & { fwId?: string }).fwId;
        if (id) out.push(id);
        groupTasks(item.tokens, out);
      }
    } else if (t.type === "blockquote") groupTasks((t as Tokens.Blockquote).tokens, out);
  }
  return out;
}

/** A secondary group (label ended in [FOLD]): one line until opened, with its checklist count. */
function FoldGroup({ g }: { g: Group }) {
  const [open, setOpen] = useState(false);
  const progress = useProgress();
  const tasks = groupTasks(g.tokens);
  const done = tasks.filter((t) => progress[t]).length;
  const all = tasks.length > 0 && done === tasks.length;
  return (
    <div className="mt-4 rounded-md bg-card/60 shadow-[inset_0_0_0_1px_rgba(176,144,90,.35)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <GroupIcon kind={g.kind} />
        <span
          className={cx(
            "min-w-0 flex-1 text-[15.5px] leading-snug font-semibold",
            all && "text-muted line-through decoration-gold/60",
          )}
        >
          <Title text={g.title!} />
        </span>
        {tasks.length > 0 && (
          <span
            className={cx(
              "shrink-0 rounded-full px-2 py-[1px] text-[12px] font-semibold tabular-nums",
              all ? "bg-teal/15 text-teal-3" : "bg-paper-2 text-muted",
            )}
          >
            {done}/{tasks.length}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="animate-rise px-2.5 pb-3 pl-[48px] [&>*:first-child]:mt-0">
          <Blocks tokens={g.tokens} k={g.id} />
        </div>
      )}
    </div>
  );
}

export function GroupView({ g }: { g: Group }) {
  if (g.kind === "battle") {
    return (
      <div className="my-5 overflow-hidden rounded-lg bg-card shadow-[inset_0_0_0_1px_rgba(19,43,46,.35)]">
        <div className="flex items-center gap-2.5 bg-teal px-4 py-2 text-parchment">
          <Swords aria-hidden="true" className="size-4 text-gold-hi" />
          <h4 className="m-0 text-[15.5px] font-bold text-[#fbf0d6]">{g.title}</h4>
        </div>
        <div className="px-4 py-1 [&>p:first-child]:font-semibold">
          <Blocks tokens={g.tokens} k={g.id} />
        </div>
      </div>
    );
  }
  if (g.kind === "moveon") {
    return (
      <div className="my-5 flex gap-3 rounded-lg bg-warn px-4 py-3 text-[#5b2a1c] shadow-[inset_0_0_0_1px_#d2a595]">
        <Hourglass aria-hidden="true" className="mt-1 size-4 shrink-0 text-warn-ink" />
        <div className="min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <h4 className="m-0 label text-warn-ink">{g.title}</h4>
          <Blocks tokens={g.tokens} k={g.id} />
        </div>
      </div>
    );
  }
  if (!g.title) return <Blocks tokens={g.tokens} k={g.id} />;
  if (g.fold) return <FoldGroup g={g} />;
  if (!g.tokens.length) {
    return (
      <div className="mt-7 mb-1 flex items-center gap-3">
        <span className="label text-gold-lo">
          <Title text={g.title} />
        </span>
        <span className="h-px flex-1 bg-gold/40" />
      </div>
    );
  }
  return (
    <div className="mt-6">
      <h4 className="m-0 flex items-center gap-2.5 text-[17px] leading-snug font-bold">
        <GroupIcon kind={g.kind} />
        <span>
          <Title text={g.title} />
        </span>
      </h4>
      <div className="pl-[38px] [&>*:first-child]:mt-1.5">
        <Blocks tokens={g.tokens} k={g.id} />
      </div>
    </div>
  );
}

/**
 * A chapter that still renders from Markdown (Cai and Dietrich keep theirs, D-42): the same feature band as JSON
 * chapters, the derived class and gear strip, then the Markdown inside one panel. No per-chapter progress here: the
 * rail's ring is the one signal (V-7).
 */
export const ChapterSection = memo(function ChapterSection({ sec }: { sec: Section }) {
  const { route } = useWalk();
  const ch = sec.chapter ?? 0;
  return (
    <ChapterCtx.Provider value={sec.chapter ?? null}>
      <section id={sec.id} data-section={sec.id} className="scroll-mt-20 pt-10 pb-2 [content-visibility:auto] [contain-intrinsic-size:auto_2600px]">
        <ChapterBand
          route={route}
          ch={ch}
          name={sec.name ?? sec.title}
          free={sec.free ? { from: sec.free.from, to: sec.free.to } : null}
          note={sec.note}
          joining={joinsIn(route, ch).map((u) => u.name)}
        />
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
          <ChapterBuilds route={route} chapter={ch} />
          <Panel icon={<BookOpen />} title="Walkthrough" sub={`Chapter ${ch} step by step`} bodyClassName="text-[15.5px] leading-[1.6] [&>*:first-child]:mt-0">
            {sec.groups.map((g) => <GroupView key={g.id} g={g} />)}
          </Panel>
        </div>
      </section>
    </ChapterCtx.Provider>
  );
});

/** One expandable row in a reference panel. */
export function Row(
  { icon, title, children, sub }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; children: ReactNode },
) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gold/30 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper/60"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] leading-snug font-bold">{title}</span>
          {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="animate-rise px-4 pb-4 text-[15.5px] [&>*:first-child]:mt-0">{children}</div>}
    </div>
  );
}
