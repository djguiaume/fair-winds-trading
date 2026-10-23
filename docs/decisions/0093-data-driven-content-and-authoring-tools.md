# 0093. Data-driven content and authoring tools

**Status:** Accepted (2026-10-23). Guillaume, after a game-dev friend's advice ("build the tool first, then you can edit everything yourself and the game is data driven"). Review: [docs/reviews/data-driven](../reviews/data-driven/README.md).

## Context

The world is already data: the map, ports, town levels and productions live in `src/data/phase1-map.json` ([0008](0008-static-map-seed-ready.md)), and all player text in the translation files ([0037](0037-english-and-french-translations.md)). But about 110 tuning constants across 20 `src/sim` files, the 7 ship classes and the 3 difficulty levels are TypeScript constants, and adding a good, a ship or a weather kind needs code. The only way to change any of it is to ask Claude. Ship models are already mostly parameters handed to the shared `RefinedBoat` builder ([0077](0077-one-file-per-ship-model.md)); only deck details are hand-written geometry.

## Decision

1. **Tuning lives in data.** `src/data/tuning/*.json` (ships, upgrades, goods, economy, difficulty, weather, seamanship), read through one live `TUNING` object so values can change at run time. A `tuning-meta.ts` file gives each value its label, range, step, unit and help, and drives the tools. This first step changes no gameplay; a test proves every moved value equals the old constant.
2. **Content lives in data too.** Goods, town levels, weather kinds and difficulty levels are lists in data files, with ids coming from the data and checked at load and in tests.
3. **One file per ship**: `src/data/ships/<id>.json` with `model` (hull, rig, colours, cargo spots, deck details picked by name from a shared library), `sailing` (polar and handling) and `unlock` (yard port, deliveries, price, optional extra conditions such as a town level or owning the tier below). A ship may start from another with `"base"`. The yard moves from the map's `builds` into the ship's `unlock`. Models stay recipes for the shared builder (keeps code-built art, [0016](0016-game-models-style-d-and-b2.md), and free sail trim, reefing, heel and upgrade looks); a glTF model for a special ship stays possible later. A genuinely new kind of part is coded once into the shared library.
4. **Authoring tools, static on GitHub Pages and lazy-loaded so players download nothing extra:**
   - **Tuning panel** in the game with `?tune`: every value live, per-value reset, changes counter, export JSON, share link/QR (same packing as [0066](0066-move-voyage-between-devices.md)), draggable polar. Style D, touch-first so it works on the tablet. Changes are kept in that browser only, in `?tune` mode only.
   - **Map editor** page `editor.html`: drag islands, ports, waypoints and coastline points, edit port properties, run the map checks the tests run, play the edited map, export the JSON.
   - **Balance check** in the panel: the economy simulation of `tests/economy-balance.test.ts` run in a worker on the edited values.
   - Later: the model sheet becomes the ship preview for ship files.
5. **Edits reach the game** by uploading the exported file on GitHub (a PR, CI runs every test including balance) or by handing it to Claude. Optionally later, a Save button in `npm run dev`.

Order: step 1 (tuning to data) and the map editor in parallel; then content as data (1b) and the tuning panel; then the balance check.

## Consequences

- Guillaume can tune and add content himself; Claude edits get smaller too.
- New Phase 3 numbers (fleet, routes) are born as data.
- Sim code reads values at call time instead of module constants.
- Tests become the safety net for hand edits: a change that breaks economy targets or a map check turns the PR red.
- Physics, new 3D part kinds, the tutorial flow and new mechanics still need code.
