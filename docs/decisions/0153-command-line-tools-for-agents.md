# 0153. Command-line tools for agents, built on the editors' code

**Status:** Accepted (2026-10-24); Guillaume picked all seven tools. Part 1 built: `fw` entry, `check`, `adr`, `balance`.

## Context

Guillaume asked whether the agents (Claude threads) should use the tools we made for him (map editor, island builder, quest builder, tuning panel) when they author islands, props, quests and the rest, and which way costs the fewest tokens, is fastest and lasts longest.

Today threads write the JSON data files directly (0093) and run `npm test`. That part is cheap. What costs time and tokens is the work around it, which every thread writes again from scratch:

- **Screenshots.** The repository holds **43 Playwright scripts, 3,443 lines** (`docs/reviews/*/src`, `docs/screenshots`, `docs/ui-refactor`, `tools/ship-models`), plus 948 lines on the south sea branch. Nearly all of them do the same things: start Vite, launch Chromium with SwiftShader, seed `fwt.settings.v1` (no hints, no night, language), click `#menu-play`, `#set-sail`, `#tutorial-free`, `#tp-undock`, move `fwt.world.boat` and `fwt.view`, and shoot desktop, landscape and portrait. Each one is 30 to 350 lines and usually needs a few runs to get right (wrong button, page not ready, boat on land).
- **Maps and schemas.** Guillaume must see a labelled map with every visual change (rule of 2026-10-24). `phase-4-map/src/make.cjs` (362 lines), `far-goods/src/make.cjs` (136) and `south-sea/src/make-schema.cjs` (136) each redraw the sea from `phase1-map.json` by hand.
- **Generating content.** Island coasts, plateaus and props are written by one-off generators (`south-sea/src/make-south.cjs`, 691 lines; `home-island/src/home-island.py`), outside the builder's own functions, so the island builder's checks only run later in the tests.
- **Checks.** The editors' checks (`quickChecks`, `flowChecks`, `routeChecks` in `src/sim/mapChecks.ts`, `checkIsland` in `src/sim/islandChecks.ts`, `checkText`/`checkPlaces` in `src/editor/quest/doc.ts`, balance in `src/sim/balance.ts`) only run inside the editor or inside the full test suite, which takes minutes and has run out of memory on threads (`--maxWorkers=2`).
- **Decision numbers.** Parallel threads pick the same ADR number and renumber later (0078/0079, 0148/0149, 0149/0150).

Three ways were weighed:

| | Tokens | Speed | Future proof |
| --- | --- | --- | --- |
| Agents click through the editors in a browser | Highest: a screenshot per step | Slowest | Breaks when the layout changes |
| Agents keep writing JSON and one-off scripts (today) | Low for data, high for the scripts around it | Medium; scripts are debugged again each time | Scripts rot in `docs/reviews` |
| **Small command-line tools on the editors' code** | Lowest: one command line replaces a script | Fastest; known to work | Editor and tools share code, a fix or feature lands in both |

## Decision

Keep writing the data files directly, and add a small set of command-line tools that agents (and Guillaume, if he likes) run with npm. Rules for all of them:

1. **One entry point**, `npm run fw -- <tool> …` (`tools/fw/fw.mjs`), with a short npm alias per tool. It loads the game's TypeScript through Vite's server-side loader, so the tools import the same modules as the editors and the game (`src/sim/mapChecks.ts`, `src/editor/island/doc.ts`, `shapes.ts`, `src/editor/quest/doc.ts`, `src/sim/balance.ts`) with no copy. Tested: loading the ring and running the quick map checks takes about 1 s.
2. **Short output by default** (a pass line, or one line per problem); `--json` for detail; images and files go to `--out`, never to the terminal. That keeps token cost low.
3. **No game logic in the tools.** When a tool needs something the editor does not export yet, it is moved into a shared module first, so the editor uses it too.
4. Each tool has a test, and `CLAUDE.md` says when to use which.

### Proposed tools, ranked

Savings are estimates from the scripts above, per use.

