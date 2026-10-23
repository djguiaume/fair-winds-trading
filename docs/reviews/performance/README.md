# Review of the optimisation advice (2026-10-23)

Decision: [0116](../../decisions/0116-performance-priorities.md). Measured on main `3491c85` in the cloud container (headless Chromium, software GPU, 1280x800, High).
Frame times there are GPU-emulation bound and say nothing about a tablet; draw counts, triangle
counts and CPU timings are meaningful. Code map checked with graphify (`graphify update .`).

## What the data says

| Measure | Today | Notes |
|---|---|---|
| Draw calls | 16 to 24 | sailing 16, near a port 24 |
| Triangles | 30k to 38k | low for an old tablet |
| Renderer CPU per frame | 0.7 ms | three.js render call only |
| Town rebuild (Calda to level 3) | 53 ms, 3 of 3 runs | one frame hitch; several times longer on an old tablet |
| Quality switch | 2 to 13 ms | already improved in ADR 0111 |
| One sim step (60 per second) | 0.33 ms | |
| of which wind shelter (`windEffectAt`) | 0.30 ms (91 %) | checks every island at every ray sample |
| of which collisions | 0.005 ms | islands have a box early-out |
| of which reefs / port range | 0.0002 / 0.0012 ms | |

Same per-step functions with the map's islands and terrain copied 5x and 25x:

| | x1 | x5 | x25 |
|---|---|---|---|
| wind shelter | 0.30 ms | 1.5 ms | 7.7 ms |
| collisions | 0.005 ms | 0.023 ms | 0.11 ms |
| reefs | 0.0002 ms | 0.0006 ms | 0.004 ms |

Everything grows in a straight line with the number of islands. Wind shelter is the only one that
matters: at 25x it alone would eat most of a tablet's frame. (Port range also jumped to about 0.6 to
1 ms on the copied map, probably because my copies shared island ids; check it on the real bigger map.)

## Drawing distant islands (for the bigger map thread)

- Already done (ADR 0103): each island is its own set of meshes with correct bounds, and three.js
  skips anything outside the camera view.
- Gap 1: the camera draws up to 600 units away (`src/render/view.ts`), but fog fully hides
  everything past about 260 units (default zoom, landscape; up to about 450 zoomed out in portrait).
  Islands in that band are drawn but invisible. Tying the camera's far distance to the fog distance
  is a small, measurable win on a bigger map.
- Gap 2: the shoreline texture behind the water shading is one 512 x 512 image over the whole map
  (`src/render/ocean.ts`). A map 5 times as wide gets shores 5 times blurrier, or a 25 times
  bigger bake. It needs tiles or a local window around the ship. The advice did not mention this.
- Gap 3: every island's geometry is built at startup (startup is 2.4 s here). With 5x the islands,
  measure startup on the tablet before deciding on lazy building.
- Labels, lanterns and windows loop over all ports; cheap now, check them again on the bigger map.

## Verdict per point

1. Defer distant town rebuilds: sound, but little value today, because a town levels up when you
   deliver there, so it is on screen. It becomes useful with Phase 3 automated routes. The real
   cost now is the 53 ms rebuild of the visible town (spread it over frames, or instanced trees/props).
2. Spatial index: the data supports it now, for wind shelter first. A simple grid or a "nearby
   islands" list is enough; RBush/Flatbush are fine but not needed for a few hundred items. One
   shared helper for wind, collisions, ports and reefs.
3. Distance-based detail: not needed for triangle counts (38k). The camera far/fog fix is the cheap
   version. Real level-of-detail only if the tablet test shows drawing is the bottleneck.
4. Loading/unloading the world: agree, defer. Revisit only if startup or memory on the tablet says so.
5. Architecture rules: agree, worth an ADR plus a roadmap line for the bigger map. Add two rules:
   "per-step queries must not scan the whole map" and "map-wide textures need a size budget".

Libraries: keep three.js. Instancing for trees is worth one measured prototype against the 53 ms
rebuild. BatchedMesh and three-mesh-bvh do not fit current problems.

## Suggested now

1. Wind shelter: only test islands within reach of the ship (biggest measured win, small change).
2. Camera far distance follows the fog.
3. Run the existing perf tool and in-game FPS on the real old tablet and phone.

Then the bigger map thread: shared spatial grid, shoreline tiles, town rebuild spread over frames.
