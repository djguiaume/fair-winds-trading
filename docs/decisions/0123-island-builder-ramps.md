# 0123. Ramps that climb along their length

**Status:** Implemented for review (2026-10-23). Adds to the sloped ground of [0096](0096-island-files-and-island-builder.md) §4 and [0106](0106-island-builder-ground-lanes-woods.md). How to use it: [island builder](../island-builder/builder/README.md#ground-and-slopes).

## Context

A slope (0106) rises straight out from one edge of raised ground, at the same height all along that edge, so it cannot climb as it goes round. Guillaume asked how to make a ramp that curls round a central plateau from the ground up to its top, and then asked for a ramp with a start height and an end height.

## Decision

- **Format:** an island file may have `ramps`: `{ "points": [[x, z], …], "width", "start", "end", "material", "from"?, "to"? }`. The ramp is a band `width` wide along the points (straight runs, two points or more). Its height rises evenly along its length from `start` at the first point to `end` at the last. Heights and width are island-radius units, like ground.
- **Game side** (`src/sim/islandLayout.ts`):
  - The ground on a ramp is the ramp's height. The ramp runs over any cliff it crosses, so lanes and paths climb it.
  - A ramp's sides count as cliff edges for footprints.
  - A ramp counts as a slope, so buildings need flat ground off it (the existing ✗ check).
  - Drawn as a band in grass or rock with rock sides and ends, mitred at bends (`rampBand` in `towns.ts`).
- **Checks:** known material, two points or more, a width, valid levels, and no ramp point past the coast.
- **Builder:** **Ramp** in Ground mode. Click the foot, any bends, then the top; click the top again or press Enter. It starts at the ground's height at the foot and ends at the ground's height at the top (0.2 higher if both are the same). The panel sets *Start height*, *End height*, *Width*, grass or rock, and the levels; the points move like a lane's. The overlay shows the band with its start and end heights.

## Consequences

- A ramp can curl round a plateau, or climb from the low ground onto it, in one piece.
- Islands without ramps are unchanged: same code path, same golden hashes.
- A file with ramps needs this version of the game.
- Trees may stand on a ramp. Homes next to a new ramp may be flagged until they move.
