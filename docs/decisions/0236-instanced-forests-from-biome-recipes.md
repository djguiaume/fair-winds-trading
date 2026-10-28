# 0236. Instanced forests from biome recipes

**Status:** Proposed (2026-10-28).

## Context

The new look (decision [0222](0222-a-new-look-smooth-terrain-blue-water-and-forests.md), issue #275) wants dense, readable woods on the smooth ground, with each sea's own trees (art direction, [new look §3](../reviews/art-direction/new-look/README.md)), towns kept visible, and counts that each quality level can afford. The classic woods scatter seeded candidates from one running generator and merge every tree into the town mesh: a forest is many triangles in one big draw, a level change rebuilds it, and one edit anywhere moves every tree.

## Decision

- **Data:** `src/data/forests.json` (`src/data/forests.ts`): tree kinds (a prop recipe built once with fixed `vars`, a size range, tints), island style → biome, and per biome its cover, lowest height, steepest slope and its mix (kinds with a weight and a height band as shares of the island's top). Clearances, grid spacing, clump noise and per-quality `share` and `shadows` live there too. Island files add only `woods.density` (× the biome's cover, 0 = none); woods off (`tries` 0) grow no forest, painted woods (`areas`) are grown thick, elsewhere the noise grows clumps over the biome's share of the free ground.
- **Placement** (`src/sim/forest.ts`, no renderer): one candidate per grid cell in the file's frame, every number from a hash of the island's seed and the cell (`src/sim/noise.ts`), so a tree depends only on the ground round it. Trees keep to the woods' area and paint, off the beach (`minHeight`), steep ground (`maxSlope`), grounds that carry none, the town's clear ground and the harbour camera's line to each house. `replantRegion` redoes only a sculpt edit's region and matches a full planting.
- **Clear ground:** the town notes it as it builds (`townProps` with `clearings`): 1.5 house widths round houses, each prop's own clear radius, fields, the arrival pier's strip; the forest adds lanes, paths, stairs, piers, build spots and the woods' painted clearings.
- **Drawing** (`src/render/models/forest.ts`): per island one `InstancedMesh` per kind in the island's batch, culled with its bounds, the shared land material, a tint per tree. Trees are stored by rank: a quality level draws the first `share` (Low 45%, Medium 70%, High and Ultra all), and its `shadows` switch casting; changing level only sets counts.
- Only the new look (`?look=v2`) grows forests; the classic look keeps its woods.

## Consequences

- Whole game map at level 2, High: 801 trees, 17 draws (1 or 2 per wooded island), 16k triangles, 59 KB of instance data; Low 380 trees, 7.5k triangles. The trees leave the merged town mesh.
- `npm run island -- <id> --forest [--level n]` reports an island's trees by kind and per quality level; `woods --density d` and the island builder's Forest density set it.
- The island builder still previews the classic look; its new-look preview (#271) calls `replantRegion` after each edit.
- East grows no trees (cover 0): heather and walls stay props. A biome needs a cover above 0 and at least one kind.
