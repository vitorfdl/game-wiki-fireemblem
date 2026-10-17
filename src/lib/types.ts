export const ROUTE_NAMES = ["Cai", "Dietrich", "Leda", "Theodora"] as const;
export type RouteName = (typeof ROUTE_NAMES)[number];

export const STATS = ["HP", "Str", "Mag", "Spd", "Dex", "Def", "Res", "Lck", "Cha"] as const;
export type Stat = (typeof STATS)[number];
export type StatLine = Record<Stat, number>;

export type Note = { name: string; why?: string };
export type Gear = {
  item: string;
  why?: string;
  /**
   * Plan-only note: which copy, who hands it over, refine timing (D-110). Shops, barters, chests and quest rewards
   * come from the item catalog through `GetLine`; never restate them here.
   */
  plan?: string;
  /** Only for items the catalog doesn't know; catalog items derive where to get them. */
  where?: string;
  slot?: "Defense" | "Accessory" | "Head";
  alts?: string[];
  /** Set when the item is only carried on some maps: when to bring it and what it replaces. */
  situational?: string;
};
export type Training = { rank: string; for?: string; how?: string };

export type StageKind = "core" | "detour" | "fix" | "bench";

/**
 * A growth check: a stat the build leans on, how to tell in game that it is on track, and how to patch it when the
 * level-ups roll low. The page adds the expected gain from the stage's growth row (personal + class + mount).
 */
export type StatCheck = {
  stat: Stat;
  /** When to look ("Lv 25", "Ch 10 prep"). */
  at?: string;
  /** On-track test the player can read in game ("doubles Ch 9 Myrmidons in the forecast"). */
  need: string;
  /** What breaks when it is short. */
  why?: string;
  /** Patches in the order to try them (1 to 3). */
  fix: string[];
};

/** A point in the campaign: Part I to III, a chapter (or Part III section), optional timing hints. */
export type Pt = { part: 1 | 2 | 3; ch?: number; at?: "early" | "late"; approx?: boolean; lv?: number };

export type Stage = {
  when: string;
  /** Structured start of the stage (P1a). The site reads this, not `when`. */
  from?: Pt;
  to?: Pt | { lv: number };
  /** Up to three reasons for this stage, when the goal line can't hold them. */
  why?: string[];
  level?: string;
  class?: string;
  kind?: StageKind;
  mount?: string;
  goal?: string;
  /** Condition for moving to the next stage. */
  exit?: string;
  /** Masteries this stage earns. */
  masteries?: string[];
  weapons?: Gear[];
  equipment?: Gear[];
  /** Consumables carried into battle (Vulnerary, Elixir, Dew, juices). Each stack takes one inventory slot. */
  items?: Gear[];
  arts?: Note[];
  spells?: Note[];
  abilities?: Note[];
  /** Battalion the unit carries this stage (Theodora's route; infantry only, tier <= Authority). Not an inventory item. */
  battalion?: { name: string; why?: string; where?: string; alts?: string[]; situational?: string };
  /** Why a slot stays empty this stage (D-102: all 5 are filled by default). */
  openSlots?: string;
  training?: Training[];
  tips?: string[];
  /** Growth checks for the stats this stage depends on (at most 3). */
  checks?: StatCheck[];
  /** Items, arts or abilities that leave the kit at this stage, with the reason. */
  drop?: { item: string; why?: string }[];
};

export type Decision = { topic: string; pick: string; why: string; else?: string };
export type Gate = {
  route?: RouteName;
  from: Pt;
  by?: Pt;
  kind: "level" | "rank" | "mastery" | "recruit" | "item";
  text: string;
};
export type CalloutType = "timing-trap" | "fork" | "multi-copy" | "route-system" | "special-map" | "bench-plan";
export type Callout = { type: CalloutType; text: string; bullets?: string[] };

/** 2 to 5 candidate classes compared on the role's stats; an option with `use` is picked, else rejected (D-121). */
export type Finalists = { stats: Stat[]; options: { class: string; mount?: string; use?: string; note: string }[] };

export type Guide = {
  decisions?: Decision[];
  finalists?: Finalists;
  gates?: Gate[];
  callouts?: Callout[];
  role?: string;
  summary?: string;
  playstyle?: string;
  focus?: Stat[];
  keys?: string[];
  watch?: string[];
  stages?: Stage[];
  alt?: string;
  /** How this route's own systems (stables, battalions, songs...) change the build. */
  routeNotes?: { system: string; note: string }[];
  arts?: Note[];
  spells?: Note[];
  abilities?: Note[];
  training?: Training[];
  specials?: string[];
  sources?: string[];
};