| # | Tool | What it does | Saves | Effort |
| --- | --- | --- | --- | --- |
| 1 | `npm run shots` | Standard real-game screenshots: starts Vite, picks the sea (`ring`, `stress`, `phase4`, or an edited map file), places the boat (`--at x,y`, heading, zoom, sail), or docks at a port, opens the chart or a quest from a step, sets language and switches (night, storms, zones), shoots `desktop,landscape,portrait`. Several shots from one small JSON list. | Biggest: replaces a 30–350 line script and its debugging runs (often 5–15k tokens and 10–20 min) with one line | Medium |
| 2 | `npm run check` | Every content check without the full test suite: map checks (quick, flow, routes) for each sea, island checks for each island file, quest text and places, prop and ship files; `--only islands/sunreach` to narrow it | Large: seconds instead of minutes, no out-of-memory, and short output | Small |
| 3 | `npm run adr` | `adr next` reads `origin/main` and every pushed branch and prints the next free number; `adr new "Title"` writes the file from the usual template and adds its line to the README | Small each time, but stops the renumber-and-merge rounds | Very small |
| 4 | `npm run chart` | A labelled map image (PNG and SVG) drawn from the real map and island files: coasts, ports, sea marks, currents, wind zones, routes, plus an optional overlay file of proposed places; the "map and schema" Guillaume must see | Large for map and layout work (replaces 130–360 line drawing scripts) | Medium |
| 5 | `npm run balance` | Leg times, pace and economy checks on all three difficulties (Guillaume's rule) as one short table, for a sea or an edited map | Medium | Small |
| 6 | `npm run island` | Island files with the builder's own functions: new island from an outline or a seeded blob, add plateau, mountain, lake, ramp, lane, woods, spots, props by type and level, tidy, then run the builder's checks; prints a one-line summary | Large for new seas (Phase 4 has four), replaces 700-line generators | Medium |
| 7 | `npm run quest` | `quest check <id>` (the quest builder's checks), `quest play <id> --step N` (prints the play-from-step link and, with `--shots`, takes the screenshots of tool 1) | Medium for the story threads | Small, after 1 |

Not proposed: driving the editors' pages in a browser (most expensive, as above), a sound tool (music and sounds are JSON already, 0099, and need a listener, not a check), and `perf` (exists, `npm run perf`, 0102).

**Recommendation:** build 1, 2 and 3 first (the work every thread repeats), then 4 and 5, then 6 and 7 when Phase 4's seas are built. Guillaume picks.

## Consequences

Threads write a command line instead of a script, so they spend fewer tokens, finish sooner and produce screenshots that look alike from one thread to the next. The editors and the tools share one code base, so a new check or a new prop type shows up in both. The one-off scripts in `docs/reviews` stay as records of past reviews; new reviews use the tools. The tools are one more thing to maintain: each has a test, and the entry point stays small. Agents still read and write the JSON data files directly; the tools do not hide them.

## Update (2026-10-24): Guillaume picked all seven; part 1 built

Built first, as the base the others use:

- `tools/fw/fw.mjs` (`npm run fw`) lists and runs the tools; `tools/fw/lib.mjs` holds the Vite loader and the argument parser.
- `npm run check` (`tools/fw/check.ts`): map quick checks on the ring and the stress sea, route sailing on the first sea (about 7 s; `--all-routes`, `--fast`), island checks for each island file at its size on the map, the quest builder's checks and the perks. The whole run takes about 10 s. The quest builder's checks moved into `questProblems` in `src/editor/quest/doc.ts`, which the builder's Checks panel now calls too.
- `npm run adr` (`tools/fw/adr.mjs`): next free number across origin/main and every pushed branch; `new "Title"` writes the file and README line.
- `npm run balance` (`tools/fw/balance.ts`): `economyRun`/`economyChecks` and `difficultyRun`/`difficultyChecks` of `src/sim/balance.ts`, one line per level and the failing checks, about 10 s; `--legs` prints only leg times.
- `CLAUDE.md` tells agents when to use them; `tests/fw-tools.test.ts` covers them.

The other four (shots, chart, island, quest) are built in parallel threads on top of this base.

## Update (2026-10-24): `npm run chart`

- `npm run chart` (`tools/fw/chart.ts`, [docs/tools/chart.md](../tools/chart.md)) draws a sea with the map editor's own `drawChart` (`src/editor/chart.ts`, run in Node on a happy-dom document) and its CSS, so the picture matches the editor; Chromium only turns the SVG into a PNG. Seas: `ring`, `stress`, `phase4`, an editor export, or a sea file merged round the ring (it replaces the shipped sea with the same id). A side panel holds the title and a legend of what is in view. `--route a,b` sails a leg with `sailRoute` (the route checks' planner) and prints its time; an overlay JSON adds proposed areas, islands, lines and labels.
- Shared code moved, no copy: sea marks are drawn by `seaMarkShape` in `src/ui/chartMarks.ts`, used by the sea chart, the map editor (new **Sea marks** layer, on) and the quest builder's map. `drawChart` takes an optional size and uses the SVG's own document, so it runs without a browser. Island names on the editor's chart now sit above the coast, not the island's radius (a ring-lagoon island's radius is far above its land).
- Replaces the drawing scripts `docs/reviews/phase-4-map/src/make.cjs`, `far-goods/src/make.cjs` and `south-sea/src/make-schema.cjs` for new work; they stay as records.

## Update (2026-10-24): `npm run island`

Built in its own thread (brief 3), replacing one-off island generators such as `docs/reviews/south-sea/src/make-south.cjs` and `docs/reviews/home-island/src/home-island.py`:

- **Steps as data** (`src/editor/island/steps.ts`): each step (`islet`, `plateau`, `mountain`, `lake`, `ramp`, `lane`, `path`, `stairs`, `woods`, `spot`, `prop`, `pier`, `remove`, `set`) is one of the island builder's own edits from `doc.ts` and `shapes.ts`, written as a small JSON object, so a whole island can be kept as a list of steps. Heights left out are taken from the ground under the point, as the builder does when you click. An error names the step by number, and nothing is written.
- **Moved into the builder's modules**, so the builder can use them too: `blobOutline` (a seeded irregular outline), `addIslet`, and sizes, heights, outlines, materials and slopes for `addPlateau`, `addMountain` and `addLake` (shapes.ts; the builder's clicks keep the old defaults); `newDesign` (doc.ts), a new island file whose woods take the tree, size and spacing most used by the shipped islands of its style.
- **The CLI** (`tools/fw/island.ts`): `new <id>` from `--outline` or `--blob`, then one step per call or `--steps file.json`; `tidy` and `check`. It writes with `tidyDesign` and `formatIslandJson` (the builder's export), runs `checkIsland` at the island's size and harbour on the ring, Phase 4 and stress seas (`islandPlacements` and `islandProblems`, now shared with `npm run check`), or at `--radius`, and prints one line: what the file holds, homes per level, spots, woods, checks.
- **Fix to the builder's export:** `formatIslandJson` put a one-item list whose object held an outline on one line (Skerry's path), which Prettier then failed. It now breaks whatever holds a value that must break, so every exported file passes `npm run lint`. Every shipped island file writes back with the same data.
- Tested in `tests/fw-island.test.ts` (a small island made only from steps passes the checks; step errors; command-line parsing; write-back of every shipped file).

## Update (2026-10-24): shots and quest built

- `npm run shots` (`tools/fw/shots.mjs`, types in `shots.d.mts`): starts Vite listening and Chromium with SwiftShader, one fresh browser context per shot and size, seeds `fwt.settings.v1` (hints seen, music and voices off, language, night, weather, storms, wind zones, currents; by default a steady day breeze with zones and currents on, like the game), opens `?debug` and clicks through `#menu-play`, `#set-sail`, `#tutorial-free` and `#tp-undock` as a player would. A sea file is played through `?map=edited` with the file in `fwt.editor.map.v1`, island files through `fwt.editor.islands.v1`, so a thread shoots its edits before they are committed. Sizes: desktop 1280×800, landscape 844×390 and portrait 390×844 (touch). A `--list` JSON file holds many shots; command-line options are their defaults. Measured: about 7 s per shot.
- Two helpers joined the `?debug` object in `src/main.ts`, so the tool sets the scene with the game's own code rather than copying it: `fwt.place(x, y, headingDeg, sailStep)` (keeps the game's sail control in step) and `fwt.dock(portId)` (the quest test's berth, `testBerth`, then the same docking a click on the port does). `fwt.chart` is exposed too.
- `npm run quest` (`tools/fw/quest.ts`): `list`, `check <id>` (filters `questProblems` to that quest and the hooks naming it), `play <id> --step N|id` (the builder's `stepPort`, `seaStart` and `playUrl` from `src/editor/quest/doc.ts`), `--shots` (the quest test through `takeShots`, the Quay tab when docked; quest cards are kept).
- The old capture scripts in `docs/reviews/*/src` stay as records; new reviews use `npm run shots`.
