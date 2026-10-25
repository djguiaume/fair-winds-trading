# 0203. Dock only at the harbour

**Status:** Proposed (2026-10-25).

## Context

Guillaume's playtest on the Xbox: "Commercer à Sunreach" came up with the boat stopped off the
lighthouse point of Sunreach's arm, at the lagoon entrance, far from the harbour. Since 0084 the
dock range was the hull's gap to the port island's **whole coast** or to its piers. On the small
ring towns that let her dock round the back of the island (60 to 108 units from the pier head);
on the big Phase 4 islands it reached right along the coast: 196 units at Sunreach, 147 at
Fogwatch, 137 at Emberhold, 125 at Rimewick. Every one of the 14 ports had the bug.

## Decision

- The shore still counts as a berth (a quay alongside the town), but only while the hull is
  within `seamanship.harbour.berthReach` (24 units, tuning data, `?tune`) of one of the port's
  solid piers. The piers themselves count everywhere, as before. A port with no pier (old
  circle islands, none on the shipped seas) keeps docking along its coast.
- The same distance drives the Dock button, automatic docking, the pier label's cue, undocking,
  home piers (Skerry) and quest dock spots, so they all agree.
- A new map check `berths` (in `quickChecks`, so `npm run check`, the sea editor and the map
  editor show it) samples the water round each port at its first and top level: an error when a
  port has no pier, no clear water to dock, or a dock zone that runs farther than
  `dockRange + berthReach + hull` from its piers; a warning `berth-split` when the dock zone is
  in two patches (shore past a spit or round a small island's back).

## Consequences

- On the old code the check fails every port of the ring and the grown sea; now all pass. Dock
  zones now reach 28 to 40 units from the pier head on the ring and 29 to 56 on the grown sea
  (Sunreach's second pier at level 3 counts).
- The stress sea's Watchman Key 5 shows the `berth-split` warning: a tiny island whose berth
  wraps round it. Not a shipped sea.
- Balance unchanged on all three levels (bots dock at the piers).
- Screenshots: project files `dock-berths/` (before, after, docking at the pier).