export type Build = {
  role?: string;
  path?: string[];
  part1Target?: string;
  part3Target?: string;
  notes?: string;
  confidence?: string;
};

export type Recruit = {
  how: "auto" | "recruit";
  support?: number;
  renown?: number;
  extra?: string;
  why?: string[];
  tip?: string;
};

export type Copy = {
  route: RouteName;
  support?: number;
  renown?: number;
  cost?: string;
  chapter: number;
  path: string[];
  role?: string;
  part1?: string;
  why: string;
  guide?: Guide;
};

export type RecruitOn = {
  how: "auto" | "recruit" | "lord" | "paralogue" | "story";
  support?: number;
  renown?: number;
  gold?: number;
  item?: string;
  task?: string;
  window?: string;
};

export type Character = {
  recruitOn?: Partial<Record<RouteName, RecruitOn>>;
  name: string;
  slug: string;
  epithet?: string;
  faction?: string;
  homeRoute?: RouteName;
  isLord?: boolean;
  weapons?: string[];
  preferred?: string[];
  avoid?: string[];
  personality?: string;
  story?: string;
  personalSkill?: { name: string; effect: string };
  growths?: StatLine;
  supports?: string[];
  tiers?: { source: string; tier: string }[];
  tierNotes?: string;
  joins?: string;
  recruit?: Recruit;
  requirements?: Record<RouteName, string>;
  build?: Build;
  guide?: Guide;
  copies?: Copy[];
  sources?: string[];
};

export type RosterEntry = { name: string; chapter: number; estimate: boolean; why: string };

export type DeployStatus = "core" | "early" | "late" | "bench";

export type Deployment = {
  summary: string;
  roles?: { role: string; primary: string; backup?: string; why: string }[];
  synergies?: {
    units: string[];
    how: string;
    /** Short headline ("Dodge-tank pocket"). Falls back to the text before the first colon of `how`. */
    title?: string;
    /** One line: what the player gains and why it matters, in game terms. */
    payoff?: string;
    kind?: "defense" | "offense" | "healing" | "mobility" | "support";
  }[];
  phases: {
    chapters: string;
    from?: number;
    to?: number;
    slots: number;
    deploy: string[];
    bench: string[];
    note?: string;
  }[];
  why?: string[];
  /**
   * Deployment as ordered slots (redesign/10-visual-language.md): slots 1-6 are the standard map lineup, 7-9 join
   * on big maps. Each slot is a role; holders change at the chapter where a better unit takes it over.
   */
  lineup?: {
    slot: number;
    role: string;
    holders: { unit: string; from: number; to?: number; why?: string }[];
    note?: string;
  }[];
  units: Record<string, { status: DeployStatus; role?: string; why: string; partII?: string }>;
  part2?: { core?: string[]; note?: string };
};

export type RouteInfo = {
  ledger?: Ledger;
  lord: RouteName;
  hook: string;
  plays: string;
  pick: string;
  watch: string;
  systems: string[];
  paralogues: number;
  why: string;
  unlocks: { gives: string[]; wants: string[] };
  team?: { summary: string; gaps: string[]; fixes: string[] };
  chapters: Record<string, { title?: string; free?: string }>;
  roster: RosterEntry[];
  extras: string[];
  /** Benched recruits taken only for an item they carry or for their support conversations. */
  fillers?: Filler[];
  deployment?: Deployment;
  mechanics?: { system: string; what: string; impact: string; units?: string[] }[];
};

export type Filler = {
  name: string;
  kind: "items" | "supports";
  when: string;
  item?: string;
  cost?: string;
  why: string;
};

export type RoutesMeta = {
  order: RouteName[];
  /** Routes the player has finished (their data stays frozen, D-42). */
  finished?: RouteName[];
  orderNote: string;
  unlockNote: string;
  part2Cap: number;
  capNote: string;
  later: string[];
  fillerNote?: string;
  routes: Record<RouteName, RouteInfo>;
};

export type ClassRow = StatLine & { tier: string };

/* ------------------------------------------------------------ Route ledger (cross-chapter plan) */

export type LicenseTier = "beginner" | "specialty" | "advanced";
export type LicenseRow = {
  unit: string;
  class: string;
  /** Chapter of the exam: a number for Part I, or a label like "Part II Ch 1". */
  ch: number | string;
  ranks?: string[];
  why?: string;
  side?: boolean;
};

