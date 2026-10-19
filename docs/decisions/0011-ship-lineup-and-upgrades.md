# 0011. Five ship classes, bought and upgraded with delivery money

**Status:** Accepted, 2026-10-19 (numbers are starting values to tune in play)

**Context:** Guillaume asked for several boats that the player can upgrade with money earned from deliveries. The roadmap only had "one ship upgrade" in Phase 1 and three classes in Phase 3.

**Decision:**

Five ship classes, each a clear step up, with a real trade-off tied to the wind model ([0007](0007-arcade-sailing-with-tacking.md)):

| Class | Rig | Hold | Strength | Weakness | Price |
|---|---|---|---|---|---|
| Sloop | 1 mast, fore-and-aft | 10 | nimble, starter ship | tiny hold | starter |
| Cutter | 1 mast, fore-and-aft, 2 jibs | 16 | points high into the wind | small hold | 1 500 |
| Schooner | 2 masts, fore-and-aft | 30 | best upwind | average downwind | 5 000 |
| Brig | 2 masts, square-rigged | 50 | fast downwind | wider no-go zone | 12 000 |
| Fluyt | 3 masts, square + mizzen | 100 | huge hold | slow and clumsy upwind | 30 000 |

Fore-and-aft rigs get a narrower no-go zone; square rigs get more downwind speed. That makes ship choice part of route planning.

Each ship has three upgrade tracks with three levels (stock, 2, 3), each visible on the model:
- **Sails:** top speed and acceleration (patched → new canvas + extra jib → racing sails + topsail).
- **Hold:** cargo capacity (+60% at level 2, +120% at level 3).
- **Hull:** durability against reefs and storms, small speed bonus (bare → painted → copper-sheathed).

Upgrade prices scale with the class (sloop: 400 for level 2, 1 200 for level 3 per track). Mockups: [docs/art](../art/).

**Consequences:**
- Phase 1 ships the sloop's three upgrade tracks and the cutter as a second ship to buy (one active ship); the schooner, brig and fluyt arrive with the fleet in Phase 3.
- The sailing model needs a per-class polar curve and no-go angle, plus multipliers from upgrades.
- Ship models are built from parts (hull, masts, sails, cargo, trims) so upgrades swap parts instead of needing a model per level.
- The hull track is the base of the ship health system [0010](0010-light-hazards-pirates-later.md) asks for, ready for pirates later.
- Cosmetics (sail colours, flags, figureheads) stay in Phase 7 and do not change stats.
