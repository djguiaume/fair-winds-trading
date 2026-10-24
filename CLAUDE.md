# Working on Fair Winds Trading

- Everything lives in this repo: code, assets, planning docs and decisions. Always document.
- Record each decision as a new file in `docs/decisions/NNNN-short-title.md` (context, decision, consequences) and link it from `docs/decisions/README.md`.
- Keep `docs/roadmap.md` up to date when scope or phases change.
- Reference art and inspiration go in `docs/reference/`.
- Tuning numbers and content (goods, ships, town levels, weather) belong in data files, not TypeScript constants (decision 0093).

## Command-line tools (decision 0153)

Agents write the data files directly, then use these tools instead of writing one-off scripts. They run the game's and the editors' own code (loaded through Vite), print a short result, and take `--help`.

- `npm run check`: every content check the editors run (seas, island files, quests, perks) in about 10 s. Run it after editing any data file, before the full `npm test`. `--only islands --island sunreach`, `--map file.json` for an editor export, `--fast` skips route sailing, `--warnings`, `--json`.
- `npm run adr`: the next free decision number across main **and every pushed branch**. `npm run adr -- new "Title"` writes the file and its README line. Use it instead of guessing the number.
- `npm run balance`: the balance bots on all three difficulty levels (Guillaume's rule) in about 10 s: leg times, milestones per level and the failing checks. `--legs` for leg times only, `--map file.json`, `--all`, `--json`. Run it after changing prices, ships, wind or the map.
- `npm run island`: make and change island files with the island builder's own edits, instead of a generator script. `npm run island -- new palm-key --style tropic --seed 7103 --blob r=1,stretch=1.25`, then one step per call (`plateau --at x,z --size rx,rz`, `mountain`, `lake`, `islet`, `ramp --points "x,z x,z"`, `lane`/`path`/`stairs`, `woods --at x,z --r 0.3`, `spot`, `prop palm --at "x,z x,z" --level 2`, `pier`, `remove prop 3`, `set`, `tidy`) or many at once with `--steps steps.json` (steps as data, `src/editor/island/steps.ts`). It writes the file the way the builder exports it, runs the builder's checks at the island's size on the seas (`--radius` for an island not on a sea yet) and prints one line. `--dry`, `--warnings`, `--json`. Add the island to its sea file yourself.
- `npm run chart`: the labelled map (PNG + SVG) Guillaume must see with every map or layout change, drawn by the map editor's chart code from the real map and island files: coasts, ports and names, reefs, banks, shallows, sea marks, currents, wind zones, a legend panel. `--sea ring|stress|phase4|file.json` (an editor export, or a sea file merged round the ring), `--around sunreach --radius 300` or `--view w,s,e,n`, `--route start,sunreach` sails a leg with the route checks' planner, `--overlay file.json` adds proposed islands, areas, routes and labels ([docs/tools/chart.md](docs/tools/chart.md)), `--out path`. Use it instead of a drawing script.
- `npm run shots`: real-game screenshots in one line, instead of a Playwright script (it starts Vite and Chromium itself, gets past the menu, level card, tutorial offer and harbour). `--sea ring|stress|phase4|map.json`, `--island a.json` (builder exports), `--at x,y --heading --zoom --look x,y --sail --ship --hold ArrowUp:2000`, or `--port id --tab quay`, `--chart --charted`, `--town palm-key:2` (a town's level; an empty island is founded first, 0155), `--lang fr`, `--night`, `--storms`, `--no-zones`, `--no-currents`, `--sizes desktop,landscape,portrait`, `--out dir` (default `shots/`, ignored by git). Many shots: `--list shots.json`, a JSON list whose entries take the same options as keys. Look at every image before posting it.
- `npm run quest`: `quest list`; `quest check <id>` (the quest builder's checks on that quest, `--file q.json` for a quest not in `src/data/quests` yet); `quest play <id> --step N` prints the builder's play-from-step link (local and Pages), `--sea` starts near the step's place, `--shots` takes the screenshots of that test with the `shots` options.
- `npm run fw`: lists every tool (all seven of 0153 are built).

If a tool lacks something, add it to the tool (and move the logic into the shared module the editor uses), rather than writing a script in `docs/reviews`.
