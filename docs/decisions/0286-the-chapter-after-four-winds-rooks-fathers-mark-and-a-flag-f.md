# 0286. The chapter after Four Winds: Rook's father's mark and a flag for the pier

**Status:** Proposed (2026-11-04).

## Context

Nothing happened after Four Winds (story review for v1.6). Guillaume picked the storyteller's option 2 on 2026-11-04: a short chapter, mystery first and a homecoming as the finale, 2 to 3 quests, data only. #359 left one thread to pull: each far sea washes up an oddity (sealed bottle, carved plank, tin box, brass compass) with the same unnamed mark, a star over a wave. There is no water east of the Stormbreak and no new sea in v1.6.

## Decision

Two main quests, lines in [chapter-361.md](../story/v1.6/chapter-361.md) (storyteller, EN + FR):

- `star-over-wave` (giver Ness, after `four-winds`): dock at Watchman Key, where Ness's drift lines meet in the Stormbreak's quiet; reach that spot (the same as Elias's `lull`), where the quest puts a `quest-buoy` (a new sea mark type: cream with an ink band and a lantern, recipe `mark-quest-buoy.json`; yellow stays for race marks); carry the sea chest (2 spaces) to Saltmere. Rook speaks the done card: the star over a wave is his father's mark, sent out the winter the family left Skerry. 250 + 350 a step, 400 at the end.
- `homecoming` (giver Rook, after `star-over-wave`): carry the old flag from Saltmere, then Ness from Watchman Key, to a spot at Skerry's pier (14 units round the berth, so mooring there finishes it). The others come on their own keels. 200 + 200 a step, 500 at the end.
- Skerry gains three props tagged `after:homecoming`: `old-flagpole` (a navy flag with a cream star over a cream wave, at the pier root, left of the path), `pier-feast` (a long table with a cream cloth and plates, benches, bunting and two lanterns) and a lamp post. New recipes, town group, within its budget; Skerry stays light (about 2,250 triangles at level 4).

## Consequences

- Small code changes: the `quest-buoy` mark type; a port keeper's arc (`keeperArc`, 0211) leaves out main quests, so Ness's and Rook's harbour lines still follow their own arcs, not the chapter. Nothing can fail: every step is a place or a carry; with Storms off the Stormbreak spot is plain water.
- The chapter pays 1,900 gold in all, small next to the last hour's 300 to 700 gold a minute; `npm run balance` passes on all three levels.
- `tests/arcs/after-four-winds.test.ts` plays both quests; Skerry's golden hashes changed for the new props.
