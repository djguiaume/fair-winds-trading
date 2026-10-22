# 0075. Ship speeds quoted in knots

**Status:** Implemented for review, 2026-10-22.

## Context

The shipyard quoted each vessel's speed as a percentage of the starter sloop ("Top speed: 125%
of the sloop") and the sails and hull upgrades as "+8% speed". The game is aimed at people who
like sailing first, and everything else the player reads at sea (boat speed, wind) is already in
knots. Guillaume asked for knots everywhere.

A sailing boat has no single top speed: it depends on the wind and the point of sail. The sim
gives speed as `polarFraction × wind × speedRatio`, so a reference wind has to be chosen.

## Decision

- Quote top speed as the speed on the ship's best point of sail, full sails, in a **14 kn
  breeze**: the Windward Ring's base wind and the middle of the "breeze" step (11 to 15 kn).
  `REFERENCE_BREEZE_KN` and `topSpeedKn()` live in `src/sim/boat.ts` next to `targetSpeed()`,
  so the number is exactly what the sim would reach in that wind.
- Fleet cards show "Top speed: 9.4 kn" (FR "Vitesse max : 9,4 nd"), one decimal, with the ship's
  own fitted upgrades applied. A line under the lineup states the reference ("Top speeds are on
  the best point of sail in a 14 kn breeze").
- Sails and hull upgrade lines show the resulting top speed in knots for the active ship at that
  level instead of "+N% speed". Acceleration stays a percentage: there is no natural unit for it.

## Consequences

Players can compare a ship's quoted speed directly with the speed log at sea. Upgraded ships
show their real number, so an upgraded sloop can out-quote a stock cutter, which is true in the
water too. A future change to the reference wind or the map's base wind only moves one constant.
Tests check the knots value and the French formatting.
