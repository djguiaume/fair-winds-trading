# 0211. The port in the harbour screen

**Status:** Proposed (2026-10-25).

## Context

Part 3 of the Phase 5 brief ([docs/phase-5/brief.md](../phase-5/brief.md), decision 0207): the
harbour screen showed every port the same way, a navy bar with the name and chips, and an empty
space under the Market rows. The art director's section 5 asked for a picture of the port at its
level with its signature colour, the keeper with a line in their voice, the town's level and next
growth, and the quay itself when nobody waits there. No hand-made pictures: the view comes from the
port's island file. The storyteller named the keepers and wrote their lines
(project file `plan/story/phase5-words.md`, section B).

## Decision

- **The picture** is the game's own scene, rendered once by `GameView.harbourPicture` from a fixed
  camera into a small JPEG (1440 × 300, drawn 1.5 × larger and scaled down), cached per port, light
  and town look; a town growing, a quest changing the land or a quality change takes it again. No
  fog, rain, storm or wind streaks; the sea keeps its tint (Fogwatch reads grey-green).
- **Three lights**: day, golden dusk and night, matching the time of day she docks
  (`harbourLight`), each taken at its clearest time of day (`harbourLightTime`). With Settings ›
  Day and night off it is always day.
- **The camera** stands off the harbour pier, a little to one side, and looks back across the pier
  at the town; numbers in `src/data/harbour-view.json`. An island file's `harbourView` places it by
  hand (`from`, `look` in the file's coordinates, `height`, `lookHeight` in radius units) and sets
  the port's signature colour (`accent`); left out, the accent is its style's first roof colour.
  Sunreach (from the lagoon up the terraces, tea-house jade) and Rimewick (along the fjord houses)
  have one.
- **The header** carries the picture behind the name and chips, the panel's navy fading out by
  45 % of the width, and a 4 px accent line. It is up to 150 px tall (19 % of the height); on short
  landscape screens and portrait phones it is a strip as tall as the name and chips.
- **The keeper** is a port's `keeper` (a `characters.json` id) in the map and sea files: the arc
  giver, Rook at Saltmere, each outpost's settler, nobody at Abbey Head and Skerry. Under the Market
  rows: their portrait framed like the Quay's, one line, the town's level and growth and what the
  next level brings (new goods, or ship upgrades at the home port). The line's state comes from the
  port's arc (`src/sim/keeper.ts`: the quests set at the port, else the keeper's own): `before`,
  `running`, `done`, and `grew` once after the town grew a level; an outpost speaks as done. The two
  lines of a state take turns from one docking to the next. Lines are
  `keeper.<person>.<state>.<n>` in `en.json` and `fr.json`.
- **The Quay tab** with nobody on it shows the picture and "Nobody waiting. Come back after the next
  tide."
- **Tools**: `npm run sea -- set port <id> --keeper <person>` and the sea editor's Keeper field;
  `npm run island -- <id> view --from x,z --look x,z --height h --look-height h --accent #hex`
  (`none` clears one, `--clear` all) and the island builder's "Harbour screen picture" fields; the
  map checks flag an unknown keeper; `npm run shots` waits for the picture before it shoots.

## Consequences

- One extra render of about 2 million pixels when she docks at a port in a light not cached yet;
  nothing per frame.
- The picture follows the real town: the ring pass (part 2) and every island change show up without
  a new picture to make. The ring ports' signatures and accents are set in their island files once
  the ring pass names them.
- The header no longer looks the same in every port, but its layout, chips, buttons and pad
  focus are unchanged; the pad's scroll padding grows with the taller header.
