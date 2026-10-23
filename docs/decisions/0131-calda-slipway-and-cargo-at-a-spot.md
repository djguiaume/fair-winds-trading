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

## Consequences

- Any later arc can load or unload quest cargo at a beach, a rock or a mooring with no new code: it is a few numbers in the quest file.
- The Calda arc's `mast` step and the Stonehaven arc's `stone` and `lens` steps are written on it.
- There is no on-screen countdown while holding at a spot yet; the coach marks and the card's title say "come in slow". A small hold ring at the spot would be a later interface piece, shared with `reach` holds.
