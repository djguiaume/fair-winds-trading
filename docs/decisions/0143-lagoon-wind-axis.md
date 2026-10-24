# 0143. Lagoon wind: a sheltered zone along an axis

**Status:** Proposed (2026-10-24), waiting for Guillaume. Nothing is built by this thread. It uses the `sheltered` zone kind, which the "Build wind zones" thread is adding to [0140](0140-wind-zones-and-currents.md) for this lagoon. It adds two small things on top. The test ring, screenshots and measurements are in [docs/reviews/ring-lagoon](../reviews/ring-lagoon/README.md).

## Context

Guillaume asked whether today's tools can make a ring island with openings to the east and west, sea in the middle, a port in the north, the wind reduced across the whole middle, and the wind blowing only E→W or W→E there.

- The ring, the lagoon, the gaps and the port already work. They are two barrier-island arms plus a port island, made in `editor.html`, and every map check passes, routes included.
- The wind does not. Island shelter ([0027](0027-islands-shape-the-wind.md)) reaches only 70 units downwind, so a lagoon this size keeps the full sea wind in its middle (14.0 kn measured at the centre for winds from N, E, S and W). Nothing turns the wind locally.
- The wind zones of 0140 are the right place for this. The "Build wind zones" thread, which owns zone semantics, is adding a `sheltered` kind: `strength` 0.55, `gusts` 0.6, `pull` 0.9, `axis: true`. With `axis`, the zone's `headingDeg` is a line, and the wind pulls towards whichever end of it is nearer the sea wind.

## Decision (proposed)

1. **The lagoon is one `sheltered` zone with `headingDeg` 90** (the east–west line) over the inside of the ring. It is data only, uses 0140's outline and fade, and its numbers live in `tuning/weather.json › zones.sheltered` ([0093](0093-data-driven-content-and-authoring-tools.md)).
2. **On top: `acrossFloor`** (0.3) for axis zones. The speed is also multiplied by max(`acrossFloor`, |cos(sea wind − axis)|). A sea wind straight across the line is the lightest, so the E→W / W→E flip happens in a near-calm, not as a sudden 180° swing at full strength. This is a small PR on the wind zones base, unless that thread already handles the flip another way.
3. **On top: the route checks sample zone wind.** `sailRoute` uses the zone's wind where it crosses one, so the check doesn't assume full-speed sailing across the lagoon.
4. Zone shelter applies before island shelter, and the shelter rays use the zone's direction. Like all of 0140, it is a pure function of seed, time and place, with no save change, and it is switched off with the Wind zones setting.

## Consequences

- Guillaume's ring can be built from data only: two arms, a port island and one sheltered zone. No ring of this size fits today's map (sea radius 440), so it belongs in a Phase 4 biome or on the grown map.
- The same zone works for any strait between high land (a fjord, the Teeth).
- On acceptance, link this ADR from the `sheltered` kind in 0140's "Update (2026-10-24)" section.
