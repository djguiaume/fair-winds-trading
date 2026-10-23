# 0133. The Stonehaven arc: a step's speaker, Teeth Rock and "A light on the Teeth"

**Status:** Implemented for review (2026-10-23), in two parts. Part 1 (PR #112, merged): the step `speaker` and the Teeth Rock island. Part 2: the arc's quest file, its text and the port change. Card text approved by the head storyteller (2026-10-23). The story is decided in the [storyteller brief](../story/storyteller-brief.md) ([0129](0129-storyteller-brief.md)) and the [community arcs](../story/community-arcs.md) story ([0122](0122-community-arcs-story.md)); this record covers the engine and map pieces the brief gives this thread, and the places chosen. ADR numbers 0130 to 0132 go to the Saltmere, Calda and Westholm arcs.

## Context

Ada Flint, the mason at Stonehaven, wants a lighthouse on the Teeth, the rocks at the west end of the south-west reef. You bring timber for the scaffold, carry stone blocks out to the rock, then find Old Ness at Watchman Key and bring his lens. Two things the brief gives this thread were missing:

- **Someone other than the giver speaks a card.** Old Ness speaks the Watchman Key step of Ada's arc, and Rook speaks one line at the Calda launch. The card always showed the quest's `giver`.
- **Teeth Rock did not exist.** The approved story puts the lighthouse on a rock at the west end of `sw-reef`; the map had only the reef.

## Decision

1. **A step's `speaker`** (a `characters.json` id) shows that person on the step's card instead of the giver: their portrait, name and role line, with the step's `mood` and `look` read as theirs. The journal, the pins on the chart and the thanks card stay the giver's, because the quest is still theirs. `checkQuests` now refuses a `giver` or `speaker` that `characters.json` lacks, and a step `look` the person doesn't have.
2. **Teeth Rock** is a new island file, `src/data/islands/teeth-rock.json` (style stone, no port), and a map island `teeth-rock` at **x −226, y −80, radius 9**, just past the reef's west tip (−210, −74), so the reef and the rock read as one line of teeth. Its landing faces west, away from the reef (`harbourBearing` 3π/2). It is bare rock in two shelves with six boulders on the reef side, and an **unlit day mark** (beacon variant 1, [0121](0121-lighthouse-and-beacon-night-lights.md)) on top where the lighthouse will stand.
3. **The beacon light test** counts only lit beacons, since a shipped island now has an unlit day mark.
4. **The arc is data only** (`src/data/quests/stonehaven-light.json`, text `quest.stonehaven-light.*` in `en.json` and `fr.json`), opened with the other arcs once `rooks-thanks` is done, offered by Ada at Stonehaven:
   - `scaffold`: deliver 6 timber to Stonehaven (100 gold; Ada worried).
   - `stone`: quest cargo `stone-blocks`, 3 pieces of 5 spaces, from Stonehaven to the **Teeth Rock landing**, a spot at sea ([0131](0131-calda-slipway-and-cargo-at-a-spot.md)) at **x −239, y −80, within 6, under 2 kn, held 3 s**, on the west side away from the reef; `clean` (150 gold). A sloop (hold 10) makes two trips, a cutter one.
   - `lens`: `speaker: "ness"`, card at Watchman Key, a chart circle of 60 round it (the player discovers the hidden port), quest cargo `lens` (space 1) from Watchman Key to the same landing (250 gold).
   - Done: `homeSpot: ["spot-4"]` (waterside: Weather glass or Boathouse), Ada's thanks at Stonehaven.
5. **The port change** uses the after-a-quest tags ([0130](0130-after-a-quest-and-the-saltmere-shoals.md)): on Teeth Rock the day mark is `before:stonehaven-light` and a **lighthouse** (variant 0, the classic Saltmere sweep, [0121](0121-lighthouse-and-beacon-night-lights.md) rule) is `after:stonehaven-light`, so the light comes on as the lens is landed and you sail off; a second **derrick** (the mason's crane) stands on Stonehaven's quay `after:stonehaven-light`; the map's `marks` get a chart-only `light` star on Teeth Rock with the same tag.

## Consequences

- Any later arc can let a neighbour speak one step without code.
- Teeth Rock is solid, charted and drawn like any island file; the reef's own outline is unchanged, so the prologue and the reef tests are untouched.
- The arc is about 500 gold and one home building; it suits a cutter or hauler for the stone, but a sloop can do every step.
- `tests/arcs/stonehaven-light.test.ts` plays it through in a sloop (two stone trips, a reef touch that resets the step, Ness's card, Ada's thanks). Card screenshots: [docs/reviews/stonehaven-light](../reviews/stonehaven-light/README.md).
- Moving Teeth Rock later means moving the landing in the quest file.
