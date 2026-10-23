# 0108. Build woodland geometry only for accepted trees

**Status:** Implemented for review (2026-10-23). Extends [0103](0103-local-island-rendering.md) and [0106](0106-island-builder-ground-lanes-woods.md).

## Context

Town growth still pauses while the changed island is rebuilt. Inspection found the woodland scatter built and painted a complete tree for every candidate before checking water, rock, spacing, homes, lanes, props, fields and painted clearings. The shipped island files request 1,100 to 2,600 attempts each, although only a small fraction survive. Rejected geometry never contributes to the image, but its allocations, transforms, colours and normals consume CPU time and create garbage during every growth, initial build and editor preview.

## Decision

- Split woodland models into inexpensive preparation and geometry construction. Preparation consumes the same seeded size and leaf-colour draws in the original order, before the candidate yaw is drawn. Construct geometry only after all placement checks accept the candidate.
- Keep the shared model catalogue authoritative for the editor and renderer; model types and scatter attempts still come from island data. There are no island-specific exceptions, new tuning constants, persistent caches or prebuilt future settlement levels.
- Keep `woodlandTree` as an immediate-building API for existing callers. The woodland scatter catalogue now returns prepared builders. Each constructed tree owns fresh geometry, disposed with its normal island/editor lifetime.
- Preserve terrain generation, levels, slopes, quarry transitions, candidate spacing and occupied-land clearing exactly. No work is deferred to another frame.

## Validation

- Existing golden hashes cover every shipped island at all four levels; local island rendering and slopes tests check transformed output, growth, edited designs, stable terrain and disposal.
- Allocation regression checks exercise pine, fir and broadleaf models: every candidate is prepared, only accepted trees allocate geometry, and an in-place editor clearing takes effect immediately without allocating any woodland trees.
- A paired local Node CPU microbenchmark compared the previous and updated builders in one process, five runs per island at level 2. Median generation times were Calda 132.8 → 33.4 ms, Saltmere 63.1 → 20.5 ms, Westholm 50.6 → 11.4 ms and South Cay 59.4 → 12.0 ms (68–80% less builder CPU). These include terrain, props, woods and underside trimming, but exclude world transforms, batching, browser rendering and GPU upload. The existing browser performance scenarios remain the end-to-end check; these numbers are not device FPS claims.

## Consequences

The game avoids doing expensive work that would immediately be discarded. This does not eliminate all growth costs: accepted trees, terrain, buildings, batching and GPU uploads still need work. Device frame-time measurements remain necessary; a CPU builder microbenchmark is not a GPU or tablet result.
