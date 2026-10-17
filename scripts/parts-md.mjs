// Writes ../part2-war.md and ../part3-salvation.md, the readable views of ../part2-war.json and ../part3-salvation.json.
// Drops and chests come from ../weapons-and-items.json, Divine classes from ../class-data.json, gathering spots from
// src/data/world-map.json (one owner per fact). Run after editing any of them: `deno task parts-md`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..");
const read = (f) => JSON.parse(readFileSync(join(REPO, f), "utf8"));
const wi = read("weapons-and-items.json");
const cls = read("class-data.json");
const world = JSON.parse(readFileSync(join(import.meta.dirname, "..", "src/data/world-map.json"), "utf8"));
const items = ["weapons", "equipment", "consumables"].flatMap((k) => wi[k]);
const nodeName = new Map(world.nodes.map((n) => [n.slug, n.name]));

/** Item `where` rows for one chapter tag ("Part II Ch 3", "Part III S5"). */
const dropsFor = (tag) =>
  items.flatMap((it) =>
    (it.where ?? []).filter((w) => w.chapter === tag).map((w) => ({ item: it.name, kind: w.source, at: w.location }))
  );
const srcLine = (d, keys) =>
  (keys ?? []).map((k) => d.sources.find((s) => s.key === k)).filter(Boolean).map((s) => s.url ? `[${s.key}](${s.url})` : s.key)
    .join(", ");
const list = (w, xs) => xs?.forEach((x) => w(`- ${x}`));

function battle(w, d, b) {
  const head = [b.gate, b.location, b.max_units ? `max ${b.max_units} units` : null, b.squads_needed ? `${b.squads_needed} squad(s)` : null]
    .filter(Boolean).join(" · ");
  w(`#### ${b.kind === "dungeon" ? "[Dungeon] " : b.kind === "skirmish" ? "[Skirmish] " : ""}${b.name}`);
  w();
  if (head) w(`*${head}*`), w();
  if (b.victory) w(`- **Victory:** ${b.victory}`);
  if (b.ideal_tier) w(`- **Ideal tier (Game8):** ${b.ideal_tier}`);
  const sug = [...(b.suggested?.classes ?? []), ...(b.suggested?.items ?? [])];
  if (sug.length) w(`- **Bring:** ${sug.join(", ")}`);
  if (b.flow) w(`- **Flow:** ${b.flow}`);
  if (b.enemies?.length) w(`- **Enemies:** ${b.enemies.join("; ")}`);
  if (b.reinforcements) w(`- **Reinforcements:** ${b.reinforcements}`);
  if (b.allies) w(`- **Allies:** ${b.allies.map((a) => `T${a.turn} ${a.units.join(", ")}`).join(" · ")}. ${b.allies_note ?? ""}`);
  if (b.guests?.length) w(`- **Guests:** ${b.guests.join("; ")}`);
  if (b.mechanics?.length) { w("- **Mechanics:**"); b.mechanics.forEach((m) => w(`  - ${m}`)); }
  if (b.tips?.length) { w("- **Tips:**"); b.tips.forEach((m) => w(`  - ${m}`)); }
  if (b.formation) w(`- **Formation:** ${b.formation}`);
  (b.recruits ?? []).forEach((r) => w(`- ${r.missable ? "⚠️ " : ""}**Recruit ${r.unit}:** ${r.how}`));
  if (b.after) w(`- **After:** ${b.after}`);
  w(`- Sources: ${srcLine(d, b.sources)}`);
  w();
}
function drops(w, tag) {
  const ds = dropsFor(tag);
  if (!ds.length) return;
  w("**Drops and pickups** (from `weapons-and-items.json`):");
  w();
  ds.forEach((x) => w(`- ${x.item}: ${x.at} (${x.kind})`));
  w();
}

