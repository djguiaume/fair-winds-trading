# 0131. Quest cargo at a spot at sea, and the Calda slipway arc

**Status:** Implemented for review (2026-10-23). Part of the community arcs ([0122](0122-community-arcs-story.md)), built to the storyteller brief ([0129](0129-storyteller-brief.md)), which gives the Calda thread this shared piece. It extends the quest engine ([0125](0125-quest-engine.md)).

## Context

Quest cargo (`carried`) could only be loaded and unloaded alongside a port. Two arcs need a place with no harbour: Ines's mast tree is loaded at a landing on **Greyback Ridge** (Calda arc, `mast`), and Ada's stone and Old Ness's lens are unloaded at the landing on **Teeth Rock** (Stonehaven arc). The brief asks for one generic piece, owned by the Calda thread, that both use.

## Decision

1. **A place is a port or a spot at sea.** `carried`'s `from` and `to` take either a port id (as before, `"home"` too) or a spot: `{ "x", "y", "within", "maxKn"?, "holdSec"? }` in map units. The boat is "at" the spot once it has stayed within `within` units, slower than `maxKn` knots, for `holdSec` seconds. It then counts as alongside for as long as it stays inside and slow, like a boat docked at a port, so a second trip loads again the same way.
2. **One more saved number.** `carried` keeps three numbers: pieces aboard, pieces delivered, and hundredths of a second held at a spot (capped at the spot's `holdSec`). Leaving the spot or speeding up sets the hold back to zero. The hold time is part of the save, so a voyage saved mid-hold goes on where it was. No shipped quest used `carried` before, so no saved progress changes shape.
3. **The checks** (`checkQuests`) refuse a spot without `x`, `y` and a `within` above zero, a non-number `maxKn` or `holdSec`, and any other field, in plain words. A string is still checked as a port.
4. **The chart follows.** The tracked step's target (`questTarget`) is a spot when the cargo is loaded or unloaded at one: the chart draws the route line and a circle of the spot's `within` there, as it does for a port.
5. **`clean`** works as before on these steps: touching a reef or shore starts the step over, so a cargo loaded at a spot is unloaded nowhere and is loaded again.

## The Calda arc, "The last keel"

The story is the brief's ([0129](0129-storyteller-brief.md)); card text approved by the head storyteller (2026-10-23). What this decision adds is where things are and the numbers:

6. **Quest file** `src/data/quests/calda-slipway.json`: giver `ines` at Port Calda, offered once Rook's thanks is done. `stone` delivers 8 stone (100 gold); `mast` carries the `mast-tree` (1 piece, space 8: a sloop's hold must be nearly empty) from the landing to Port Calda, `clean` (150 gold); `launch` carries Rook (space 0) from Saltmere to Port Calda inside par (250 gold). The quest's reward offers home spot `spot-1` (Workshop or Rigging loft).
7. **The landing** is on Greyback Ridge's south shore, at x -103, y 116: within 10 units, under 2 kn, for 3 s. It is about 9 units off the coast, clear of reefs, on the side facing Port Calda (the arc test checks this).
8. **Par for the launch:** fair 130 s, captain 100 s, salt 80 s. The balance model's sloop leg Saltmere → Port Calda is about 57 s, a clipper's 39 s, so the sloop makes captain's par with a clean passage and salt's with a good one. The title shows it through `{par}` (Westholm's fill-in, [0132](0132-westholm-mill.md)).
9. **Port Calda after the arc** (after-a-quest hook, [0130](0130-after-a-quest-and-the-saltmere-shoals.md)): the bare slipway stands at every level before the arc (`before:calda-slipway`), the slipway with a hull at every level after (`after:calda-slipway`); planks are made from level 2 instead of 3 (`afterQuest`). Before the arc, a level-3 Calda shows the bare slipway instead of the hull it showed until now, which matches "the yard has stood idle since the winter".
10. **The pilot cutter** is a new sea mark type, `pilot-cutter` (the small hull of the fishing boat, painted black), moored off the pier head (x 164.5, y 239.8), tagged `after:calda-slipway`. A sea mark, not an island prop, because a moored boat is solid and cannot wait on a quest (0130).

## Consequences

- Any later arc can load or unload quest cargo at a beach, a rock or a mooring with no new code: it is a few numbers in the quest file.
- The Calda arc's `mast` step and the Stonehaven arc's `stone` and `lens` steps are written on it.
- There is no on-screen countdown while holding at a spot yet; the coach marks and the card's title say "come in slow". A small hold ring at the spot would be a later interface piece, shared with `reach` holds.
