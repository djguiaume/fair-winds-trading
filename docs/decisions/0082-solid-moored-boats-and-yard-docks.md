# 0082. Solid moored boats and grown yard docks

**Status:** Implemented for review, 2026-10-22.

## Context

[0038](0038-hull-damage-from-any-crash.md) made the harbour pier solid. Town growth
([0060](0060-growing-town-visuals.md)) then drew bigger docks and moored fishing boats as
scenery, with collision left as a follow-up. [0071](0071-distinct-producer-islands.md) made the
four producer ports' T-heads, working piers and quays solid, but two things could still be
sailed through:

- Saltmere's moored fishing boats (3 at a hamlet, up to 6 at a port town, round the coast).
- The hidden shipyards (Abbey Head, Watchman Key) keep the older town model: their T-head
  (level 3) and second pier with its quay (level 4) were drawn but not solid.

Guillaume asked for the big piers and the moored boats to be solid before Phase 2 is released.

## Decision

- **Every moored fishing boat is a solid capsule** along its keel: the drawn hull (2 units
  long at 1.55 scale) is 6.8 map units long and 3.1 wide. It lives in `world.piers` with
  `boat: true`, so it grows with the settlement level and refreshes on level-up and save load
  like the piers.
- **Ramming one is its own surface, `boat`**, as hard as a pier: a docking bump is free, a
  harder hit costs hull points like a pier crash, with its own toast ("Rammed a moored boat!").
- **Hidden yards' grown docks are solid** in their own harbour frame: the main pier's width
  follows the level, the T-head from level 3, the second pier and its quay at level 4.
- The renderer tags each solid deck and moored hull (`userData.solid`), and a test checks that a
  collision pier or boat sits under every drawn one at every level, and that every moored boat
  capsule sits on a drawn hull.

Fishing moorings already avoid the arrival lane (0072), so docking is unchanged: the approach to
every pier head stays clear and every port still docks at levels 1 to 4.

## Consequences

- No more sailing through anything drawn in a harbour. Saltmere's waterfront becomes a little
  harder to sail close to at a port town, which suits a busy fishing harbour.
- The ship is still a circle against these capsules (as against piers): a long hull can look
  like it overlaps a moored boat's end by a little before it stops.
- Legacy fish towns (round islands with `kind: 'fish'`) still draw scenery boats that are not
  solid; no Phase 1 port uses that model.

**Validation:** `tests/harbour-obstacles.test.ts` (drawn decks and hulls match collision at
every level, ramming a moored boat reports a `boat` crash and stops short of it, hidden yards stay
approachable and dockable at every level); the existing pier, approach and docking tests in
`tests/hazards.test.ts` and `tests/island-layout.test.ts` updated for the extra obstacles.
Checked in the game with headless Chromium, collision outlines drawn over the scene
([screenshots](../screenshots/solid-harbours/README.md)).