/* ---------------------------------------------------------------- Part II */
{
  const d = read("part2-war.json");
  const out = [];
  const w = (s = "") => out.push(s);
  w("# Fire Emblem: Fortune's Weave: Part II (War)");
  w();
  w(`Generated from \`part2-war.json\` by \`site/scripts/parts-md.mjs\` (${d.updated}). Drops come from \`weapons-and-items.json\`. Edit the JSON, then rerun.`);
  w();
  w("## At a glance");
  w();
  const o = d.overview;
  list(w, [o.unlock, o.per_lord, o.skip, o.same_map_set, o.no_free_time, `**Defeat:** ${o.defeat}`, `**Deploy:** ${o.deploy}`, `**Enemies:** ${o.enemy_baseline}`, `**Tier:** ${o.ideal_tier}`]);
  w();
  w("## Carryover");
  w();
  list(w, [d.carryover.into_part2, d.carryover.handouts, d.carryover.out_of_part2]);
  w();
  w("## Preparations (every chapter)");
  w();
  list(w, [d.prep.licenses, d.prep.divine_sand, d.prep.facilities_until]);
  w();
  w("| Facility | Does |");
  w("|---|---|");
  d.prep.facilities.forEach((f) => w(`| ${f.name} | ${f.does} |`));
  d.prep.lord_facilities.forEach((f) => w(`| ${f.lord}'s War Path | ${f.does} |`));
  w();
  w("| Army Action (one per chapter) | Effect |");
  w("|---|---|");
  d.prep.army_actions.forEach((a) =>
    w(`| ${a.name} | ${a.does}${a.levels ? ` Levels: ${Object.entries(a.levels).map(([c, l]) => `Ch ${c} ${l}`).join(", ")}.` : ""} |`)
  );
  w();
  w("## ⚠️ Missables");
  w();
  d.missables.forEach((m) => w(`- [ ] **${m.when}:** ${m.text}`));
  w();
  for (const c of d.chapters) {
    w(`## Chapter ${c.ch}: ${c.name}`);
    w();
    if (c.prep) w(`**Prep:** ${c.prep}`), w();
    c.battles.forEach((b) => battle(w, d, b));
    drops(w, `Part II Ch ${c.ch}`);
  }
  w("## Open questions");
  w();
  list(w, d.open_questions);
  w();
  w("## Sources");
  w();
  d.sources.forEach((s) => w(`- ${s.key}: [${s.name}](${s.url})`));
  writeFileSync(join(REPO, "part2-war.md"), out.join("\n") + "\n");
}