export type Ledger = {
  keyDecisions?: { text: string; ch?: number; panel?: "ledger" | "mounts" | "army" }[];
  renownPace?: { ch: number; from: number; to: number; opens: string }[];
  /** At most three one-line rules shown above the class queues. */
  rules?: string[];
  licenses?: {
    beginner: LicenseRow[];
    specialty: LicenseRow[];
    advanced: LicenseRow[];
    advancedCap: number;
    buy?: string;
  };
  licenseBudget?: { ch: number; beginner: number; specialty: number; advanced: number }[];
  weaponPriority?: { type: string; units: string[]; why?: string }[];
  uniques?: { item: string; to: string; from: string; ch?: number; fallback?: string }[];
  /** The route's refine plan. `ore` groups rows: rare-ore specials, common-ore Iron, Da Mina (ores unknown), Part III Soulstone (D-138). */
  refines?: {
    unit: string;
    item: string;
    why?: string;
    ch?: number | string;
    ore?: "rare" | "common" | "soulstone" | "?";
  }[];
  barters?: { item: string; for: string; at?: string; note?: string; ch?: number }[];
  carried?: { unit: string; item: string; when: string }[];
};

/* ------------------------------------------------------------ Chapter files */

export type Conf = "?" | "community" | "disputed";

/** One row of content. `text` is a full, self-explanatory line; `detail` folds under it. */
export type Line = {
  text: string;
  detail?: string[];
  conf?: Conf;
  /** A tracked event: renders a checkbox. Needs `id`. */
  task?: boolean;
  id?: string;
  /** Optional sub-header inside a slot ("8/10 to 9/1"). */
  group?: string;
  /** Explore rows: a dungeon whose chests feed builds (tracked once cleared). */
  loot?: boolean;
};

export type MissableKind = "scene" | "choice" | "support-chain" | "recruit-window" | "item" | "timing";
export type Missable = Line & {
  id: string;
  kind: MissableKind;
  when?: string;
  where?: string;
  lose: string;
  recover: string;
  /** For a choice: each option, and the quest ids it leads to (hidden from exit lists once another option is picked). */
  options?: { pick: string; gives: string; quests?: string[] }[];
  /** The missable is a dated quest from the catalog: the row and the quest share one checkbox (the quest's id). */
  quest?: string;
};

export type QuestRow = {
  quest: string;
  note?: string;
  detail?: string[];
  offered?: "always" | "if-offered";
  group?: string;
  /** The plan skips this quest: it stays listed in the Quests slot but never shows in exit lists. */
  skip?: boolean;
};

export type ChapterFile = {
  route: RouteName;
  ch: number;
  name: string;
  free: { from: string; to: string } | null;
  unlocks?: string[];
  routine: {
    same?: number;
    drop?: string[];
    /** One row per week pattern ("Week 1", "Weeks 2 on"): the three Sunday tables. */
    meals?: { week: string; tables: string[][]; note?: string }[];
    /**
     * One row per target. `gift` (and `alt`) name a gift in repo-root gifts.json: price and shop come from there.
     * Free-text rows (finished routes) still carry their own `where` and `cost`.
     */
    gifts?: {
      unit: string;
      gift: string;
      alt?: string;
      where?: string;
      cost?: string;
      until?: string;
      note?: string;
      /** First week this unit is in reach: a 30G pastry opens the bond before the weekly gift. */
      first?: boolean;
    }[];
    raven?: string;
    weekly?: Line[];
  } | null;
  missables: Missable[];
  classes: { note?: Line; override?: { unit: string; text: string }[] };
  gear: {
    buy?: Line[];
    /** Planned barters. Counter and materials come from the item catalog (D-110); `at` picks the counter. */
    barter?: { item: string; at?: string; note?: string; for: string }[];
    assign?: { item: string; to: string; why?: string }[];
    note?: Line[];
  };
  recruits: { unit: string; action: string; when?: string; detail?: string[]; callout?: Callout; conf?: Conf }[];
  prep?: Line[];
  quests: { route: QuestRow[]; sub: QuestRow[]; paralogue: QuestRow[] };
  explore: Line[];
  battle: {
    title: string;
    objective: string;
    lose?: string;
    guests?: string[];
    tips: Line[];
    loot?: Line[];
    callout?: Callout;
  };
  exitExtra?: Line[];
};

export type QuestKind =
  | "kindness"
  | "perform"
  | "send-supplies"
  | "dread-warrior"
  | "mentorship"
  | "request"
  | "subquest"
  | "paralogue"
  | "story";

