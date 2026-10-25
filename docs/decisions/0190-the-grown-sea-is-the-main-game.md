# 0190. The grown sea is the main game

**Status:** Proposed (2026-10-25). Gap 1 of the [Phase 4 review](../reviews/phase-4-review/README.md) ([0188](0188-phase-4-review-and-release-gate.md)). [Screenshots](../reviews/grown-sea-main/README.md) for Guillaume before merge.

## Context

Since [0152](0152-south-sea-sunreach-layout.md) the four Phase 4 seas round the Windward Ring were a dev sea, reached only at `?map=phase4`, with its own save (`fwt.phase4.`), a "Phase 4 sea (… laid out)" badge and a map name of its own (`Windward Ring (Phase 4 sea)`). A normal game still sailed the ring alone. Releasing Phase 4 means the grown sea is the game: players with a ring voyage keep it, save codes (FW2, [0118](0118-compact-save-code.md)) keep reading, and the editors, tools and `?bench` work on it by default.

## Decision

1. **The game sails the grown sea.** `GAME_MAP` (`src/data/maps.ts`) is the ring with every sea file round it (`grownMap`, the sea files listed in `seas/grown.json`). The game opens on it with no `?map=`; there is no badge.
2. **It keeps the ring's name** (`Windward Ring`). The ring is unchanged in the middle, so a ring voyage resumes exactly where it was: same position, docked where it was, every port, market, quest, island and building kept. The new waters start fogged ([0156](0156-fog-of-war.md)); the seas open through the story as before (the south's letter after "Fair winds" and Watchman Key). The tutorial choice and the chart's view, keyed by the map's name, carry over too.
3. **The dev voyages still load.** `compatibleSaveMaps` lists `Windward Ring (Phase 4 sea)`; `?map=phase4` still opens the voyage kept under `fwt.phase4.`, now on the game's own sea (it resumes at the start, like any migrated save).
4. **Ring save codes still read.** An FW2 code holds lists (ports, quests, islands, currents) in the map's order with a fingerprint; the grown sea's lists are longer, so a ring code does not fit them. `readSaveCode` takes the maps the world's map grew from under the same name (`PHASE1_MAP` from the transfer panel): when the grown sea cannot place a code, it is read with the ring's lists and then checked against the grown sea, which has every id it names. New codes are written with the grown sea's lists.
5. **The ring alone stays as a test sea:** `?map=ring`, its own save (`fwt.ring.`), a "The Windward Ring alone (test)" badge. `PHASE1_MAP` stays the ring for the tests.
6. **Editors and tools default to the game's sea:** the map editor opens the sea editor (the ring alone at `editor.html?sea=ring`; the picker says "The game's sea" / "Windward Ring alone"); the quest builder's "Play from step" links play on the grown sea (`&sea=phase4`, with the sea editor's working copy if any); `npm run chart`, `shots` (`--sea phase4`, also `game`; `--editor` bare is the sea editor) and `quest` default to it; `npm run check` already checked it. `?bench` runs on it (its route is round the ring, which every sea keeps).
7. **`npm run balance` and the `?tune` balance panel stay on the ring for now.** On the grown sea the bots trade with every far port from the first minute, so 8 of 19 checks fail ([review](../reviews/phase-4-review/README.md), gap 3). They switch once the "Balance the grown sea" thread makes the bots open the seas in story order; `--map phase4` runs them there meanwhile.
8. **Two small fixes the new players would meet:** the moored "<island> · your island" title sits under the destination pill instead of behind it (landscape and desktop; narrow screens and portrait already place it elsewhere), and the chart's market lists a far good only once a port on the chart sells or makes it, or one is in the hold (`farGoodsOnChart`).

## Consequences

- A new game and every existing voyage now see the four seas; the outer seas' gaps in the review (east story, balance, art musts) are now gaps of the game, not of a dev sea.
- A code made on the grown sea does not read in an older build (as with any new version); a ring code reads in both.
- If a sea file ever changes a ring id, ring codes would stop reading: the ring's ports, islands and currents stay first and unchanged (tested in `tests/grown-sea-game.test.ts`).
- The chart-label collisions and wind-zone names over uncharted water stay with the "Fogwatch south tier and outpost fixes" thread.
