# 0161. Sea editor: every sea file in the map editor

**Status:** Accepted (2026-10-24). Guillaume approved the screenshots.

## Context

The map editor ([0095](0095-map-editor.md)) edited only `src/data/phase1-map.json`, today's Windward Ring. The Phase 4 seas ([0137](0137-phase-4-biomes-and-founded-outposts.md)) live in their own files, `src/data/seas/<sea>.json`, merged round the ring by `src/data/grownMap.ts` ([0152](0152-south-sea-sunreach-layout.md)). The south sea, its fog of war chart areas ([0156](0156-fog-of-war.md)) and its founding site ([0157](0157-founding-an-outpost.md)) were therefore written by generator scripts and edited by hand as JSON. Guillaume called this a huge oversight: three more biomes are coming, and none of them could be drawn in the editor.

The route checks also took about 2.5 minutes on the grown sea, too slow for an editor that reruns them after each edit.

## Decision

**One editor, a sea picker.** The map editor is also the sea editor. A picker in the top bar switches between the *Windward Ring* (`editor.html`, unchanged) and the *Phase 4 sea* (`editor.html?sea=phase4`): the ring and every sea file as one map, the same map `?map=phase4` sails.

- **Every thing knows its file.** In the sea editor each island, shape, port, waypoint, sea mark, current, wind zone and chart area carries the sea file it belongs to (`inSea`, an editor-only tag the game ignores). The panel shows it as **Sea file** and can move a thing to another file; an island takes its port and harbour waypoint along.
- **New things go into the active sea**, picked in the sea panel (select nothing). A chart area made on the ring goes to the first sea: the ring is charted from the start and has no fog.
- **＋ New sea** makes an empty sea file. `grown.json` now lists the seas in the order they open (`"seas": ["south"]`) and `grownMap.ts` loads every file in `src/data/seas/`, so a new biome needs no code.
- **Sea-wide fields:** sea radius and charted radius (`grown.json`), each sea's name; the ring's base wind, start and home port stay in `phase1-map.json`.
- **New tools:** sea marks (buoys, the four cardinals, lights, boats, with name, turn and "on the chart"), shallows (with Max draft), chart areas (outline, name, id). The port panel gains **Founding site**. Sea marks and shallows also work on the ring.
- **Export** lists every file (`phase1-map.json`, `seas/grown.json`, each sea) as changed or same, with a download for each changed one. Files are written byte for byte like the repository's: Prettier's layout, and an object the shipped file writes open stays open. `south.json` was normalised once (`485.0` written `485`); a test keeps every sea file round-tripping.
- **Play this sea** opens `?map=edited&sea=phase4` on its own save (`fwt.editor.play.phase4.`), with edited island files and quests.
- **Import** takes a sea file (or the ring's map file) and replaces that file's things.
- **`npm run sea`** does the same edits from the command line, with the editor's own code (`src/editor/seaSteps.ts`, steps as data): `list`, `new`, `add`, `move`, `set`, `remove`, `--steps`, then the map checks and one line. **`npm run shots -- --editor ring|phase4`** photographs the editor (`--select`, `--look`, `--zoom`, `--export`, `--draft`).
- **Faster route checks, same answers.** The planner uses a binary heap and a numbered grid in typed arrays, remembers per check run whether each leg is clear and the zones' and currents' effect, skips shores far from a point by their bounding circles, and searches once from each start instead of once per port pair. Ring 5.7 s to 0.7 s, Phase 4 sea 157 s to 6 s, stress sea minutes to 5 s. The results are unchanged (a test compares one search with routes to every port).

## Consequences

A new biome is laid out like this: ＋ New sea, draw its islands, reefs, shallows, marks, currents, zones and chart areas, check, play, export. Agents can do the same with `npm run sea`. Generator scripts such as `docs/reviews/south-sea/src/make-south.cjs` are history; the data files are edited with the editor or the tool. `npm run check`, `chart` and `shots --sea phase4` pick up any sea listed in `grown.json`.

The editor's draft for the grown sea is kept separately from the ring's (`fwt.editor.seas.v1`), so the two never overwrite each other. The tag `inSea` stays out of every exported file.
