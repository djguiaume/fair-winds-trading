# 0109. One file per ship

**Status:** Implemented for review (2026-10-23). Requested by Guillaume; step 3 of [0093](0093-data-driven-content-and-authoring-tools.md), after goods and weather kinds ([0108](0108-goods-and-weather-kinds-as-data.md)).

## Context

A ship was spread over five places: its sailing and price numbers in `src/data/tuning/ships.json` ([0094](0094-tuning-moved-to-data.md)), its id in `SHIP_IDS`, its hull size and sections in `src/sim/hullShape.ts`, its heel factor in `src/sim/heel.ts`, and its model in its own TypeScript file (`cutter.ts`… since [0077](0077-one-file-per-ship-model.md)), which was mostly one block of numbers handed to the shared `RefinedBoat` builder. Adding a ship needed code in all of them. The [data-driven review](../reviews/data-driven/README.md) recommended one file per ship holding `sailing`, `unlock` and `model`.

## Decision

1. **`src/data/ships/<id>.json`**, one per class, loaded with `import.meta.glob`, so adding a file adds the ship. Sections: `id`, `name`, `line`, `tier`; `unlock` (`standing`, `price`, `upgradePrices`); `sailing` (the old class numbers plus `heel`); `hull` (`length`, `beam`, `depth`, `outline`, `rings`); `model` (colours, masts, booms, gaffs, jibs, cargo spots, castle, square masts, `parts`). Shipyard order comes from `line` then `tier`.
2. **One source, many readers.** `TUNING.ships` (the sim's flat `ShipClass`, still live for the `?tune` panel, same paths in `tuning-meta.ts`), `SHIP_IDS`, `HULL_DIMENSIONS` / `HULL_SHAPES` (harbour distances) and `HEEL_FACTOR` are all built from the files. `tuning/ships.json` is gone.
3. **Models are recipes.** `shipModels.ts` turns a file into a `RefinedRig` (`rigOf`) and builds it with `RefinedBoat`; the seven per-ship TypeScript files are gone. Hand-built geometry that numbers cannot describe is a named **part** in `src/render/models/shipParts.ts` (`schooner-deck`, `clipper-deck`, `hoy-deck`, `leeboards`, `fluyt-stern`, `indiaman-stern`, `gun-ports`), listed in `model.parts`. The indiaman's gun ports needed a new `hullFinish` hook on the rig (geometry cast onto the finished hull and merged into it), replacing its subclass.
4. **Where a ship is built stays in the map** (a port's `builds`, edited in the map editor): yards are per map, and the editor already edits them.
5. **The warship line's heel factors** (ketch 0.85, brig 0.75, frigate 0.65) were placeholders in `heel.ts` for ships that do not exist yet; they move to those ships' files when the line is built (Phase 5).
6. The model sheet (`models.html`) lists ships from the files, so a new file shows up there for checking.
7. How to add a ship: [docs/content/README.md](../content/README.md).

## Consequences

- No visual or gameplay change: the seven models pass every existing rig test (triangle counts, sails, cargo, upgrades, gun ports) unchanged, and the sim values are the same.
- A new ship that reuses existing parts needs no code; a new kind of part does, once.
- `tests/ship-files.test.ts` checks the files feed every reader and builds a copied, renamed ship with no code.
- Later: the `?tune` panel can export ship files, and a visual rig editor on the model sheet can edit `model` and `hull`.
