# 0117. Wind shelter checks only nearby land; the camera stops at the fog

**Status:** Implemented for review (2026-10-23). The two "do now" items of [0116](0116-performance-priorities.md), requested by Guillaume ("start in other threads the optimisation we should start now. merge those yourself"). The engine rules for the bigger map stay in 0115 (bigger map readiness work).

## Context

Wind shelter (`windEffectAt`, [0027](0027-islands-shape-the-wind.md)) casts three upwind rays and four side rays every simulation step and, at each sample point, tested every wind blocker on the map. Its cost grows with the number of islands, which matters once the map grows about 5 times ([0116](0116-performance-priorities.md)).

The camera's far plane was a fixed 600 units, while the fog fully hides everything past `fog.far` (about 264 at default zoom in landscape, up to about 830 zoomed out in portrait).

## Decision

1. **One shared nearby lookup.** `src/sim/spatial.ts` holds `SpatialGrid<T extends Circle>` (`Circle` = `{x, y, r}`): built once from map data (64-unit cells), `near(x, y, r, out?)` returns the items whose circle comes within `r` of a point, in their original order, exactly what a full scan with the same circle test returns. It has no game knowledge, so collisions, reefs, port range and "which islands to build and draw" (bigger map work, 0115) can reuse it instead of growing their own.
2. **Wind shelter asks the grid.** `world.windBlockers` is now a `SpatialGrid<WindBlocker>` (`windGrid()` in `wind.ts`). `windEffectAt` accepts the grid or a plain list; with the grid it first takes the blockers within `max(shadowLength, funnelReach) + 1` of the boat, read from tuning on every call so the `?tune` panel ([0114](0114-tuning-panel-and-balance-check.md)) still works live. Every ray sample lies within that reach and a blocker only counts inside its own circle, so leaving out the others cannot change the result. A plain list still scans everything; tests use it as the reference.
3. **The camera's far plane follows the fog.** Each frame, `camera.far = fog.far` (projection updated only when it moves by more than a unit). With the 58° camera pitch and 40° field of view, the sea at the top of the screen is about 1.3 × the camera distance away, and the fog never ends closer than 1.6 × (night plus storm), so nothing visible is cut.

## Proof that nothing changed

- **Wind:** `tests/spatial.test.ts` compares grid and full scan on the Windward Ring every 9 units across the whole sea, each with a different wind direction (over 7,000 points, hundreds of them in a lee or along a flank): shelter and funnel are equal to the last bit. Same with the shadow length doubled, as the tune panel could. The grid itself is checked against a full scan on 300 random circles and 400 random queries. The whole suite (742 tests) passes with no other test changed, including the balance and "plays the same" tests.
- **Picture:** rendered the same frame twice, far 600 then far = fog, in headless Chromium: 48 cases (landscape 1280 × 800 and portrait 390 × 844, zoom 0.6 / 1 / 1.7, day and night, four places). Rendering is deterministic (the same far twice gives 0 changed pixels); the change touches at most about 60 pixels out of a million, single pixels where two surfaces nearly touch, from the better depth precision. Not visible: [comparison](../reviews/performance/far-plane-compare.png).

## Measurements

Headless Chromium in the cloud container, `windEffectAt` per call, averaged over 8 wind directions; "near land" = points 10 to 60 units off every island, "whole sea" = a 25-unit grid over the sea. Today's islands copied 5 and 25 times for the bigger maps.

| Map | Blockers | Near land, before | Near land, after | Whole sea, before | Whole sea, after |
|---|---|---|---|---|---|
| today | 14 | 0.0050 ms | 0.0044 ms | 0.0044 ms | 0.0030 ms |
| × 5 | 70 | 0.0132 ms | 0.0038 ms | 0.0127 ms | 0.0047 ms |
| × 25 | 350 | 0.0493 ms | 0.0027 ms | 0.0506 ms | 0.0033 ms |

A whole simulation step near land (Node): 0.04 ms before and 0.03 ms after on today's map, 0.09 ms before and 0.03 ms after at × 25.

These are about 60 times lower than the 0.30 ms per step in 0116 (probably a measurement with a cold or instrumented JavaScript engine); the shape is the same: before grows with the number of islands, after stays flat. On today's map the gain is small; it is insurance for the bigger map.

Camera far plane: on today's map draw calls and triangles are identical before and after in all 48 cases (16 to 27 calls, 15k to 41k triangles): the camera's top and side planes already cut everything the far plane now cuts. It pays on a bigger map, where large islands near the horizon line would otherwise pass the culling test. In portrait zoomed out the fog (about 830) reached beyond the old 600, which nothing on screen could show either.

## Consequences

- Wind shelter costs the same on any map size; the bigger map work adds collisions, reefs, port range and island building to the same grid instead of new structures.
- Islands outside the fog are skipped by three.js automatically on the bigger map.
- The grid is built once per world; anything that moves islands during a voyage (none today) must rebuild it.
- Device numbers still come from the old tablet and phone test in 0116.