/* --------------------------------------------------------------- Part III */
{
  const d = read("part3-salvation.json");
  const out = [];
  const w = (s = "") => out.push(s);
  const quest = (id) => d.quests.find((q) => q.id === id);
  const gather = (name) => {
    const it = Object.values(world.items).find((x) => x.name === name);
    if (!it) return null;
    const p = it.places.map((s) => nodeName.get(s) ?? s);
    const o = (it.other ?? []).map((x) => x.where);
    return [...p, ...o].join(", ");
  };
  w("# Fire Emblem: Fortune's Weave: Part III (Salvation)");
  w();
  w(`Generated from \`part3-salvation.json\` by \`site/scripts/parts-md.mjs\` (${d.updated}). Drops and chests come from \`weapons-and-items.json\`, Divine classes from \`class-data.json\`, gathering spots from \`site/src/data/world-map.json\`.`);
  w();
  w("## At a glance");
  w();
  const o = d.overview;
  list(w, [o.unlock, `⚠️ ${o.point_of_no_return}`, o.storage, o.recruits_in_dagsion, o.structure, o.dungeons]);
  w(`- **New:** ${o.new_in_part3.join(", ")}`);
  w(`- **Path functions:** ${o.path_functions.map((p) => `${p.lord}: ${p.functions.join(", ")}`).join(" · ")}`);
  w();
  w("## Calendar");
  w();
  w("| Section | Name | Free Time | Mission Time | Squads | Map turns (Game8) | Gates |");
  w("|---|---|---|---|---|---|---|");
  d.sections.forEach((s) =>
    w(`| ${s.n} | ${s.name} | ${s.free_time ? `${s.free_time.from}–${s.free_time.to}` : "—"} | ${s.mission_time ? `${s.mission_time.from}–${s.mission_time.to}` : "—"} | ${s.squads || "—"} | ${s.turns ?? "—"} | ${s.battles.filter((b) => !b.kind).map((b) => b.name.replace("Battle vs. ", "").replace("Showdown vs. ", "")).join(", ")} |`)
  );
  w();
  w("## ⚠️ Missables");
  w();
  d.missables.forEach((m) => w(`- [ ] **${m.when}:** ${m.text}`));
  w();
  w("## Systems");
  w();
  const sy = d.systems;
  w("**Squads**"), w(), list(w, sy.squads), w();
  w("**Repairs**"), w(), list(w, sy.repairs), w();
  w("**Mission Time**"), w(), list(w, sy.mission_time), w();
  list(w, [`**Relief:** ${sy.relief}`, `**Merge Causality:** ${sy.merge_causality}`, `**Trials:** ${sy.trials}`, `**Drifting Reliquary:** ${wi.systems.part_carryover}`]);
  w();
  if (sy.facilities) w("**Dagsion facilities**"), w(), list(w, sy.facilities), w();
  if (sy.shops) w("**Shops and menus**"), w(), list(w, sy.shops), w();
  if (sy.farming) w("**Farming and training**"), w(), list(w, sy.farming), w();
  if (sy.mounts) w("**Mounts (Stable)**"), w(), list(w, sy.mounts), w();
  for (const s of d.sections) {
    w(`## Section ${s.n}: ${s.name}`);
    w();
    const when = [s.free_time && `Free Time ${s.free_time.from}–${s.free_time.to}`, s.mission_time && `Mission Time ${s.mission_time.from}–${s.mission_time.to}`, s.squads && `${s.squads} squads`, s.turns && `${s.turns} map turns`].filter(Boolean);
    if (when.length) w(`*${when.join(" · ")}*`), w();
    if (s.intro) w(s.intro), w();
    if (s.flow?.length) w("**What happens**"), w(), s.flow.forEach((x, i) => w(`${i + 1}. ${x}`)), w();
    if (s.unlocks) w(`- **Opens:** ${s.unlocks.join(", ")}`);
    if (s.scenes) w(`- **Optional scenes:** ${s.scenes.join(", ")}. ${s.scenes_note ?? ""}`);
    (s.joins ?? []).forEach((j) => w(`- **Joins: ${j.unit}.** ${j.how}`));
    (s.overworld ?? []).forEach((x) => w(`- ${x}`));
    w();
    if (s.quests?.length) {
      w("| Quest | Giver / where | Task | Needs | Reward |");
      w("|---|---|---|---|---|");
      for (const q of s.quests.map(quest)) {
        const r = q.reward;
        const rw = [r.gold && `${r.gold.toLocaleString("en-US")}G`, r.relief && `${r.relief} Relief`, ...(r.items ?? []), ...(r.unlocks ?? []), r.trial_items && `Trial: ${r.trial_items.join(", ")}`]
          .filter(Boolean).join(", ");
        const stops = q.stops ? ` Stops: ${q.stops.map((x) => `${x.at} (${[...x.items, `${x.gold}G`].join(", ")})`).join("; ")}.` : "";
        w(`| ${q.missable ? "⚠️ " : ""}${q.name} | ${[q.giver, q.where].filter(Boolean).join(", ")} | ${q.task}${q.how ? `. ${q.how}` : ""} | ${q.requires ?? "—"} | ${rw}. Due ${q.due}.${stops} |`);
      }
      w();
      for (const q of s.quests.map(quest)) {
        const m = q.task.match(/Deliver (\d+) (.+)$/);
        const spots = m && gather(m[2].replace(/s$/, "")) ? gather(m[2].replace(/s$/, "")) : m && gather(m[2]);
        if (spots) w(`- ${m[2]}: ${spots}`);
      }
      w();
    }
    for (const b of s.battles) battle(w, d, b);
    drops(w, `Part III S${s.n}`);
    if (s.after) w(`**After Balor:** ${s.after}`), w();
    if (s.n === 4) {
      w("### Temple of the Diadem");
      w();
      list(w, [d.diadem.opens, ...d.diadem.rules]);
      w();
      w("| Key of the Diadem | Region | Spot |");
      w("|---|---|---|");
      d.diadem.keys.forEach((k) => w(`| ${k.dungeon} | ${k.region} | ${k.spot} |`));
      w();
      w("| Divine class | Item | Ranks | Chamber / unlock |");
      w("|---|---|---|---|");
      cls.classes.filter((c) => c.tier === "Divine").forEach((c) =>
        w(`| ${c.name} | ${c.requirements.license.replace(" (Divine License item)", "")} | ${c.requirements.ranks.join(", ")} | ${c.unlock} |`)
      );
      w();
    }
  }
  w("## Open questions");
  w();
  list(w, d.open_questions);
  w();
  w("## Sources");
  w();
  d.sources.forEach((s) => w(`- ${s.key}: [${s.name}](${s.url})`));
  writeFileSync(join(REPO, "part3-salvation.md"), out.join("\n") + "\n");
}
console.log("wrote part2-war.md, part3-salvation.md");
