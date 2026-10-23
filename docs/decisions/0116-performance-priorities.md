# 0116. Performance priorities: what to do now, later, or not at all

**Status:** Accepted (2026-10-23). Measurements in [the performance review](../reviews/performance/README.md). The engine rules for a bigger map belong to ADR 0115 ("Bigger map engine rules", proposed by the bigger map readiness work); this decision does not repeat them.

## Context

An outside optimisation suggestion (deferred distant town rebuilds, a spatial index, distance-based detail, world loading and unloading, small libraries such as RBush/Flatbush, instancing, BatchedMesh, three-mesh-bvh) was checked against measurements on main `3491c85` with the repeatable performance tool ([0102](0102-repeatable-performance-baseline.md)) and Node microbenchmarks of the per-step simulation, on today's map and with its islands copied 5 and 25 times. The map is expected to grow to about 5 times its size, and the game must stay smooth on an old tablet and a phone ([0006](0006-desktop-and-mobile.md)).

Key numbers: 16 to 24 draw calls, 30k to 38k triangles, 0.7 ms renderer CPU per frame; a visible town rebuild takes 53 ms; one simulation step takes 0.33 ms, of which wind shelter (`windEffectAt`) is 0.30 ms and grows linearly with islands (1.5 ms at 5x, 7.7 ms at 25x). Collisions, reefs and port range are cheap. The camera draws to 600 units while fog hides everything past about 260. The shoreline texture is one 512 x 512 bake over the whole map.

## Decision

**Do now** (separate PRs):
- Wind shelter tests only islands within its reach of the ship.
- The camera's far distance follows the fog distance.
- Measure on the real old tablet and phone with the in-game FPS and the performance tool.

**Do with the bigger map** (planned in the bigger map readiness work): a shared spatial grid for wind, collisions, reefs, ports and piers; island geometry built near the ship and spread over frames; a shoreline texture that covers a window around the ship instead of the whole map.

**Postponed, with the trigger that brings each back:**
- Deferred rebuilds of distant towns: today a town grows when the player delivers there, so it is on screen. Revisit when anything can grow a town the player cannot see (automated routes, [0097](0097-progression-candidates-and-later-extensions.md)); it then falls out of building islands near the ship.
- The remaining 53 ms rebuild of the visible town: spread it over frames, or try instanced trees and props. Do it if the tablet test shows the hitch is noticeable.
- Distance-based level of detail: only if the tablet test shows drawing (not the simulation) is the bottleneck. Triangle counts are low today.
- World loading and unloading by region: only if startup time or memory on the tablet requires it after islands are built near the ship.
- Instancing woodland trees: one measured prototype against the visible town rebuild, when that item is picked up.

**Not needed now:**
- RBush or Flatbush: a simple grid covers a few hundred items; reconsider only if items move or counts reach thousands.
- three.js BatchedMesh: per-island batches already cull correctly with few draw calls.
- three-mesh-bvh: sailing collisions use 2D outlines; only relevant if editor picking becomes slow.
- Replacing three.js or adopting a game framework: no measured problem it would solve.

## Consequences

The two quick fixes give the largest measured gain for a bigger map at little risk. The cloud measurements use a software GPU, so frame times there are not device evidence; only the tablet test can promote a postponed item. Each postponed item names the measurement that would bring it back, so it can be picked up without redoing this review.
