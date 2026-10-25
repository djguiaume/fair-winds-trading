# 0193. The east sea's story and the Four winds closing beat

**Status:** Proposed (2026-10-25). Storyteller approved the cards (2026-10-25); waits for the art director and Guillaume's look at the portraits, cards and new looks.

## Context

The east sea (Fogwatch, [0173](0173-east-sea-fogwatch-the-stepping-stones-and-fog-banks.md)) was built without its story. The head storyteller wrote its step table and the Phase 4 closing beat in the brief ([docs/story/storyteller-brief.md](../story/storyteller-brief.md), "The east sea, step by step" and "The closing beat: Four winds"). Guillaume asked whether every person has their own voice, as Rook has in the prologue; Bram's voice was too close to Rook's. The Phase 4 review found that Amber Strand never grows: it was the same empty beach at levels 1 to 3.

## Decision

**Three arcs and a closing beat, all data** (`src/data/quests/`, text in `src/i18n/en.json` and `fr.json`):

| Quest | Steps | Gold |
|---|---|---|
| `westholm-letter` (Maren, Westholm; starts once `westholm-mill` and `watchman-passage` are done, decision 0194) | `chart`: dock at Fogwatch, charting the Stepping Stones and Fogwatch Waters | 350 |
| `fogwatch-amber` (Elias Morrow) | `fish` (8 smoked fish), `way` (a card with Elias's Stormbreak line and a "Which way?" button), `strand` (reach 692, 452 off Amber Strand under 3 kn, held 3 s; charts Amber Reach), `light` (8 lamp oil) | 400, 450, 650 |
| `outpost-east` (Elias; Pip Holt speaks the settler and done cards) | `supplies` (land 8 timber and 6 planks at 688, 465 under 2 kn), `settler` (carry `pip` from Fogwatch) | 450, 600, then `found: ["amber-strand"]` |
| `four-winds` (Rook, a main quest; starts once all four outposts are founded) | `home`: moor at Skerry | 300 |

- Every card is at most about 220 characters in English. Elias's Stormbreak line needed its own card, so the arc has a `way` step with one "continue" option, as the prologue splits Rook's talk.
- Maren's letter says "the mill has its sails again", not "the mill's turning": the brief's Westholm rule says no line promises that the mill turns.
- **People:** Elias Morrow (amber carver) and Pip Holt (settler) in `characters.json`, low-poly portraits as data (0124), with their own babble voices in `audio.json`: Elias slow, soft and low (vowels `eu`, little wobble, volume 0.8), Pip quick and bright like her cousin Maren but not the same (vowels `iae`). Bram drops to pitch 0.74 with vowels `aeo`, away from Rook's `oau`.
- **New looks:** `amber-workshop` (Elias's workshop on Fogwatch's front row, facing the camera: red shutters closed `before:fogwatch-amber`, and `amber-workshop-lit`, a lamp in an amber window, `after:fogwatch-amber`); a `signpost` on Skerry's pier, arms tipped in the four seas' colours, `after:four-winds`. The workshop takes the place of one turf house, and Fogwatch drops three of its seventeen sheep to stay inside its 6,000-triangle budget (5,974). The foghorn's lamp stays as it is: lit or dark, it doesn't read from the game camera.
- **Amber Strand grows:** a hut, two drying racks, crates, a lamp, the flagpole and name board at level 1; two houses, a drying shed, a beached boat at level 2; a pier, a boathouse and two houses at level 3.
- **Engine, generic:** `questsFor` also leaves out a quest that starts after a quest this map can't run (`questsIn` lists the quests a condition names), so `four-winds`, which names no port, stays off the ring sea like the arcs before it.

## Consequences

- Phase 4's story is complete on the grown sea: four letters, four keepers, four outposts, then Rook's "Four winds" at Skerry.
- The quest builder edits all four quests, and `npm run quest -- check <id>` passes for each; `tests/arcs/east-sea-story.test.ts` plays the arcs through in a sloop.
- Gold follows the west and north, a little higher for the last sea; `npm run balance` passes on all three levels (the bots don't play quests).
