# 0008. Start with one static map, keep the code ready for seeded generation

**Status:** Accepted, 2026-10-19

**Context:** Seeded random maps would be nice but should not slow the start.

**Decision:** Ship the MVP with one handmade map. Islands, settlements and wind zones are described as data (not hard-coded in scenes), and any randomness goes through a seedable RNG, so a procedural generator can later produce the same data from a seed.

**Consequences:** Seeded maps are added in a later phase without rewriting the world code.