export type Quest = {
  id: string;
  name: string;
  kind: QuestKind;
  giver?: string;
  task: string;
  where?: string;
  reward?: { gold?: number; renown?: number; items?: string[]; unlocks?: string[] };
  routes: Partial<
    Record<RouteName, {
      ch: number;
      window?: { from: string; to: string };
      due?: string;
      fight?: string;
      missable?: boolean;
    }>
  >;
  conf?: Conf;
};

/* ------------------------------------------------------------ Part II and Part III plan files (D-124) */

export type Blessing = "Aurora" | "Mars" | "Smyrnos" | "Jurah" | "Kalla" | "Credna";

/**
 * A War chapter's plan (`walkthrough/<route>/war-chNN.json`). Map facts come from repo-root part2-war.json; exams
 * and kit from the Part II build stages; drops from the item catalog. This file holds only the choices.
 */
export type WarChapterFile = {
  route: RouteName;
  ch: number;
  /** The one Army Action this chapter. */
  action: { pick: "Training Drills" | "Group Drills" | "Group Service"; why: string; god?: Blessing } | null;
  /** Blessings to equip at the Temple Administrator, in the order to fire them. */
  blessings: { god: Blessing; lv?: number; why: string }[];
  /** Who deploys (up to the map cap) and who sits; order = slot order. */
  deploy: { units: string[]; bench?: string[]; note?: string };
  missables: Missable[];
  gear?: { assign?: { item: string; to: string; why?: string }[]; note?: Line[] };
  /** Guests and recruits on this map: the plan line for each (facts come from part2-war.json). */
  people?: { unit: string; kind: "guest" | "recruit" | "skip"; text: string }[];
  tips: Line[];
  exitExtra?: Line[];
};

/** A Salvation Section's plan (`walkthrough/<route>/salvation-sNN.json`). Facts come from part3-salvation.json. */
export type SalvationFile = {
  route: RouteName;
  n: number;
  /** Free Time in turn bands ("Turns 1–4"), each row a full line; `squad` tags the squad that does it. */
  plan: { group: string; rows: (Line & { squad?: string })[] }[];
  missables: Missable[];
  /** Merge Causality this Section (300 Karma Shards each, D-118). */
  merges?: { unit: string; base: RouteName; with: RouteName[]; why: string }[];
  /** Other joins the plan acts on (talks in Dagsion). Section facts add the automatic ones. */
  joins?: { unit: string; text: string }[];
  /** Part III quests (ids in part3-salvation.json) worked this Section, with the plan note. */
  quests: { id: string; note?: string; squad?: string }[];
  gear?: { assign?: { item: string; to: string; why?: string }[]; note?: Line[] };
  /** Plan per gate battle (battle name as in part3-salvation.json). */
  gates: {
    battle: string;
    order?: number;
    /** The squad that starts the battle from the gate or a tile next to it: it spends its map turn. */
    launch?: SquadId;
    /** Who deploys, from the squads standing at the gate (Eshmel comes on top). */
    deploy?: string[];
    /** Blessings to equip for this battle, in the order to fire them (gods.json levels). */
    blessings?: { god: Blessing; lv?: number; why: string }[];
    tips: Line[];
  }[];
  /** Calls made for the player this Section (D-143): what, why, the rejected option. */
  decisions?: { topic: string; pick: string; why: string; alt?: string }[];
  /**
   * Master License queue this Section, in priority order (D-149): who takes the next License and why.
   * `license: "Elephant"` marks an Elephant License row (D-156): shown apart, outside the vendor's 3 Master Licenses.
   */
  licenses?: { unit: string; to: string; why: string; license?: "Elephant" }[];
  /** Units with copies on several routes: the copy to recruit in Dagsion. Merges add the others. */
  copies?: { unit: string; pick: RouteName; why?: string }[];
  exitExtra?: Line[];
};

export type SquadId = "A" | "B" | "C" | "D" | "E";

/** Part III squads (`walkthrough/<route>/squads.json`, D-126). One owner for who rides with whom. */
export type SquadsFile = {
  route: RouteName;
  /** A first pass: the page shows a Draft ribbon until this is false. */
  draft: boolean;
  note?: string;
  sections: {
    n: number;
    squads: {
      id: SquadId;
      role: string;
      job: string;
      units: string[];
      gates: string[];
      note?: string;
    }[];
    bench: string[];
    note?: string;
  }[];
};
