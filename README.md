# Fortune's Weave Muster Roll

The companion site for the four Part I routes: an interactive walkthrough per lord, plus who joins each army, when, and how to build them. React, Tailwind CSS v4 and Vite, run with Deno.

## Run it

```sh
deno install        # first time only: fetches the npm packages into node_modules/
deno task dev       # http://localhost:5173 with live reload
deno task build     # static site in dist/
deno task preview   # serve dist/
deno task check     # type check, lint and format check
```

## Deploy

Pushing to `master` runs `.github/workflows/pages.yml`: Deno builds the site and GitHub Pages serves `dist/` (D-161). The repo holds only `site/`, so the build reads the research library from `research/`, a generated copy of the root JSON and walkthrough Markdown. `deno task dev` and `deno task build` refresh it when the library sits one level up, and the pre-commit hook syncs and stages it (run `git config core.hooksPath .githooks` once per clone). Never edit `research/` by hand; edit the root file. To refresh by hand: `deno task sync-research`.

## Where things live

| Path | What |
|---|---|
| `../walkthrough-*.md` | The walkthroughs. The site reads them at build time; edit the Markdown and the page updates. Dietrich's route is stitched from three files (see `DIETRICH` in `src/lib/walkthrough/model.ts`) |
| `../bird-time-guide.md` | Pale Raven answers for the Field Kit |
| `../battalions.json` | Battalion catalog (tier, Authority, carrier stats, gambit, recruit towns). vite ships it as `BATTALIONS` for `[[battalion:Name]]` cards; builds name one per stage in `stage.battalion`; the Ledger Gear tab derives carriers |
| `../dishes.json` | Meal dish reactions (54 characters × 12 dishes, fortunesweave.co.uk). vite ships it as `DISHES`; `src/lib/dishes.ts` ranks dishes for a table (Perfect = all three like); the Meals tab's queue, dish check and matrix read it; `deno task dishes-md` rewrites `../dishes.md` |
| `../gifts.json` | Gift catalog (price, shops, loved / really liked). `src/lib/gifts.ts` derives the Gifts tab, chapter gift rows and `[[gift:Name]]` hover cards from it; `deno task gifts-md` rewrites `../gifts.md` |
| `src/data/world-map.json`, `public/img/map/overworld.webp` | World map for the Field Kit's Map tab: 252 places with pixel positions on the mosaic, gathering items and roads, taken from fortunesweave.co.uk/map. Place and item names in the walkthroughs link to it |
| `src/data/characters/<name>.json` | One unit: profile, growths, recruitment, class plan (`build`), stage-by-stage build guide (`guide`) and extra copies on other routes (`copies`) |
| `src/data/routes/index.json`, `src/data/routes/<route>.json` | Play order (index); per route: info, chapters, roster, extras, fillers, deployment, mechanics and the `ledger` (key decisions, Renown pace, License queues, uniques, barters) |
| `src/data/walkthrough/<route>/chNN.json` | Migrated chapters in the fixed nine-slot template (`redesign/03-data-model.md`). A chapter with a JSON file renders from it; the others still render from Markdown |
| `../part2-war.json`, `../part3-salvation.json`, `../gods.json` | Part II and III facts and the Blessing table, shipped as `PART2`, `PART3`, `GODS` (`src/lib/parts.ts`). Part III quest rewards also feed item sources |
| `src/data/walkthrough/<route>/war-chNN.json`, `salvation-sNN.json`, `squads.json` | Part II and III plans (D-124, D-126): choices only; `src/lib/part-plan.ts` loads them, `src/components/parts/` renders the War and Salvation pages and the War Prep, Squads, Temples and Diadem tabs |
| `src/data/quests/<route>.json` → `quests.gen.json` | Quest catalog per route; `deno task merge-quests` writes the merged file the site reads |
| `scripts/` | `check-content` (validator), `coverage` (migration coverage), `shots` (screenshots), `merge-quests`, `p1a_timing.py`; see `scripts/README.md` |
| `src/data/classes.json` | Class growth modifiers, including class-with-mount rows |
| `src/data/mounts.json` | Mount growths and where to catch them |
| `../run-log/stat-checkpoints.json` | Stat log (D-133): the player's logged stat screens. `#/<route>/stats` writes it through the `statLog` plugin in `vite.config.ts` (`/api/stat-log`, dev and preview only; a static copy keeps entries in the browser). `src/lib/stat-log.ts` computes the expected value from the previous entry |
| `src/data/item-tiers.json` | Weapon tier letters shown on loadout cards |
| `src/lib/` | Types, data access, growth math and the hash router |
| `src/lib/walkthrough/` | Markdown loading, chapter and group parsing, build checkpoints, checklist storage |
| `src/components/` | `home/`, `walkthrough/`, `army/`, `dossier/` pages and shared `ui/` pieces |
| `public/img/` | Portraits and key art. Portraits without transparency are detected at build time |

