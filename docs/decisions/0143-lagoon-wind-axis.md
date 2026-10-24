# 0143. Ring island with a lagoon, and its wind

**Status:** Accepted (2026-10-24). Guillaume: harbour facing **in**, and he wants this kind of island for the **tropical main port** of Phase 4 ([0137](0137-phase-4-biomes-and-founded-outposts.md)), with **staggered entrances** (point 5). The `sheltered` zone is built in [0144](0144-wind-zones-in-the-sim.md). The test rings, screenshots and measurements are in [docs/reviews/ring-lagoon](../reviews/ring-lagoon/README.md).

## Context

Guillaume asked whether today's tools can make a ring island with openings to the east and west, sea in the middle, a port in the north, the wind reduced across the whole middle, and the wind blowing only E→W or W→E there.

- The ring, the lagoon, the gaps and the port already work. They are two barrier-island arms plus a port island, made in `editor.html`, and every map check passes, routes included.
- The wind does not. Island shelter ([0027](0027-islands-shape-the-wind.md)) reaches only 70 units downwind, so a lagoon this size keeps the full sea wind in its middle (14.0 kn measured at the centre for winds from N, E, S and W). Nothing turns the wind locally.
- The wind zones of 0140 are the right place for this. The "Build wind zones" thread, which owns zone semantics, is adding a `sheltered` kind: `strength` 0.55, `gusts` 0.6, `pull` 0.9, `axis: true`. With `axis`, the zone's `headingDeg` is a line, and the wind pulls towards whichever end of it is nearer the sea wind.

## Decision

1. **The lagoon is one `sheltered` zone with `headingDeg` 90** (the east–west line) over the inside of the ring. It is data only, uses 0140's outline and fade, and its numbers live in `tuning/weather.json › zones.sheltered` ([0093](0093-data-driven-content-and-authoring-tools.md)).
2. **No flip at full strength.** This is built into `sheltered` itself ([0144](0144-wind-zones-in-the-sim.md)). With `acrossFloor` 0.3, the speed is also multiplied by max(`acrossFloor`, |cos(sea wind − axis)|), and the pull is scaled by |cos| too, so the direction eases. Turning the sea wind through straight-across gives a smooth wind vector. Straight across, the lagoon gets 0.55 × 0.3 of the sea wind.
3. **The route and balance checks sample zone wind.** The wind zones thread will add this once the shared base lands, so the check doesn't assume full-speed sailing across the lagoon.
4. Zone shelter applies before island shelter, and the shelter rays use the zone's direction. Like all of 0140, it is a pure function of seed, time and place, with no save change, and it is switched off with the Wind zones setting.

5. **The tropical main island is a staggered ring, harbour facing in.**
   - Two equal arms whose centres sit about 40 units apart, so at the west the north arm's headland runs past the outside of the south arm's tip, and at the east the reverse (point-symmetric). Each entrance is a slanted slot with a bend, not a straight cut.
   - **Slot at least 50 units of clear water.** At 52 every map check passes. At 28 a sloop can't get in at all (the route check's hull plus turning room).
   - Measured with the route check (no zone wind yet), reaching the harbour from 280 units outside takes 30 to 72 s whatever the wind, against 22 to 101 s with straight gaps. The bend means you are never dead upwind through the entrance for long, which suits the gentle south that opens first, while still making you work the turn.
   - The arms are drawn by the existing generated look for now. A town that spreads along the inner shore, as in Guillaume's reference picture, is island builder work on the port's island file, done when the tropical port is built.

## Consequences

- The ring is built from data only: two arms, a port island and one sheltered zone. It is about 330 units across, which fits the grown sea (radius 985) and not today's ring (440).
- The same zone works for any strait between high land (a fjord, the Teeth).
- 0140's zone list links here from `sheltered`.
