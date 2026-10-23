# 0133. The Stonehaven arc: a step's speaker, Teeth Rock and "A light on the Teeth"

**Status:** Implemented for review (2026-10-23), in two parts. Part 1: the step `speaker` and the Teeth Rock island. Part 2: the arc's quest file and text. The story is decided in the [storyteller brief](../story/storyteller-brief.md) ([0129](0129-storyteller-brief.md)) and the [community arcs](../story/community-arcs.md) story ([0122](0122-community-arcs-story.md)); this record covers the engine and map pieces the brief gives this thread, and the places chosen. ADR numbers 0130 to 0132 go to the Saltmere, Calda and Westholm arcs.

## Context

Ada Flint, the mason at Stonehaven, wants a lighthouse on the Teeth, the rocks at the west end of the south-west reef. You bring timber for the scaffold, carry stone blocks out to the rock, then find Old Ness at Watchman Key and bring his lens. Two things the brief gives this thread were missing:

- **Someone other than the giver speaks a card.** Old Ness speaks the Watchman Key step of Ada's arc, and Rook speaks one line at the Calda launch. The card always showed the quest's `giver`.
- **Teeth Rock did not exist.** The approved story puts the lighthouse on a rock at the west end of `sw-reef`; the map had only the reef.

## Decision

1. **A step's `speaker`** (a `characters.json` id) shows that person on the step's card instead of the giver: their portrait, name and role line, with the step's `mood` and `look` read as theirs. The journal, the pins on the chart and the thanks card stay the giver's, because the quest is still theirs. `checkQuests` now refuses a `giver` or `speaker` that `characters.json` lacks, and a step `look` the person doesn't have.
2. **Teeth Rock** is a new island file, `src/data/islands/teeth-rock.json` (style stone, no port), and a map island `teeth-rock` at **x −226, y −80, radius 9**, just past the reef's west tip (−210, −74), so the reef and the rock read as one line of teeth. Its landing faces west, away from the reef (`harbourBearing` 3π/2). It is bare rock in two shelves with six boulders on the reef side, and an **unlit day mark** (beacon variant 1, [0121](0121-lighthouse-and-beacon-night-lights.md)) on top where the lighthouse will stand.
3. **The beacon light test** counts only lit beacons, since a shipped island now has an unlit day mark.

## Consequences

- Any later arc can let a neighbour speak one step without code.
- Teeth Rock is solid, charted and drawn like any island file; the reef's own outline is unchanged, so the prologue and the reef tests are untouched.
- Part 2 adds the lighthouse (variant 0, the classic Saltmere sweep, tagged `after:stonehaven-light` with the after-a-quest hook of 0130), the arc's quest file and its text.