The shapes of every JSON file are in `src/lib/types.ts`. Editing a unit's JSON and saving updates the page while `deno task dev` runs.

## Build guide fields

A `guide` has `role`, `summary`, `playstyle`, `focus` (stats), `keys` (do this), `watch` (pitfalls), `stages`, `alt` and `sources`. Each stage has `when`, `level`, `class`, `kind` (`core`, `detour`, `fix` or `bench`), `mount`, `goal`, `exit` (when to move on), `masteries` (earned there), `training`, `tips` and `checks` (growth checks: `stat`, `at`, `need`, `why`, up to 3 `fix` patches; the page adds the expected gain from the growth row), plus the full kit for that step: `weapons`, `equipment`, `arts`, `spells` and `abilities`. Each worn piece names 1 to 2 `alts` (catalog items); the kit card shows them on every stage and tags each as spare or with who carries it then (`src/lib/holders.ts`, D-135). A lord's key item never goes in the kit: the catalog's `holder` field puts it under Inventory as always on (D-134). Each stage lists the whole kit, not just what changed; the page works out what's new, upgraded or kept, and `drop` explains what leaves the kit. The growth panel reads the stage's `class`, `mount` and `level` to pick the matching row in `classes.json`, so keep class and mount names as the game writes them. `finalists` (`stats`, `options` of `class`, optional `mount`, `use`, `note`) lists 2 to 5 candidate classes; the page computes each one's growth on those stats from the unit's growths and `classes.json`, an option with `use` is the picked class and one without it a rejected alternative (D-121).

## How the walkthrough page reads the Markdown

Write the walkthroughs as before; these conventions turn into visuals:

