# 0233. Depth-coloured water from the height fields

**Status:** Proposed (2026-10-28, issue #274). Waits for Guillaume and the art director on the before/after shots.

## Context

Step 4 of the new look ([0222](0222-a-new-look-smooth-terrain-blue-water-and-forests.md), [plan](../v1.2/plan.md#4-water-about-1-week)) colours the sea by the depth of the seabed instead of the shore-distance tint, which saturates at 64 units and showed hard steps in the mockup. The art director gave three colours per sea ([new-look README §4](../reviews/art-direction/new-look/README.md#4-water-by-depth-per-sea)). The issue asked for a depth map that scales with the map and its memory budget, the same water on every quality level with more detail higher up, and no stale water after an edit.

## Decision

1. **One seabed bake per map** (`src/render/seabedDepth.ts`, `seabedTexture.ts`), from the islands' height fields as drawn (the same cached objects, so nothing is built twice) and the terrain shapes. Each cell takes its highest ground (all land counts as `land`, 24, and reefs, shallows, sandbanks, barrier islands and ice fields as their weight in `graphics.json › water.depth.beds`), the grid is blurred into a soft shelf (6 cells), so the turquoise reaches about 14 to 16 units past the coast and the deep colour about 40, as the art director asked, and the depth is stored as one byte per cell: 0 at the coast, 1 for deep water.
2. **Whole map, capped, not a moving window.** At 3 units a cell the whole game sea is 666 × 629 bytes (0.4 MB), less than the shore bake, snapped to whole cells so an edit never shifts the cells under another coast. A camera window would need re-bakes and uploads while sailing, the worst kind of cost on a phone. A bigger map gets coarser cells past `maxTexels` (1024 per side, 1 MB) rather than more memory. Baking takes about 0.1 s on a laptop, once per map, land change or quality change with an edit; the fields it reads already cost about 1.5 s under `?look=v2`.
3. **Re-baked only on a change**: a new field (the height field cache hands out a new object after an island edit or a quest raising land), a new terrain shape or a changed depth number. All quality levels share the bake and are rebound together, like the shore bake.
4. **The shader** keeps the shore texture for the foam and adds the depth: shallow → mid over `midAt` of the depth, mid → deep after, light wave crests, softer facet shading. Low reads the depth per vertex, Medium and up per pixel; High and Ultra keep the v1.1 sky reflection, glint and soft foam unchanged.
5. **Colours per sea** in `palette.json › water`, blended across the borders over `seaBlend` units at the camera, as the old sea tints were. Dusk, night and storms shade them by the classic look's water against the day's, so every sea darkens alike, and anything darker than the sea's `night` floor is lifted toward it (moonlit navy, never black or violet; day colours are all brighter and never touched); the cold-sea zone tint no longer changes the water (the north's own colours replace it). The overlays (calm, current, rough and shallows water) copy the depth colours, so they match.
6. **Behind `?look=v2`** with the rest of the new look; the classic water stays the default until the islands pass review.

## Consequences

- The numbers are in `graphics.json › water.depth` (Graphics tab in `?tune`); depth-map numbers apply on the next bake (a quality change or reload), shading numbers at once. The ramp colours are edited in `palette.json` for now: `?tune` has no colour control.
- The smoothing of #269 and the sculpting of #270 reach the water through the height fields with no change here; their sloped underwater ground counts at its own height.
- The editors' island preview keeps its see-through sea, which shows the real seabed and is never stale.
