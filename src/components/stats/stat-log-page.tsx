import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCopy, Download, FileCheck2, HardDrive, Pencil, Trash2 } from "lucide-react";
import { CLASS_REF } from "virtual:refs";
import { char, CHARACTERS, routeLineup, routeSlug } from "../../lib/data.ts";
import { href } from "../../lib/router.ts";
import { nowChapter, useTrack } from "../../lib/track.ts";
import { P3_JOINERS, salvationArmy, warArmy } from "../../lib/part-army.ts";
import { primaryClass } from "../../lib/growth.ts";
import {
  bonusDetail,
  type CheckpointId,
  checkpointLabel,
  CHECKPOINTS,
  classOptions,
  deleteEntry,
  type Expect,
  expected,
  exportLog,
  type Flag,
  flagOf,
  historyOf,
  putEntry,
  type StatEntry,
  useStatLog,
} from "../../lib/stat-log.ts";
import { type RouteName, type Stat, STATS } from "../../lib/types.ts";
import { cx } from "../../lib/cx.ts";
import { TopBar } from "../army/top-bar.tsx";
import { Medal } from "../ui/medal.tsx";
import { unitNow } from "../dossier/unit-now.ts";

/*
 * Stat log (D-133): one keyboard-only form to record a unit's stat screen at a checkpoint, the unit's history with
 * the expected value from its previous entry, and an overview of every logged unit. Tab walks the form in reading
 * order, Enter saves, and after a save the next unit in the roster is picked so a whole army goes in one pass.
 */

type Draft = {
  checkpoint: CheckpointId;
  when: string;
  unit: string;
  level: string;
  cls: string;
  stats: Record<Stat, string>;
  note: string;
  editing?: string;
};

const blankStats = () => Object.fromEntries(STATS.map((s) => [s, ""])) as Record<Stat, string>;
/** Checkpoint and "when" carry over between visits in this session: a pass usually logs many units at one point. */
let lastPick: { checkpoint: CheckpointId; when: string } | null = null;

/** Roster for the picker: the route's army in join order, then its Part II additions, then Part III joiners. */
function unitGroups(route: RouteName): { label: string; names: string[] }[] {
  const army = routeLineup(route);
  const seen = new Set(army);
  const war = warArmy(route).map((u) => u.name).filter((n) => !seen.has(n) && seen.add(n));
  const p3 = [...P3_JOINERS, ...salvationArmy().filter((u) => u.origin === "joiner").map((u) => u.name)]
    .filter((n) => CHARACTERS[n] && !seen.has(n) && seen.add(n));
  return [
    { label: `${route}'s army`, names: army },
    { label: "Part II", names: war },
    { label: "Part III joiners", names: p3 },
  ].filter((g) => g.names.length);
}

/** Class name as class-data.json writes it ("Swordmaster" in a plan reads as "Sword Master"). */
function knownClass(raw: string | undefined): string {
  const c = primaryClass(raw);
  if (!c) return "";
  if (CLASS_REF[c] || c === "Commoner" || c === "Noble") return c;
  const hit = Object.keys(CLASS_REF).find((k) =>
    k.replace(/\s/g, "").toLowerCase() === c.replace(/\s/g, "").toLowerCase()
  );
  return hit ?? "";
}

/** The class the plan has for a unit at a Part I "When" ("Ch 6"), to catch a mis-picked class (type-ahead). */
function planClass(route: RouteName, unit: string, when: string, checkpoint?: string): string {
  // A join is logged before the first exam of that chapter: no class to compare yet.
  if (checkpoint === "join") return "";
  const ch = Number(when.match(/^Ch (\d+)/i)?.[1]);
  return ch >= 1 && ch <= 12 ? knownClass(unitNow(route, unit, ch).cls) : "";
}