- `## Chapter N: Name` starts a chapter. A first line with `Free time: 3/15 to 4/10` (or `Free Time 3: 3/22-4/20`, or `No free time`) becomes the date bar.
- A `###` heading or a line that is only bold (`**Recruits**`) starts a block. Its words pick the icon: recruit, class/exam, quest, paralogue, shop, dungeon, support. `**Story battle: ...**` becomes a battle card and `**Before you move on:**` a warning card.
- `- [ ]` items become checkboxes saved in the browser. Items longer than about two lines show their first sentence and a "more" toggle.
- `> **Support focus:** ...` collapses into a strip of portraits with a Meal plan button. Other quotes collapse into notes.
- Character names get portraits and link to the unit's build; in the walkthrough a plain click opens the Units side panel on that unit instead (no unit hover cards). `(community-reported)`-style source notes become a ConfMark icon. `Support 3`/`S3`, `Renown 6`, gold (`3,000G`), dates (`5/20`, red when the text says due/ends/by) and `[MISSABLE]`, `[CARRIES]`, `[EXTRA]`, `[PART II]` become chips.
- The `## Supports: gifts and meals` section moves into the Field Kit (Gifts and Meals tabs). Tables whose cells read `Lord + A + B` draw the three seats as portraits.
- Carry-forward (D-139): every tracked task (exam, recruit, give-out, gear, quest, missable, loot dungeon) also shows in every later chapter until ticked, as a "From earlier" group at the top of its slot; dated ones stop at their due date and show once as "missed?". A task whose previous step is open (previous exam, the stage's exam, the recruit) is a dashed draft with a "Waits for" line. One list per route in `src/lib/open-tasks.ts` feeds the chapters, the Exit slot and "Still open in Part I". Spec: `../docs/specs/walkthrough-carry-forward.md`.
- Each chapter's "Joins" and "Build checkpoints" come from the unit JSON, not the Markdown: a stage whose `when` starts with `Ch N` shows in Chapter N, with the gear that is new at that stage.

## Refs and the stat glossary

- In authored JSON text, `[[type:Name|label]]` refs (unit, item, class, art, ability, quest, place, gather, mount, stat, gift) become chips with hover cards. Gift names in plain text chip automatically. A chapter's `routine.gifts[]` row names a catalog gift in `gift` (and `alt`); price and shop come from `gifts.json`. `[[stat:Prt]]` (or `[[stat:Protection]]`) opens the stat card from `../combat-stats.json`, which the `virtual:refs` plugin in `vite.config.ts` ships as `STATS`.
- `<Rich text={t} stats />` also turns stat deltas in plain text ("Prt +10", "Str/Mag +7", "Hit −30") into glossary badges. It's opt-in (synergy payoffs); without `stats`, `Rich` renders as usual. The abbreviation list is `STAT_ABBR` in `src/lib/refs.ts`.

## Pins

Field Kit › Pins (key P) lists items, gifts and gathering materials you pinned (D-108). Pin from a hover card's top-right Pin pill, a build inventory card's pin icon, or the map's gathering bar. Wrap a container in `<PinScope from={{ unit, stage, ch, slot, place, note }}>` (`src/components/ui/pin-toggle.tsx`) so pins made inside it remember where they came from. Where to get each pin is derived in `src/lib/pins.ts` from the item, gift and map data; pins are stored in `fw-state-v2` under `pins`.

## Arena

Field Kit › Arena (key A) is derived from the builds (`src/lib/arena.ts`, D-107, D-136, D-140): this week's pairs for the whole team, then "Ranks to reach", every unit's open targets with a rank picker and a "reached" tick. Every skill starts at D, so D targets never show. Reported ranks are stored in `fw-state-v2` under `ranks` and re-plan the pairs and each chapter's Routine Arena line.

## Items

Field Kit › Items (key I) is the item catalog (D-114): every row of `../weapons-and-items.json` as a card with stats, every way to get it (`pinSources`, same rows as Pins) and the units whose build stages carry it (`src/lib/item-catalog.ts`). Filters, sort and page stay for the session. New item fields shown on cards (`dur`, `curse`, `refine`, `group`) come through `ItemRef` in `vite.config.ts`.

## URLs

Hash routes keep the built site working on any static host: `#/cai` (walkthrough), `#/cai/ch/6`, `#/theodora/war/ch/3` (Part II), `#/theodora/salvation/s/2` (Part III), `#/theodora/army/war`, `#/theodora/army/salvation` (Army per Part), `#/cai/army`, `#/cai/io`, `#/cai/io/profile`, `#/theodora/stats` (stat log), `#/reserve/bertrand`, `#/later`. Keys: 1 to 4 open a lord (not on the stat log, which is typed into); in a walkthrough G (gifts), M (map), E (meals), R (raven), P (pins), I (items) and B (builds) open the Field Kit tabs, J and K step chapters and Esc closes; War adds W (War Prep), Salvation adds Q (squads), O (temples) and D (Diadem); in a dossier arrows step through units and Esc goes back.

## Redesign

The presentation rework is planned in `../redesign/` (start with its README). What the site remembers (current chapter, last place, last unit view, recent pages, recruits, classes reached, missables, quests) lives in `src/lib/track.ts` under the `fw-state-v2` key; the top bar's run menu exports and imports it.
