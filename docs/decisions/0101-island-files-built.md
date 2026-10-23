# 0101. Island files built: the four port islands come from data

**Status:** Implemented for review (2026-10-23). Step 2 of [0096](0096-island-files-and-island-builder.md) (accepted); step 3 is the island builder UI. Plan: [docs/island-builder](../island-builder/README.md). File format: [docs/island-builder/files](../island-builder/files/README.md).

## Context

0096 decided one JSON file per designed port island and a builder to edit them, in two steps. Step 2 moves Port Calda, Saltmere, Westholm and Stonehaven out of `islandLayout.ts` and `towns.ts` with no visible change, so the builder has files to edit.

## Decision

- **Files.** `src/data/islands/calda.json`, `saltmere.json`, `westholm.json`, `south-cay.json`, loaded by `src/data/islands.ts` (types, `islandDesign(id)`, `designOf(island)`). The map's island entry names its file: `"look": { "design": "calda" }`; `prepareMap` sets the island's `profile` from the file's `style`. An island with only a `profile` (the model sheet, tests) is built from that style's shipped file. Format as in 0096 §1, with these details settled by the bake:
  - Ground that is a coast's beach inset says `"coast": 0` (the 0.085 beach rule stays in code, `BEACH`); other ground is an `outline`. Port Calda's main ground, whose beach widens under the log yard, is a baked outline. `"shape": "peak"` with `"base"` draws a rock cone (Calda's mountain, Stonehaven's stack).
  - Stonehaven's quarry bench that changes per level is four ground entries with `from`/`to`.
  - Lanes: plain lanes (revealed near standing homes), Stonehaven's `path` (with `y`) and its `stairs` (`[x, z, height]` points, `base`, a landing at each bend).
  - Props: `type`, `x`, `z`, `turn` (degrees), `size`, `variant` (colours or a count), `shape` (0 to 1, the proportion a model used to draw at random), `from`, `to`, and optional `y`, `fit` (footprint for the checks), `clear` (how far round it the woods are cleared) and `tags` (`workshop`, `windmill`, `log-yard:shore|upland`, `outbuilding`). Heights are automatic: the ground under the prop, else the sand, else the sea. Homes are the home types in file order (the residence numbers), revealed 3 · 10 · 21 · 32 as before; Saltmere's islet house is a fish house tagged `outbuilding`.
  - Woods: `tree`, `tries`, `area`, `size`, `margin`, `spacing` (and per height `spacingAt`), `clear` circles. The rules that stay in code: no trees on rock or where the grown quarry will be, none in the arrival lane, cleared by homes, lanes, props and fields.
- **Prop catalogue** `src/render/models/props.ts`: the town models moved out of `towns.ts` unchanged, and `PROP_TYPES`, 41 ids in groups (homes, town, timber, fish, farm, stone, nature, landmarks) with their footprint and flags (`home`, `building`, `water`, `edge` for slipways, rails and paving that may overhang a ledge or the water).
- **One builder.** `designedTownParts(design, R, level)` in `towns.ts` replaces `characterTownParts`, its per-kind branches, `characterTownPlan` and `characterStreets`. `islandLayout(design, level)`, `characterPiers(design, …)` and the new `islandMoorings(design, level)` read the file, so collision, docking, the chart and the water use it too. The yards and scenery islands keep the generated look.
- **Bake, then proof, then removal.** `tools/bake-islands` ran the old code (a legacy copy in `tests/helpers/legacy`) and wrote the files. `tests/island-files-proof.test.ts` matched every part the old code drew to a part from the files, for the four ports at levels 1 to 4: same vertex count, colours and game hooks, positions within 1e-4 reference units (files keep six decimals), and the same coasts, lake, ground, piers and moorings. It passed in CI on commit cc1fd8a of PR #78, then the legacy copy, the proof and the bake were removed (they stay in that commit). Model-sheet pictures before and after: same triangle count (69,656), 2 to 7 pixels in 1.4 million differ (edge pixels; the parts are drawn in a slightly different order).
- **Checks** `src/sim/islandChecks.ts` (`checkIsland(design, kit)`), with the model-dependent parts passed in by `islandCheckKit(design, R)` from `towns.ts`, implement 0096 §2: known types and levels; land props on land, on one ground level (not on a cliff edge) and out of the lake, beach props with their centre on the sand; water props in the sea; nothing in the arrival lane or on a side pier over the water; ground and lake inside the coast; homes never removed, removed props replaced; buildings overlapping (warning); lane pieces over water or cliffs (warning, not drawn); 6,000 triangles at level 4 (warning above 5,000). `tests/island-files.test.ts` runs them on the shipped files (no errors; warnings only for lanes and Calda's 5,050 triangles) and on broken copies, and keeps golden geometry hashes per island and level.

## Consequences

- Guillaume can already move a house or a woodpile by editing a file, and the builder (step 3) has a format, a catalogue and checks to work with.
- Houses are fixed: a change to an old seeded rule no longer reshuffles them. Stonehaven has 23 homes (the old plan's 28 plots minus the five the masons' yard and keep always took); `island-layout.test.ts` now checks the files' homes instead of the removed plan generator.
- The golden hashes change with any deliberate island, model or builder change: look at the island, then paste the new values.
- Calda is at 5,050 triangles at level 4 (0096 counted 5,018 without the docks), inside the 6,000 budget.
- Slopes (0096 §4) are not in the files yet; they come with the builder.
