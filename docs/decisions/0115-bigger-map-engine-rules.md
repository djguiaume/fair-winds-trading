# 0115. Bigger map engine rules, a stress test sea, and what a 5x map needed

**Status:** Implemented for review (2026-10-23). Requested by Guillaume ("getting ready for the bigger map … draw only the islands near the ship, or it will slow down on old tablets"); he confirmed the map grows to **5 times its area** (sea radius about 985 instead of 440). Builds on [0116](0116-performance-priorities.md) (what to do now, later, or not at all) and [0117](0117-nearby-wind-shelter-and-camera-far.md) (wind shelter near the ship, camera far plane at the fog, shared `SpatialGrid`). Readiness review and measurements: [reviews/bigger-map](../reviews/bigger-map/README.md).

## Context

The Windward Ring is a sea of radius 440 with 11 islands and 6 ports. A map with 5 times the area has a radius of about 985, sailing distances about 2.2 times longer, and, at today's density, about 50 islands. Before this decision nothing could show how the game behaves at that size: every estimate came from copying islands in a unit test. The readiness review found these gaps: wind shelter and the far plane (fixed in 0117), every island built at startup, one 512 × 512 shoreline texture over the whole map, storms tied to a fixed 440-unit area and to a time window that a longer crossing outgrows, a sea chart whose fixed 3x zoom shows a bigger sea's islands smaller, and a save-transfer QR that gets dense (handled by its own thread).

## Decision

### Rules for the engine (for every later map and feature)

1. **The simulation never depends on what is drawn.** Islands, towns and economies keep their state whether or not their models exist; a model may be built late, but must show the current state when it appears.
2. **No per-step check does real work for every item on the map.** A cheap bounds test per item is fine up to a few hundred items; anything heavier asks the shared `SpatialGrid` (`src/sim/spatial.ts`, 0117) for what is near. One spatial lookup for the whole game, not one per feature.
3. **Map-wide resources have a budget.** A texture or buffer that covers the whole map is sized from the map with a cap (the shoreline: 1.4 units per texel, at most 2048 per side, one byte per texel).
4. **Anything tied to the sea's size reads the map**, never a copy of today's radius: storms cross `boundsRadius × areaShare`; the chart zooms by scale.
5. **Distances and detail settings a designer would tune live in data** ([0093](0093-data-driven-content-and-authoring-tools.md)); engine budgets (texture caps, grid cell size) stay as named constants beside the code that uses them.
6. **Measure on the stress sea before optimising.** A change for the bigger map shows its numbers on `?map=stress`; an item postponed below comes back only when a measurement there, or on the old tablet, says so.

### The stress test sea

`?map=stress` sails a dev-only sea of radius 985 (`src/data/stressMap.ts`, settings in `src/data/stress-map.json`): today's map copied five times, each copy turned and shifted, leaving out any island or shape that would overlap land already placed or the edge. It has 46 islands, 24 ports and 24 reefs and sandbanks, passes the editor's map checks, and plays on its own save (`fwt.stress.` prefix), so the real voyage is never touched. A small "Stress test sea" label shows it. The performance tool runs on it as on any URL: `npm run perf -- "http://127.0.0.1:5180/?map=stress"`.

### Changes for a 5x map

- **Shoreline texture sized to the map.** The bake keeps today's sharpness (1.4 units per texel) on any map, capped at 2048 per side, and is stored one byte per texel instead of four: today's map uses 539 × 517 (0.28 MB, was 1 MB), the stress sea 1158 × 1195 (1.4 MB). A bake takes about 25 ms once at load on both. This replaces the "shoreline window around the ship" idea of 0116: same sharpness, no re-baking while sailing, much simpler. A window comes back only if a map's bake would exceed the cap (land spread over about 2,900 units, 3.8 times today's).
- **Storms on any sea size.** `weather.json › default.storms.areaRadius` (440) became `areaShare` (1 = the whole sea) and `perRadius` (440): storms cross the map's own radius, and a sea gets one storm "lane" per `perRadius`, so the stress sea has two at once and a captain meets them about as often as today (inside a storm 4.3 % of the time 200 units from the centre, 2.7 % today). How far back storms are looked up now follows the longest possible crossing, so a long crossing no longer vanishes mid-sea. On today's map storms are unchanged (same tracks and ids, tested). Maps pass their radius through `WindConfig.seaRadius`, set by `prepareMap`.
- **Chart.** The closest zoom gives the same detail as 3x on today's sea, whatever the sea's size (6.5x on the stress sea). Small names of scenery islands wait until the chart shows fewer than 3 units per pixel, so a whole big sea on a phone in portrait shows ports only; they appear when zooming in.
- **Terrain collisions** got the same box early-out as island coasts (identical results).

### Measured as not needed at 5x the area, so not built

- **Building islands only near the ship.** On the stress sea the renderer draws the same 16 draw calls and about 30k triangles as today while sailing, because each island is already culled outside the view ([0103](0103-local-island-rendering.md)) and the far plane now stops at the fog (0117). Building all 46 islands takes about 0.4 s in Node on this machine (0.08 s today), adds about 0.25 s to page start in headless Chromium, and holds about 8 MB of geometry; three.js only uploads to the GPU what has been drawn. Building near the ship would turn that one-off cost at load into hitches while sailing (each island 5 to 15 ms here, several times that on a tablet). **Trigger:** startup or memory on the old tablet with the stress sea, or a map with several hundred islands.
- **Moving collisions, reefs and port range onto the grid.** A whole simulation step on the stress sea takes about 0.1 ms; collisions 0.02 ms. **Trigger:** rule 2, when one of them stops having a cheap per-item test, or the stress sea measures them above 0.1 ms.
- **Deferring rebuilds of distant towns** stays postponed as in 0116 (it falls out of building islands near the ship).

## Consequences

- The bigger map can be authored and tested now: the editor already handles any Sea radius, and every engine part that depended on today's size reads the map instead.
- Tuning: `storms.areaRadius` is gone from `weather.json`; `?tune` shows "Storm area" (share of the sea) and "Sea per storm". The "plays the same" hash for difficulty weather was updated once for that rename.
- Gameplay numbers that depend on distance (long-haul order rewards, `economy.json › distanceScale`; the economy targets of [0046](0046-phase-1-economy-tuning.md)) are not changed here: they belong to the bigger map's own layout and the balance check (0114) will show the drift.
- The save-transfer QR size on a bigger map is handled separately ("Smaller save QR code").
- The old-tablet test of 0116 should now be run twice: on today's map and on `?map=stress`.
