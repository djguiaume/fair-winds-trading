# 0266. Free Sailing sessions kept in memory only

**Status:** Accepted (2026-11-01), part of v1.4 (#300).

## Context

v1.4 lets the player try any ship, upgrades and look on the real sea (#300, plan "Catalogue, budgets, Free Sailing"). The risk is the voyage: one stray autosave, transfer or reward from a test sail would overwrite real progress. The game's page is built round one world and one storage chosen at boot (`main.ts`), and already sails memory-only voyages for quest tests (0142) and the benchmark (0154).

## Decision

- **A separate page load.** The title menu's **Free Sailing** row reloads the game as `?free`. That page's storage is `memoryStorage()`: it never opens the voyage's save, so autosaves, Settings › New game, the tutorial's choice and every other save path write to memory. Leaving (**Back to my voyage**) loads the plain page from its untouched save; a refresh starts a fresh session on the setup; the session ends when left. `?free` ignores `?map`, `?tune` and a transfer link.
- **What the session is.** The game's own sea (no new map), the towns, markets and land of a new voyage, no quests (no story, rewards, races or personal bests), no gold, an empty hold, the whole chart open. Docking works; with no gold nothing can be bought. Hazards, Settings and reduced motion apply as in a voyage; Settings (device preferences) are the one thing shared with the voyage.
- **Setup screen** (`src/ui/freeSailing/`), the Boat looks frame (0265): where-and-when presets at the left, the turntable boat in the middle, ship (every class) and upgrades (1 to 3 each) at the right, **Boat looks** with every item open (`everythingUnlocked`), **Set sail**. The pause menu's **Change ship or place** reopens it; Set sail restarts at the preset, and game time only moves forward. The looks tried are kept for the session only.
- **Nothing to masquerade as a voyage.** No save, export, QR or file in a session: Move your voyage and New game are hidden, a badge at sea says "nothing is kept".
- **Presets are data**: `src/data/free-sailing/<id>.json` (names, place, hour, weather kind, ship and upgrades), `rules.json` (clearance, search days). The session starts at the first game time with the preset's hour and weather, on the level and Weather setting in force (none found, the hour alone). Checks (`freeSailingChecks.ts`): clear deep water for the largest ship, outside every harbour's docking reach, inside the sea, the weather reached on every level. The editors' **Free Sailing** page and `npm run free` share `src/editor/freeSailing/doc.ts`.

## Consequences

Four presets through the day: Saltmere morning (sloop, all base), Rain off Westholm (indiaman, hauler), Fogwatch reach (clipper, swift), Night off Rimewick (cutter, all max). `npm run free -- walk` is the isolation proof in the real game: it starts a voyage, launches Free Sailing, dresses her, changes ships, pauses, restarts, refreshes and goes back, logging every storage write, and fails if the voyage's save or any non-preference key changed. Tests: `tests/free-sailing.test.ts`. Free Sailing polish beyond this (more presets, a chosen town state) is v1.4.1 (#357).
