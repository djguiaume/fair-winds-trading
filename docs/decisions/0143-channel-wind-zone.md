# 0143. Channel wind zone

**Status:** Proposed (2026-10-24), waiting for Guillaume. Nothing is built. It adds one kind to the wind zones of [0140](0140-wind-zones-and-currents.md). The test ring, screenshots and measurements are in [docs/reviews/ring-lagoon](../reviews/ring-lagoon/README.md).

## Context

Guillaume asked whether today's tools can make a ring island with openings to the east and west, sea in the middle, a port in the north, the wind reduced across the whole middle, and the wind blowing only E→W or W→E there.

- The ring, the lagoon, the gaps and the port already work. They are two barrier-island arms plus a port island, made in `editor.html`, and every map check passes, routes included.
- The wind does not. Island shelter ([0027](0027-islands-shape-the-wind.md)) reaches only 70 units downwind, so a lagoon this size keeps the full sea wind in its middle (14.0 kn measured at the centre for winds from N, E, S and W). Nothing turns the wind locally.
- The wind zones of [0140](0140-wind-zones-and-currents.md) are the right place for this, but their `trade-belt` pulls towards one heading, not along a line both ways.

## Decision (proposed)

1. **A new zone kind, `channel`**, with a per-zone `axisDeg` (the line the wind follows: 90 = east–west). It uses the 0140 map format, outline and fade like every other zone.
2. **Its numbers live in `tuning/weather.json › zones.channel`** ([0093](0093-data-driven-content-and-authoring-tools.md)): `pull` 1, `strength` 0.5, `acrossFloor` 0.3. A zone can override them with `tune`, as in 0140.
3. **What it does to the wind:**
   - The direction turns (by `pull`) to whichever end of the axis is nearer the sea wind.
   - The speed is multiplied by `strength` × max(`acrossFloor`, |cos(sea wind − axis)|). A sea wind straight across the channel is the lightest, so the E→W / W→E flip happens in a near-calm.
   - It is applied before island shelter, and the shelter rays use the zone's direction.
   - Like all of 0140, it is a pure function of seed, time and place, and the save does not change.
4. **Checks:** a `channel` zone needs an `axisDeg`. The route checks (`sailRoute`) take a zone's wind where they cross one, so they don't assume full-speed sailing across a channel.
5. **Editor:** "Channel" in the Add wind zone kind picker, with an axis dial (one line, two ends) in place of the trade belt's heading dial.
6. **It is off with the Wind zones switch** (0140 point 6), like every zone.

## Consequences

- It is small: one kind, one optional field, one weather.json block, one branch in the zone term of `windAt`, and a dial in the editor. Everything else comes with the 0140 shared base ("Build ocean currents" thread).
- Guillaume's ring can then be built from data only: two arms, a port island and one channel zone. No ring of this size fits today's map (sea radius 440), so it belongs in a Phase 4 biome or on the grown map.
- The same kind works for any strait between high land (a fjord, the Teeth), not only rings.
- On acceptance, add `channel` to the zone kinds listed in 0140's "Update (2026-10-24)" section with a link here.