/** What the check took out of an entry before comparing (note numbers, battalion), as one muted line. */
function TakenOut({ e }: { e: StatEntry }) {
  const b = bonusDetail(e);
  if (!b.from.length) return null;
  const stats = Object.entries(b.stats)
    .filter(([, n]) => n)
    .map(([st, n]) => `${st} ${n! > 0 ? "+" : "−"}${Math.abs(n!)}`)
    .join(", ");
  return (
    <span className="mt-0.5 block text-[11px] text-muted" title={stats}>
      Taken out: {b.from.join(" · ")}
    </span>
  );
}

function focusOf(route: RouteName, unit: string): Set<Stat> {
  const c = char(unit);
  const g = c?.copies?.find((x) => x.route === route)?.guide ?? c?.guide;
  return new Set(g?.focus ?? []);
}

const FLAG_STYLE: Record<Exclude<Flag, null>, string> = {
  low: "bg-blood-2 text-white",
  behind: "bg-[#f3d9a8] text-warn-ink",
  ahead: "bg-cai-2 text-[#1d5e3e]",
};
const FLAG_WORD: Record<Exclude<Flag, null>, string> = { low: "2σ low", behind: "1σ behind", ahead: "1σ ahead" };

const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const signed = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`;
};

const field =
  "h-10 rounded-md border border-paper-3 bg-card px-2.5 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold-hi";

export function StatLogPage({ route }: { route: RouteName }) {
  const log = useStatLog();
  const t = useTrack();
  const groups = useMemo(() => unitGroups(route), [route]);
  const order = useMemo(() => groups.flatMap((g) => g.names), [groups]);
  const classes = useMemo(classOptions, []);
  const unitRef = useRef<HTMLSelectElement>(null);
  const levelRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  const defaultClass = (unit: string): string => {
    const last = historyOf(log.entries, unit).at(-1);
    if (last) return last.cls;
    // No class yet in the plan (a Ch 1 unit before its first exam): the stat screen says Commoner or Noble.
    return knownClass(unitNow(route, unit, nowChapter(route, t)).cls) || "Commoner";
  };
  const fresh = (unit: string, keep?: Partial<Draft>): Draft => ({
    checkpoint: keep?.checkpoint ?? lastPick?.checkpoint ?? "join",
    when: keep?.when ?? lastPick?.when ?? `Ch ${nowChapter(route, t)}`,
    unit,
    level: "",
    cls: defaultClass(unit),
    stats: blankStats(),
    note: "",
  });
  const [d, setD] = useState<Draft>(() => fresh(order[0]));

  // The file arrives after the first render: fill the class from the unit's last entry once it does.
  useEffect(() => {
    if (log.mode !== "loading" && !d.editing && !d.level) setD((x) => ({ ...x, cls: defaultClass(x.unit) }));
  }, [log.mode]);

  useEffect(() => {
    document.title = `FE: Fortune's Weave - ${route} · Stat log`;
  }, [route]);

  const history = historyOf(log.entries, d.unit);
  const level = Number(d.level);
  const prev = history.filter((e) => e.level < level && e.id !== d.editing).at(-1) ?? null;
  const focus = focusOf(route, d.unit);

  // Live check while typing: the draft against the previous entry.
  const live = useMemo(() => {
    if (!prev || !level) return null;
    const stats = Object.fromEntries(STATS.map((s) => [s, d.stats[s] === "" ? NaN : Number(d.stats[s])])) as Record<
      Stat,
      number
    >;
    return expected(prev, { ...prev, level, cls: d.cls || prev.cls, stats, unit: d.unit });
  }, [prev, level, d.cls, d.stats, d.unit]);

  const pickUnit = (unit: string) => {
    setD((x) => ({ ...fresh(unit, { checkpoint: x.checkpoint, when: x.when }) }));
    setArmed(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const stats = Object.fromEntries(STATS.map((s) => [s, Number(d.stats[s])])) as Record<Stat, number>;
    // Re-logging the same unit, checkpoint and level replaces that entry; anything else adds one, so a forgotten
    // Checkpoint change never overwrites the baseline.
    const same = log.entries.find((x) =>
      x.unit === d.unit && x.checkpoint === d.checkpoint && x.level === level && x.route === route
    );
    const entry: StatEntry = {
      id: d.editing ?? same?.id ?? `${routeSlug(route)}-${char(d.unit)?.slug ?? d.unit}-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      route,
      unit: d.unit,
      checkpoint: d.checkpoint,
      when: d.when.trim(),
      level,
      cls: d.cls,
      stats,
      ...(d.note.trim() ? { note: d.note.trim() } : {}),
    };
    const err = await putEntry(entry);
    if (err) return setMsg({ text: err, bad: true });
    lastPick = { checkpoint: d.checkpoint, when: d.when };
    const verb = d.editing ? "Updated" : same ? "Replaced" : "Saved";
    setMsg({ text: `${verb} ${d.unit} · Lv ${level} · ${checkpointLabel(d.checkpoint)}` });
    if (d.editing) {
      setD(fresh(d.unit, d));
    } else {
      const next = order[(order.indexOf(d.unit) + 1) % order.length];
      setD(fresh(next, d));
    }
    unitRef.current?.focus();
  };

  const edit = (e: StatEntry) => {
    setD({
      checkpoint: e.checkpoint,
      when: e.when,
      unit: e.unit,
      level: String(e.level),
      cls: e.cls,
      stats: Object.fromEntries(STATS.map((s) => [s, String(e.stats[s])])) as Record<Stat, string>,
      note: e.note ?? "",
      editing: e.id,
    });
    setMsg({ text: `Editing ${e.unit} · Lv ${e.level}. Enter saves, Esc cancels.` });
    levelRef.current?.focus();
  };

  const onFormKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && d.editing) {
      setD(fresh(d.unit, d));
      setMsg({ text: "Edit cancelled." });
      unitRef.current?.focus();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportLog(log.entries));
      setMsg({ text: "Log copied. Paste it to Claude." });
    } catch {
      setMsg({ text: "Clipboard blocked: use Download.", bad: true });
    }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportLog(log.entries)], { type: "application/json" }));
    a.download = "stat-checkpoints.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="min-h-screen bg-paper" data-no-hotkeys>
      <TopBar back={{ to: href(routeSlug(route)), label: `${route}'s walkthrough` }} current={route} view="stats" />
      <main className="mx-auto max-w-[1180px] px-4 pt-8 pb-24 md:px-8">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="label text-gold-lo">{route} run · stat checkpoints</div>
            <h1 className="m-0 mt-1 font-display text-[clamp(28px,3.4vw,40px)] leading-tight">Stat log</h1>
          </div>
          <Storage mode={log.mode} count={log.entries.length} onCopy={copy} onDownload={download} />
        </div>
        <p className="mt-2 mb-0 max-w-[80ch] text-[14.5px] text-ink-soft">
          Log the stat screen when a unit joins, at its Lv 20 and Lv 35 exams, at the end of Part I, at the start of
          Part III and before Lv 45 or Divine exams. Each entry is checked against the growths from the one before it.
        </p>

        <form
          onSubmit={submit}
          onKeyDown={onFormKey}
          className="mt-5 rounded-xl bg-card p-4 shadow-[0_10px_30px_-18px_rgba(16,38,42,.45),inset_0_0_0_1px_var(--color-paper-3)]"
        >
          <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-paper-2 pb-4">
            <Labeled label="Checkpoint" htmlFor="sl-cp">
              <select
                id="sl-cp"
                value={d.checkpoint}
                onChange={(e) => setD({ ...d, checkpoint: e.target.value as CheckpointId })}
                className={cx(field, "w-[180px]")}
              >
                {CHECKPOINTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Labeled>
            <Labeled label="When" htmlFor="sl-when">
              <input
                id="sl-when"
                value={d.when}
                required
                placeholder="Ch 9 · War Ch 3 · Section 2"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setD({ ...d, when: e.target.value })}
                className={cx(field, "w-[150px]")}
              />
            </Labeled>
            <p className="m-0 max-w-[46ch] pb-2 text-[12.5px] leading-snug text-muted">
              Set these once per pass: they stay while you log the whole army.
            </p>
          </div>
          <div className="grid grid-cols-[auto_1fr] items-start gap-4">
            <Medal name={d.unit} route={route} size={72} />
            <div>
              <div className="flex flex-wrap items-end gap-3">
                <Labeled label="Unit" htmlFor="sl-unit">
                  <select
                    id="sl-unit"
                    ref={unitRef}
                    autoFocus
                    value={d.unit}
                    onChange={(e) => pickUnit(e.target.value)}
                    className={cx(field, "w-[190px] font-semibold")}
                  >
                    {groups.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.names.map((n) => (
                          <option key={n} value={n}>
                            {n}
                            {historyOf(log.entries, n).length ? ` · ${historyOf(log.entries, n).length}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Labeled>
                <Labeled label="Level" htmlFor="sl-level">
                  <input
                    id="sl-level"
                    ref={levelRef}
                    type="number"
                    inputMode="numeric"
                    required
                    min={1}
                    max={99}
                    value={d.level}
                    placeholder={history.at(-1) ? String(history.at(-1)!.level) : "Lv"}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setD({ ...d, level: e.target.value })}
                    className={cx(field, "w-[76px] text-center tabular-nums")}
                  />
                </Labeled>
                <Labeled label="Class" htmlFor="sl-class">
                  <select
                    id="sl-class"
                    required
                    value={d.cls}
                    onChange={(e) => setD({ ...d, cls: e.target.value })}
                    className={cx(field, "w-[200px]")}
                  >
                    <option value="" disabled>Pick a class</option>
                    {classes.map((g) => (
                      <optgroup key={g.tier} label={g.tier}>
                        {g.names.map((n) => <option key={n} value={n}>{n}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {planClass(route, d.unit, d.when, d.checkpoint) &&
                    planClass(route, d.unit, d.when, d.checkpoint) !== d.cls && (
                    <span className="mt-0.5 text-[11.5px] font-semibold text-warn-ink">
                      Plan at {d.when}: {planClass(route, d.unit, d.when, d.checkpoint)}
                    </span>
                  )}
                </Labeled>
              </div>

              <div className="mt-4 grid grid-cols-9 gap-2">
                {STATS.map((s) => {
                  const ex = live?.[s];
                  const f = d.stats[s] === "" ? null : flagOf(ex);
                  return (
                    <div key={s} className="flex flex-col items-stretch">
                      <label
                        htmlFor={`sl-${s}`}
                        className={cx(
                          "label mb-1 text-center text-[11px]",
                          focus.has(s) ? "text-ink" : "text-gold-lo",
                        )}
                        title={focus.has(s) ? "A stat this build needs" : undefined}
                      >
                        {s}
                        {focus.has(s) && <span className="ml-0.5 text-gold">◆</span>}
                      </label>
                      <input
                        id={`sl-${s}`}
                        type="number"
                        inputMode="numeric"
                        required
                        min={0}
                        max={99}
                        value={d.stats[s]}
                        placeholder={prev
                          ? String(prev.stats[s])
                          : history.at(-1)
                          ? String(history.at(-1)!.stats[s])
                          : ""}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setD({ ...d, stats: { ...d.stats, [s]: e.target.value } })}
                        className={cx(
                          field,
                          "h-12 w-full text-center text-[20px] font-semibold tabular-nums placeholder:text-faint placeholder:font-normal",
                          focus.has(s) && "border-gold",
                          f && FLAG_STYLE[f],
                        )}
                      />
                      <span className="mt-1 h-4 text-center text-[11.5px] text-muted tabular-nums">
                        {ex ? `exp ${fmt(ex.mean)}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Labeled label="Boosters, meals, notes" htmlFor="sl-note" grow>
                  <input
                    id="sl-note"
                    value={d.note}
                    placeholder="Seraph Robe (HP +5), stat meal Str +1 ..."
                    onChange={(e) => setD({ ...d, note: e.target.value })}
                    className={cx(field, "w-full")}
                  />
                </Labeled>
                <button
                  type="submit"
                  className="flex h-10 items-center gap-1.5 rounded-md bg-ink px-4 text-[15px] font-semibold text-gold-hi hover:bg-teal-3 focus:ring-2 focus:ring-gold-hi focus:outline-none"
                >
                  <Check aria-hidden="true" className="size-4" />
                  {d.editing ? "Update" : "Save"}
                  <kbd className="ml-1 rounded bg-white/10 px-1.5 text-[11px] font-normal">Enter</kbd>
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
                <span>
                  <kbd>Tab</kbd> next · <kbd>Shift+Tab</kbd> back · <kbd>Enter</kbd> save · letters jump in a list
                </span>
                <span>After a save the next unit is picked and focused.</span>
                {prev && <span>Compared with Lv {prev.level} ({checkpointLabel(prev.checkpoint)}).</span>}
              </div>
              <p
                role="status"
                aria-live="polite"
                className={cx(
                  "mt-1 mb-0 min-h-5 text-[13.5px] font-semibold",
                  msg?.bad ? "text-blood-2" : "text-[#1d5e3e]",
                )}
              >
                {msg?.text ?? ""}
              </p>
            </div>
          </div>
        </form>

        <History
          unit={d.unit}
          entries={history}
          focus={focus}
          armed={armed}
          onEdit={edit}
          onDelete={(e) => {
            if (armed !== e.id) return setArmed(e.id);
            setArmed(null);
            deleteEntry(e.id);
            setMsg({ text: `Deleted ${e.unit} · Lv ${e.level}.` });
          }}
        />
        <Overview route={route} order={order} entries={log.entries} current={d.unit} onPick={pickUnit} />
        <p className="mt-6 max-w-[90ch] text-[12.5px] text-muted">
          Expected value: the previous entry, plus the class flat bonus change, plus one roll per level at personal +
          class growth. When the class changed in between, each level rolls in the class the build plans for that level.
          Bonuses written in the note ("Ability +1 def") are taken out, and so is the battalion: the one named in the
          note, else the one the build plans for that chapter ("no battalion" in the note turns that off; a join has
          none). Each row lists what it took out. The lord's key item is always on, so it cancels. σ is the spread of
          the rolls. Mount growth and stat caps are not counted. ◆ marks the stats this unit's build needs. "plan:"
          under a class means the build expects another class there.
        </p>
      </main>
    </div>
  );
}

function Labeled(
  { label, htmlFor, children, grow }: { label: string; htmlFor: string; children: React.ReactNode; grow?: boolean },
) {
  return (
    <div className={cx("flex flex-col", grow && "min-w-[240px] flex-1")}>
      <label htmlFor={htmlFor} className="label mb-1 text-[11px] text-gold-lo">{label}</label>
      {children}
    </div>
  );
}

function Storage(
  { mode, count, onCopy, onDownload }: {
    mode: "loading" | "file" | "browser";
    count: number;
    onCopy: () => void;
    onDownload: () => void;
  },
) {
  if (mode === "loading") return <span className="text-[13px] text-muted">Loading the log…</span>;
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {mode === "file"
        ? (
          <span className="flex items-center gap-1.5 rounded-full bg-cai-2 px-3 py-1 text-[13px] font-semibold text-[#1d5e3e]">
            <FileCheck2 aria-hidden="true" className="size-4" />
            {count} entries · saved to <code className="text-[12px]">run-log/stat-checkpoints.json</code>
          </span>
        )
        : (
          <span
            className="flex items-center gap-1.5 rounded-full bg-warn px-3 py-1 text-[13px] font-semibold text-warn-ink"
            title="No dev server: entries stay in this browser. Run deno task dev to save to the file."
          >
            <HardDrive aria-hidden="true" className="size-4" />
            {count} entries · this browser only (run <code className="text-[12px]">deno task dev</code>)
          </span>
        )}
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-1 rounded-md bg-paper-2 px-2.5 py-1 text-[13px] font-semibold hover:bg-paper-3 focus:ring-2 focus:ring-gold-hi focus:outline-none"
      >
        <ClipboardCopy aria-hidden="true" className="size-4" />Copy
      </button>
      <button
        type="button"
        onClick={onDownload}
        className="flex items-center gap-1 rounded-md bg-paper-2 px-2.5 py-1 text-[13px] font-semibold hover:bg-paper-3 focus:ring-2 focus:ring-gold-hi focus:outline-none"
      >
        <Download aria-hidden="true" className="size-4" />Download
      </button>
    </div>
  );
}

function StatCell({ value, ex, need }: { value: number; ex?: Expect; need: boolean }) {
  const f = flagOf(ex);
  return (
    <td className="px-1 py-1.5 text-center align-top">
      <div
        className={cx(
          "mx-auto w-12 rounded-md py-0.5 text-[16px] font-semibold tabular-nums",
          f ? FLAG_STYLE[f] : need ? "bg-paper-2" : "",
        )}
        title={ex ? `Expected ${fmt(ex.mean)} ± ${fmt(ex.sd)}${f ? ` · ${FLAG_WORD[f]}` : ""}` : undefined}
      >
        {value}
      </div>
      {ex && (
        <div className="mt-0.5 text-[11px] text-muted tabular-nums">
          {signed(value - ex.mean)}
        </div>
      )}
    </td>
  );
}

function History(
  { unit, entries, focus, armed, onEdit, onDelete }: {
    unit: string;
    entries: StatEntry[];
    focus: Set<Stat>;
    armed: string | null;
    onEdit: (e: StatEntry) => void;
    onDelete: (e: StatEntry) => void;
  },
) {
  return (
    <section className="mt-8">
      <h2 className="m-0 font-display text-[22px]">{unit}'s checkpoints</h2>
      {entries.length === 0
        ? <p className="mt-1 text-[14px] text-muted">Nothing logged yet. The first entry is the baseline.</p>
        : (
          <div className="mt-2 overflow-x-auto rounded-lg bg-card shadow-[inset_0_0_0_1px_var(--color-paper-3)]">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="label text-[11px] text-gold-lo">
                  <th className="px-3 py-2 text-left">Checkpoint</th>
                  <th className="px-2 py-2 text-left">When</th>
                  <th className="px-2 py-2 text-right">Lv</th>
                  <th className="px-2 py-2 text-left">Class</th>
                  {STATS.map((s) => (
                    <th key={s} className={cx("px-1 py-2 text-center", focus.has(s) && "text-ink")}>
                      {s}
                      {focus.has(s) && <span className="text-gold">◆</span>}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-left">Note</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const ex = i > 0 ? expected(entries[i - 1], e) : null;
                  return (
                    <tr key={e.id} className="border-t border-paper-2">
                      <td className="px-3 py-1.5 font-semibold whitespace-nowrap">
                        {checkpointLabel(e.checkpoint)}
                        {i === 0 && <span className="ml-1.5 text-[11px] font-normal text-muted">baseline</span>}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-ink-soft">{e.when}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{e.level}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {e.cls}
                        {planClass(e.route, e.unit, e.when, e.checkpoint) &&
                          planClass(e.route, e.unit, e.when, e.checkpoint) !== e.cls && (
                          <span className="block text-[11px] font-semibold text-warn-ink">
                            plan: {planClass(e.route, e.unit, e.when, e.checkpoint)}
                          </span>
                        )}
                      </td>
                      {STATS.map((s) => <StatCell key={s} value={e.stats[s]} ex={ex?.[s]} need={focus.has(s)} />)}
                      <td className="max-w-[220px] px-2 py-1.5 text-[12.5px] text-ink-soft">
                        {e.note}
                        <TakenOut e={e} />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEdit(e)}
                          aria-label={`Edit Lv ${e.level}`}
                          className="rounded p-1 text-ink-soft hover:bg-paper-2 focus:ring-2 focus:ring-gold-hi focus:outline-none"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(e)}
                          aria-label={armed === e.id ? "Press again to delete" : `Delete Lv ${e.level}`}
                          className={cx(
                            "ml-1 rounded p-1 focus:ring-2 focus:ring-gold-hi focus:outline-none",
                            armed === e.id
                              ? "bg-blood-2 px-2 text-[12px] font-semibold text-white"
                              : "text-ink-soft hover:bg-paper-2",
                          )}
                        >
                          {armed === e.id ? "Delete?" : <Trash2 aria-hidden="true" className="size-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

function Overview(
  { route, order, entries, current, onPick }: {
    route: RouteName;
    order: string[];
    entries: StatEntry[];
    current: string;
    onPick: (unit: string) => void;
  },
) {
  const rows = order
    .map((unit) => {
      const h = historyOf(entries, unit);
      if (!h.length) return null;
      const last = h.at(-1)!;
      const ex = h.length > 1 ? expected(h.at(-2)!, last) : null;
      const focus = focusOf(route, unit);
      const flags = ex
        ? STATS.map((s) => ({ s, f: flagOf(ex[s]), z: ex[s].z, need: focus.has(s) })).filter((x) => x.f)
        : [];
      return { unit, last, count: h.length, flags };
    })
    .filter(Boolean) as {
      unit: string;
      last: StatEntry;
      count: number;
      flags: { s: Stat; f: Flag; z: number; need: boolean }[];
    }[];
  if (!rows.length) return null;
  return (
    <section className="mt-8">
      <h2 className="m-0 font-display text-[22px]">Army overview</h2>
      <p className="mt-0.5 mb-2 text-[13px] text-muted">
        Latest entry per unit against the one before it. Red on a ◆ stat is worth a fix.
      </p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2 p-0">
        {rows.map((r) => (
          <li key={r.unit}>
            <button
              type="button"
              onClick={() => onPick(r.unit)}
              aria-current={r.unit === current ? "true" : undefined}
              className="flex w-full items-center gap-3 rounded-lg bg-card p-2 text-left shadow-[inset_0_0_0_1px_var(--color-paper-3)] hover:bg-paper-2 focus:ring-2 focus:ring-gold-hi focus:outline-none aria-[current=true]:shadow-[inset_0_0_0_2px_var(--color-gold)]"
            >
              <Medal flat name={r.unit} route={route} size={40} ring="transparent" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <b className="text-[15px]">{r.unit}</b>
                  <span className="text-[12.5px] text-ink-soft">Lv {r.last.level} {r.last.cls}</span>
                </span>
                <span className="block text-[11.5px] text-muted">
                  {checkpointLabel(r.last.checkpoint)} · {r.last.when}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {r.count === 1 && <span className="text-[12px] text-muted">baseline only</span>}
                  {r.count > 1 && r.flags.length === 0 && <span className="text-[12px] text-[#1d5e3e]">on curve</span>}
                  {r.flags.map((x) => (
                    <span
                      key={x.s}
                      className={cx("rounded px-1.5 text-[11.5px] font-semibold tabular-nums", FLAG_STYLE[x.f!])}
                    >
                      {x.s}
                      {x.need ? "◆" : ""} {x.z >= 0 ? "+" : "−"}
                      {Math.abs(x.z).toFixed(1)}σ
                    </span>
                  ))}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
