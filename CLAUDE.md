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
- `npm run chart`: the labelled map (PNG + SVG) Guillaume must see with every map or layout change, drawn by the map editor's chart code from the real map and island files: coasts, ports and names, reefs, banks, shallows, sea marks, currents, wind zones, a legend panel. `--sea ring|stress|phase4|file.json` (an editor export, or a sea file merged round the ring), `--around sunreach --radius 300` or `--view w,s,e,n`, `--route start,sunreach` sails a leg with the route checks' planner, `--overlay file.json` adds proposed islands, areas, routes and labels ([docs/tools/chart.md](docs/tools/chart.md)), `--out path`. Use it instead of a drawing script.
- `npm run fw`: lists every tool. Tools still being built (0153): `shots`, `island`, `quest`.

If a tool lacks something, add it to the tool (and move the logic into the shared module the editor uses), rather than writing a script in `docs/reviews`.
