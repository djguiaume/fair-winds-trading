# 0134. The epilogue: "Fair winds"

**Status:** Implemented (2026-10-24). Guillaume chose an ending after the four arcs ([0129](0129-storyteller-brief.md), 2026-10-23) and said to build it (2026-10-24). Written and built by the head storyteller.

## Context

The four community arcs (Saltmere [0130](0130-after-a-quest-and-the-saltmere-shoals.md), Port Calda [0131](0131-calda-slipway-and-cargo-at-a-spot.md), Westholm [0132](0132-westholm-mill-and-babble-voices.md), Stonehaven [0133](0133-stonehaven-light-arc.md)) can be played in any order. Without an ending, the story would stop when the last arc's thanks card closed. The storyteller brief planned a short epilogue: Rook and the four people come to Skerry, the island gets a visible mark, and the sandbox carries on.

## Decision

1. **One quest, `fair-winds`** (`src/data/quests/fair-winds.json`, giver `rook`). It starts once all four arcs are done (`all` of four `quest-done`). It has one step, `home`, whose goal is being moored at the home island, and it pays 200 gold.
2. **No card port.** Neither the quest nor its step names a port, so Rook's card shows as soon as the quest starts, wherever the captain is, right after the last arc's thanks: "Come home to Skerry". His thanks shows as soon as the captain moors there: everyone came, and the Fair Winds Trading Company is "entered in the book". The text is in `en.json` and `fr.json` (`quest.fair-winds.*`).
3. **A new condition, `moored`** (`island`, optional, default the map's home island): moored at the pier of one of the captain's islands. Docking at a home island is not a port dock (`dockedAt` stays empty), so `docked` with `port: "home"` means the map's home port, Saltmere. The new condition is generic and works for any island with build spots ([0128](0128-build-spots-on-any-island.md)).
4. **The visible mark is data:** two new generic props, `flagpole` (a two-colour flag; `variant` picks the colours) and `name-board` (a board on two posts). Both stand on Skerry tagged `after:fair-winds` ([0130](0130-after-a-quest-and-the-saltmere-shoals.md) hook), clear of the build spots and the harbour approach.

## Consequences

- The story has an ending, and play carries on in the sandbox afterwards. The journal shows the quest under Rook.
- Skerry's golden geometry hashes in `tests/island-files.test.ts` change on purpose, because the two props are in the file.
- Any later island can reuse `moored` and the two props, for example an extension's island ([0128](0128-build-spots-on-any-island.md)).
- Screenshots: [docs/reviews/fair-winds](../reviews/fair-winds/README.md).
