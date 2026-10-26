# 0222. A new look: smooth terrain, blue water and forests

**Status:** Accepted for direction (2026-10-26, Guillaume on mockup v2: "Yes that's exactly the direction we want"). Planned as v1.2. Each island's final look is still approved from screenshots (art director, then Guillaume).

## Context

Decision [0221](0221-an-ultra-quality-level-for-desktop-and-xbox.md) planned an Ultra level for desktop and Xbox, with terrain work later. Guillaume then sent more *Traffic Architect* screenshots ("smooth ground, real-like terrain") and found the first mockup "not quite" there. A second mockup in the real game ([docs/reviews/desktop-graphics](../reviews/desktop-graphics/README.md#mockup-v2-the-approved-direction), page script, no game code changed) did this:

- rebuilt each island's ground as one smooth heightfield from its existing terrain (the island mesh rasterised to a height grid, blurred, low noise added), with the ground under towns kept at its terrace height so houses sit;
- let the ground slope gently into the sea instead of a step;
- coloured the ground by height and slope (sand, wet sand, grass with soft patches, beige earth on slopes);
- planted dense instanced woods (pines and broadleaf on the ring, broadleaf in the south) away from the town;
- coloured the water from the seabed depth (light blue at the coast, darker offshore) with softer foam, Fresnel sky reflection and a sun glint;
- added a light haze toward the horizon.

Guillaume approved that direction and asked whether it changes every quality level.

## Decision

1. **v1.2, "a new look"**, is this mockup made real, on **every quality level**: the ground shape, water colour and forests are content, not effects, so phones and desktops show the same game. Levels only change detail:

   | Level | Ground grid | Trees | Effects |
   | --- | --- | --- | --- |
   | Low, Medium | Coarser (about 2 units) | Fewer | No shadow map |
   | High | Full (about 1 unit) | Full | Soft shadows |
   | Ultra (0221) | Full | Most | Shadows, ambient occlusion, haze |

2. **Island data stays.** Island files, the island builder and `npm run island` keep their shapes (plateaus, mountains, ramps, woods, spots). Only the step that turns them into a mesh changes: shapes → height grid → smoothing → mesh, in one shared module the game, the island builder and the sea editor all use. Smoothing amounts, ground colours per biome, tree recipes, densities and water colours live in data (`palette.json`, `tuning.json`, props).
3. **The coast the player sees is the coast the sim uses.** The smoothed shoreline must stay within a small tolerance of the sim's land outline (grounding, docking at berths, reefs, shallows, the chart). The map checks (`npm run check`) gain a test for it.
4. **Water** is coloured from a seabed depth texture built from the same height grids (it replaces the shore-distance tint), on all levels; each sea keeps its own tint (tropical south lighter, north colder, east greyer).
5. **Biomes:** fire (black sand, lava, moss), ice (snow, ice shelves) and fog (turf, sea stacks) get their own ground colours and tree mixes; sea stacks, cliffs and rocks that must stay sharp stay as faceted props on top of the smooth ground.
6. **Art bible:** rule 1's "flat shading" no longer applies to terrain and water (models, houses, boats and trees stay flat-shaded); §2's sea colour moves from turquoise to depth-coloured blue. Updated in the art bible with this ADR.

## Consequences

- Effort about 7 to 9 weeks: terrain module and editors 2 to 3, coast alignment and checks 1, water 1, forests 1 to 2, biomes and the island-by-island review 2. The Ultra lighting of 0221 stays in v1.1; its "depth colour" water step moves here, v1.1 keeps only the sky reflection and softer foam.
- Triangles go up: the smooth ground is denser than today's islands. Low and Medium use the coarser grid and fewer trees; `?bench` on the old tablet decides the grid size before release.
- Every screenshot of islands in the docs goes stale once v1.2 lands.
- The mockup scripts (`graphics-desktop/mockup-v2-terrain.js` and `prototype-fx.js` in the project files) are the reference for the build thread, not code to ship.
