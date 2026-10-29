# 0235. Smooth island ground: shore on the coast, faceted landmarks

**Status:** Proposed (2026-10-28, issue #269; waits for Guillaume's look).

## Context

[0222](0222-a-new-look-smooth-terrain-blue-water-and-forests.md) asks for rolling ground; the [art direction](../reviews/art-direction/new-look/README.md) asks that slopes keep each biome's cliff colours, zones blend over 1.5 to 3 units, and stacks, signature cliffs, crater rims, fjords and ice stay sharp. The mockup's plain blur moved the waterline about 2.4 units inland and raised skirts round tall shapes; clamping land and sea to the raster put the coast on the grid's steps.

## Decision

- **Smoothing in the sim** (`src/sim/smoothField.ts`, numbers in `terrain.json › smooth`): blur (sigma 2.4), relief noise faded in over 3 units, the town's ground kept at 85% of its terrace round props, build spots, pier roots and ramps, a second blur (0.9). Then hand sculpting (0230) on top. Game, editors and CLIs read the same field.
- **Waterline on the sim coast:** the blur counts the sea at minus the beach height, and within 2.5 units of the true coast outline the ground follows a shore profile from the signed distance to it (0.35 up on land, 0.7 down under water), so the 0 contour runs on the coast, not on the grid. Past that band the sea floor deepens to the seabed.
- **Per-shape `smooth`** in island files (0 to 1, left out 1): a weighted (normalised) blur, so a `smooth: 0` shape neither moves nor pulls on its neighbours. Those shapes are drawn as their classic crisp tiers and cones over the rolling ground, reaching down to the seabed. Editable in the island builder (Smooth) and `npm run island -- <id> ground <i> --smooth 0`.
- **Colours by zone** (`fieldGround.ts`, `terrain.json › draw`): each ground's own top colours mottled on the flat, its slope colours (`palette.json › grounds › slope`, else `side`) in height bands on slopes, each style's `wet` band at the waterline. Ground edges blend over 2 units with 0.6 units of jitter.
- **Budget kept:** cells deep inside faceted pieces and wholly under 0.9 units of (opaque) sea are not drawn. Ground triangles on the game's sea: High 615k, Medium 160k, Low 73k, against #268's 620k, 159k and 73k.

## Consequences

- Building every field of the sea takes about 0.4 s more (1.7 s in all on a laptop); a worker can come later if devices need it (#278).
- The coast check (#273) still has to prove the tolerance on every island; the smoothing tests already keep land above and sea below 0 past half a unit either side of the coast.
- Which landmark shapes are faceted is data: the first set (stacks, Fogwatch's bands, the Smoulder and Emberhold cones, Sunreach's rim summits, Stonehaven's cliff, Rimewick's fjord walls, bergs) is for the art review to adjust.
