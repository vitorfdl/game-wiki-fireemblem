# Content scripts

Plain Node ESM (`.mjs`), Node 22 built-ins only. Every script also runs under Deno with `deno run -A`. Run them from `site/`.

| Script | What it does |
|---|---|
| `check-content.mjs` | Validator from `redesign/03-data-model.md` §7: chapter files, quest ids, route ledgers, unit builds, `[[refs]]` |
| `coverage.mjs` | Coverage checker from `redesign/06-agent-playbook.md` §4 and §5: every source block and sentence has a report entry, facts survive, drops stay under 15% |
| `shots.mjs` | Per-chapter screenshots of a running site in Brief and Full mode, for the P5 reviewers |
| `merge-quests.mjs` | Merges `src/data/quests/<route>.json` into `src/data/quests.gen.json` |
| `gift_rows.py` | Regenerates `routine.gifts` for Leda and Theodora from `gifts.json`, rosters and fillers (D-97): `python3 scripts/gift_rows.py write` |
| `gifts-md.mjs` | Writes `../gifts.md` from `../gifts.json` (the gift catalog the site derives picks from) |
| `lib/content-data.mjs` | Shared loaders and the ref resolver (mirrors `src/lib/refs.ts`) |

## check-content

```sh
node scripts/check-content.mjs                 # all routes, all units
node scripts/check-content.mjs --route cai     # one route: its chapters, ledger and the units on it
node scripts/check-content.mjs --strict        # warnings fail too
node scripts/check-content.mjs --verbose       # list each over-long unit field instead of a count per file
node scripts/check-content.mjs --notes         # list the conf values ("?", "community", "disputed")

deno run -A scripts/check-content.mjs --route cai
```

Exit code 1 on errors. **Errors**: missing slot keys, chapter text over its limit (headline 110, row text 100, detail bullets 120 and at most 3, recruit action 100, callout text 100, key decisions 90 and at most 5, battle tips at most 4), unresolved `[[refs]]`, quest ids with no entry for the route, tracked rows without an id, ids off the grammar (`<route>-chNN-<slot>-<slug>`), duplicate ids, recruit rows for units that join automatically, License rows with no matching stage, too many Part I Advanced rows, stages without `from` or out of order, builds that don't reach Part III. **Warnings**: unit JSON text over its limit (goal, exit, when, gear why, gate text, decision why; P3 shortens these), License rows whose chapter differs from the stage, chapter `free` that disagrees with `routes/<route>.json`, a recruit or quest row repeated across chapters, `task: true` outside missables and explore, REVIEW left in coverage reports.

## coverage

```sh
node scripts/coverage.mjs cai --init                    # writes redesign/reports/cai-chapters.coverage.json, every entry "todo"
node scripts/coverage.mjs cai --init --agent P3-builds  # writes cai-builds.coverage.json instead
node scripts/coverage.mjs cai                           # checks all redesign/reports/cai-*.coverage.json together
node scripts/coverage.mjs cai --facts                   # also checks dates, gold, Support, Renown, Lv and ranks reach the dest file
node scripts/coverage.mjs cai --chapters 6,7            # only those chapters' blocks
node scripts/coverage.mjs cai --all                     # print every failure, not the first 60

deno run -A scripts/coverage.mjs cai --facts
```

Blocks are cut the way `migmap.py` cut `05-migration-map.md` (Cai 170, Dietrich 167, Theodora 173, Leda 179). Dietrich reads three files: `walkthrough-part1-dietrich.md` (route plan, Ch 1 to 3), `walkthrough-dietrich-ch4-9.md` and `walkthrough-dietrich-ch10-12.md`. Sentences are list items, table rows and paragraphs, split on `. ` before a capital; each is hashed as the first 10 hex of sha1 over the whitespace-normalised text. `--init` refuses to overwrite a report unless you pass `--force`.

Fill each entry with `status` (`moved`, `derived`, `merged`, `dropped`), `dest` (a path under `site/src/data/`, for example `walkthrough/cai/ch06.json#recruits`; an array is fine) and, for drops, `reason`. A dropped sentence may not hold a date or a Support or Renown gate. A derived sentence with "only if" or "unless" must point at a stage `exit`, `why` or `gates` entry.

## shots

Serve a build first, on a port of your own:

```sh
npx vite build --outDir /tmp/my-dist          # or: deno task build
cd /tmp/my-dist && python3 -m http.server 8743 &
```

Then:

```sh
node scripts/shots.mjs cai --url http://localhost:8743/ --chapters 6,7 --out /tmp/shots
deno run -A scripts/shots.mjs cai --url http://localhost:8743/   # first time: deno run -A npm:playwright install chromium
```

Images go to `redesign/shots/<route>/new/` by default, named `<route>-chNN-brief.png` and `-full.png`, clipped from `#ch-N` to `#ch-(N+1)`. Playwright is found as the local `playwright` package, then `/opt/npm-tools/node_modules/playwright`, then `npm:playwright` under Deno. Without Playwright the script prints a notice and exits 0.
